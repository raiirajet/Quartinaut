# Quartinaut 5.4 – vertiefter Native-Android-Audit

**Datum:** 13.11.2026  
**Quellen:** hochgeladenes Original `Quartinaut_5.4_Interaktive_Schweizkarte_Firebase_CLI.zip`, darunter `hosting/app-release-540.js`, `hosting/src/v462/dashboard-background.js`, `rules/firestore.rules`, `rules/storage.rules`, `functions/sicherheitsupdates/quartinautHub/index.js`, `functions/v50/index.js`, und der Android-Branch `native-android-v1`.

**Prüfumfang:** Quellcode-, Rules- und Funktionsschnittstellenvergleich; GitHub-Android-Kompilierung und ausgewählte Node-Tests. Keine Live-Regeländerung, kein Firestore-/Storage-Write, kein Firebase-Deployment, kein physischer Android-Gerätetest. Auf den produktiven Firebase-Konsolenzustand wurde nicht allein aufgrund des ZIP-Inhalts geschlossen.

## Zusammenfassung

Android-Komponenten sind wirklich nativ (Compose statt WebView). Die Oberfläche ist noch **nicht** vollständig funktionsgleich mit Version 5.4. Ziel ist eine ergänzende native App, die vorhandene Firebase-Schnittstellen sicher nutzt, ohne andere Konten, Daten oder die Website zu verändern. Die technische Qualität muss vor einer produktiven Veröffentlichung mit Gerätetests und einem echten Rollentest nachgewiesen werden.

## Befunde und Prioritäten

| Priorität | Befund | Betroffene Stelle | Umsetzung / notwendige Aktion |
|---|---|---|---|
| P0 | Persönliches Hintergrundfoto war rein lokal; kein Gerätesync | `hosting/src/v462/dashboard-background.js` | **Code vorbereitet:** neuer privater Cloud-Endpunkt `quartinautAppearance`, Bild-Upload/Download/Entfernen, native Vorschau und Web-Bridge-Vorschau. Noch nicht live deployed |
| P0 | Aktuelle Storage-Regeln erlauben nur Verifikationsfotos, nicht Hintergründe | `rules/storage.rules` | Kein öffentliches Öffnen der Regeln. Hintergrund ausschliesslich über geprüfte Callable Function und Admin-SDK speichern |
| P0 | Produktive Android-Firebase-App-Registrierung/Signierung fehlt | `QuartinautRepository.kt`, `app/build.gradle.kts` | Eigene Android App ID, SHA-256-Fingerprints, `google-services.json`, App Check, Release-Keystore und CI-Signierung kontrolliert einrichten |
| P0 | Der neue Serverdienst ist vorbereitet, aber noch nicht veröffentlicht | `functions/appearance/`, `firebase.appearance.json` | Backend separat, gesichert, geprüft deployen; anschliessend 2 Geräte/2 Konten vollständig testen |
| P0 | Konto-Löschfunktion berücksichtigt neu eingeführte Hintergrundobjekte noch nicht | vorhandener `deleteOwnAccountData`-Workflow | Serverdatei und private Metadaten beim Kontolöschen entfernen; vollständige Datenexport-/Löschprüfung |
| P1 | Fehlende native Funktionen beim Hochladen/Verifizieren von Bildern | Native Gallery, `quartinautPhoto` | Native Fotoauswahl, Qualitätsregeln, EXIF-Schutz, serverautorisierten Upload und Verifizierungs-Workflow ergänzen |
| P1 | Adminansichten sind nur ein Auszug aus der Web-Verwaltung | `NativeSettingsAndAdmin.kt` | Benutzerfreigaben, Rollen- und Standortwechsel, Moderation, Audit-Log und Verwaltungsfilter nachbauen; Adminrechte immer aus Custom Claims + Backend |
| P1 | Rollenkontext wird clientseitig teilweise aus dem Profil abgeleitet | `QuartinautRepository.kt::isAdmin` | UID-gebundene Custom Claims für Anzeige prüfen; serverseitige Prüfung bleibt massgeblich |
| P1 | Geschützte Foto-Rückgaben und Reservierungen wurden nur statisch geprüft | `NativeProtectedGallery.kt`, `functions/v50/index.js` | E2E-Funktionstests aller Statusübergänge und Rollen (Käufer, Verkäufer, Eigentümer, Admin) |
| P1 | Browser-Bestandsbilder waren mit reiner lokaler Speicherung nicht mobil synchron | Web 5.4 | **Vorschau vorbereitet und statisch getestet:** Migration ausschliesslich nach ausdrücklicher Zustimmung |
| P1 | Eingaben wurden in der Native-App sofort verworfen, auch wenn der Server nicht speicherte | `createRequest` und `sendChat` | **Korrigiert:** Navigation bzw. Eingabeleerung erst nach erfolgreicher Speicherung |
| P1 | Beim Öffnen weiterer Chats konnten alte Live-Listener aktiv bleiben | `openChat`, `closeChat` | **Korrigiert:** alter Listener wird entfernt, bevor der nächste Chat geladen wird |
| P1 | Alarme aus anderen Kantonen konnten in der Anzeige landen | `MainActivity.kt` | **Korrigiert:** Kanton und Gemeindekontext werden gemeinsam berücksichtigt |
| P1 | Neue persönliche Bilder benötigen Missbrauchs-/Kostenbegrenzung | `functions/appearance/index.js` | **Implementiert:** Eigentümerprüfung, verifizierte E-Mail, JPEG-Rekodierung ohne Metadaten, Pixel-/Byte-Grenzen und pro-UID-Schreiblimit |
| P1 | Kein natives FCM/Push, Google Login oder Deep-Link-Handling | Android Gradle/Manifest | Nach Firebase-Registrierung ergänzen, Logout/Token-Widerruf und Benachrichtigungen testen |
| P2 | Schweizkarte enthält Gemeindegrenzen von 2025 und Namen/BFS 2026 | `NativeMunicipalityMap.kt`, `hosting/src/v54/swiss-map.mjs` | Datenstand sichtbar kennzeichnen (bereits so); später korrekte 2026-Polygone und Gemeindewappen integrieren |
| P2 | Die native Gemeindekarte lädt die GeoJSON-Quelle erneut, wenn Kantone geöffnet werden | `NativeMunicipalityMap.kt` | Sicheren lokalen Cache, ETag/TTL, Offline-Fallback und möglichst gebündelte Geodaten ergänzen |
| P2 | Dunkelmodus hat noch hart codierte helle Farben | Compose-Screens | Material-Theme-Tokens statt `Color.White` für Karten/Listen; Kontrast-/AMOLED-Test |
| P2 | Hintergrundfoto kann auf manchen Geräten EXIF-gedreht erscheinen | `NativeDashboardBackground.kt` | Orientierung beim Import korrigieren, native Verschiebe-/Zoom-Zuschneideansicht ergänzen |
| P2 | Komplettes Dashboard-Kachelmanagement der Website fehlt | `MainActivity.kt` | Anzeigen, Ausblenden, Sortieren, Einklappen, benutzerspezifisch servergespeicherte Einstellungen |
| P2 | Full-Feature Suche/Favoriten/Filter und Offline-Fehlermeldungen fehlen noch | Android Quartier+ | Suchindizes, Filter, Favoriten, sichere Paging-Queries, Retry und transparente Leerezustände |
| P2 | Geräte-/Tablet-Layouts sind noch vereinfacht | Compose Screens | Responsive 2-Spalten-Modus, grössere Karte, Seitenleiste, Landscape und Foldables |
| P2 | Keine vollständigen automatisierten Instrumentation/Accessibility-Tests | GitHub Actions | UI-Tests für Login, Profil, Karte, Chats und Ausleihe; TalkBack, Textskalierung und 48dp-Ziele |
| P3 | Kein nativer Kamera-/QR-/Share-Flow und keine komfortable Konto-Exportansicht | Native App | Nach Kern-Funktionsparität ergänzen, ohne Privacy-/Security-Komponenten zu schwächen |
| P3 | Debug-APK wurde mit temporärer Signatur gebaut | GitHub CI | Vor einem Release stabile Signatur, Versionsstrategie, Updatepfad und Android App Bundle (AAB) |

## Neuer Server-Hintergrund: technische Vertrauensgrenzen

Der Android-Client sendet nur ein **nach Benutzeraktion ausgewähltes und neu als JPEG kodiertes** Bild. Die Cloud Function verwendet ausschliesslich die UID aus dem verifizierten Firebase-Auth-Kontext, niemals eine frei übergebene Fremd-UID. Sie prüft Konto- und E-Mail-Status, verkleinert das Bild mit Sharp und entfernt Metadaten. Es wird unter `dashboard-backgrounds/<uid>/current.jpg` im privaten bestehenden Firebase Storage gespeichert. In Firestore werden Metadaten unter `dashboardBackgrounds/<uid>` abgelegt; die Funktion ist der einzige Lese-/Schreibpfad. Die aktuellen Storage-Regeln erlauben keine direkte Einsicht in diesen Pfad.

**Nicht live:** Die Callable Function wurde bewusst nicht deployt. Bis dahin meldet die Android-Oberfläche den Serverdienst als nicht verfügbar; die separate Web-Vorschau lässt nur lokale Speicherung zu. Keine gegenteilige Erfolgsbehauptung.

## Empfohlene Release-Reihenfolge

1. Original-Live-Regeln, Hosting- und Functions-Codebases sichern; benötigte Firebase-Ressourcen und bestehende Regelsituation gegen den Live-Stand prüfen.
2. Neue Appearance-Funktion samt Quoten, Lösch-Lifecycle und Tests in separater Codebase freigeben. Nur diese Funktion deployen.
3. Android als eigene Firebase-App registrieren; Signing, App Check, Push-Fingerprints und einen vom Livebetrieb getrennten Testablauf vorbereiten.
4. Gerätetests: Login, Bestätigungsmail, Kontoanlage, eigenes/fremdes Konto, Upload/Download/Entfernen über zwei Geräte, Ausloggen und Konto löschen.
5. Erst danach Web-Vorschau inkl. bewusst ausgelöster Übernahme bestehender lokaler Fotos freigeben; Cache-Version kontrollieren.
6. Funktionsparität der Administration, Chats, V5.0-Reservierungen, Bild-Uploads, Filtersuche und Offline-Bedienung herstellen.
7. Barrierefreiheit, Performance und Releasesignierung abschliessen.

## Abnahmekriterien für die Background-Funktion

- Benutzer A kann Bild A hochladen und auf Android sowie Web nach Anmeldung sehen.
- Benutzer B sieht weder Bild A noch Metadaten, auch nicht über manipulierte Firebase-Requests.
- Keine direkte Storage-Regel für `dashboard-backgrounds/**` wird geöffnet.
- Bilder mit falschem Typ, übergrossen Daten und fremden Objektpfaden werden serverseitig abgelehnt.
- Fotos werden ohne EXIF/GPS gespeichert, private Cache-Daten erscheinen nach Abmeldung nicht für ein anderes Konto.
- Entfernen löscht Serverobjekt und Metadaten und synchronisiert beide Oberflächen.
- Bisherige lokal gespeicherte Bilder bleiben ohne ausdrückliche Aktion lokal.
- Beim vollständigen Löschen eines Kontos werden auch neue Hintergrundobjekte entfernt.
- Firebase Hosting/Webclient, bestehende Chats und Datensätze bleiben erhalten.

**Merksatz:** Ein erfolgreicher GitHub-Kompiliervorgang bestätigt nur einen baubaren Quellcode. Er ersetzt keine Live-Backend- oder Geräteprüfung.
