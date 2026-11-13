# Quartinaut: serverseitiger Dashboard-Hintergrund

**VORBEREITET, NICHT DEPLOYT.** Diese Funktion hat keinen Zugriff per öffentlicher URL und braucht einen Firebase-Auth-Kontext.

## Funktionsweise
Die Callable Function \`quartinautAppearance\` ist ausschliesslich für angemeldete, aktive Quartinaut-Benutzer erreichbar und verarbeitet nur das Bild des angemeldeten UID. Sie akzeptiert komprimiertes JPEG, validiert Format und Größe, verarbeitet das Bild mit \`sharp\`, entfernt Metadaten/EXIF, verkleinert auf max. 1600 px und begrenzt auf 480 KB.

Die neue GCS-Datei \`dashboard-backgrounds/<uid>/current.jpg\` bleibt **privat**: die aktuellen Firebase Storage Rules erlauben für diesen Pfad weder direkten Lese- noch Schreibzugriff. Die Cloud Function nutzt die Admin-SDK-Berechtigung. Firestore speichert lediglich Metadaten in \`dashboardBackgrounds/<uid>\`. Bestehende Regeln und bestehende Benutzerdaten bleiben unverändert.

## Voraussetzungen zur Veröffentlichung
1. Live-Regeln und bestehende Cloud Functions sichern/mit Release abgleichen.
2. Service-Account benötigt die vorgesehenen Berechtigungen im vorhandenen Bucket \`quartinaut.firebasestorage.app\`.
3. \`cd functions/appearance && npm install && npm test\`
4. \`cd ../.. && firebase deploy --project quartinaut --config firebase.appearance.json --only functions:quartinautAppearance\`
5. Erst nach einem erfolgreichen Backend-Deployment den Android-Hintergrundschalter freigeben und eine Ende-zu-Ende-Prüfung auf zwei Testkonten durchführen.
6. Für Browsersynchronisation separat Web-Client 5.4 an die Callable Function anbinden. Der bisherige Browser-Hintergrund liegt nur im lokalen Browser-Speicher.

**Achtung:** Firebase-CLI-Deployments, Regeln und Produktionsdaten wurden durch die Erstellung dieses Codes nicht verändert.
