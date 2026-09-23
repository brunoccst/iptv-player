package expo.modules.tvmedia

import android.app.Notification
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.offline.Download
import androidx.media3.exoplayer.offline.DownloadManager
import androidx.media3.exoplayer.offline.DownloadNotificationHelper
import androidx.media3.exoplayer.offline.DownloadService
import androidx.media3.exoplayer.scheduler.Scheduler

/** Foreground service that runs Media3 downloads with a progress notification. */
@UnstableApi
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

  override fun getForegroundNotification(downloads: MutableList<Download>, notMetRequirements: Int): Notification =
    DownloadNotificationHelper(this, DownloadCenter.CHANNEL_ID)
      .buildProgressNotification(this, android.R.drawable.stat_sys_download, null, null, downloads, notMetRequirements)

  companion object {
    private const val NOTIFICATION_ID = 4101
  }
}
