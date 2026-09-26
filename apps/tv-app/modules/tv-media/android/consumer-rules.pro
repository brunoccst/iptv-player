# FFmpeg audio extension (D-059): Media3 creates the renderer by reflection, so R8 must keep it when bundled.
-dontwarn androidx.media3.decoder.ffmpeg.**
-keep class androidx.media3.decoder.ffmpeg.FfmpegAudioRenderer { <init>(...); }
-keep class androidx.media3.decoder.ffmpeg.FfmpegLibrary { *; }
