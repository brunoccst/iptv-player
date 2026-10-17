package expo.modules.tvmedia

import android.annotation.SuppressLint
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebView
import android.webkit.WebViewClient
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException

/**
 * Reads provider names outside the JavaScript thread (issue #228, DECISIONS.md#d-188). The app's own name parser
 * (assets/name-parser.js, built from packages/shared/src/direct/nameRow.ts by apps/tv-app/scripts/build-name-parser.mjs)
 * runs in a WebView that is never shown: its JavaScript runs in the WebView's renderer with V8's compiler, so the app's
 * JavaScript thread stays free and the same rules run, written once. Any failure rejects, and the app reads the names
 * itself as before. The WebView goes after a minute without work.
 */
object NameParser {
  private const val IDLE_MS = 60_000L
  /** One batch takes well under a second; a stuck renderer must not stall the library build. */
  private const val CALL_TIMEOUT_MS = 30_000L
  private val main = Handler(Looper.getMainLooper())
  private var view: WebView? = null
  private var ready = false
  /** Calls waiting for the page and the parser to load. */
  private val waiting = mutableListOf<Pair<String, Promise>>()
  /** Calls the page is working on. */
  private val running = mutableSetOf<Promise>()
  private val release = Runnable { if (running.isEmpty() && waiting.isEmpty()) destroy() }

  fun parse(context: Context, names: String, promise: Promise) {
    main.post {
      main.removeCallbacks(release)
      try {
        val current = view ?: create(context)
        if (ready) evaluate(current, names, promise) else waiting.add(names to promise)
      } catch (error: Throwable) {
        promise.reject(CodedException("ERR_NAME_PARSER", error.message ?: "WebView not available", error))
      }
    }
  }

  @SuppressLint("SetJavaScriptEnabled")
  private fun create(context: Context): WebView {
    val script = context.assets.open("name-parser.js").bufferedReader().use { it.readText() }
    val created = WebView(context.applicationContext)
    created.settings.javaScriptEnabled = true
    created.settings.blockNetworkLoads = true
    created.settings.allowFileAccess = false
    created.webViewClient = object : WebViewClient() {
      override fun onPageFinished(page: WebView, url: String?) {
        if (page !== view || ready) return
        page.evaluateJavascript("$script;typeof parseNames") { type ->
          if (page !== view) return@evaluateJavascript
          if (type != "\"function\"") return@evaluateJavascript fail("parser did not load ($type)")
          ready = true
          val queued = waiting.toList()
          waiting.clear()
          for ((names, promise) in queued) evaluate(page, names, promise)
        }
      }

      // The renderer died (low memory): the app reads the names itself; never take the app down with it.
      override fun onRenderProcessGone(page: WebView, detail: RenderProcessGoneDetail?): Boolean {
        if (page === view) fail("renderer gone")
        return true
      }
    }
    view = created
    ready = false
    main.postDelayed({ if (view === created && !ready) fail("parser page did not load") }, CALL_TIMEOUT_MS)
    created.loadDataWithBaseURL(null, "<!doctype html><title>names</title>", "text/html", "utf-8", null)
    return created
  }

  private fun evaluate(page: WebView, names: String, promise: Promise) {
    running.add(promise)
    val timeout = Runnable { if (running.remove(promise)) fail("parser timed out", promise) }
    main.postDelayed(timeout, CALL_TIMEOUT_MS)
    // `names` is a JSON array, which is also a JavaScript literal; the answer comes back as JSON.
    page.evaluateJavascript("parseNames($names)") { result ->
      main.removeCallbacks(timeout)
      if (!running.remove(promise)) return@evaluateJavascript
      if (result == null || !result.startsWith("[")) {
        promise.reject(CodedException("ERR_NAME_PARSER", "no answer from the parser", null))
      } else {
        promise.resolve(result)
      }
      main.removeCallbacks(release)
      main.postDelayed(release, IDLE_MS)
    }
  }

  /** Rejects every call waiting or running (and `also`), and drops the WebView. */
  private fun fail(reason: String, also: Promise? = null) {
    val queued = waiting.map { it.second } + running + listOfNotNull(also)
    waiting.clear()
    running.clear()
    destroy()
    for (promise in queued) promise.reject(CodedException("ERR_NAME_PARSER", reason, null))
  }

  private fun destroy() {
    val current = view ?: return
    view = null
    ready = false
    current.destroy()
  }
}
