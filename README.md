# Quartinaut

**Schweizer Quartier- und Gemeindeplattform · Native Android-App**

## Android-APK herunterladen

[**Quartinaut 5.7.2 – APK direkt herunterladen**](https://github.com/raiirajet/Quartinaut/releases/download/android-v13-preview/Quartinaut-Android-Preview.apk)

[**Alle Quartinaut-Versionen auf GitHub Releases**](https://github.com/raiirajet/Quartinaut/releases)

Für die Installation auf Android den neuesten Eintrag **Android Preview** öffnen und
die Datei `Quartinaut-Android-Preview.apk` herunterladen. Falls der Release-Download einmal nicht erreichbar ist, steht die letzte erfolgreich erstellte Testversion unter
[GitHub Actions – Android-APK (Build 43561632244)](https://github.com/raiirajet/Quartinaut/actions/runs/43561632244)
als Artefakt `Quartinaut-Native-Debug-APK` zur Verfügung.

Die APK wird als **GitHub Release** bereitgestellt, nicht als grosse Binärdatei
direkt im Git-Quellbaum. So bleibt der `main`-Branch übersichtlich und der
Download auch für weitere App-Versionen zentral auffindbar.

## Aktualisierungen in der App

Seit dem Android-Entwicklungsstand **5.7.2** prüft Quartinaut beim Öffnen,
ob ein neueres offizielles GitHub-Release vorliegt. Dann erscheint in der
App die Meldung **„Update verfügbar“**. In den Einstellungen gibt es zusätzlich
die Schaltfläche **„Jetzt auf Updates prüfen“**.

Die Installation erfolgt nur auf ausdrückliche Bestätigung durch Android.
**Aktuelle Testversionen haben noch keine dauerhaft gleiche App-Signatur:**
Deshalb ist eine nahtlose Aktualisierung über eine ältere Debug-APK noch
nicht garantiert. Eine Deinstallation löscht lokale Appdaten und Entwürfe.
Vor produktiven nahtlosen Updates muss ein stabiler Release-Signaturschlüssel
eingerichtet werden.

## Entwicklung

Der vollständige Kotlin-/Jetpack-Compose-Quellcode und die GitHub-Builds liegen
im [Entwicklungszweig `native-android-v1`](https://github.com/raiirajet/Quartinaut/tree/native-android-v1).
Die bestehende [Quartinaut-Webseite](https://quartinaut.web.app/) bleibt davon getrennt.

**Firebase-Datenbanken, Konten und produktive Sicherheitsregeln werden durch
die GitHub-APK-Veröffentlichung nicht verändert.**
