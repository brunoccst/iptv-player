package expo.modules.tvmedia

import java.math.BigDecimal
import java.math.BigInteger
import java.util.Calendar

/**
 * A movie or series entry as the library saves it: the columns of a library's items table (`sqlLibrary.ts`, `_r`).
 * Null fields are saved as NULL.
 */
internal class SavedEntry(
  val streamId: String,
  val name: String,
  val categoryId: String?,
  val posterUrl: String?,
  val rating: Double?,
  val addedAt: Long?,
  val released: Long?,
  val containerExtension: String?,
  val tmdbId: String?,
  val releaseYear: Long?,
)

/**
 * Movie and series entries read here instead of in JavaScript, so a list goes from the download straight into the
 * library database (D-135). Each field comes out exactly as the JavaScript reads it: `looseJson.ts` (`str`, `num`,
 * `unixTime`), `xtream.ts` (`readMovieSummary`, `readSeriesSummary`), `directApiClient.ts` (the dates) and
 * `pipeline.ts` (`savedItem`, `tmdbId`, `releaseKey`, `parseYear`). Change them together.
 */
internal object ListItems {
  /** Entries of a batch from [JsonArraySplitter] (whole entries joined by commas); throws on text that is not JSON. */
  fun read(batch: String, kind: String, out: (SavedEntry) -> Unit) {
    val json = Json(batch)
    json.skipSpace()
    while (!json.atEnd()) {
      val value = json.value(topLevel = true)
      if (value is Map<*, *>) entry(value, kind)?.let(out)
      json.skipSpace()
      if (json.atEnd()) break
      json.expect(',')
      json.skipSpace()
    }
  }

  /** One entry, or null when the JavaScript skips it (no id, no name). */
  fun entry(item: Map<*, *>, kind: String): SavedEntry? {
    val movie = kind == "movie"
    val id = str(item, if (movie) "stream_id" else "series_id") ?: return null
    val name = str(item, "name") ?: return null
    val releaseDate = if (movie) null else str(item, "releaseDate") ?: str(item, "release_date")
    val tmdb = str(item, "tmdb") ?: str(item, "tmdb_id")
    return SavedEntry(
      streamId = id,
      name = name,
      categoryId = str(item, "category_id"),
      posterUrl = str(item, if (movie) "stream_icon" else "cover"),
      rating = num(item, "rating"),
      addedAt = unixSeconds(item, if (movie) "added" else "last_modified"),
      released = releaseKey(releaseDate),
      containerExtension = if (movie) str(item, "container_extension") else null,
      tmdbId = tmdb?.takeIf { DIGITS.matches(it) && it.any { c -> c in '1'..'9' } },
      releaseYear = parseYear(releaseDate?.take(4)),
    )
  }

  /** A JSON number as it was written: JavaScript turns it into a double first. */
  class Number(val text: String)

  /** An array or object inside an entry: no field the library reads is one. */
  private object Nested

  /** `str` in looseJson.ts: strings, numbers and booleans as trimmed text; blank and anything else are null. */
  fun str(item: Map<*, *>, name: String): String? {
    val text = when (val field = item[name]) {
      is String -> field
      is Number -> jsString(field.text.toDouble())
      is Boolean -> if (field) "1" else "0"
      else -> null
    }
    return text?.let(::jsTrim)?.takeIf { it.isNotEmpty() }
  }

  /** `num` in looseJson.ts: `Number(text)`, when finite; -0 is saved as 0, as JavaScript sends it. */
  fun num(item: Map<*, *>, name: String): Double? = str(item, name)?.let(::jsNumber)?.takeIf { it.isFinite() }?.plus(0.0)

  /**
   * `unixTime` in looseJson.ts, then back to seconds (`directApiClient.ts`): digits only, above zero. JavaScript
   * cannot make a date beyond 8.64e12 s (it fails); those are null here.
   */
  fun unixSeconds(item: Map<*, *>, name: String): Long? {
    val text = str(item, name) ?: return null
    if (!DIGITS.matches(text)) return null
    val seconds = text.toDouble()
    return if (seconds > 0 && seconds <= MAX_DATE_SECONDS) seconds.toLong() else null
  }

  /** `releaseKey(releaseDate, null)` in pipeline.ts: yyyymmdd from a date that starts "2021-3-04", else null. */
  fun releaseKey(releaseDate: String?): Long? {
    val match = DATE.find(releaseDate ?: return null) ?: return null
    val (year, month, day) = match.destructured
    if (parseYear(year) == null) return null
    val m = month.toInt()
    val d = day.toInt()
    if (m !in 1..12 || d !in 1..31) return null
    return year.toLong() * 10000 + m * 100 + d
  }

  /** `parseYear` in parser.ts: "1999" to "(1999)", from 1900 to next year. */
  fun parseYear(value: String?): Long? {
    val text = jsTrim(value ?: return null)
    if (text.length < 4 || text.length > 6 || !YEAR.matches(text)) return null
    val year = text.trim('(', ')', ' ').toLong()
    return if (year >= 1900 && year <= Calendar.getInstance().get(Calendar.YEAR) + 1) year else null
  }

  /** `Number(text)` in JavaScript for trimmed text: decimal, 0x/0o/0b, or Infinity; NaN for anything else. */
  fun jsNumber(text: String): Double {
    if (DECIMAL.matches(text)) return text.toDouble()
    if (INFINITY.matches(text)) return if (text.startsWith('-')) Double.NEGATIVE_INFINITY else Double.POSITIVE_INFINITY
    val radix = RADIX.matchEntire(text) ?: return Double.NaN
    val base = when (radix.groupValues[1].lowercase()) {
      "x" -> 16
      "o" -> 8
      else -> 2
    }
    return BigInteger(radix.groupValues[2], base).toDouble()
  }

  /** `String(number)` in JavaScript: the shortest digits, plain from 1e-7 to below 1e21, else with an exponent. */
  fun jsString(value: Double): String {
    if (value == 0.0) return "0"
    if (value.isInfinite()) return if (value > 0) "Infinity" else "-Infinity"
    if (value == Math.rint(value) && Math.abs(value) < 9.007199254740992E15) return value.toLong().toString()
    val exact = BigDecimal(value.toString()).stripTrailingZeros()
    val digits = exact.unscaledValue().abs().toString()
    // The number is 0.digits × 10^point.
    val point = digits.length - exact.scale()
    val sign = if (value < 0) "-" else ""
    return when {
      point in 1..21 ->
        sign + if (digits.length <= point) digits + "0".repeat(point - digits.length)
        else digits.substring(0, point) + "." + digits.substring(point)
      point in -5..0 -> sign + "0." + "0".repeat(-point) + digits
      else -> {
        val exponent = point - 1
        sign + digits[0] + (if (digits.length > 1) "." + digits.substring(1) else "") +
          "e" + (if (exponent > 0) "+" else "-") + Math.abs(exponent)
      }
    }
  }

  /** `String.prototype.trim` in JavaScript: its whitespace and line ends, which differ from Kotlin's. */
  fun jsTrim(text: String): String {
    var start = 0
    var end = text.length
    while (start < end && isJsSpace(text[start])) start++
    while (end > start && isJsSpace(text[end - 1])) end--
    return if (start == 0 && end == text.length) text else text.substring(start, end)
  }

  private fun isJsSpace(c: Char) =
    c in '\u0009'..'\u000D' || c == ' ' || c == ' ' || c == ' ' || c in ' '..' ' ||
      c == ' ' || c == ' ' || c == ' ' || c == ' ' || c == '　' || c == '﻿'

  private const val MAX_DATE_SECONDS = 8.64e12
  private val DIGITS = Regex("[0-9]+")
  private val YEAR = Regex("\\(?[0-9]{4}\\)?")
  private val DATE = Regex("^\\s*([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})")
  private val DECIMAL = Regex("[+-]?([0-9]+\\.?[0-9]*|\\.[0-9]+)([eE][+-]?[0-9]+)?")
  private val INFINITY = Regex("[+-]?Infinity")
  private val RADIX = Regex("0([xXoObB])([0-9a-fA-F]+)")

  /** Just enough JSON for entries: strings, numbers (as written), true/false/null; nested values are skipped. */
  private class Json(private val text: String) {
    private var at = 0

    fun atEnd() = at >= text.length

    fun skipSpace() {
      while (at < text.length && (text[at] == ' ' || text[at] == '\n' || text[at] == '\r' || text[at] == '\t')) at++
    }

    fun expect(c: Char) {
      if (at >= text.length || text[at] != c) fail()
      at++
    }

    fun value(topLevel: Boolean = false): Any? {
      skipSpace()
      if (at >= text.length) fail()
      return when (text[at]) {
        '{' -> if (topLevel) obj() else { skipNested(); Nested }
        '[' -> { skipNested(); Nested }
        '"' -> string()
        't' -> literal("true", true)
        'f' -> literal("false", false)
        'n' -> literal("null", null)
        else -> number()
      }
    }

    private fun obj(): Map<String, Any?> {
      val fields = HashMap<String, Any?>()
      at++
      skipSpace()
      if (at < text.length && text[at] == '}') {
        at++
        return fields
      }
      while (true) {
        skipSpace()
        if (at >= text.length || text[at] != '"') fail()
        val key = string()
        skipSpace()
        expect(':')
        fields[key] = value()
        skipSpace()
        if (at >= text.length) fail()
        if (text[at] == ',') {
          at++
          continue
        }
        expect('}')
        return fields
      }
    }

    private fun string(): String {
      at++
      var plain = at
      var out: StringBuilder? = null
      while (true) {
        if (at >= text.length) fail()
        val c = text[at]
        when {
          c == '"' -> {
            val result = out?.append(text, plain, at)?.toString() ?: text.substring(plain, at)
            at++
            return result
          }
          c == '\\' -> {
            val builder = out ?: StringBuilder().also { out = it }
            builder.append(text, plain, at)
            if (at + 1 >= text.length) fail()
            when (val escaped = text[at + 1]) {
              '"', '\\', '/' -> builder.append(escaped)
              'b' -> builder.append('\b')
              'f' -> builder.append('\u000C')
              'n' -> builder.append('\n')
              'r' -> builder.append('\r')
              't' -> builder.append('\t')
              'u' -> {
                if (at + 6 > text.length) fail()
                val hex = text.substring(at + 2, at + 6)
                if (!hex.all { it in '0'..'9' || it in 'a'..'f' || it in 'A'..'F' }) fail()
                val code = hex.toInt(16)
                builder.append(code.toChar())
                at += 4
              }
              else -> fail()
            }
            at += 2
            plain = at
          }
          c < ' ' -> fail()
          else -> at++
        }
      }
    }

    private fun number(): Number {
      val start = at
      if (at < text.length && text[at] == '-') at++
      while (at < text.length && (text[at].isAsciiDigit() || text[at] in ".eE+-")) at++
      val written = text.substring(start, at)
      if (!NUMBER.matches(written)) fail()
      return Number(written)
    }

    private fun literal(word: String, value: Any?): Any? {
      if (!text.startsWith(word, at)) fail()
      at += word.length
      return value
    }

    /** Skips an array or object, strings included. */
    private fun skipNested() {
      var depth = 0
      while (at < text.length) {
        when (text[at]) {
          '{', '[' -> depth++
          '}', ']' -> if (--depth == 0) {
            at++
            return
          }
          '"' -> {
            string()
            continue
          }
        }
        at++
      }
      fail()
    }

    private fun Char.isAsciiDigit() = this in '0'..'9'

    private fun fail(): Nothing = throw IllegalArgumentException("not JSON near character $at")

    companion object {
      private val NUMBER = Regex("-?(0|[1-9][0-9]*)(\\.[0-9]+)?([eE][+-]?[0-9]+)?")
    }
  }
}
