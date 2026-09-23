package expo.modules.tvmedia

import android.net.Uri
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.offline.Download
import androidx.media3.exoplayer.offline.DownloadRequest
import androidx.media3.exoplayer.offline.DownloadService
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** JS entry point: player view + download functions. JS wrapper: modules/tv-media/src/index.ts. */
@UnstableApi
class TvMediaModule : Module() {
  private val context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  private val downloadsListener: () -> Unit = {
    sendEvent("onDownloadsChanged", mapOf("downloads" to DownloadCenter.list()))
  }

  override fun definition() = ModuleDefinition {
    Name("TvMedia")
    Events("onDownloadsChanged")

    OnCreate {
      DownloadCenter.init(context)
      DownloadCenter.addListener(downloadsListener)
    }

    OnDestroy {
      DownloadCenter.removeListener(downloadsListener)
    }

    Function("listDownloads") {
      DownloadCenter.list()
    }

    /** `metadata` is opaque JSON stored with the download (title, poster, ids) for the Downloads screen. */
    Function("startDownload") { id: String, uri: String, isHls: Boolean, metadata: String ->
      val request = DownloadRequest.Builder(id, Uri.parse(uri))
        .apply { if (isHls) setMimeType(MimeTypes.APPLICATION_M3U8) }
        .setData(metadata.toByteArray(Charsets.UTF_8))
        .build()
      DownloadService.sendAddDownload(context, TvDownloadService::class.java, request, true)
    }

    Function("pauseDownload") { id: String ->
      DownloadService.sendSetStopReason(context, TvDownloadService::class.java, id, STOP_REASON_PAUSED, false)
    }

    Function("resumeDownload") { id: String ->
      DownloadService.sendSetStopReason(context, TvDownloadService::class.java, id, Download.STOP_REASON_NONE, true)
    }

    Function("removeDownload") { id: String ->
      DownloadService.sendRemoveDownload(context, TvDownloadService::class.java, id, false)
    }

    View(TvPlayerView::class) {
      Events("onStatus", "onProgress", "onTracks", "onEnd", "onError")

      Prop("source") { view: TvPlayerView, source: PlayerSource? ->
        view.load(source)
      }

      Prop("paused") { view: TvPlayerView, paused: Boolean ->
        view.setPaused(paused)
      }

      AsyncFunction("seekTo") { view: TvPlayerView, positionMs: Double ->
        view.seekTo(positionMs)
      }.runOnQueue(Queues.MAIN)

      AsyncFunction("selectTrack") { view: TvPlayerView, type: String, groupIndex: Int, trackIndex: Int ->
        view.selectTrack(type, groupIndex, trackIndex)
      }.runOnQueue(Queues.MAIN)
    }
  }

  companion object {
    private const val STOP_REASON_PAUSED = 1
  }
}
