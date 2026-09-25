package expo.modules.tvmedia

import android.content.Context
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.AesCipherDataSink
import androidx.media3.datasource.AesCipherDataSource
import androidx.media3.datasource.DataSink
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.FileDataSource
import androidx.media3.datasource.cache.CacheDataSink
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.NoOpCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import androidx.media3.exoplayer.offline.DefaultDownloadIndex
import androidx.media3.exoplayer.offline.DefaultDownloaderFactory
import androidx.media3.exoplayer.offline.Download
import androidx.media3.exoplayer.offline.DownloadManager
import java.io.File
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.Executors

/**
 * Process-wide Media3 download state. Cache lives in the app's private `filesDir` (no other app or user access
 * without root), AES-encrypted with a Keystore-protected key. Player and DownloadService share it. D-029, D-050.
 */
@androidx.annotation.OptIn(UnstableApi::class)
object DownloadCenter {
  const val CHANNEL_ID = "downloads"
  const val USER_AGENT = "TvMedia/1.0 (Media3)"
  private const val PREFERENCES = "tv-media"
  private const val KEY_USER_AGENT = "user-agent"
  private const val SCRATCH_BYTES = 64 * 1024

  private var initialized = false
  private val listeners = CopyOnWriteArraySet<() -> Unit>()

  lateinit var cache: SimpleCache
    private set
  lateinit var httpDataSourceFactory: DefaultHttpDataSource.Factory
    private set
  lateinit var cacheDataSourceFactory: CacheDataSource.Factory
    private set
  lateinit var downloadManager: DownloadManager
    private set

  @Synchronized
  fun init(context: Context) {
    if (initialized) return
    val app = context.applicationContext
    val database = StandaloneDatabaseProvider(app)
    val cacheDir = File(app.filesDir, "offline-media")
    val downloadIndex = DefaultDownloadIndex(database)
    val (secretKey, newKey) = OfflineKey.load(app)
    // Files from before encryption (or under a lost key) cannot be read: drop them and their download entries.
    if (newKey) {
      SimpleCache.delete(cacheDir, database)
      val ids = mutableListOf<String>()
      downloadIndex.getDownloads().use { cursor -> while (cursor.moveToNext()) ids.add(cursor.download.request.id) }
      ids.forEach(downloadIndex::removeDownload)
    }
    cache = SimpleCache(cacheDir, NoOpCacheEvictor(), database)
    httpDataSourceFactory = DefaultHttpDataSource.Factory()
      .setUserAgent(savedUserAgent(app))
      .setAllowCrossProtocolRedirects(true)
    // Encrypted at rest: AES-CTR on write, decrypted on read; the scratch buffer keeps the downloader's copy intact.
    val encryptedRead = DataSource.Factory { AesCipherDataSource(secretKey, FileDataSource()) }
    val encryptedWrite = DataSink.Factory {
      AesCipherDataSink(secretKey, CacheDataSink(cache, CacheDataSink.DEFAULT_FRAGMENT_SIZE), ByteArray(SCRATCH_BYTES))
    }
    // Read-only cache view: offline playback reads downloaded data; streaming does not fill the download cache.
    cacheDataSourceFactory = CacheDataSource.Factory()
      .setCache(cache)
      .setCacheReadDataSourceFactory(encryptedRead)
      .setUpstreamDataSourceFactory(httpDataSourceFactory)
      .setCacheWriteDataSinkFactory(null)
    val downloadDataSourceFactory = CacheDataSource.Factory()
      .setCache(cache)
      .setCacheReadDataSourceFactory(encryptedRead)
      .setCacheWriteDataSinkFactory(encryptedWrite)
      .setUpstreamDataSourceFactory(httpDataSourceFactory)
    val downloaderFactory = DefaultDownloaderFactory(downloadDataSourceFactory, Executors.newFixedThreadPool(2))
    downloadManager = DownloadManager(app, downloadIndex, downloaderFactory).apply {
      // One at a time: every download holds a provider connection.
      maxParallelDownloads = 1
      addListener(object : DownloadManager.Listener {
        override fun onDownloadChanged(manager: DownloadManager, download: Download, finalException: Exception?) = notifyListeners()
        override fun onDownloadRemoved(manager: DownloadManager, download: Download) = notifyListeners()
      })
    }
    initialized = true
  }

  /**
   * Providers often only answer player-like agents; direct mode talks to them without a relay (DECISIONS.md#d-038).
   * Saved so downloads resumed by the service after a restart use it before JS runs.
   */
  @Synchronized
  fun setUserAgent(context: Context, userAgent: String) {
    context.applicationContext.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).edit().putString(KEY_USER_AGENT, userAgent).apply()
    if (initialized) httpDataSourceFactory.setUserAgent(userAgent)
  }

  private fun savedUserAgent(context: Context): String =
    context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).getString(KEY_USER_AGENT, null) ?: USER_AGENT

  fun addListener(listener: () -> Unit) = listeners.add(listener)

  fun removeListener(listener: () -> Unit) = listeners.remove(listener)

  private fun notifyListeners() = listeners.forEach { it() }

  /** Completed or queued download by id, or null. */
  fun find(id: String): Download? = downloadManager.downloadIndex.getDownload(id)

  /** All downloads. In-progress entries come from `currentDownloads` because the index holds stale progress. */
  fun list(): List<Map<String, Any?>> {
    val current = downloadManager.currentDownloads.associateBy { it.request.id }
    val result = mutableListOf<Map<String, Any?>>()
    downloadManager.downloadIndex.getDownloads().use { cursor ->
      while (cursor.moveToNext()) {
        val stored = cursor.download
        result.add(toMap(current[stored.request.id] ?: stored))
      }
    }
    return result
  }

  fun toMap(download: Download): Map<String, Any?> = mapOf(
    "id" to download.request.id,
    "state" to stateName(download),
    "percent" to if (download.percentDownloaded == C.PERCENTAGE_UNSET.toFloat()) null else download.percentDownloaded.toDouble(),
    "bytesDownloaded" to download.bytesDownloaded.toDouble(),
    "metadata" to String(download.request.data, Charsets.UTF_8),
    "failureReason" to download.failureReason,
  )

  private fun stateName(download: Download): String = when (download.state) {
    Download.STATE_QUEUED -> if (download.stopReason != Download.STOP_REASON_NONE) "paused" else "queued"
    Download.STATE_STOPPED -> "paused"
    Download.STATE_DOWNLOADING -> "downloading"
    Download.STATE_COMPLETED -> "completed"
    Download.STATE_FAILED -> "failed"
    Download.STATE_REMOVING -> "removing"
    Download.STATE_RESTARTING -> "queued"
    else -> "unknown"
  }
}
