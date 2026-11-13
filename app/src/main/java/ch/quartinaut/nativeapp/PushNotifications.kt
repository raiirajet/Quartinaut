package ch.quartinaut.nativeapp

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import java.security.MessageDigest
import java.time.Instant

object NotificationChannels {
    const val GENERAL = "quartinaut_updates"

    fun create(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(
                GENERAL,
                "Quartinaut-Mitteilungen",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Chats, Gemeinde-Alarme und lokale Neuigkeiten"
                lockscreenVisibility = android.app.Notification.VISIBILITY_PRIVATE
            }
        )
    }
}

object PushTokenRegistrar {
    private const val PREFS = "quartinaut_push"
    private const val TOKEN_ID = "token_id"

    fun sync(context: Context, completed: ((Result<Unit>) -> Unit)? = null) {
        val appContext = context.applicationContext
        val user = FirebaseAuth.getInstance().currentUser
        if (user == null || !user.isEmailVerified) {
            completed?.invoke(Result.failure(IllegalStateException("Bitte zuerst anmelden und E-Mail bestätigen.")))
            return
        }
        FirebaseMessaging.getInstance().token
            .addOnSuccessListener { token -> save(appContext, token, completed) }
            .addOnFailureListener { completed?.invoke(Result.failure(it)) }
    }

    fun save(context: Context, token: String, completed: ((Result<Unit>) -> Unit)? = null) {
        val user = FirebaseAuth.getInstance().currentUser
        if (user == null || !user.isEmailVerified || token.isBlank()) {
            completed?.invoke(Result.failure(IllegalStateException("Pushregistrierung ist noch nicht möglich.")))
            return
        }
        val db = FirebaseFirestore.getInstance()
        db.collection("users").document(user.uid).get()
            .addOnSuccessListener { profile ->
                if (!profile.exists() || profile.getString("accountStatus") !in listOf(null, "active")) {
                    completed?.invoke(Result.failure(IllegalStateException("Das Benutzerkonto ist nicht aktiv.")))
                    return@addOnSuccessListener
                }
                val tokenId = sha256(token)
                val now = Instant.now().toString()
                val record = mapOf(
                    "id" to tokenId,
                    "token" to token,
                    "uid" to user.uid,
                    "active" to true,
                    "platform" to "android",
                    "area" to (profile.getString("area") ?: ""),
                    "areaKey" to (profile.getString("areaKey") ?: ""),
                    "cantonCode" to (profile.getString("cantonCode") ?: ""),
                    "appVersion" to appVersion(context),
                    "updatedAt" to now
                )
                val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                val previous = prefs.getString(TOKEN_ID, null)
                db.collection("deviceTokens").document(tokenId)
                    .set(record, SetOptions.merge())
                    .addOnSuccessListener {
                        prefs.edit().putString(TOKEN_ID, tokenId).apply()
                        if (!previous.isNullOrBlank() && previous != tokenId) {
                            db.collection("deviceTokens").document(previous).delete()
                        }
                        completed?.invoke(Result.success(Unit))
                    }
                    .addOnFailureListener { completed?.invoke(Result.failure(it)) }
            }
            .addOnFailureListener { completed?.invoke(Result.failure(it)) }
    }

    fun deactivate(context: Context, completed: () -> Unit) {
        val tokenId = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(TOKEN_ID, null)
        if (tokenId.isNullOrBlank() || FirebaseAuth.getInstance().currentUser == null) {
            completed()
            return
        }
        FirebaseFirestore.getInstance().collection("deviceTokens").document(tokenId)
            .update(mapOf("active" to false, "updatedAt" to Instant.now().toString()))
            .addOnCompleteListener { completed() }
    }

    private fun sha256(value: String): String = MessageDigest.getInstance("SHA-256")
        .digest(value.toByteArray())
        .joinToString("") { "%02x".format(it) }

    @Suppress("DEPRECATION")
    private fun appVersion(context: Context): String = runCatching {
        context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: ""
    }.getOrDefault("")
}

class QuartinautMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        PushTokenRegistrar.save(applicationContext, token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val notification = message.notification
        val title = (notification?.title ?: message.data["title"] ?: "Quartinaut").take(80)
        val body = (notification?.body ?: message.data["body"] ?: "Neue Mitteilung verfügbar.").take(240)
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("route", message.data["route"]?.take(40) ?: "home")
        }
        val pending = PendingIntent.getActivity(
            this,
            message.messageId?.hashCode() ?: System.currentTimeMillis().toInt(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val built = NotificationCompat.Builder(this, NotificationChannels.GENERAL)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(pending)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .build()
        if (Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(
                this, Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        ) {
            NotificationManagerCompat.from(this).notify(
                message.messageId?.hashCode() ?: System.currentTimeMillis().toInt(),
                built
            )
        }
    }
}
