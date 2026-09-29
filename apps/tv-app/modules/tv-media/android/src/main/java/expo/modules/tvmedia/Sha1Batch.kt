package expo.modules.tvmedia

import java.security.MessageDigest

/**
 * SHA-1 of many texts at once, for title ids (D-118): in JavaScript on a TV (no JIT) it took about a minute for 110k
 * titles. `texts` are separated by "\n"; the result is their 40-character hex digests, one after another.
 */
internal object Sha1Batch {
  private const val HEX = "0123456789abcdef"

  fun hash(texts: String): String {
    val digest = MessageDigest.getInstance("SHA-1")
    val parts = texts.split('\n')
    val out = StringBuilder(parts.size * 40)
    for (part in parts) {
      for (byte in digest.digest(part.toByteArray(Charsets.UTF_8))) {
        val value = byte.toInt()
        out.append(HEX[(value shr 4) and 15]).append(HEX[value and 15])
      }
    }
    return out.toString()
  }
}
