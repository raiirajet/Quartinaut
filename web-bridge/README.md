# Web-Client 5.4: privater Dashboard-Hintergrund

Der Android-Code und der neue Serverdienst liegen im Branch `native-android-v1`.

## Aktueller Stand

Die originalen Dateien der Web-Version 5.4 wurden getrennt vom produktiven Hosting analysiert. Ein **nicht veröffentlichtes Web-Vorschauset** wurde auf Basis des Originalpakets erstellt und getestet:

- Zusätzlicher geschützter Cloud-Download über `quartinautAppearance` nach dem Login
- Eine neue Bildauswahl speichert in der Cloud, sobald die neue Funktion erreichbar ist
- Verfügbare lokale Altbilder bleiben **lokal**, bis der Benutzer ausdrücklich `Lokales Bild bewusst synchronisieren` auswählt
- Wird der Serverdienst nicht erreicht, bleibt die bisherige lokale Speicherung verfügbar; die Oberfläche nennt das ausdrücklich
- Ein über den Server geladenes Bild wird nur im Speicher der aktiven Sitzung vorgehalten (kein öffentlicher Download-Link)
- Die vorhandene Schaltfläche `Standard wiederherstellen` entfernt synchronisierte Bilder zunächst serverseitig
- Cache-Versionswechsel im Service Worker, damit eine spätere freigegebene Veröffentlichung ausgeliefert werden kann

Der zugehörige lokale Patch befindet sich im ausgelieferten Archiv `Quartinaut_5_4_Serverhintergrund_Web_Vorschau.zip`, unter `tools/apply_web_background_patch.py`.

## Prüfungen

`node --check hosting/app-release-540.js`, `node --check hosting/sw.js` und die 19 vorhandenen Node-Tests für den Original-Web-Code wurden mit der Vorschau bestanden.

**Keine Veröffentlichung ist erfolgt.** Vor einem Web-Deploy den separaten Serverdienst deployen, alle Live-Regeln und Backend-Funktionen sichern, mit einem Testkonto auf mehreren Geräten prüfen und erst dann die korrigierten Hosting-Dateien kontrolliert bereitstellen.

## Offene Integrationsarbeit

Die Aktualisierung muss noch in den regulären Web-Release-Prozess übernommen werden. `firebase deploy --only hosting` würde die komplette bestehende Website aktualisieren – daher ist keine automatische Veröffentlichung in dieser Änderung enthalten.
