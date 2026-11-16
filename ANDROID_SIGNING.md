# Dauerhafte Android-Signierung

Am 16. November 2026 wurde die erste dauerhafte Quartinaut-Signieridentität
erstellt (RSA 4096, Alias `quartinaut`, Gültigkeit 10'000 Tage). Das private
Backup enthält den Keystore und dessen Kennwörter und muss von der Eigentümerin
dauerhaft sicher verwahrt werden. Im Repository liegen ausschliesslich das
öffentliche Zertifikat und dessen Fingerprints unter `signing/`.

SHA-256: `A7F498276029BC545335FA8D9A12140FF5FEEEB215AC97AA9F4193F1BBE3F6AE`

SHA-1: `A58C30DAD91C279A4ADB4DAE957F26D4F1966DB2`

Release-Build 31 (`5.11.2-signed-preview`) wurde erfolgreich als signierte APK
und als App Bundle erstellt. `assembleRelease`, `bundleRelease` und die
Release-Lint-Prüfung sind erfolgreich. APK-Signatur und App-Bundle-Signatur
wurden gegen das feste Zertifikat geprüft; Paketname, Buildnummer und
deaktivierter Debug-Modus wurden bestätigt. Der Unit-Test-Task enthält derzeit
keine Testquellen. Geräte- und Anmeldetests sind damit nicht belegt.
Die Datei-Prüfsummen stehen unter `signing/release-verification.json`.

Ohne einen vollständigen Keystore
und dessen Kennwörter bricht ein Release-Build ab. Debug-Builds bleiben separat.
Ein erfolgreich signiertes Release ist erst nach einem erfolgreichen Build und
der Prüfung gegen den festgelegten Zertifikatsfingerprint bestätigt.

## Schlüssel und GitHub einrichten

Für alle Quartinaut-Updates den jetzt erstellten Keystore aus dem privaten
Backup verwenden. **Keinen zweiten Schlüssel erstellen**, da Android solche
APKs nicht als Update über dieselbe Release-Installation akzeptiert.

Das vorhandene Zertifikat kann lokal geprüft werden; Kennwort interaktiv
eingeben:

```bash
keytool -list -v -keystore quartinaut-release.jks -alias quartinaut
```

Keystore und Kennwörter dauerhaft ausserhalb von GitHub sichern. Alle künftigen
Direkt-APK-Updates benötigen denselben Schlüssel. Ein Wechsel von bisherigen
Debug-APKs auf diese Signatur kann eine einmalige Neuinstallation erfordern;
dabei gehen lokale Entwürfe und Appdaten verloren. Vorher Daten sichern.

Unter [GitHub Actions Secrets](https://github.com/raiirajet/Quartinaut/settings/secrets/actions)
vier **Repository Secrets** anlegen:

| Name | Inhalt |
| --- | --- |
| `QUARTINAUT_KEYSTORE_BASE64` | Vollständiger Keystore als Base64, ohne Zeilenumbrüche |
| `QUARTINAUT_KEYSTORE_PASSWORD` | Keystore-Kennwort |
| `QUARTINAUT_KEY_ALIAS` | Schlüsselalias `quartinaut` |
| `QUARTINAUT_KEY_PASSWORD` | Kennwort des privaten Schlüssels |

Für Base64 unter Linux `base64 -w 0 quartinaut-release.jks` verwenden.
Weder diesen Inhalt noch Kennwörter ins Repository, in Issues oder Build-Logs
schreiben. Der öffentliche SHA-256-Zertifikatsfingerprint ist im Release-
Workflow fest hinterlegt. Eine zusätzliche GitHub-Variable ist nicht nötig.

Der derzeit verbundene GitHub-Zugang kann Actions Secrets nicht verwalten
(HTTP 403 bei der Abfrage). Die Einrichtung muss über einen entsprechend
berechtigten Zugang erfolgen.

## Release bauen

Den Workflow **Android signed release** mit dem Branch `native-android-v1`
starten. Er liefert im Actions-Artefakt `Quartinaut-Signed-Release` eine APK,
ein App Bundle und Datei-Prüfsummen. Er veröffentlicht keine GitHub Release
und führt kein Firebase-Deployment aus. Bei fehlendem Schlüssel oder falschem
Zertifikat gibt es kein freigegebenes Artefakt.

Sobald das feste Zertifikat im Branch vorhanden ist, veröffentlicht der alte
Debug-Workflow keine weiteren APKs auf GitHub Releases. Seine Debug-Artefakte
bleiben für Entwicklungstests verfügbar. Dadurch ersetzt eine spätere APK mit
zufälligem Debug-Schlüssel keine dauerhaft signierte Veröffentlichung.

Bei Einführung des neuen Workflows muss die Workflow-Datei auch im GitHub-
Standardbranch vorhanden sein, damit sie über `workflow_dispatch` gestartet
werden kann; der auszuführende Code bleibt `native-android-v1`.

Lokaler Build mit vier gesetzten Umgebungsvariablen:
`QUARTINAUT_KEYSTORE_FILE` (absoluter Pfad), `QUARTINAUT_KEYSTORE_PASSWORD`,
`QUARTINAUT_KEY_ALIAS`, `QUARTINAUT_KEY_PASSWORD`:

```bash
gradle :app:assembleRelease :app:bundleRelease
python3 scripts/verify-release-apk.py \
  "$ANDROID_HOME/build-tools/35.0.0/apksigner" \
  app/build/outputs/apk/release/app-release.apk
```

Für die APK-Prüfung zusätzlich `QUARTINAUT_SIGNING_SHA256` setzen.

## Firebase und Geräteprüfung

SHA-1 und SHA-256 wurden am 16. November 2026 in der bestehenden Firebase-
Android-App `ch.quartinaut.nativeapp` im Projekt `quartinaut` registriert
(App-ID `1:815175119171:android:2ae4bed9a9393de5e23ff6`). Die Release-App
verwendet bereits Play Integrity für App Check. Play Integrity und dessen
Vertriebsanforderungen für die vorgesehene Installationsart konfigurieren und
auf echten Geräten prüfen, bevor App Check verbindlich erzwungen wird.
Google-Anmeldung, Push und ein Update mit derselben Release-Signatur prüfen.
Bei Play App Signing zusätzlich den von Google verwalteten App-Signierschlüssel
registrieren; er kann vom lokalen Upload-Schlüssel abweichen.
