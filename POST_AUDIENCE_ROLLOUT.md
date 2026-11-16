# Regionale Anliegen – Stand Build 33

Für Anliegen sind Umkreis (5/10/25/50 km), Gemeinde und Schweizweit jetzt über
`quartinautAudience` in `europe-west6` eingerichtet. Die Kantons-Veröffentlichung
verwendet weiterhin den bestehenden Pfad. Quartier+ bleibt bei der bisherigen
Kantons-Reichweite; dort sind die weiteren Optionen deaktiviert.

## Standort und Straße

GPS und Netzwerk werden parallel angefragt. Nur aktuelle, ausreichend genaue
Fixes werden übernommen; nach 20 Sekunden endet die Abfrage mit einem sichtbaren
Hinweis. Eine Straßenabfrage hat zusätzlich ein Limit von sechs Sekunden.
Android-Geocoder liefert ausschliesslich das Straßenfeld: keine Adresszeile,
keine Hausnummer. Angefügte Hausnummern und Nummernbereiche werden entfernt.
Der Straßenname bleibt in der lokalen Anzeige und wird keinem Beitrag oder
Backend-Dokument hinzugefügt. Bei ungenauer Position ist die Straßenanzeige
entsprechend gekennzeichnet. Ohne Geocoder-Ergebnis bleibt der Standort nutzbar.

Nur auf 0,01 Grad gerundete Koordinaten gelangen nach bewusstem Standortabruf an
Firebase. Sie sind privat und für Umkreis-Abfragen zwei Stunden gültig.
Dies ist eine Ortsangabe vom Gerät, kein Nachweis physischer Anwesenheit.

## Serverseitige Zugriffskontrolle

Neue regionale Anliegen liegen in `quartinautScopedRequests`. Direkte Client-
Zugriffe sind vollständig gesperrt. Alte Web-/Android-Clients und bestehende
Admin-SDK-Lesewege kennen diese neue Quelle nicht und können ihre Einschränkung
somit nicht umgehen. Bestehende Kantonsabfragen bleiben unverändert.

Der Dienst prüft aktive Konten und die gespeicherte Gemeinde bzw. den Kanton.
Umkreis-Entscheidungen verwenden die private, noch gültige Standortangabe des
Betrachters und eine serverseitige Distanzberechnung. Schweizweite Anliegen
sind für aktive Konten mit hinterlegtem Schweizer Kanton sichtbar. Eigentümer
sehen ihre eigenen Einreichungen; Moderation benötigt vertrauenswürdige Claims.

Der Dienst schreibt ausschliesslich erlaubte öffentliche Felder in private
Empfängeransichten unter `quartinautAudienceFeeds/{uid}/items/{id}`. Ein Zugriff
ist höchstens fünf Minuten gültig und an Benutzer, Profilregion, Rollen-Claims,
Quellversion und gegebenenfalls Standortversion gebunden. Die Position, Straße,
Hausnummer sowie interne Vorgangskennung sind darin nicht enthalten. Geänderte
oder gelöschte Quellen und geänderte Regionen/Rollen/Standorte entwerten ältere
Ansichten. Die App lädt Ansichten ausschliesslich vom Server.

Bearbeitung führt erneut zur Freigabe. Die native Verwaltung enthält die neue
Anliegen-Warteschlange. Fotos, Favoriten, Radar, Reaktionen und der Start eines
privaten Chats werden bei jedem Aufruf erneut autorisiert. Bestehende private
Chats bleiben auf ihre Teilnehmer begrenzt. Es gibt keinen zusätzlichen
Push-Versand für die neue Quelle; bestehende Push-Trigger werden nicht erweitert.

Der Feed scannt höchstens 600 aktuelle regionale Datensätze sowie eigene
Einreichungen und liefert bis zu 200 erlaubte Ansichten. Weitere Seiten bzw.
ein geographischer Suchindex sind für grössere Datenmengen gesondert umzusetzen.

## Bereitstellung und Prüfung

Produktiv: Projekt `quartinaut`, Standard-Datenbank `(default)` in `nam5`.
Die zweite Datenbank `default` (Enterprise, `eur3`) wird nicht verändert.
`firebase/audience.firestore.rules` basiert auf den vor der Änderung gesicherten
Live-Regeln; nur die neuen privaten Namensräume sind ergänzt. Der breitere
Entwicklungsentwurf `firebase/firestore.rules` enthält dieselben Ergänzungen,
wird mit diesem Rollout aber nicht anstelle des Live-Standes veröffentlicht.

```bash
npm ci --prefix functions/audience
npm --prefix functions/audience run check
npx -y firebase-tools@latest emulators:exec --config firebase.audience.json --only firestore --project demo-quartinaut-rules 'npm --prefix firebase/rules-tests run test:audience'
npx -y firebase-tools@latest deploy --project quartinaut --config firebase.audience.json --only functions:quartinaut-audience --non-interactive
npx -y firebase-tools@latest deploy --project quartinaut --config firebase.audience.json --only firestore:rules --non-interactive
```

Die Regeln sind ein geprüfter Prototyp und vor breiter öffentlicher Nutzung
weiter zu prüfen. Tests decken getrennte Konten, andere Gemeinden/Kantone,
Distanz, fehlenden/abgelaufenen Standort, Rollenwechsel, abgelaufene Ansichten,
Schema-Manipulation, fremde Fotos und private Chat-Bindung ab. Die unveränderte
Legacy-Kantonsabfrage ist als Regressionstest enthalten. Ein echter Gerätetest
mit GPS und Android-Geocoder ist in dieser Arbeitsumgebung nicht verfügbar.


Ergänzende Bestandsprüfung: 11 von 12 vorhandenen Chat-/Storage-Tests bestehen
lokal. Der alte Chatmedien-Uploadtest liefert `storage/unauthorized`; dasselbe
Ergebnis wurde mit den unveränderten Regeln aus Commit `2797116` reproduziert.
Die produktiven Storage-Regeln wurden bei diesem Rollout nicht geändert.
