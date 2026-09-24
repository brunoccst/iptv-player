package expo.modules.tvmedia

import android.app.Notification
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.util.Log
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.offline.Download
import androidx.media3.exoplayer.offline.DownloadManager
import androidx.media3.exoplayer.offline.DownloadNotificationHelper
import androidx.media3.exoplayer.offline.DownloadService
import androidx.media3.exoplayer.scheduler.Scheduler

/** Foreground service that runs Media3 downloads with a progress notification. */
@androidx.annotation.OptIn(UnstableApi::class)
class TvDownloadService : DownloadService(
  NOTIFICATION_ID,
  DEFAULT_FOREGROUND_NOTIFICATION_UPDATE_INTERVAL,
  DownloadCenter.CHANNEL_ID,
  R.string.tv_media_download_channel,
  0,
) {
  override fun getDownloadManager(): DownloadManager {
    DownloadCenter.init(this)
    return DownloadCenter.downloadManager
  }

  override fun getScheduler(): Scheduler? = null

  // Android kills the app if a service started with startForegroundService() is not in the foreground within
  // seconds (seen on a busy emulator when Media3 restarts the service). Go foreground first; Media3 then
  // updates or removes the same notification.
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    try {
      val notification = getForegroundNotification(mutableListOf(), 0)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
    } catch (error: Exception) {
      // Not allowed from the background on Android 12+ when started with plain startService(); Media3 handles it.
      Log.w("TvDownloadService", "early startForeground skipped: ${error.message}")
    }
    return super.onStartCommand(intent, flags, startId)
  }

  override fun getForegroundNotification(downloads: MutableList<Download>, notMetRequirements: Int): Notification =
    DownloadNotificationHelper(this, DownloadCenter.CHANNEL_ID)
      .buildProgressNotification(this, android.R.drawable.stat_sys_download, null, null, downloads, notMetRequirements)

  companion object {
    private const val NOTIFICATION_ID = 4101
  }
}
