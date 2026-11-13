# Android-Nativisierung – Implementierungsstand

## Architektur
- Kotlin, Jetpack Compose Material 3, Firebase Android SDK.
- Keine WebView, kein HTML-Wrapper, keine Firebase-Regeländerung.
- Entwicklungsbranch: native-android-v1.

## Funktional
- E-Mail-Anmeldung / Sitzungsverwaltung, Profil aus bestehender users-Collection.
- Natives Dashboard, Schwarzes Brett, Quartier+-Einträge und private Chats.
- Native Schweiz-Auswahl mit amtlichem Gemeindeverzeichnis als HTTP-JSON aus dem bestehenden Quartinaut-Hosting, ohne HTML.
- Cloud-Functions-Verbindungen für Hub und Quartinaut 5.0.

## Noch nicht funktionsgleich mit der Web-App
Administrations-Workflows, Verifikationsfoto, Moderation, erweiterte Benachrichtigungen, Push, Medien-Uploads, alle Chat-Sonderfälle, vollständige geografische Polygon-Karte, Offline-Synchronisation und sämtliche Einstellungen der Web-App. Diese Punkte sind nicht als fertig zu betrachten.

## Wichtige Sicherheitsbedingungen
Alle produktiven Rechte bleiben in Firebase Rules/Functions. Der Client darf niemals direkt Adminrechte vergeben.
Android benötigt für eine vollständig produktive Firebase-Konfiguration eine registrierte Android-App und ggf. App Check, signierte SHA-Fingerprints für Google Sign-In und FCM-Setup.
