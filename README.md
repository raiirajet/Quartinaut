# Quartinaut Native Android

**Quartinaut Native Android 5.11.3 Permissions Preview · Build 32 · Kotlin + Jetpack Compose.**

## Berechtigungen beim ersten Start

Vor der Anmeldung fragt Quartinaut erstmals die fehlenden Android-Freigaben
für Standort und Kamera sowie ab Android 13 für Benachrichtigungen ab.
Ein ungefährer Standort genügt. Bereits erteilte Freigaben werden übersprungen;
eine Ablehnung führt nicht zu wiederholten automatischen Dialogen. Die App ist
auch ohne diese Freigaben zugänglich.

Unter Einstellungen → **Standort, Kamera und Berechtigungen verwalten** können
die Freigaben später erneut geprüft und angefragt werden. Bei ausgeschaltetem
Standortdienst gibt es einen direkten Weg zu den Android-Standorteinstellungen.
Internetzugriff wird von Android automatisch erlaubt; die Bildauswahl verwendet
weiterhin den System-Dateidialog ohne umfassenden Speicherzugriff.

## Android-APK direkt herunterladen

Die aktuelle installierbare **Test-APK** steht nach erfolgreichem GitHub
Actions-Build auf der [GitHub-Releases-Seite](https://github.com/raiirajet/Quartinaut/releases)
als `Quartinaut-Android-Preview.apk` zur Verfügung. Der `main`-Branch
verlinkt diese Downloads. Grosse Binärdateien werden nicht im Git-Quellbaum
versioniert.

Wenn ein neuer Build mit höherem `versionCode` veröffentlicht wird,
zeigt Quartinaut beim nächsten Öffnen **„Update verfügbar“**.
In den Einstellungen kann die Prüfung auch manuell gestartet werden.

**Wechsel zur festen Signatur:** Die bisherigen Debug-APKs verwenden
wechselnde Schlüssel. Am 16. November 2026 wurde eine dauerhafte Release-
Signieridentität eingerichtet und deren Zertifikat in Firebase registriert.
Beim ersten Wechsel von einer alten Debug-APK zur signierten Release-APK kann
Android eine Neuinstallation verlangen. Eine Deinstallation löscht lokale
Entwürfe und Appdaten; diese vorher sichern. Künftige Release-Updates müssen
mit demselben Schlüssel und einem höheren `versionCode` erstellt werden.
Es findet keine stille Installation statt.

Die Vorbereitung für feste Release-Signierung mit APK-/App-Bundle-Build und
Zertifikatsprüfung ist in [ANDROID_SIGNING.md](ANDROID_SIGNING.md) beschrieben.
Der dauerhafte Keystore wurde am 16. November 2026 erstellt. Die privaten
Signierdaten müssen für CI noch über einen berechtigten Zugang in die
GitHub-Actions-Secrets übernommen werden; das öffentliche Zertifikat liegt
unter `signing/`.


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

Die native Firebase-Android-App ist registriert; SHA-1 und SHA-256 des festen
Release-Schlüssels sind in Firebase hinterlegt. Für die produktive Verteilung
bleiben Google-Anmeldung, FCM, App Check und Updates auf echten Geräten zu
prüfen. Die alten GitHub-Debug-APKs verwenden weiterhin ihre früheren
Debug-Signaturen.

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

## Native Preview 5.4.3 (Android 15 / 16 und Chat-Fix)

- Statusleiste: echter dunkler Edge-to-Edge-Hintergrund und kontrastreiche Symbole.
- Beiträge und Karten: passende Material-Farben statt weisser Karten mit weissem Text.
- Hilfe suchen/anbieten: 3-Schritt-Assistent mit Vorschau und Speicherung nach Firebase-Bestätigung.
- Quartier+-Beiträge: Bereiche, Kategorie, Pflichtfelder, Preis, Datum und Teilnehmerzahl werden validiert; Vorschau vor dem Veröffentlichen. Eine stabile Vorgangskennung schützt vor doppelten Inseraten nach Verbindungsproblemen.
- Private Chats: bei verweigerter direkter Firestore-Abfrage wird die separate Callable `quartinautPrivateChats` verwendet. Sie prüft bei jedem Aufruf aktive Benutzer und die exakte 1:1-Teilnahme. Alte Firestore-Regeln werden nicht gelockert.
- Das neue, noch separat zu veröffentlichende Backend liegt in `functions/nativeChats/`, Konfiguration in `firebase.chats.json`. Die Android-APK allein kann eine durch Live-Regeln verweigerte Chatabfrage nicht zuverlässig beheben.
- GitHub Actions testet sowohl die bisherigen Hintergrundbild- als auch die neuen Chat-Service-Validierungsroutinen.

**Backend-Deploy (separat, produktives Firebase, nur bei berechtigtem Zugriff):**
```bash
cd ~/Quartinaut-Native
git pull origin native-android-v1
cd functions/nativeChats && npm install && npm test && cd ../..
firebase deploy --project quartinaut --config firebase.chats.json --only functions:quartinaut-native-chats
```

**Wichtig:** Ohne bestätigten Cloud-Function-Deploy und Test mit zwei Konten ist die Chat-Reparatur im Produktivsystem noch nicht vollständig aktiv. Die Android-App selbst kann mit dem GitHub-APK gebaut und installiert werden.

## 5.10.0 – Android UX, offline und Zuverlässigkeit

- Alle 2'110 Schweizer Gemeindeembleme bleiben fest in der APK. Der Quellenbestand
  umfasst 2'109 Wappen und das offizielle Logo von Haute-Ajoie; bei historischen
  Bildern sind Gemeindezusammenlegungen gesondert zu prüfen.
- Vereinfachte 2025er Gemeindegeometrie wird zur Buildzeit aus einer fest
  referenzierten Revision geladen und offline in die APK eingebunden. Die
  geometrischen Grenzen sind nicht mit dem 2026er BFS-Verzeichnis gleichzusetzen.
- Schnellaktionen und Aufgaben-Navigation, Statusfilter und Suche in «Meine
  Beiträge», persistentere Erstellungsentwürfe und Navigationszustand.
- Lokale, anonyme Messung von Ladezeiten (letzte Messung, Median, P95) unter
  Einstellungen → Verbindungsdiagnose. Kein Tracking-Backend.
- Schrittweise App-Einführung, über Einstellungen erneut aufrufbar.
- Radar kann bereits gesehene Treffer lokal markieren. Dies ersetzt keine
  serverseitigen Push-Suchaufträge.
- Ausleihen zeigen eine Statusübersicht; die Anzeige nimmt keine tatsächlich
  nicht bestätigte Übergabe an. Gemeinde- und offizielle Termine sind gemeinsam
  über den Gemeindekalender erreichbar.
- Beitragserstellung nutzt stabile Vorgangskennungen; die serverseitige
  Beitragsliste ist für kleine Feldprojektionen vorbereitet.

### Wichtige Veröffentlichungsgrenzen

Ein erfolgreicher GitHub-Build beweist keine vollständig durchgeführten
End-to-End-Gerätetests auf verschiedenen Android-Geräten. Die bisherigen GitHub-Preview-APKs sind Debug-Testversionen. Für Release-
Builds ab Build 31 ist jetzt eine dauerhafte Signieridentität eingerichtet;
der private Keystore muss von der Eigentümerin sicher aufbewahrt werden.
Keine Schlüssel oder Zugangsdaten in das Repository übernehmen.

Die optimierte `functions/enhancements/index.js` ist Quellcode im
GitHub-Entwicklungszweig. Der Android-Build deployed keine Funktionen oder
Firebase-Sicherheitsregeln. Das produktive Backend muss nach Prüfung gesondert
freigegeben und deployed werden.
