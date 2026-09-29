package expo.modules.tvmedia

import expo.modules.kotlin.Promise
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import java.net.URL
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

/**
 * Provider lists (movies, series, channels) downloaded and cut into batches of whole entries on a background thread
 * (D-115). JavaScript only parses each batch: turning 200 MB of bytes into text and finding the entries in JavaScript
 * kept the one JavaScript thread busy for about two minutes on a Chromecast. At most [READY] batches wait, so memory
 * stays at a few MB whatever the list's size.
 */
internal object ListReader {
  private val lists = ConcurrentHashMap<Int, Reading>()
  private val ids = AtomicInteger(1)

  /** Resolves with `{ id, status }` once the reply's status is known; rejects when the provider cannot be reached. */
  fun open(url: String, headers: Map<String, String>, timeoutMs: Int, batchChars: Int, promise: Promise) {
    val id = ids.getAndIncrement()
    val reading = Reading(id, url, headers, timeoutMs, batchChars, promise)
    lists[id] = reading
    reading.start()
  }

  /**
   * The next piece: `{ kind: "batch", text }`, then one of `{ kind: "end", chars }`, `{ kind: "whole", text, chars }`
   * (not an array), `{ kind: "incomplete", text }` (stopped before its "]") or `{ kind: "error", message }`.
   */
  fun next(id: Int, promise: Promise) {
    val reading = lists[id]
    if (reading == null) promise.resolve(mapOf("kind" to "error", "message" to "closed"))
    else reading.next(promise)
  }

  fun close(id: Int) {
    lists.remove(id)?.close()
  }

  private const val READY = 2
  private const val MAX_REDIRECTS = 5

  private class Reading(
    private val id: Int,
    private val url: String,
    private val headers: Map<String, String>,
    private val timeoutMs: Int,
    private val batchChars: Int,
    private val opened: Promise,
  ) : Thread("list-reader-$id") {
    private val lock = Object()
    private val ready = ArrayDeque<Map<String, Any?>>()
    private var waiting: Promise? = null
    private var ended = false

    @Volatile private var closed = false

    @Volatile private var connection: HttpURLConnection? = null

    override fun run() {
      var answered = false
      try {
        val response = connect()
        val status = response.responseCode
        opened.resolve(mapOf("id" to id, "status" to status))
        answered = true
        if (status !in 200..299) return
        val splitter = JsonArraySplitter(batchChars) { deliver(mapOf("kind" to "batch", "text" to it)) }
        InputStreamReader(response.inputStream, Charsets.UTF_8).use { reader ->
          val buffer = CharArray(64 * 1024)
          while (!closed) {
            val count = reader.read(buffer)
            if (count < 0 || !splitter.feed(buffer, count)) break
          }
        }
        val chars = splitter.chars.toDouble()
        deliver(
          when (val end = splitter.finish()) {
            is JsonArraySplitter.End.Complete -> mapOf("kind" to "end", "chars" to chars)
            is JsonArraySplitter.End.Whole -> mapOf("kind" to "whole", "text" to end.text, "chars" to chars)
            is JsonArraySplitter.End.Incomplete -> mapOf("kind" to "incomplete", "text" to end.preview, "chars" to chars)
          },
        )
      } catch (error: Exception) {
        if (!answered) {
          val code = if (error is SocketTimeoutException) "ERR_LIST_TIMEOUT" else "ERR_LIST_CONNECT"
          opened.reject(code, error.message ?: error.javaClass.simpleName, error)
        } else {
          deliver(mapOf("kind" to "error", "message" to (error.message ?: error.javaClass.simpleName)))
        }
      } finally {
        connection?.disconnect()
      }
    }

    /** Follows redirects, also between http and https (HttpURLConnection alone does not). */
    private fun connect(): HttpURLConnection {
      var target = URL(url)
      repeat(MAX_REDIRECTS + 1) {
        val next = target.openConnection() as HttpURLConnection
        connection = next
        next.connectTimeout = timeoutMs
        next.readTimeout = timeoutMs
        next.instanceFollowRedirects = false
        headers.forEach { (name, value) -> next.setRequestProperty(name, value) }
        val status = next.responseCode
        val location = next.getHeaderField("Location")
        if (status !in 300..399 || location == null) return next
        next.disconnect()
        target = URL(target, location)
      }
      return connection!!
    }

    /** Hands a piece to the waiting read, or keeps it; waits while [READY] pieces are unread. */
    private fun deliver(piece: Map<String, Any?>) {
      val reader: Promise?
      synchronized(lock) {
        while (!closed && waiting == null && ready.size >= READY) lock.wait()
        if (closed) return
        reader = waiting
        waiting = null
        if (reader == null) ready.addLast(piece)
        if (piece["kind"] != "batch") ended = true
      }
      reader?.resolve(piece)
    }

    fun next(promise: Promise) {
      val piece: Map<String, Any?>?
      synchronized(lock) {
        piece = ready.removeFirstOrNull()
        if (piece != null) lock.notifyAll()
        else if (closed || (ended && ready.isEmpty())) {
          // Nothing more will come.
        } else {
          waiting = promise
          return
        }
      }
      promise.resolve(piece ?: mapOf("kind" to "error", "message" to "closed"))
    }

    fun close() {
      val reader: Promise?
      synchronized(lock) {
        closed = true
        reader = waiting
        waiting = null
        ready.clear()
        lock.notifyAll()
      }
      reader?.resolve(mapOf("kind" to "error", "message" to "closed"))
      // Stops a download in progress: the thread's read fails and it ends.
      Thread { connection?.disconnect() }.start()
    }
  }
}
