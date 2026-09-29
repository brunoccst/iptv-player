package expo.modules.tvmedia

/**
 * Cuts the text of a JSON array into batches of whole elements, as the text arrives (D-115). Each batch is the
 * elements joined by commas, without the brackets, so JavaScript parses it with one `JSON.parse("[" + batch + "]")`,
 * which is fast, instead of going through a 100 MB reply character by character, which took minutes on a Chromecast.
 *
 * - Whitespace outside strings is dropped (less text to hand over).
 * - Characters outside the BMP (emoji) are written as JSON escapes (`😀`): Expo hands text to JavaScript
 *   as modified UTF-8, which would garble them. JSON.parse turns the escapes back into the same characters.
 * - A reply that is not an array (an object, an error page) is kept whole.
 */
internal class JsonArraySplitter(private val batchChars: Int, private val onBatch: (String) -> Unit) {
  sealed class End {
    /** The array ended with its "]". */
    object Complete : End()

    /** Not an array: the whole text (empty for an empty reply). */
    class Whole(val text: String) : End()

    /** The text stopped before the array's "]": the start of what was left, for the error message. */
    class Incomplete(val preview: String) : End()
  }

  /** Characters read (for the log). */
  var chars = 0L
    private set

  // Before the array's "[" (0), inside it (1), after its "]" (2); a reply that is not an array (3).
  private var phase = 0
  private var depth = 0
  private var inString = false
  private var escaped = false
  private val out = StringBuilder()

  /** Feeds the next characters; false once the array has ended (the rest need not be read). */
  fun feed(chunk: CharArray, length: Int): Boolean {
    chars += length
    for (index in 0 until length) {
      val c = chunk[index]
      when (phase) {
        0 -> {
          if (isSpace(c)) continue
          if (c == '[') {
            phase = 1
          } else {
            phase = 3
            append(c)
          }
        }
        1 -> inArray(c)
        2 -> return false
        else -> append(c)
      }
    }
    return phase != 2
  }

  fun finish(): End =
    when (phase) {
      0 -> End.Whole("")
      2 -> End.Complete
      3 -> End.Whole(out.toString())
      else -> End.Incomplete(out.take(200).toString())
    }

  private fun inArray(c: Char) {
    if (inString) {
      append(c)
      if (escaped) escaped = false
      else if (c == '\\') escaped = true
      else if (c == '"') inString = false
      return
    }
    when (c) {
      '"' -> {
        inString = true
        out.append(c)
      }
      '{', '[' -> {
        depth++
        out.append(c)
      }
      '}', ']' -> {
        if (depth == 0) {
          // The array's own "]".
          if (out.isNotEmpty()) emit()
          phase = 2
        } else {
          depth--
          out.append(c)
        }
      }
      ',' -> {
        if (depth == 0 && out.length >= batchChars) emit() else out.append(c)
      }
      else -> if (!isSpace(c)) append(c)
    }
  }

  private fun emit() {
    onBatch(out.toString())
    out.setLength(0)
  }

  private fun append(c: Char) {
    if (c in '\uD800'..'\uDFFF') {
      out.append("\\u").append(HEX[c.code shr 12 and 15]).append(HEX[c.code shr 8 and 15])
        .append(HEX[c.code shr 4 and 15]).append(HEX[c.code and 15])
    } else {
      out.append(c)
    }
  }

  private companion object {
    const val HEX = "0123456789abcdef"

    fun isSpace(c: Char) = c == ' ' || c == '\n' || c == '\r' || c == '\t' || c == '﻿'
  }
}
