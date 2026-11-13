# Quartinaut – Native Android

Native Kotlin-/Jetpack-Compose-App für Quartinaut. **Keine WebView** und keine Übernahme der HTML-Oberfläche.

## Quelle
Ausgangsbasis: Quartinaut 5.4 (13.11.2026). Der bestehende Web-Client und das produktive Firebase-Backend bleiben unverändert.

## Stand
Android-Neuentwicklung; gegenüber der Web-Version noch keine Funktionsparität. Funktionsumfang und Grenzen stehen in `ANDROID_STATUS.md`.

## Build
Android Studio öffnen, Android SDK 35 und JDK 17 installieren, dann `gradle :app:assembleDebug`.
Die Debug-APK liegt in `app/build/outputs/apk/debug/app-debug.apk`.

Firebase: Im Source-Modus wird zunächst die bereits öffentlich im Web-Client vorhandene Firebase-Web-Konfiguration für die SDK-Initialisierung genutzt. Für eine produktive Android-Veröffentlichung die App zusätzlich in Firebase registrieren, den nativen Android-App-Identifier und `google-services.json` konfigurieren sowie Google-Login, Push und App Check passend einrichten. Keine Geheimnisse ins öffentliche Repository hochladen.
