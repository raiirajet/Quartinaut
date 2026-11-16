# Dauerhafte Android-Signierung

Die Release-Konfiguration ist vorbereitet. Ohne einen vollständigen Keystore
und dessen Kennwörter bricht ein Release-Build ab. Debug-Builds bleiben separat.
Ein erfolgreich signiertes Release ist erst nach einem erfolgreichen Build und
der Prüfung gegen den festgelegten Zertifikatsfingerprint bestätigt.

## Schlüssel und GitHub einrichten

Falls schon ein Quartinaut-Release-Schlüssel existiert, diesen weiterverwenden.
Für eine neue Signieridentität den Keystore auf einem vertrauenswürdigen Rechner
erstellen; Kennwörter interaktiv eingeben:

```bash
keytool -genkeypair -v -keystore quartinaut-release.jks -storetype JKS \
  -alias quartinaut -keyalg RSA -keysize 4096 -validity 10000 \
  -dname 'CN=Quartinaut'
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
| `QUARTINAUT_KEY_ALIAS` | Schlüsselalias, beim obigen Befehl `quartinaut` |
| `QUARTINAUT_KEY_PASSWORD` | Kennwort des privaten Schlüssels |

Für Base64 unter Linux `base64 -w 0 quartinaut-release.jks` verwenden.
Weder diesen Inhalt noch Kennwörter ins Repository, in Issues oder Build-Logs
schreiben. Unter **Actions → Variables** die Repository-Variable
`QUARTINAUT_SIGNING_SHA256` mit dem SHA-256-Zertifikatsfingerprint aus `keytool`
anlegen. Doppelpunkte sind erlaubt. Dies ist kein Geheimnis.

Der derzeit verbundene GitHub-Zugang kann Actions Secrets nicht verwalten
(HTTP 403 bei der Abfrage). Die Einrichtung muss über einen entsprechend
berechtigten Zugang erfolgen.

## Release bauen

Den Workflow **Android signed release** mit dem Branch `native-android-v1`
starten. Er liefert im Actions-Artefakt `Quartinaut-Signed-Release` eine APK,
ein App Bundle und Datei-Prüfsummen. Er veröffentlicht keine GitHub Release
und führt kein Firebase-Deployment aus. Bei fehlendem Schlüssel oder falschem
Zertifikat gibt es kein freigegebenes Artefakt.

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

Den neuen SHA-1- und SHA-256-Fingerprint in der bestehenden Firebase-Android-App
`ch.quartinaut.nativeapp` im Projekt `quartinaut` registrieren. Die Release-App
verwendet bereits Play Integrity für App Check. Play Integrity und dessen
Vertriebsanforderungen für die vorgesehene Installationsart konfigurieren und
auf echten Geräten prüfen, bevor App Check verbindlich erzwungen wird.
Google-Anmeldung, Push und ein Update mit derselben Release-Signatur prüfen.
Bei Play App Signing zusätzlich den von Google verwalteten App-Signierschlüssel
registrieren; er kann vom lokalen Upload-Schlüssel abweichen.
