package expo.modules.tvmedia

import android.app.ActivityManager
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import androidx.core.app.NotificationCompat
import org.json.JSONArray
import org.json.JSONObject

/**
 * Guide reminders with the app closed (issue #263, DECISIONS.md#d-222): one system alarm per reminder, which posts a
 * notification when the programme starts. JS hands over the whole list, already translated, whenever it changes
 * (src/tv/reminderAlarms.ts); the list is kept here too, so the alarms come back after a restart of the phone.
 * While the app is in front, its own popup shows the reminder and the alarm stays silent.
 *
 * On a TV the alarm opens the app instead (issue #309, DECISIONS.md#d-238): TV launchers show notifications poorly. Android
 * lets an app open itself from the background only with "Display over other apps"; without it, the notification is
 * posted as on the phone.
 */
object ReminderAlarms {
  private const val PREFERENCES = "tv-media-reminders"
  private const val KEY_LIST = "list"
  private const val KEY_CHANNEL = "channel"
  const val CHANNEL_ID = "reminders"
  const val EXTRA_ID = "expo.modules.tvmedia.REMINDER_ID"

  /** `list`: JSON `[{ id, startMs, title, text }]`; `channelName`: the notification channel's name in the app language. */
  fun schedule(context: Context, list: String, channelName: String) {
    val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
    val wanted = parse(list).filter { it.optLong("startMs") > System.currentTimeMillis() }
    val wantedIds = wanted.map { it.getString("id") }.toSet()
    // Reminders taken off the list (dismissed, cancelled, watched): no alarm and no notification left behind.
    for (old in parse(preferences.getString(KEY_LIST, null))) {
      val id = old.optString("id")
      if (id in wantedIds) continue
      alarms(context).cancel(alarmIntent(context, old))
      notifications(context).cancel(id, 0)
    }
    preferences.edit().putString(KEY_LIST, JSONArray(wanted).toString()).putString(KEY_CHANNEL, channelName).apply()
    for (reminder in wanted) setAlarm(context, reminder)
  }

  /** After a restart of the phone (alarms do not survive it) or an app update. */
  fun restore(context: Context) {
    val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
    for (reminder in parse(preferences.getString(KEY_LIST, null))) {
      if (reminder.optLong("startMs") > System.currentTimeMillis()) setAlarm(context, reminder)
    }
  }

  fun notify(context: Context, intent: Intent) {
    val id = intent.getStringExtra(EXTRA_ID) ?: return
    if (inFront(context)) return
    val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
    val reminder = parse(preferences.getString(KEY_LIST, null)).firstOrNull { it.optString("id") == id } ?: return
    // Opens the app, which shows the reminder's popup with Watch (it still shows 10 minutes after the start, D-184).
    val launch = context.packageManager.getLeanbackLaunchIntentForPackage(context.packageName)
      ?: context.packageManager.getLaunchIntentForPackage(context.packageName)
    launch?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
    if (isTv(context) && launch != null && canOpenOverOtherApps(context)) {
      try {
        context.startActivity(launch)
        return
      } catch (_: Exception) {
        // Refused after all: the notification below is all there is.
      }
    }
    val manager = notifications(context)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val name = preferences.getString(KEY_CHANNEL, null) ?: "Reminders"
      manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, name, NotificationManager.IMPORTANCE_HIGH))
    }
    val open = launch?.let {
      PendingIntent.getActivity(context, id.hashCode(), it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }
    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_popup_reminder)
      .setContentTitle(reminder.optString("title"))
      .setContentText(reminder.optString("text"))
      .setCategory(NotificationCompat.CATEGORY_REMINDER)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setAutoCancel(true)
      .setContentIntent(open)
      // The programme is no news once its reminder would no longer show in the app.
      .setTimeoutAfter(10 * 60_000L)
      .build()
    try {
      manager.notify(id, 0, notification)
    } catch (_: SecurityException) {
      // Notifications not allowed (Android 13+): the app's own popup is all there is.
    }
  }

  /** A TV (Android TV, Google TV): the alarm opens the app rather than notify (issue #309). */
  fun isTv(context: Context): Boolean = context.packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK)

  /** "Display over other apps", which lets the app open itself when a reminder starts (Android 10+ asks for it). */
  fun canOpenOverOtherApps(context: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)

  /** Opens the system screen that allows it; false when this TV has none (some leave it out). */
  fun openOverOtherAppsSettings(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return false
    val intents = listOf(
      Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${context.packageName}")),
      Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION),
    )
    for (intent in intents) {
      try {
        context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        return true
      } catch (_: Exception) {
        // Not on this TV: try the next.
      }
    }
    return false
  }

  private fun setAlarm(context: Context, reminder: JSONObject) {
    val at = reminder.getLong("startMs")
    val pending = alarmIntent(context, reminder)
    val manager = alarms(context)
    // Exact when the system allows it; otherwise within a minute of the start.
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || manager.canScheduleExactAlarms()) {
      manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending)
    } else {
      manager.setWindow(AlarmManager.RTC_WAKEUP, at, 60_000L, pending)
    }
  }

  private fun alarmIntent(context: Context, reminder: JSONObject): PendingIntent {
    val id = reminder.optString("id")
    val intent = Intent(context, ReminderReceiver::class.java).setAction(ACTION).putExtra(EXTRA_ID, id)
    return PendingIntent.getBroadcast(context, id.hashCode(), intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }

  private fun inFront(context: Context): Boolean {
    val processes = (context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager).runningAppProcesses ?: return false
    return processes.any {
      it.pid == Process.myPid() && it.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
    }
  }

  private fun parse(json: String?): List<JSONObject> {
    if (json.isNullOrEmpty()) return emptyList()
    return try {
      val array = JSONArray(json)
      (0 until array.length()).map { array.getJSONObject(it) }
    } catch (_: Exception) {
      emptyList()
    }
  }

  private fun alarms(context: Context) = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
  private fun notifications(context: Context) = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  const val ACTION = "expo.modules.tvmedia.REMINDER"
}

/** A reminder's alarm went off, or the phone restarted (alarms are lost then). */
class ReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      ReminderAlarms.ACTION -> ReminderAlarms.notify(context, intent)
      Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED -> ReminderAlarms.restore(context)
    }
  }
}
