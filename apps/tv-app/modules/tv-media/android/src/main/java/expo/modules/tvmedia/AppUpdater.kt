package expo.modules.tvmedia

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/**
 * Self-update (DECISIONS.md#d-062): downloads a newer APK from the GitHub release, checks it (SHA-256 from GitHub,
 * same package, newer version, same signing key) and hands it to the Android installer, which asks the user.
 */
object AppUpdater {
  private const val FOLDER = "updates"
  private const val FILE = "update.apk"

  fun installedVersion(context: Context): Map<String, Any?> {
    val info = packageInfo(context.packageManager, context.packageName)
    return mapOf("versionCode" to versionCode(info).toDouble(), "versionName" to info.versionName)
  }

  /** Downloads `url` to the app cache and checks its SHA-256 (hex, when given). Reports progress; returns the path. */
  fun download(context: Context, url: String, sha256: String?, onProgress: (Long, Long) -> Unit): String {
    val folder = File(context.cacheDir, FOLDER).apply { mkdirs() }
    folder.listFiles()?.forEach { it.delete() }
    val target = File(folder, FILE)
    var connection = URL(url).openConnection() as HttpURLConnection
    // GitHub answers with a redirect to its file storage (also https).
    var redirects = 0
    while (connection.responseCode in 300..399 && redirects++ < 5) {
      val next = connection.getHeaderField("Location") ?: break
      connection.disconnect()
      connection = URL(URL(url), next).openConnection() as HttpURLConnection
    }
    if (connection.responseCode != 200) throw IOException("HTTP ${connection.responseCode}")
    val total = connection.contentLengthLong
    val digest = MessageDigest.getInstance("SHA-256")
    connection.inputStream.use { input ->
      target.outputStream().use { output ->
        val buffer = ByteArray(64 * 1024)
        var done = 0L
        var reported = 0L
        while (true) {
          val count = input.read(buffer)
          if (count < 0) break
          output.write(buffer, 0, count)
          digest.update(buffer, 0, count)
          done += count
          if (done - reported > 512 * 1024) {
            reported = done
            onProgress(done, total)
          }
        }
        onProgress(done, total)
      }
    }
    connection.disconnect()
    val hex = digest.digest().joinToString("") { "%02x".format(it) }
    if (!sha256.isNullOrBlank() && !hex.equals(sha256, ignoreCase = true)) {
      target.delete()
      throw IOException("The download is damaged (checksum mismatch).")
    }
    return target.absolutePath
  }

  /**
   * What Android would say about installing `path`: "ok", "not-newer", "other-app" or "other-key" (signed with a
   * different key than the installed app, so Android refuses it without an uninstall first).
   */
  fun check(context: Context, path: String): String {
    val pm = context.packageManager
    val flags = if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else @Suppress("DEPRECATION") PackageManager.GET_SIGNATURES
    val archive = pm.getPackageArchiveInfo(path, flags) ?: return "other-app"
    if (archive.packageName != context.packageName) return "other-app"
    val installed = packageInfo(pm, context.packageName, flags)
    if (versionCode(archive) <= versionCode(installed)) return "not-newer"
    // Some Android versions report no certificates for an archive; then the system installer has the last word.
    val archiveKeys = signatures(archive)
    return if (archiveKeys.isEmpty() || archiveKeys == signatures(installed)) "ok" else "other-key"
  }

  /** Android 8+: the user must allow this app to install apps once (Settings → Install unknown apps). */
  fun canInstall(context: Context): Boolean =
    Build.VERSION.SDK_INT < 26 || context.packageManager.canRequestPackageInstalls()

  /** Opens "Install unknown apps" for this app; some TV builds lack that screen, then the security settings. */
  fun openInstallSettings(context: Context) {
    val perApp = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
    for (intent in listOf(perApp, Intent(Settings.ACTION_SECURITY_SETTINGS), Intent(Settings.ACTION_SETTINGS))) {
      try {
        context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        return
      } catch (_: ActivityNotFoundException) {
      }
    }
  }

  /** Opens the system installer for the downloaded APK; Android asks the user to confirm. */
  fun install(context: Context, path: String) {
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.tvmedia.updates", File(path))
    val intent = Intent(Intent.ACTION_VIEW)
      .setDataAndType(uri, "application/vnd.android.package-archive")
      .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(intent)
  }

  private fun packageInfo(pm: PackageManager, name: String, flags: Int = 0): PackageInfo =
    if (Build.VERSION.SDK_INT >= 33) pm.getPackageInfo(name, PackageManager.PackageInfoFlags.of(flags.toLong()))
    else @Suppress("DEPRECATION") pm.getPackageInfo(name, flags)

  private fun versionCode(info: PackageInfo): Long =
    if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else @Suppress("DEPRECATION") info.versionCode.toLong()

  private fun signatures(info: PackageInfo): Set<String> {
    val raw = if (Build.VERSION.SDK_INT >= 28) {
      info.signingInfo?.let { if (it.hasMultipleSigners()) it.apkContentsSigners else it.signingCertificateHistory }
    } else {
      @Suppress("DEPRECATION") info.signatures
    }
    return raw.orEmpty().map { it.toCharsString() }.toSet()
  }
}
