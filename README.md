# Quartinaut Native Android

**Quartinaut 5.4 → Kotlin + Jetpack Compose · ohne WebView.**

Eigenständige Android-App auf Grundlage des von der Eigentümerin bereitgestellten Quartinaut-5.4-Release-Kandidaten. Es handelt sich nicht um eine umverpackte Website. Produktives Hosting und Firebase-Regeln werden beim APK-Build nicht verändert.

## Natives Design und Originalressourcen

Die originalen Dateien der Web-Version 5.4 werden zur Buildzeit mit `scripts/sync-original-assets.sh` in die App eingebunden:

- App-Logo und Launcher-Icon, `icon-192.png`, `icon-512.png`
- Schweizer-Kantonskarte `quartinaut-logo.svg` (26 antippbare Pfade)
- Die fünf farbigen 3D-Navigationselemente Start, Quartier+, Neu, Chats und Profil
- BFS-Gemeindeverzeichnis `ch-locations-2026.json`: **26 Kantone, 2'110 Gemeinden**, offline nutzbar

Die detailgenauen Gemeinde-Grenzpolygone der Web-Version kommen **aus dem öffentlichen 2025er GeoJSON-Datensatz** und werden auch in der nativen Fassung beim ersten Öffnen eines Kantons geladen. Bei fehlender Internetverbindung bleibt die örtliche Gemeindeliste erhalten.

## Android-Build

Android Studio / JDK 17 / Android SDK 35 und Gradle 8.9:

```bash
bash scripts/sync-original-assets.sh
gradle :app:assembleDebug
```

APK: `app/build/outputs/apk/debug/app-debug.apk`. Im GitHub-Entwicklungszweig werden Debug-APK und Quellcode in **Actions** automatisch als Downloads veröffentlicht.

Für eine **produktive Android-App** sind eine separate Firebase-Android-App-Registrierung, die korrekten App-Fingerprints, eigene stabile Signierung, Google Sign-in/FCM-Setup, App Check sowie Sicherheits-, Geräte- und Regressionstests notwendig. Die jetzigen GitHub-Debug-APKs werden nicht mit einem stabilen produktiven Signaturschlüssel signiert; ältere Preview-Versionen müssen deshalb vor der Neuinstallation gegebenenfalls deinstalliert werden.

## Backend

Benutzt bestehende Firestore-/Firebase-Auth-/Functions-Schnittstellen im Projekt `quartinaut`, Cloud Functions in `europe-west6`. Geschützte Beitragsfotos werden über `quartinautPhoto` gelesen, **nicht** über ungeschützte Storage-URLs.

## Vollständigkeit

**Noch keine vollständige 1:1-Funktionsparität.** Siehe `ANDROID_STATUS.md` mit dem detaillierten Stand. Kein Firebase-Deployment, keine geänderten Backend-Regeln, keine Konten-/Datenmigration.

## 5.4.1 – geschützter Dashboard-Hintergrund (Vorbereitung)
- Kotlin-Bildauswahl und private Vorschau über `NativeDashboardBackground.kt`.
- Bildbytes werden **nicht** durch Firestore-Dokumente oder öffentliche Storage-URLs geteilt.
- Separater Cloud Functions Codebase `functions/appearance` mit schmalem `firebase.appearance.json`.
- Backend-Writes sind authentifiziert, auf den eigenen UID beschränkt, mit verifizierter E-Mail, JPEG-Rekodierung, Entfernen von EXIF und einem Limit für Bildänderungen.
- Ohne veröffentlichten Backend-Dienst ist die Einstellung als nicht verfügbar markiert; **nicht** als erfolgreich gespeichert.
- Optionales Web-Preview zur geräteübergreifenden Ansicht aus v5.4 liegt separat vor (siehe `web-bridge/README.md`).
- Vollständige Audit-Matrix und Release-Gates in `AUDIT_NATIVE_54_2026-11-13.md`.

Keine produktive Firebase-Funktion, Hosting-Datei oder Rules wurden verändert.
