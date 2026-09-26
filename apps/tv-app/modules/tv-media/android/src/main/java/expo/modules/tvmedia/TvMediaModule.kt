package expo.modules.tvmedia

import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.offline.Download
import androidx.media3.exoplayer.offline.DownloadRequest
import androidx.media3.exoplayer.offline.DownloadService
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** JS entry point: player view + download functions. JS wrapper: modules/tv-media/src/index.ts. */
@androidx.annotation.OptIn(UnstableApi::class)
class TvMediaModule : Module() {
  private val context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  private val downloadsListener: () -> Unit = {
    sendEvent("onDownloadsChanged", mapOf("downloads" to DownloadCenter.list()))
  }

  private val pairing = PairingServer { id, body -> sendEvent("onPairingRequest", mapOf("id" to id, "body" to body)) }

  override fun definition() = ModuleDefinition {
    Name("TvMedia")
    Events("onDownloadsChanged", "onPairingRequest", "onUpdateProgress")

    OnCreate {
      DownloadCenter.init(context)
      DownloadCenter.addListener(downloadsListener)
    }

    OnDestroy {
      DownloadCenter.removeListener(downloadsListener)
      pairing.stop()
    }

    /** Phone-to-TV pairing, TV side (DECISIONS.md#d-060): starts the one-time server; returns host, port and key. */
    Function("startPairing") {
      pairing.start()
    }

    Function("respondPairing") { id: String, status: Int, body: String ->
      pairing.respond(id, status, body)
    }

    Function("stopPairing") {
      pairing.stop()
    }

    /**
     * Phone side: Google's code scanner (Play services) reads the TV's QR code. No camera permission, and the scanner
     * UI is downloaded by Play services, so the APK stays small. Resolves null when the user backs out.
     */
    AsyncFunction("scanQrCode") { promise: Promise ->
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      val options = GmsBarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_QR_CODE).build()
      GmsBarcodeScanning.getClient(activity, options).startScan()
        .addOnSuccessListener { promise.resolve(it.rawValue) }
        .addOnCanceledListener { promise.resolve(null) }
        .addOnFailureListener { promise.reject(CodedException("ERR_SCANNER", it.message ?: "Scanner not available", it)) }
    }

    Function("setUserAgent") { userAgent: String ->
      DownloadCenter.setUserAgent(context, userAgent)
    }

    /** Whether the FFmpeg audio extension is bundled and its native library loads (D-059). */
    Function("ffmpegAudioAvailable") {
      try {
        Class.forName("androidx.media3.decoder.ffmpeg.FfmpegLibrary").getMethod("isAvailable").invoke(null) as Boolean
      } catch (_: Throwable) {
        false
      }
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

    /**
     * Hands a stream to another installed video player (VLC, MX Player, Just Player, …), DECISIONS.md#d-057.
     * `headers` go in the `headers` extra (["User-Agent", "…"]), which MX Player and Just Player read. Returns "opened"
     * when a default player took it, "chooser" when the system app chooser was shown, "none" when no app can play it.
     */
    Function("openExternalPlayer") { uri: String, mimeType: String, title: String, headers: Map<String, String> ->
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      val intent = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(Uri.parse(uri), mimeType)
        putExtra("title", title)
        putExtra("headers", headers.flatMap { (name, value) -> listOf(name, value) }.toTypedArray())
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      val packageManager = activity.packageManager
      if (packageManager.queryIntentActivities(intent, 0).isEmpty()) return@Function "none"
      // Without a default app, Android resolves to its own resolver ("android"): show the chooser instead.
      val default = packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)?.activityInfo?.packageName
      if (default == null || default == "android") {
        activity.startActivity(Intent.createChooser(intent, "Open with"))
        "chooser"
      } else {
        activity.startActivity(intent)
        "opened"
      }
    }

    /** Self-update (DECISIONS.md#d-062): installed version code and name. */
    Function("installedVersion") {
      AppUpdater.installedVersion(context)
    }

    /** Downloads the update APK (progress in `onUpdateProgress`), checks its SHA-256; resolves with the file path. */
    AsyncFunction("downloadUpdate") { url: String, sha256: String? ->
      AppUpdater.download(context, url, sha256) { done, total ->
        sendEvent("onUpdateProgress", mapOf("bytes" to done.toDouble(), "total" to total.toDouble()))
      }
    }

    /** "ok", "not-newer", "other-app" or "other-key" (different signing key: Android would refuse it). */
    Function("checkUpdate") { path: String ->
      AppUpdater.check(context, path)
    }

    Function("canInstallUpdates") {
      AppUpdater.canInstall(context)
    }

    Function("openInstallSettings") {
      AppUpdater.openInstallSettings(context)
    }

    Function("installUpdate") { path: String ->
      AppUpdater.install(context, path)
    }

    /** Sign-out and account change (DECISIONS.md#d-050). */
    Function("removeAllDownloads") {
      DownloadService.sendRemoveAllDownloads(context, TvDownloadService::class.java, false)
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
