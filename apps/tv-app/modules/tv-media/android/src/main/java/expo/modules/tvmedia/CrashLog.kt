package expo.modules.tvmedia

import android.app.ActivityManager
import android.content.Context
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Native crashes in the app's Log (D-113, issue #109). An error in native code (e.g. `OutOfMemoryError` in the fetch
 * module) ends the process before JavaScript can log anything, so the last run's Log just stopped. The handler writes
 * the crash to a small file; the next start moves it into the Log. Also reports the memory the app may use.
 */
object CrashLog {
  private const val FILE = "last-crash.txt"
  private const val MAX_FRAMES = 25
  @Volatile private var installed = false

  fun install(context: Context) {
    if (installed) return
    installed = true
    val file = File(context.filesDir, FILE)
    val previous = Thread.getDefaultUncaughtExceptionHandler()
    Thread.setDefaultUncaughtExceptionHandler { thread, error ->
      try {
        // Small and simple: after an OutOfMemoryError there may be little memory left.
        val text = StringBuilder()
        val time = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
        text.append(time.format(Date())).append(" on thread ").append(thread.name).append('\n')
        var cause: Throwable? = error
        var depth = 0
        while (cause != null && depth < 4) {
          text.append(if (depth == 0) "" else "Caused by: ").append(cause.javaClass.name).append(": ").append(cause.message ?: "").append('\n')
          for (frame in cause.stackTrace.take(MAX_FRAMES)) text.append("  at ").append(frame.toString()).append('\n')
          cause = cause.cause
          depth++
        }
        file.writeText(text.toString())
      } catch (_: Throwable) {
        // Nothing more can be done here; the system's own crash handling still runs.
      }
      previous?.uncaughtException(thread, error)
    }
  }

  /** The crash of the last run, once; null when it ended normally. */
  fun takeLastCrash(context: Context): String? {
    val file = File(context.filesDir, FILE)
    if (!file.exists()) return null
    return try {
      file.readText()
    } catch (_: Throwable) {
      null
    } finally {
      file.delete()
    }
  }

  /** How much memory the app may use and the device has, in MB. */
  fun memoryInfo(context: Context): Map<String, Any> {
    val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    val memory = ActivityManager.MemoryInfo().also { activityManager.getMemoryInfo(it) }
    val runtime = Runtime.getRuntime()
    val mb = { bytes: Long -> (bytes / (1024 * 1024)).toInt() }
    return mapOf(
      "javaHeapMaxMb" to mb(runtime.maxMemory()),
      "javaHeapUsedMb" to mb(runtime.totalMemory() - runtime.freeMemory()),
      "memoryClassMb" to activityManager.memoryClass,
      "largeMemoryClassMb" to activityManager.largeMemoryClass,
      "deviceRamMb" to mb(memory.totalMem),
      "deviceFreeRamMb" to mb(memory.availMem),
      "lowRamDevice" to activityManager.isLowRamDevice,
    )
  }
}
