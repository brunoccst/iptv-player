package expo.modules.tvmedia

import android.util.Base64
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.net.Inet4Address
import java.net.NetworkInterface
import java.net.ServerSocket
import java.net.Socket
import java.security.SecureRandom
import java.util.UUID
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

/**
 * Phone-to-TV pairing (DECISIONS.md#d-060): a tiny HTTP server on the home network that takes `POST /pair` while the
 * QR code is on screen. Bodies go to JS (`onRequest`), which decrypts them and answers with `respond`. Plain HTTP is
 * fine: the bodies are encrypted with the one-time key from the QR code.
 */
class PairingServer(private val onRequest: (id: String, body: String) -> Unit) {
  private var socket: ServerSocket? = null
  private val pending = ConcurrentHashMap<String, CompletableFuture<Pair<Int, String>>>()

  /** Starts on a free port. Returns host (null when not on a network), port and a fresh 32-byte key (base64). */
  @Synchronized
  fun start(): Map<String, Any?> {
    stop()
    val server = ServerSocket(0)
    socket = server
    thread(name = "pairing-server", isDaemon = true) {
      while (!server.isClosed) {
        val client = try {
          server.accept()
        } catch (_: IOException) {
          break
        }
        thread(name = "pairing-request", isDaemon = true) { handle(client) }
      }
    }
    val key = ByteArray(32).also { SecureRandom().nextBytes(it) }
    return mapOf("host" to lanAddress(), "port" to server.localPort, "key" to Base64.encodeToString(key, Base64.NO_WRAP))
  }

  fun respond(id: String, status: Int, body: String) {
    pending.remove(id)?.complete(status to body)
  }

  @Synchronized
  fun stop() {
    try {
      socket?.close()
    } catch (_: IOException) {
    }
    socket = null
    pending.values.forEach { it.complete(503 to "") }
    pending.clear()
  }

  private fun handle(client: Socket) = client.use {
    try {
      client.soTimeout = 15_000
      val input = client.getInputStream()
      val requestLine = readLine(input) ?: return@use
      var length = 0
      while (true) {
        val header = readLine(input) ?: return@use
        if (header.isEmpty()) break
        val (name, value) = header.split(":", limit = 2).let { it[0].trim() to it.getOrElse(1) { "" }.trim() }
        if (name.equals("Content-Length", ignoreCase = true)) length = value.toIntOrNull() ?: 0
      }
      val (status, body) = when {
        !requestLine.startsWith("POST /pair ") -> 404 to ""
        length <= 0 || length > MAX_BODY -> 413 to ""
        else -> {
          val bytes = ByteArray(length)
          var read = 0
          while (read < length) {
            val count = input.read(bytes, read, length - read)
            if (count < 0) return@use
            read += count
          }
          val id = UUID.randomUUID().toString()
          val future = CompletableFuture<Pair<Int, String>>()
          pending[id] = future
          onRequest(id, String(bytes, Charsets.UTF_8))
          try {
            future.get(60, TimeUnit.SECONDS)
          } catch (_: Exception) {
            pending.remove(id)
            504 to ""
          }
        }
      }
      val payload = body.toByteArray(Charsets.UTF_8)
      val head = "HTTP/1.1 $status ${if (status == 200) "OK" else "Error"}\r\n" +
        "Content-Type: application/json\r\nContent-Length: ${payload.size}\r\nConnection: close\r\n\r\n"
      client.getOutputStream().apply {
        write(head.toByteArray(Charsets.US_ASCII))
        write(payload)
        flush()
      }
    } catch (_: IOException) {
    }
  }

  private fun readLine(input: InputStream): String? {
    val line = ByteArrayOutputStream()
    while (true) {
      val byte = input.read()
      if (byte < 0) return if (line.size() == 0) null else line.toString("US-ASCII")
      if (byte == '\n'.code) return line.toString("US-ASCII").trimEnd('\r')
      if (line.size() > 8_192) return null
      line.write(byte)
    }
  }

  companion object {
    private const val MAX_BODY = 8 * 1024 * 1024

    /** The device's IPv4 address on the home network (Wi-Fi or Ethernet). */
    fun lanAddress(): String? = try {
      NetworkInterface.getNetworkInterfaces()?.toList().orEmpty()
        .filter { it.isUp && !it.isLoopback }
        .flatMap { it.inetAddresses.toList() }
        .filterIsInstance<Inet4Address>()
        .firstOrNull { it.isSiteLocalAddress }
        ?.hostAddress
    } catch (_: Exception) {
      null
    }
  }
}
