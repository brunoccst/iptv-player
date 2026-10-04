package expo.modules.tvmedia

import java.security.MessageDigest
import java.util.concurrent.Callable
import java.util.concurrent.Executors

/**
 * SHA-1 of many texts at once, for title ids (D-118): in JavaScript on a TV (no JIT) it took about a minute for 110k
 * titles. `texts` are separated by "\n"; the result is their 40-character hex digests, one after another. A large
 * batch is split over every core (D-134).
 */
internal object Sha1Batch {
  private const val HEX = "0123456789abcdef"
  /** Below this many texts one thread is quicker than handing out the work. */
  private const val PARALLEL_FROM = 2000
  private val cores = Runtime.getRuntime().availableProcessors().coerceAtLeast(1)
  private val pool by lazy {
    Executors.newFixedThreadPool(cores) { Thread(it, "sha1-batch").apply { isDaemon = true } }
  }

  fun hash(texts: String): String {
    val parts = texts.split('\n')
    if (parts.size < PARALLEL_FROM || cores == 1) return hash(parts, 0, parts.size)
    val size = (parts.size + cores - 1) / cores
    val chunks = (0 until parts.size step size).map { start ->
      pool.submit(Callable { hash(parts, start, minOf(parts.size, start + size)) })
    }
    val out = StringBuilder(parts.size * 40)
    for (chunk in chunks) out.append(chunk.get())
    return out.toString()
  }

  private fun hash(parts: List<String>, from: Int, to: Int): String {
    val digest = MessageDigest.getInstance("SHA-1")
    val out = StringBuilder((to - from) * 40)
    for (index in from until to) {
      for (byte in digest.digest(parts[index].toByteArray(Charsets.UTF_8))) {
        val value = byte.toInt()
        out.append(HEX[(value shr 4) and 15]).append(HEX[value and 15])
      }
    }
    return out.toString()
  }
}
