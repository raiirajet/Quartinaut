# Quartinaut 5.4 – Stand der nativen Android-Rekonstruktion

Stand: 13. November 2026. Grundlage: hochgeladener, lokal geprüfter Quartinaut-5.4-Quellcode, nicht ein Reverse-Engineering einer unbekannten Website.

## Native Basismodule

| Bestandteil | Umsetzung | Nachprüfung |
|---|---|---|
| Compose Material 3, Android Navigation | Nativ | Gerätetest offen |
| Quartinaut-Logo und 5 originale 3D-Navigationsbilder | In APK gebündelt | Bilddarstellung auf Gerät testen |
| Offizielle 26 Kantone, 2'110 Gemeinden (BFS 2026) | Nativ, offline als Datenliste | Gemeindesuche testen |
| Klickbare Kantonskarte mit offiziellen Kürzeln | Natives Canvas, lokales SVG | Präzision der kleinen Kantone testen |
| Kanton-Zoom und Gemeinde-Polygone | Native Android-Pfade, öffentliches 2025-GeoJSON | 2025/2026-Gemeindefusionen beachten; Netzwerk nötig |
| Kanton-Steckbriefe, Hauptort, Gemeindezahl, öffentliche Registrierungen | Firestore/Offline-Stammdaten | Live-Rechte prüfen |
| E-Mail-Anmeldung und Privatkonto-Registrierung | Firebase Android SDK | Nutzeranlage und Verifikation E2E testen |
| Geschützte Benutzerprofile | Firestore, Auth | Alle Rollenkonstellationen testen |
| Persönliche Startseite, Dark Mode, Benachrichtigungsthemen | Nativ, quartinautHub-Settings | Synchronisation testen |
| Dashboard, Schwarzes Brett, Beitragserstellung | Compose, Firestore | Filter / Freigabe testen |
| Private 1:1-Chats | Compose, Firestore | Push / Sonderfälle fehlen |
| Quartier+: Marktplatz, Leihbörse, Vereine, Fundbüro, Projekte, Mängel, Kalender | Native Listen, Detailseiten und Erstellformulare | Backend-End-to-End testen |
| V5.0: Marktreservierungen, Ausleih-Zeitfenster, Vereinsanmeldungen | Callable-API integriert | Stornierung und volle Verwaltungs-Flows unvollständig |
| Öffentliche Likes/Kommentare | Geschützte Social-Cloud-Function | Live testen |
| Bilder aus Beiträgen | Authentifizierter Callable-Fotoabruf, native Galerie | Begrenzungen/Quoten testen |
| Offizielle Mitteilungen & Alarme | Native Listen | Lesebestätigungen unvollständig |
| Moderationsbasis für Quartier+ | Approve/Reject über serverseitige Funktion | Vollständige Administration fehlt |

## Nicht oder erst teilweise in dieser APK

- **Komplette Administration** inklusive Benutzerfreigabe, Verwaltung aller Kontoarten, Einladungen, Verifizierungs- und Standortwechselanträge, Audit-Log.
- **Foto-Upload**, Kamerazugriff, EXIF-Entfernung/Komprimierung und private Verifikationsfotos; der geschützte Fotoabruf ist vorhanden.
- **Push-Benachrichtigungen/FCM**, Android App Check, Google-Anmeldung, Passkeys, Deep Links, Hintergrunddienste.
- Alle Detailfunktionen rund um Chats (Papierkorb, Stummschaltung, ungelesen), Boards (Umkreissuche, Urgency-Filter, Favoriten), Moderationsfälle und Community-Kalender.
- Alle Einstellungen, Rechtsseiten, Download-/Exportfunktionen, Mehrsprachigkeit und Assistenzfunktionen.
- Vollständig offline verfügbare 2026-Gemeindepolygone und Gemeindewappen aller Gemeinden.
- Vollständige Geräte-, Regression-, Accessibility- und Firebase-Integrationsprüfungen.

## Architektur und Sicherheit

Keine WebView oder Website-Oberfläche. Keinerlei ungeprüfte Regeländerung an Firebase. Der vorhandene Web-Bestand ist unangetastet.

**Achtung:** Der aktuelle Debug-Build benutzt die vorhandene Produktions-Firebase-Konfiguration für die Kommunikation; Testeinträge können echte Daten erzeugen. Die Einrichtung einer eigenen Android-App in der Firebase-Konsole ist **vor Veröffentlichung erforderlich**. Prüfungen des GitHub-Kotlin-Builds beweisen Kompilierbarkeit, nicht fehlerfreie Anwendung auf echten Geräten.

Gemeindegrenzen: vereinfachter Stand 01.01.2025, Quelle `samkhavandi/Swiss_Geography_Look_Ups`; Namen/BFS: 05.11.2026. Bei Fusionen können Grenze und Gemeindeliste auseinanderfallen. Offizielle Kanton-/Gemeindewappen sind noch nicht als eigenständige Assets eingebunden.

## Nachträge 5.4.1 Preview

- Neuer nativer Dashboard-Hintergrund mit Bildauswahl, Vorschau und Löschbestätigung. **Server-Funktion vorbereitet, noch nicht deployed**, daher vorerst kein geräteübergreifender Produktivbetrieb.
- Verifizierte Benutzer können nach Freigabe der Cloud Function nur den Hintergrund des eigenen Kontos speichern/lesen. Firestore-Metadaten werden nicht direkt an Android ausgeliefert.
- Neue serverseitige Quoten, Bildformatvalidierung, Entfernung von Metadaten und eine feste private Storage-Objektstruktur.
- Chats beenden alte Firestore-Abonnements beim Wechseln. Eingaben werden erst nach erfolgreichem Schreiben gelöscht.
- Anliegenformular verlässt die Seite erst nach bestätigtem Speichern; Alarmanzeige schliesst fremde Kantone aus.
- Web-Preview für kompatiblen Serverhintergrund ist separat verfügbar; lokal gespeicherte Fotos werden nicht automatisch in die Cloud migriert.
- Weiterhin offen: vollständig validierter Firebase-Live-Stand, Registrierungs-/Admin-Ende-zu-Ende-Test, signiertes Produktionsrelease, FCM und alle Spezialfunktionen. Siehe Audit-Datei.
