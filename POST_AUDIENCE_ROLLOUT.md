# Beitragsreichweite: technische Freigabe vor Live-Schaltung

Android Build 30 enthält eine neue lokale Auswahl in **Hilfe/Anliegen** und **Quartier+**: Umkreis 5/10/25/50 km, Gemeinde, Kanton und Schweizweit. Der Umkreis erfordert freiwillige Standortfreigabe. Die Position wird auf ungefähr 1 km gerundet; keine kontinuierliche Standortverfolgung.

**Wichtig:** `NativePostAudience.kt` setzt `AUDIENCE_BACKEND_READY = false`. Eine Veröffentlichung ausserhalb der bestehenden Kantons-Reichweite wird absichtlich blockiert, da die produktiven Firestore-Regeln und der bestehende `quartinautHub`-Callable die neuen Zielgruppen noch nicht zuverlässig einschränken. Die Beschränkung auf den bisherigen Kanton kann wie bisher benutzt werden. Keine andere Reichweite als technisch aktiv darstellen.

Vor Freigabe:
1. Server: den validierten Zielgruppen-Scope für `requests` und `communityHubItems` in den jeweiligen Schreib-/Freigabewegen prüfen, persistieren und bei ALLEN Lesewegen konsistent anwenden, darunter Quartier+, Radar, Favoriten, Suche, Detail und Fotozugriffe, Push/Benachrichtigungen und Offline-Cache.
2. Firestore: Leserechte durchsetzen. Bestehende Regeln erlauben canton-basiertes Lesen; für Radius sind dynamische Geodistanzabfragen über ein authentifiziertes serverseitiges Lese-API notwendig, nicht nur Compose-Filter. Die alten Client-Versionen und Web-App dürfen diese Einschränkung ebenfalls nicht umgehen können.
3. Radius: keine präzisen Standortdaten in öffentlichen Dokumenten zurückgeben; Zugriffsentscheidungen brauchen eine robuste Distanz-/Standortverifikation und definierte Datenschutz- und Missbrauchsregeln.
4. National: sicherstellen, dass die Feed-Abfragen schweizweite Beiträge tatsächlich laden können. Bestehende Canton-Queries können dies nicht leisten.
5. Integration: beide Formular-Endpunkte, bestehende Beiträge, Moderation, Bearbeitung, regionale Benachrichtigungen, private Fotos und Firebase Security-Rule-Emulatortests mit zwei Konten (gleiche/andere Gemeinde, Kanton, Umkreis, schweizweit) durchtesten.
6. Erst dann `AUDIENCE_BACKEND_READY` auf true setzen, neue APK ausliefern und Firebase in der richtigen Standard-Datenbank bereitstellen.

Schweizer SVG-/Wappendaten und die Firestore-Enterprise-Datenbank bleiben unverändert.

## Prüfung vom 16. November 2026

Im Entwicklungsstand `0decad8` fehlen im Repository die Implementierungen der
bereits produktiv aufgerufenen Dienste `quartinautHub` und `quartinautPhoto`.
Die vorhandenen zusätzlichen Funktionen ersetzen diese Dienste nicht.
Ein Firebase-Zugang für eine Prüfung bzw. Bereitstellung ist in der aktuellen
Arbeitsumgebung nicht eingerichtet.

Konkrete Befunde für die nächste Backend-Änderung:

- `requestInUserScope()` in `firebase/firestore.rules` wertet `audienceLevel`
  nicht aus. Die direkten Schreibregeln für `requests` beschränken den Wert
  ebenfalls nicht. Eine umgebaute App könnte deshalb die lokale UI-Sperre
  umgehen. Die UI-Sperre ist keine serverseitige Sicherheitsregel.
- `QuartinautRepository.createRequest()` überträgt bereits `audienceLevel`,
  aber keinen Umkreis-Mittelpunkt. Ein späterer Umkreis-Rollout muss diesen
  Schreibweg und die getrennte private Speicherung der Koordinaten ersetzen.
- Die direkten Android-Feed-Abfragen filtern auf Kanton und Status. Werden
  Gemeinde-/Umkreisbedingungen nur in die Leseregeln ergänzt, werden solche
  Abfragen insgesamt verweigert: Firestore-Regeln filtern kein Abfrageergebnis.
  Der Wechsel auf einen geschützten Server-Leseweg muss dazu passen.
- `functions/enhancements` verwendet für Radar und Favoriten bisher nur den
  Kanton; `functions/nativeChats.startChat` prüft ebenfalls nicht die geplante
  Beitragsreichweite. Diese Admin-SDK-Zugriffe umgehen Firestore-Regeln und
  brauchen dieselbe serverseitige Zugriffsentscheidung wie Detail und Fotos.

Die produktiven Funktionsquellen und der Firebase-Zugang sind daher für eine
vollständige Umsetzung erforderlich. Die Reichweitenfreigabe bleibt bis zur
gemeinsamen Umsetzung und Prüfung deaktiviert. Diese Prüfung hat keine
produktiven Firebase-Regeln oder Funktionen verändert.

### Nach erfolgreicher Firebase-Anmeldung

Der Zugriff auf `quartinaut` wurde am selben Tag erfolgreich hergestellt.
Die aktive App verwendet weiterhin die Standard-Datenbank `(default)` in
`nam5`. Die zweite Datenbank `default` ist Enterprise in `eur3` und wird nicht
verändert. Die aktuellen Firestore- und Storage-Regeln wurden vor einer
Änderung lokal gesichert. Sie unterscheiden sich vom breiteren, bisher nicht
bereitgestellten Regelentwurf unter `firebase/`.

Die produktiven Quellen von `quartinautHub`, `quartinautPhoto` und
`quartinautTarget` wurden über die Google-Cloud-Funktions-API abgerufen und
lokal gesichert. Damit ist die vorher fehlende Quellcodebasis verfügbar.
Die genaue Freischaltung der neuen Beitragsreichweiten ist noch zu klären;
es wurden keine Live-Regeln oder Standort-Funktionen geändert.

SHA-1 und SHA-256 der neuen dauerhaften Android-Signieridentität wurden
erfolgreich bei der bestehenden Firebase-Android-App registriert; die
öffentlichen Registrierungsnachweise liegen unter `signing/`.
