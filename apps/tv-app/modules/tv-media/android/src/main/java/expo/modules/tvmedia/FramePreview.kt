package expo.modules.tvmedia

import android.content.Context
import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import android.os.Build
import android.util.Base64
import expo.modules.kotlin.Promise
import java.io.ByteArrayOutputStream
import java.util.concurrent.Executors

/**
 * Progress bar preview frames (D-180). Providers ship no thumbnails, so a frame is decoded from the stream itself: one
 * `MediaMetadataRetriever` per stream, opened on the first request and kept until `close` (it holds a second connection
 * to the provider, so JS asks only when the account has one to spare). One thread: requests run one after another.
 */
object FramePreview {
  private val executor = Executors.newSingleThreadExecutor()
  private var retriever: MediaMetadataRetriever? = null
  private var openUri: String? = null

  /** Resolves a JPEG data URI of the key frame nearest `timeMs`, `width` px wide; null when the stream gives none. */
  fun frame(context: Context, uri: String, timeMs: Double, width: Int, promise: Promise) {
    executor.execute {
      try {
        val source = open(context, uri)
        val timeUs = (timeMs * 1000).toLong()
        val bitmap = if (Build.VERSION.SDK_INT >= 27) {
          source.getScaledFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST_SYNC, width, width)
        } else {
          source.getFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)?.let { full ->
            val scaled = Bitmap.createScaledBitmap(full, width, (width * full.height / full.width.coerceAtLeast(1)).coerceAtLeast(1), true)
            if (scaled !== full) full.recycle()
            scaled
          }
        }
        if (bitmap == null) {
          promise.resolve(null)
          return@execute
        }
        val bytes = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.JPEG, 75, bytes)
        bitmap.recycle()
        promise.resolve("data:image/jpeg;base64," + Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP))
      } catch (_: Throwable) {
        // A stream the retriever cannot open or seek (some containers, a refused connection): no preview.
        close()
        promise.resolve(null)
      }
    }
  }

  /** Lets go of the stream (player closed, or another title). */
  fun release() {
    executor.execute { close() }
  }

  private fun open(context: Context, uri: String): MediaMetadataRetriever {
    retriever?.let { if (openUri == uri) return it }
    close()
    val next = MediaMetadataRetriever()
    next.setDataSource(uri, mapOf("User-Agent" to DownloadCenter.savedUserAgent(context)))
    retriever = next
    openUri = uri
    return next
  }

  private fun close() {
    try {
      retriever?.release()
    } catch (_: Throwable) {
    }
    retriever = null
    openUri = null
  }
}
