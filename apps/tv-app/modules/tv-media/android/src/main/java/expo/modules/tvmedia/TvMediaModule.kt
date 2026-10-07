package expo.modules.tvmedia

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioManager
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.Process
import android.provider.Settings
import android.view.WindowManager
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

  private val pairing = PairingServer("/pair") { id, body -> sendEvent("onPairingRequest", mapOf("id" to id, "body" to body)) }
  private val remote = PairingServer("/remote") { id, body -> sendEvent("onRemoteRequest", mapOf("id" to id, "body" to body)) }

  override fun definition() = ModuleDefinition {
    Name("TvMedia")
    Events("onDownloadsChanged", "onPairingRequest", "onRemoteRequest", "onUpdateProgress", "onWatchNextOpen")

    OnCreate {
      // First, so a native crash from here on is in the next run's Log (D-113).
      CrashLog.install(context)
      DownloadCenter.init(context)
      DownloadCenter.addListener(downloadsListener)
    }

    // A title chosen in the home screen's "Continue watching" row while the app runs (D-147).
    OnNewIntent { intent ->
      WatchNext.take(intent)?.let { sendEvent("onWatchNextOpen", mapOf("id" to it)) }
    }

    OnDestroy {
      DownloadCenter.removeListener(downloadsListener)
      pairing.stop()
      remote.stop()
    }

    /**
     * Provider lists read on a background thread (D-115): `openList` resolves with `{ id, status }`, `readList` with
     * the next batch of whole entries (then the end), `closeList` stops and frees the download. `save` ("movie:lib1_r",
     * else empty): the list is saved into that library items table instead, and only its end comes back (D-135).
     */
    AsyncFunction("openList") {
      url: String,
      headers: Map<String, String>,
      timeoutMs: Int,
      batchChars: Int,
      guideFromMs: Double,
      guideToMs: Double,
      save: String,
      promise: Promise,
      ->
      val target = ListReader.save(context, save)
      ListReader.open(url, headers, timeoutMs, batchChars, guideFromMs.toLong(), guideToMs.toLong(), target, promise)
    }

    AsyncFunction("readList") { id: Int, promise: Promise ->
      ListReader.next(id, promise)
    }

    Function("closeList") { id: Int ->
      ListReader.close(id)
    }

    /** SHA-1 hex digests of texts separated by "\n", one after another (title ids, D-118). */
    AsyncFunction("sha1Batch") { texts: String ->
      Sha1Batch.hash(texts)
    }

    /** The library database (D-121): statements with rows of parameters, all in one transaction (JSON). */
    AsyncFunction("dbRun") { statements: String, promise: Promise ->
      LibraryDb.run(context, statements, promise)
    }

    /** The rows of a query as a JSON array of arrays; `params` is a JSON array (D-121). */
    AsyncFunction("dbQuery") { sql: String, params: String, promise: Promise ->
      LibraryDb.query(context, sql, params, promise)
    }

    /** The native crash of the last run (stack trace), once; null when it ended normally (D-113). */
    Function("takeLastCrash") {
      CrashLog.takeLastCrash(context)
    }

    /** Java heap limit and use, the device's RAM (MB), for the Log (D-113). */
    Function("memoryInfo") {
      CrashLog.memoryInfo(context)
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
     * Remote play, TV side (DECISIONS.md#d-061): a server that stays up while the app runs, on the first free port of
     * `ports` (a fixed range, so paired phones find it again). Returns host and port.
     */
    Function("startRemote") { ports: List<Int> ->
      remote.start(ports) - "key"
    }

    Function("respondRemote") { id: String, status: Int, body: String ->
      remote.respond(id, status, body)
    }

    Function("stopRemote") {
      remote.stop()
    }

    /** 32 random bytes (SecureRandom), base64: keys for remote play. */
    Function("randomKey") {
      PairingServer.randomKey()
    }

    /** The name the user gave the device (Settings), else its model. Shown on the phone ("Playing on …"). */
    Function("deviceName") {
      android.provider.Settings.Global.getString(context.contentResolver, "device_name")
        ?: android.os.Build.MODEL
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
        // No title: Android shows its own "Open with", in the device language.
        activity.startActivity(Intent.createChooser(intent, null))
        "chooser"
      } else {
        activity.startActivity(intent)
        "opened"
      }
    }

    /**
     * Account menu → Close the app: like "Force stop" in the system settings. Removes the app from the recent apps and
     * ends its process (downloads in progress stop too), so the next start is a fresh one.
     */
    AsyncFunction("closeApp") {
      appContext.currentActivity?.finishAndRemoveTask()
      // A moment for the task to go away first, then end the process.
      Handler(Looper.getMainLooper()).postDelayed({ Process.killProcess(Process.myPid()) }, 300)
    }.runOnQueue(Queues.MAIN)

    /**
     * Phone player (issue #184, D-155): the screen brightness of the app's window, 0–1. While the app sets none it is
     * the system's (its 0–255 setting).
     */
    Function("brightness") {
      val own = appContext.currentActivity?.window?.attributes?.screenBrightness ?: -1f
      if (own >= 0f) own.toDouble()
      else Settings.System.getInt(context.contentResolver, Settings.System.SCREEN_BRIGHTNESS, 128) / 255.0
    }

    /** Sets the window's brightness (at least 1 %, so the screen never goes black); below 0 gives it back to the system. */
    AsyncFunction("setBrightness") { level: Double ->
      appContext.currentActivity?.window?.let { window ->
        val attributes = window.attributes
        attributes.screenBrightness =
          if (level < 0) WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE else level.coerceIn(0.01, 1.0).toFloat()
        window.attributes = attributes
      }
    }.runOnQueue(Queues.MAIN)

    /** Phone player (issue #184, D-155): the media volume, 0–1. */
    Function("volume") {
      val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      audio.getStreamVolume(AudioManager.STREAM_MUSIC).toDouble() / audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
    }

    /** Sets the media volume to the nearest of its steps, without the system's volume panel; returns the new volume. */
    Function("setVolume") { level: Double ->
      val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      val max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
      try {
        audio.setStreamVolume(AudioManager.STREAM_MUSIC, Math.round(level.coerceIn(0.0, 1.0) * max).toInt(), 0)
      } catch (_: SecurityException) {
        // Do Not Disturb can refuse it; the volume stays as it was.
      }
      audio.getStreamVolume(AudioManager.STREAM_MUSIC).toDouble() / max
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

    /** Opens the Android installer on top of the app's screen (D-070). */
    AsyncFunction("installUpdate") { path: String ->
      AppUpdater.install(context, appContext.currentActivity, path)
    }.runOnQueue(Queues.MAIN)

    /** Home screen "Continue watching" on Android TV and Google TV (DECISIONS.md#d-147): the app's rows. */
    AsyncFunction("watchNextRows") {
      WatchNext.rows(context)
    }

    /** Inserts, updates and removes rows as src/tv/watchNext.ts planned (JSON). */
    AsyncFunction("applyWatchNext") { plan: String ->
      WatchNext.apply(context, plan)
    }

    /** The id of the row the app was started from, once. */
    Function("takeWatchNextOpen") {
      WatchNext.takeOpen(appContext.currentActivity)
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

      AsyncFunction("addSubtitle") { view: TvPlayerView, text: String, language: String, label: String ->
        view.addSubtitle(text, language, label)
      }.runOnQueue(Queues.MAIN)
    }
  }

  companion object {
    private const val STOP_REASON_PAUSED = 1
  }
}
