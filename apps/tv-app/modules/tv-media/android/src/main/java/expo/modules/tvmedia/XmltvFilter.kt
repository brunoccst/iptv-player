package expo.modules.tvmedia

import java.util.Calendar
import java.util.TimeZone

/**
 * The provider's full TV guide (XMLTV) cut into batches of whole `<programme>` elements on the download thread
 * (issue #119, D-130). A week of guide for 20,000+ channels is hundreds of MB; only the programmes that overlap
 * [fromMs, toMs) reach JavaScript, which parses them like the desktop app does.
 */
internal class XmltvFilter(
  private val batchChars: Int,
  private val fromMs: Long,
  private val toMs: Long,
  private val emit: (String) -> Unit,
) {
  private val buffer = StringBuilder()
  private val batch = StringBuilder()

  /** Characters read so far. */
  var chars = 0L
    private set

  /** Programmes seen, in the window or not. */
  var seen = 0L
    private set

  fun feed(chunk: CharArray, count: Int) {
    chars += count
    buffer.append(chunk, 0, count)
    var at = 0
    while (true) {
      val begin = buffer.indexOf(OPEN, at)
      if (begin < 0) {
        at = maxOf(at, buffer.length - OPEN.length)
        break
      }
      val end = buffer.indexOf(CLOSE, begin)
      if (end < 0) {
        at = begin
        break
      }
      at = end + CLOSE.length
      seen++
      if (inWindow(begin)) {
        batch.append(buffer, begin, at).append('\n')
        if (batch.length >= batchChars) flush()
      }
    }
    buffer.delete(0, at)
  }

  /** Hands over the last batch. */
  fun finish() {
    flush()
  }

  private fun flush() {
    if (batch.isEmpty()) return
    emit(batch.toString())
    batch.setLength(0)
  }

  /** Reads `start` and `stop` from the opening tag at [begin]; unreadable times are kept (JavaScript decides). */
  private fun inWindow(begin: Int): Boolean {
    val tagEnd = buffer.indexOf(">", begin)
    if (tagEnd < 0) return true
    val tag = buffer.substring(begin, tagEnd)
    val start = attribute(tag, "start")?.let(::parseTime) ?: return true
    val stop = attribute(tag, "stop")?.let(::parseTime) ?: return true
    return stop > fromMs && start < toMs
  }

  companion object {
    private const val OPEN = "<programme"
    private const val CLOSE = "</programme>"
    private val ATTRIBUTE = Regex("""\s(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)')""")
    private val TIME = Regex("""^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*(?:([+-])(\d{2}):?(\d{2}))?""")

    private fun attribute(tag: String, name: String): String? =
      ATTRIBUTE.findAll(tag).firstOrNull { it.groupValues[1] == name }?.let { it.groupValues[2].ifEmpty { it.groupValues[3] } }

    /** "20261003201500 +0200" → epoch ms, like `parseXmltvTime` in the shared code. */
    fun parseTime(value: String): Long? {
      val match = TIME.find(value.trim()) ?: return null
      val g = match.groupValues
      val calendar = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
      calendar.clear()
      calendar.set(g[1].toInt(), g[2].toInt() - 1, g[3].toInt(), g[4].toInt(), g[5].toInt(), g[6].ifEmpty { "0" }.toInt())
      val offset = if (g[7].isEmpty()) 0L else (if (g[7] == "-") -1 else 1) * (g[8].toLong() * 60 + g[9].toLong()) * 60_000
      return calendar.timeInMillis - offset
    }
  }
}
