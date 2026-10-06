package expo.modules.tvmedia

import android.app.Activity
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.tv.TvContract
import android.os.Build
import org.json.JSONObject

/**
 * The home screen's "Continue watching" row on Android TV and Google TV (Watch Next, DECISIONS.md#d-147). JS decides
 * what to insert, update and remove (src/tv/watchNext.ts); this reads and writes the app's own rows. A row opens the
 * app with `EXTRA_ID`, which JS takes with `takeOpen` (cold start) or the `onWatchNextOpen` event (app running).
 *
 * Column names and values are the platform's (`TvContract.WatchNextPrograms`, API 26), written out because Kotlin does
 * not reach the constants that class inherits from its column interfaces.
 */
object WatchNext {
  const val EXTRA_ID = "expo.modules.tvmedia.WATCH_NEXT_ID"

  private const val ID = "_id"
  private const val PACKAGE_NAME = "package_name"
  private const val INTERNAL_PROVIDER_ID = "internal_provider_id"
  private const val BROWSABLE = "browsable"
  private const val TYPE = "type"
  private const val TITLE = "title"
  private const val SEASON_DISPLAY_NUMBER = "season_display_number"
  private const val EPISODE_DISPLAY_NUMBER = "episode_display_number"
  private const val POSTER_ART_URI = "poster_art_uri"
  private const val POSTER_ART_ASPECT_RATIO = "poster_art_aspect_ratio"
  private const val INTENT_URI = "intent_uri"
  private const val LAST_PLAYBACK_POSITION_MILLIS = "last_playback_position_millis"
  private const val DURATION_MILLIS = "duration_millis"
  private const val WATCH_NEXT_TYPE = "watch_next_type"
  private const val LAST_ENGAGEMENT_TIME_UTC_MILLIS = "last_engagement_time_utc_millis"

  private const val TYPE_MOVIE = 0
  private const val TYPE_TV_EPISODE = 3
  private const val ASPECT_RATIO_2_3 = 4
  private const val WATCH_NEXT_TYPE_CONTINUE = 0

  /** Android 8+ TVs only; phones have no TV provider. */
  private fun supported(context: Context) =
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && context.packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK)

  /** The app's rows: `{ rowId, id, browsable, positionMs, lastEngagementMs }`. */
  fun rows(context: Context): List<Map<String, Any?>> {
    if (!supported(context)) return emptyList()
    val projection = arrayOf(ID, INTERNAL_PROVIDER_ID, BROWSABLE, LAST_PLAYBACK_POSITION_MILLIS, LAST_ENGAGEMENT_TIME_UTC_MILLIS)
    val result = mutableListOf<Map<String, Any?>>()
    context.contentResolver
      .query(TvContract.WatchNextPrograms.CONTENT_URI, projection, "$PACKAGE_NAME = ?", arrayOf(context.packageName), null)
      ?.use { cursor ->
        while (cursor.moveToNext()) {
          result += mapOf(
            "rowId" to cursor.getLong(0).toDouble(),
            "id" to if (cursor.isNull(1)) null else cursor.getString(1),
            "browsable" to (cursor.getInt(2) != 0),
            "positionMs" to cursor.getLong(3).toDouble(),
            "lastEngagementMs" to cursor.getLong(4).toDouble(),
          )
        }
      }
    return result
  }

  /** `{ insert: [entry], update: [{ rowId, entry }], remove: [rowId] }`, see `watchNextPlan` in src/tv/watchNext.ts. */
  fun apply(context: Context, plan: String) {
    if (!supported(context)) return
    val json = JSONObject(plan)
    val resolver = context.contentResolver
    json.optJSONArray("remove")?.let { remove ->
      for (i in 0 until remove.length()) resolver.delete(TvContract.buildWatchNextProgramUri(remove.getLong(i)), null, null)
    }
    json.optJSONArray("update")?.let { update ->
      for (i in 0 until update.length()) {
        val change = update.getJSONObject(i)
        resolver.update(TvContract.buildWatchNextProgramUri(change.getLong("rowId")), values(context, change.getJSONObject("entry")), null, null)
      }
    }
    json.optJSONArray("insert")?.let { insert ->
      for (i in 0 until insert.length()) resolver.insert(TvContract.WatchNextPrograms.CONTENT_URI, values(context, insert.getJSONObject(i)))
    }
  }

  private fun values(context: Context, entry: JSONObject) = ContentValues().apply {
    val id = entry.getString("id")
    val episode = entry.optString("type") == "episode"
    put(INTERNAL_PROVIDER_ID, id)
    put(WATCH_NEXT_TYPE, WATCH_NEXT_TYPE_CONTINUE)
    put(TYPE, if (episode) TYPE_TV_EPISODE else TYPE_MOVIE)
    put(TITLE, entry.getString("title"))
    if (episode && !entry.isNull("season")) put(SEASON_DISPLAY_NUMBER, entry.getInt("season").toString())
    if (episode && !entry.isNull("episode")) put(EPISODE_DISPLAY_NUMBER, entry.getInt("episode").toString())
    // The provider's poster (the launcher loads it); without one, the app icon.
    val poster = if (entry.isNull("posterUrl")) null else entry.getString("posterUrl")
    put(POSTER_ART_URI, poster ?: "android.resource://${context.packageName}/${context.applicationInfo.icon}")
    put(POSTER_ART_ASPECT_RATIO, ASPECT_RATIO_2_3)
    put(LAST_PLAYBACK_POSITION_MILLIS, entry.getLong("positionMs"))
    put(DURATION_MILLIS, entry.getLong("durationMs"))
    put(LAST_ENGAGEMENT_TIME_UTC_MILLIS, entry.getLong("lastEngagementMs"))
    put(INTENT_URI, openIntent(context, id).toUri(Intent.URI_INTENT_SCHEME))
  }

  /** Opens (or brings back) the app with the entry's id. */
  private fun openIntent(context: Context, id: String): Intent {
    val launch = context.packageManager.getLeanbackLaunchIntentForPackage(context.packageName)
      ?: context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?: Intent(Intent.ACTION_MAIN).setPackage(context.packageName)
    return launch.putExtra(EXTRA_ID, id)
  }

  /** The entry id an intent carries, removed from it so it is used once. */
  fun take(intent: Intent?): String? {
    val id = intent?.getStringExtra(EXTRA_ID) ?: return null
    intent.removeExtra(EXTRA_ID)
    return id
  }

  fun takeOpen(activity: Activity?): String? = take(activity?.intent)
}
