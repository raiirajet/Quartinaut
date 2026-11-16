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
