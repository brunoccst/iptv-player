package expo.modules.tvmedia

import android.content.Context
import android.os.Handler
import android.os.Looper
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.HttpDataSource
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.offline.Download
import androidx.media3.exoplayer.offline.DownloadHelper
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

/** What to play. Either `offlineId` (completed download) or `uri` (backend relay URL). */
class PlayerSource : Record {
  @Field var uri: String? = null
  @Field var offlineId: String? = null
  @Field var isHls: Boolean = false
  @Field var startPositionMs: Double = 0.0
}

/**
 * ExoPlayer surface without built-in controls; React Native draws the UI and drives it via props and view
 * functions. Emits status, progress (every 500 ms), tracks, end and error events.
 */
@androidx.annotation.OptIn(UnstableApi::class)
class TvPlayerView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout = true

  private val onStatus by EventDispatcher()
  private val onProgress by EventDispatcher()
  private val onTracks by EventDispatcher()
  private val onEnd by EventDispatcher()
  private val onError by EventDispatcher()

  private val handler = Handler(Looper.getMainLooper())
  private var player: ExoPlayer? = null
  private var paused = false
  private var loadedKey: String? = null

  private val playerView = PlayerView(context).apply {
    useController = false
    resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
    isFocusable = false
    layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
  }

  private val ticker = object : Runnable {
    override fun run() {
      emitProgress()
      handler.postDelayed(this, 500)
    }
  }

  private val listener = object : Player.Listener {
    override fun onPlaybackStateChanged(state: Int) {
      onStatus(mapOf("state" to stateName(state), "isPlaying" to (player?.isPlaying == true)))
      if (state == Player.STATE_ENDED) onEnd(mapOf<String, Any>())
    }

    override fun onIsPlayingChanged(isPlaying: Boolean) {
      onStatus(mapOf("state" to stateName(player?.playbackState ?: Player.STATE_IDLE), "isPlaying" to isPlaying))
    }

    override fun onPlayerError(error: PlaybackException) {
      onError(mapOf("message" to (error.message ?: "Playback error"), "code" to error.errorCodeName, "detail" to causeOf(error)))
    }

    override fun onTracksChanged(tracks: Tracks) = emitTracks(tracks)
  }

  init {
    addView(playerView)
  }

  fun load(source: PlayerSource?) {
    val key = source?.let { "${it.offlineId}|${it.uri}" }
    if (key == loadedKey) return
    loadedKey = key
    releasePlayer()
    if (source == null || (source.uri == null && source.offlineId == null)) return

    DownloadCenter.init(context)
    // Decoder fallback: if the preferred (often hardware) decoder fails to init, try the next one.
    val renderers = DefaultRenderersFactory(context).setEnableDecoderFallback(true)
    val exoPlayer = ExoPlayer.Builder(context, renderers)
      .setMediaSourceFactory(DefaultMediaSourceFactory(DownloadCenter.httpDataSourceFactory))
      .build()
    exoPlayer.addListener(listener)
    playerView.player = exoPlayer
    player = exoPlayer

    val offline = source.offlineId?.let { DownloadCenter.find(it) }
    if (offline != null && offline.state == Download.STATE_COMPLETED) {
      // Plays the exact request that was downloaded, reading only from the private cache.
      exoPlayer.setMediaSource(DownloadHelper.createMediaSource(offline.request, DownloadCenter.cacheDataSourceFactory))
      exoPlayer.seekTo(source.startPositionMs.toLong())
    } else if (source.uri != null) {
      val item = MediaItem.Builder()
        .setUri(source.uri)
        .apply { if (source.isHls) setMimeType(MimeTypes.APPLICATION_M3U8) }
        .build()
      exoPlayer.setMediaItem(item, source.startPositionMs.toLong())
    } else {
      onError(mapOf("message" to "Download not found on this device.", "code" to "OFFLINE_MISSING"))
      return
    }

    exoPlayer.playWhenReady = !paused
    exoPlayer.prepare()
    handler.post(ticker)
  }

  fun setPaused(value: Boolean) {
    paused = value
    player?.playWhenReady = !value
  }

  fun seekTo(positionMs: Double) {
    player?.seekTo(positionMs.toLong().coerceAtLeast(0))
    emitProgress()
  }

  /** `type` is "audio" or "text". `groupIndex` -1 disables text tracks. */
  fun selectTrack(type: String, groupIndex: Int, trackIndex: Int) {
    val exoPlayer = player ?: return
    val trackType = if (type == "audio") C.TRACK_TYPE_AUDIO else C.TRACK_TYPE_TEXT
    val builder = exoPlayer.trackSelectionParameters.buildUpon()
    if (groupIndex < 0) {
      builder.setTrackTypeDisabled(trackType, true)
    } else {
      val group = exoPlayer.currentTracks.groups.getOrNull(groupIndex) ?: return
      builder.setTrackTypeDisabled(trackType, false)
      builder.setOverrideForType(TrackSelectionOverride(group.mediaTrackGroup, trackIndex))
    }
    exoPlayer.trackSelectionParameters = builder.build()
  }

  private fun emitProgress() {
    val exoPlayer = player ?: return
    val duration = if (exoPlayer.duration == C.TIME_UNSET) 0L else exoPlayer.duration
    onProgress(mapOf(
      "positionMs" to exoPlayer.currentPosition.toDouble(),
      "durationMs" to duration.toDouble(),
      "bufferedMs" to exoPlayer.bufferedPosition.toDouble(),
      "isLive" to exoPlayer.isCurrentMediaItemLive,
    ))
  }

  private fun emitTracks(tracks: Tracks) {
    val list = mutableListOf<Map<String, Any?>>()
    tracks.groups.forEachIndexed { groupIndex, group ->
      val type = when (group.type) {
        C.TRACK_TYPE_AUDIO -> "audio"
        C.TRACK_TYPE_TEXT -> "text"
        else -> return@forEachIndexed
      }
      for (trackIndex in 0 until group.length) {
        val format = group.getTrackFormat(trackIndex)
        list.add(mapOf(
          "type" to type,
          "groupIndex" to groupIndex,
          "trackIndex" to trackIndex,
          "label" to (format.label ?: format.language ?: "Track ${list.size + 1}"),
          "language" to format.language,
          "selected" to group.isTrackSelected(trackIndex),
        ))
      }
    }
    onTracks(mapOf("tracks" to list))
  }

  private fun stateName(state: Int) = when (state) {
    Player.STATE_BUFFERING -> "buffering"
    Player.STATE_READY -> "ready"
    Player.STATE_ENDED -> "ended"
    else -> "idle"
  }

  private fun releasePlayer() {
    handler.removeCallbacks(ticker)
    player?.removeListener(listener)
    player?.release()
    player = null
    playerView.player = null
  }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    releasePlayer()
    loadedKey = null
  }
}

/** The underlying reason ("HTTP 403", "Failed to connect to …") that ExoPlayer's "Source error" hides. For the in-app log. */
@androidx.annotation.OptIn(UnstableApi::class)
private fun causeOf(error: Throwable): String {
  val parts = mutableListOf<String>()
  var cause: Throwable? = error.cause
  while (cause != null && parts.size < 4) {
    parts += when (cause) {
      is HttpDataSource.InvalidResponseCodeException -> "HTTP ${cause.responseCode} ${cause.responseMessage ?: ""}".trim()
      else -> "${cause.javaClass.simpleName}: ${cause.message ?: ""}".trim()
    }
    cause = cause.cause
  }
  return parts.joinToString(" <- ")
}

