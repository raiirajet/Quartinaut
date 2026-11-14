# Quartinaut 5.7.1 – Ausleihen und Firebase-Diagnose
Stand: 14.11.2026 · Entwicklungszweig `native-android-v1`.

## Beobachteter Fehler
Vom Benutzer bereitgestellte Android-Screenshots zeigen:
- Eigener Leihartikel, kein Ausleihknopf (Selbstausleihe ist zu Recht nicht erlaubt).
- Leerer Ausleih-Kalender trotz vorhandenem Inserat.
- Fehlermeldung `quartinautEnhancements` sei noch nicht veröffentlicht.
- `PERMISSION_DENIED` bei direkter Firestore-Abfrage der Chatliste.

## Codeänderungen
- Alle veröffentlichten **fremden** Leihangebote: `quartinautV50` Aktion `loan.request`;
  Auswahl Abholung/Rückgabe in Europe/Zurich, Zeitraumvalidierung, einmalige Operations-ID,
  Erfolgsmeldung und Weiterleitung zum Ausleihkalender.
- Eigene Angebote: nur Verwaltungslink, keine Selbstausleihe.
- Kalender: Unterscheidung zwischen Angeboten und tatsächlichen Anfragen,
  Anzeige echter Buchungsfehler statt irreführender Leermeldung.
- Private Chats: keine eigenständige clientseitige `chats`-Listenabfrage mehr;
  Liste, Erstellung und Nachrichten über `quartinautPrivateChats`.
  Keine Firestore-Regelöffnung.
- Radar / Meine Beiträge: klar bezeichnete lokale, schreibgeschützte Fallbacks
  bei nicht bereitgestellter `quartinautEnhancements`-Funktion.
- Preis pro Ausleihtag und Verfügbarkeitsangaben für Deutsche/Schweizer Nutzer.

## Was Android allein nicht beheben kann
Die Screenshots zeigen, dass der optionale Callable-Dienst `quartinautEnhancements`
am Live-Standort fehlt. Die hierfür vorgesehene Cloud Function liegt im
Repository unter `functions/enhancements`, wurde durch das GitHub-Push
**nicht** bei Firebase veröffentlicht.

Prüfung nach Anmeldung in der Firebase CLI mit autorisierten Projektzugriffen:

```sh
firebase functions:list --project quartinaut
npm --prefix functions/enhancements test
node --check functions/enhancements/index.js
```

Erst nach Sichtprüfung, Versions- und Zugriffsprüfung des Produktionsprojekts:
gezielt **nur den fehlenden Callable** der isolierten Codebase veröffentlichen:

```sh
firebase deploy --project quartinaut --config firebase.enhancements.json --only functions:quartinaut-enhancements:quartinautEnhancements
```

Kein `--force`, kein ungezieltes Deployment aller Functions. Keine gleichzeitige
Änderung der Firestore-/Storage-Regeln. Das App-Projekt nutzt **(default)**,
Standard Firestore, `nam5`; die Enterprise-Instanz `default` in `eur3`
ist nicht Ziel dieses Releases und darf nicht verändert werden.

Der geschützte Chat-Dienst `quartinautPrivateChats` existiert nach dem
bisherigen Projektstand produktiv in `europe-west6`. Ihn nicht ohne
Abgleich von Live-Version und Kandidaten-Quellcode ersetzen. Wenn die Chat-
API trotz entferntem Legacy-Listener fehlschlägt, Fehlercode über
Verbindungsdiagnose ermitteln und erst dann den API-Vertrag untersuchen.

## Manuelle End-to-End-Tests (zwei getrennte verifizierte Konten)
1. Konto A veröffentlicht ein Leihangebot, das freigegeben wurde.
2. Konto A sieht „eigener Eintrag“ und kann sich nicht selbst ausleihen.
3. Konto B öffnet das fremde Angebot, wählt gültige Daten und sendet
   **eine** `loan.request`-Anfrage.
4. Im Ausleih-Kalender von Konto A erscheint `requested` samt „Annehmen“/
   „Ablehnen“; Konto B sieht dieselbe Anfrage mit Stornierung.
5. Annahme: beide sehen `accepted`; anschliessend Rückgabe `returned`
   über das Besitzerkonto testen.
6. Überlappende Anfragen, ungültige Zeiträume, Fremdkanton und blockierte
   Konten müssen serverseitig abgelehnt werden.
7. Geschützte Chatliste (Konto A/B) testen, Chatstart und Send/Read; auf
   Firestore `PERMISSION_DENIED` und unberechtigte Chat-Lesezugriffe achten.
8. Radar / Meine Beiträge vor und nach dem gezielten Erweiterungsdeployment
   testen. Vorher nur lokale Leseansicht, nachher erlaubte Aktionen.
9. Im Gerätestatus `Firebase Debug App Check` nicht mit Produktions-App-Check
   verwechseln. Debug-APK nur für Tests einsetzen.

**Wichtig:** Ein erfolgreicher CI-Kotlin-Build testet nicht automatisch die
live arbeitende `quartinautV50`-Function, die Überlappungs-/Reservierungsregeln
oder die echte Benutzer-Authentifizierung. Die Backend-Deployments wurden
in diesem Commit bewusst **nicht** ausgeführt.
