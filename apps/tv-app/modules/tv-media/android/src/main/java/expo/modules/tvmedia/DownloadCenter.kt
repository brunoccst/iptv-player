package expo.modules.tvmedia

import android.content.Context
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.NoOpCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import androidx.media3.exoplayer.offline.Download
import androidx.media3.exoplayer.offline.DownloadManager
import java.io.File
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.Executors

/**
 * Process-wide Media3 download state. Cache lives in the app's private `filesDir` (no other app or user access
 * without root). Player and DownloadService share it. See DECISIONS.md#d-029.
 */
@androidx.annotation.OptIn(UnstableApi::class)
object DownloadCenter {
  const val CHANNEL_ID = "downloads"
  const val USER_AGENT = "TvMedia/1.0 (Media3)"
  private const val PREFERENCES = "tv-media"
  private const val KEY_USER_AGENT = "user-agent"

  private var initialized = false
  private val listeners = CopyOnWriteArraySet<() -> Unit>()

  lateinit var cache: SimpleCache
    private set
  lateinit var httpDataSourceFactory: DefaultHttpDataSource.Factory
    private set
  lateinit var cacheDataSourceFactory: CacheDataSource.Factory
    private set
  lateinit var downloadManager: DownloadManager
    private set

  @Synchronized
  fun init(context: Context) {
    if (initialized) return
    val app = context.applicationContext
    val database = StandaloneDatabaseProvider(app)
    cache = SimpleCache(File(app.filesDir, "offline-media"), NoOpCacheEvictor(), database)
    httpDataSourceFactory = DefaultHttpDataSource.Factory()
      .setUserAgent(savedUserAgent(app))
      .setAllowCrossProtocolRedirects(true)
    // Read-only cache view: offline playback reads downloaded data; streaming does not fill the download cache.
    cacheDataSourceFactory = CacheDataSource.Factory()
      .setCache(cache)
      .setUpstreamDataSourceFactory(httpDataSourceFactory)
      .setCacheWriteDataSinkFactory(null)
    downloadManager = DownloadManager(app, database, cache, httpDataSourceFactory, Executors.newFixedThreadPool(2)).apply {
      // One at a time: every download holds a provider connection.
      maxParallelDownloads = 1
      addListener(object : DownloadManager.Listener {
        override fun onDownloadChanged(manager: DownloadManager, download: Download, finalException: Exception?) = notifyListeners()
        override fun onDownloadRemoved(manager: DownloadManager, download: Download) = notifyListeners()
      })
    }
    initialized = true
  }

  /**
   * Providers often only answer player-like agents; direct mode talks to them without a relay (DECISIONS.md#d-038).
   * Saved so downloads resumed by the service after a restart use it before JS runs.
   */
  @Synchronized
  fun setUserAgent(context: Context, userAgent: String) {
    context.applicationContext.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).edit().putString(KEY_USER_AGENT, userAgent).apply()
    if (initialized) httpDataSourceFactory.setUserAgent(userAgent)
  }

  private fun savedUserAgent(context: Context): String =
    context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).getString(KEY_USER_AGENT, null) ?: USER_AGENT

  fun addListener(listener: () -> Unit) = listeners.add(listener)

  fun removeListener(listener: () -> Unit) = listeners.remove(listener)

  private fun notifyListeners() = listeners.forEach { it() }

  /** Completed or queued download by id, or null. */
  fun find(id: String): Download? = downloadManager.downloadIndex.getDownload(id)

  /** All downloads. In-progress entries come from `currentDownloads` because the index holds stale progress. */
  fun list(): List<Map<String, Any?>> {
    val current = downloadManager.currentDownloads.associateBy { it.request.id }
    val result = mutableListOf<Map<String, Any?>>()
    downloadManager.downloadIndex.getDownloads().use { cursor ->
      while (cursor.moveToNext()) {
        val stored = cursor.download
        result.add(toMap(current[stored.request.id] ?: stored))
      }
    }
    return result
  }

  fun toMap(download: Download): Map<String, Any?> = mapOf(
    "id" to download.request.id,
    "state" to stateName(download),
    "percent" to if (download.percentDownloaded == C.PERCENTAGE_UNSET.toFloat()) null else download.percentDownloaded.toDouble(),
    "bytesDownloaded" to download.bytesDownloaded.toDouble(),
    "metadata" to String(download.request.data, Charsets.UTF_8),
    "failureReason" to download.failureReason,
  )

  private fun stateName(download: Download): String = when (download.state) {
    Download.STATE_QUEUED -> if (download.stopReason != Download.STOP_REASON_NONE) "paused" else "queued"
    Download.STATE_STOPPED -> "paused"
    Download.STATE_DOWNLOADING -> "downloading"
    Download.STATE_COMPLETED -> "completed"
    Download.STATE_FAILED -> "failed"
    Download.STATE_REMOVING -> "removing"
    Download.STATE_RESTARTING -> "queued"
    else -> "unknown"
  }
}
