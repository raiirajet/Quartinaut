# Quartinaut 5.7.4 – Wappen, Kalender und Diagnose

## Brand-Marke und App-Icon
- Das grün-goldene Schweizerkarten-Logo ist eine transparente Android-Vektorgrafik.
- Die Header-/Startseiten-Komponente lädt keine alte quadratische `icon-512.png` mehr.
- Android Launcher `ic_launcher` verwendet ein transparentes Adaptive-Icon (API 26+); die Maskierung der eigentlichen Startbildschirm-Icons wird weiterhin durch das jeweilige Android-Launcher-Design bestimmt.
- Der bestehende `scripts/assets-5.4.sha256`-Vergleich läuft unverändert, das alte quadratische PNG wird jedoch nicht mehr als neues Launcher-Icon kopiert.

## Wappen-Abdeckung
- Wappen bleiben je BFS-Gemeindenummer bzw. kantonalem ISO-Code zugeordnet.
- Die Wikidata-Abfrage verwendet P771/P94 für Gemeinden und P300/P94 für Kantone, in kleinen Chargen und per 30-Tage-Cache für erfolgreiche Gemeindeantworten.
- SVG/PNG werden von Wikimedia Commons geladen. Die Kartenanzeige zählt erfolgreich geladene Wappen; nicht zugeordnete/geblockte Bilder erhalten einen neutralen Schild-Platzhalter.
- Eine 100-%-Garantie für alle 2'110 aktuellen Gemeinden ist *nicht* möglich, wenn die Quelle kein Bild enthält oder die Internetverbindung fehlt. Keine geratenen Heraldikdateien. Ausdrücklich überprüfte Flawil- und St.-Gallen-Fallbacks sind vorhanden.
- Für amtlich-rechtliche Verwendung die Schutzbestimmungen beachten; Darstellungen dienen der informativen Gemeindeübersicht.

## Gemeindekalender
- Unter **Gemeindetermine** erscheinen nun quellenbelegte offizielle Termine direkt neben, aber getrennt von den veröffentlichten Backend-Beiträgen.
- Filter nach Gemeinde, Kanton und Schweiz; Suchfeld; alte Termine optional.
- Es werden nur `confirmed_exact_date`-Einträge mit `calendarExact=true` als bestätigte Terminkarten übernommen. Unsichere/unklare Daten werden nicht stillschweigend als bestätigt ausgegeben.
- Bestehender Quellenkatalog: `official_calendar_ch_2026_2030.json` mit 194 Datensätzen.
- Neue Quelle: `municipal_calendar_verified_sg.json` mit 12 datierten St. Galler Feiertagen und Flawiler Veranstaltungen. Grundlage: sGS 552.1 (Art. 2) und Flade Nr. 46/2026.
- Daten bleiben **offline, lokal und schreibgeschützt**. Kein Firestore-Import, keine automatisch als Gemeinde veröffentlichten Beiträge. Keine Echtzeit-Vollabdeckung sämtlicher Gemeinden.

## Verbindungsdiagnose
- `retryFeeds()` löscht keine Fehlermeldungen mehr vorschnell.
- Ein vorher fehlgeschlagener Enhancement-Callable wird über `posts.mine` erneut kontrolliert; nur eine erfolgreiche Antwort beendet seine Fehlermeldung.
- Andere Abfragefehler bleiben bestehen, bis der entsprechende Feed erfolgreich antwortet; Quellengruppe wird jeweils gesondert aktualisiert.
- „Keine Fehler bei bisher geprüften Diensten“ bedeutet nicht, dass jeder Cloud-Dienst veröffentlicht ist.

## Prüfungen
- `bash scripts/sync-original-assets.sh`
- `python3 -m unittest discover -s scripts -p test_official_calendar.py -v`
- `node --check`, Callable-Security-Tests, Emulator-Sicherheitstests und `gradle :app:assembleDebug --no-daemon` über GitHub Actions
- Auf echtem Gerät prüfen: Launcher-Transparenz je Theme, alle Wappen in verschiedenen Kantonen, sichtbare offizielle Termine für Flawil/SG/CH und persistenten NOT_FOUND-Hinweis.
- Keine Firebase-Functions-/Firestore-/Storage-Deployment-Aktion erforderlich oder in diesem Release autorisiert.
