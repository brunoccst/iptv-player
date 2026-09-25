package expo.modules.tvmedia

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * AES key that encrypts downloaded media (DECISIONS.md#d-050). The key is random per install and saved only wrapped
 * by an Android Keystore key, which cannot be exported from the device.
 */
object OfflineKey {
  private const val KEYSTORE = "AndroidKeyStore"
  private const val ALIAS = "tv-media-offline"
  private const val PREFERENCES = "tv-media"
  private const val KEY_WRAPPED = "offline-key"
  private const val GCM_TAG_BITS = 128

  /** The data key, and whether it is new (anything cached under an older or missing key is unreadable). */
  fun load(context: Context): Pair<ByteArray, Boolean> {
    val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
    preferences.getString(KEY_WRAPPED, null)?.let { saved ->
      runCatching { unwrap(saved) }.getOrNull()?.let { return it to false }
    }
    val key = ByteArray(16).also { SecureRandom().nextBytes(it) }
    preferences.edit().putString(KEY_WRAPPED, wrap(key)).commit()
    return key to true
  }

  private fun keystoreKey(): SecretKey {
    val keyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }
    (keyStore.getKey(ALIAS, null) as? SecretKey)?.let { return it }
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
    generator.init(
      KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256)
        .build(),
    )
    return generator.generateKey()
  }

  private fun wrap(key: ByteArray): String {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, keystoreKey()) }
    return Base64.encodeToString(cipher.iv + cipher.doFinal(key), Base64.NO_WRAP)
  }

  private fun unwrap(saved: String): ByteArray {
    val bytes = Base64.decode(saved, Base64.NO_WRAP)
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.DECRYPT_MODE, keystoreKey(), GCMParameterSpec(GCM_TAG_BITS, bytes, 0, 12))
    return cipher.doFinal(bytes, 12, bytes.size - 12)
  }
}
