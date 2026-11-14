package ch.quartinaut.nativeapp

import android.app.Application
import com.google.firebase.FirebaseApp

class QuartinautApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        val app = requireNotNull(FirebaseApp.initializeApp(this)) {
            "Firebase Android configuration is missing"
        }
        AppCheckProvider.install(app)
        NotificationChannels.create(this)
    }
}
