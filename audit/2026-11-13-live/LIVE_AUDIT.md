# Quartinaut Native – Live-Audit vor Weiterentwicklung

Stand: 13. November 2026, Europe/Zurich

## Umfang und Annahmen

- GitHub: `raiirajet/Quartinaut`, Zweig `native-android-v1`, Commit `fde2cbb1670ee8b75fd62a2ddf6326a6e449f816`.
- Firebase: Projekt `quartinaut`, Projektnummer `815175119171`.
- Ziel-Datenbank ist `projects/quartinaut/databases/(default)`, weil Android und alle produktiven Firestore-Trigger ausdrücklich `(default)` verwenden.
- Es wurden keine Regeln, Daten, Functions oder Benutzer verändert. Dokumentwerte und Dokument-IDs wurden nicht in die Audit-Artefakte übernommen.

## Live-Infrastruktur

| Bereich | Live-Stand |
|---|---|
| Firestore `(default)` | Standard Edition, `nam5`, pessimistische Nebenläufigkeit |
| Zusätzliche Datenbank `default` | Enterprise Edition, `eur3`; vom aktuellen Android-Code nicht verwendet |
| Wiederherstellung | PITR deaktiviert, kein Backup-Zeitplan, Löschschutz deaktiviert |
| Firebase Apps | Eine Web-App; keine Android-App registriert |
| Cloud Functions | 37 aktive Funktionen, Node.js 22, überwiegend `europe-west6` |
| Native Chat-Backend | `quartinautPrivateChats` aktiv |
| Hintergrundbild-Backend | `quartinautAppearance` aktiv |
| Erweiterungs-Backend | `quartinautEnhancements` nicht vorhanden |
| Firestore-Indizes | 14 zusammengesetzte Indizes |
| Storage | Nur `verification-photos/{uid}/{file}` direkt zugelassen; sonst Default-Deny |

## Rollenbestand ohne personenbezogene Werte

| Feld | Verteilung |
|---|---|
| Benutzerprofile | 4 |
| Rolle | 1 `admin`, 3 `resident` |
| Kontotyp | 4 `resident` |
| Kontostatus | 3 `active`, 1 `disabled` |
| Verifiziert | 2 `true`, 2 `false` |
| Verifikationsstatus | 2 `verified`, 2 `none` |
| Gemeindestatus | 4 `none` |

Adminrechte werden in Regeln aus Auth-Claims (`admin == true` oder `role in ['admin','area_admin']`) gelesen. Normale Benutzer können ihr Rollenfeld nicht selbst ändern. Gemeinde-Verwaltung wird zusätzlich über geschützte Profilfelder geprüft.

## Vorhandene Live-Datenmodelle

Es existieren 16 Top-Level-Collections. Feldnamen und Typen wurden aus höchstens 20 Beispieldokumenten je Collection abgeleitet; Werte wurden nicht gespeichert.

| Collection | Zentrale Felder |
|---|---|
| `users` | `uid`, `email`, `displayName`, `role`, `accountType`, `accountStatus`, `areaKey`, `cantonCode`, `verified`, `verificationStatus`, `dashboard`, `onboarding` |
| `requests` | `uid`, `title`, `text`, `type`, `category`, `status`, `areaKey`, `cantonCode`, `createdAt`, `expiresAt`, `reports` |
| `communityHubItems` | `ownerUid`, `kind`, `title`, `description`, `category`, `status`, `priceChf`, `startsAt`, `endsAt`, `capacity`, `venue` |
| `communityHubGroupPosts` | `groupId`, `uid`, `authorName`, `message`, `createdAt` |
| `communityHubQuotas` | `uid`, `kind`, `day`, `count`, `updatedAt` |
| `communitySocial` | `id`, `kind`, `likes`, `updatedAt` |
| `communityUserSettings` | `topics`, `digest`, `quietHours`, `homeView`, `updatedAt`; Untercollections werden serverseitig verwaltet |
| `communitySearchIndex` | `sourceId`, `kind`, `tokens`, `sortAt`, `indexedAt`, `area`, `cantonCode` |
| `communityIndexControl` | `status`, `sources`, `counts`, `startedAt`, `completedAt` |
| `notificationPreferences` | `uid`, `enabled`, `alerts`, `officialNotices`, `bulletin`, `chats`, `quietHours`, `keywordRules` |
| `deviceTokens` | `uid`, `token`, `active`, `areaKey`, `cantonCode`, `createdAt`, `updatedAt` |
| `pushDeliveries` | `type`, `contentId`, `status`, `requested`, `successCount`, `failureCount`, `attemptedAt` |
| `pushTests` | `uid`, `status`, `tokenHint`, `createdAt`, `updatedAt` |
| `verificationRequests` | `uid`, `accountType`, `status`, `method`, `proofType`, `idPhoto`, `decidedAt`, `decidedBy` |
| `auditLog` | `action`, `actorUid`, `targetUid`, `detail`, `area`, `createdAt` |
| `publicStats` | `totalUsers`, `cantonCounts`, `updatedAt` |

Noch nicht als Live-Top-Level-Collection vorhanden sind unter anderem `chats`, `chatMessages`, `loanReservations`, `marketplaceHolds`, `communityCalendar`, `quartinautTrustReviews`, `quartinautLoanHandover` und `quartinautUserReminders`. Die Regeln beziehungsweise Functions können einige davon bei der ersten Nutzung anlegen.

## Sicherheitsprüfung der Regeln

Gesamtbewertung: **2/5 – major**. Details stehen in `security-audit.json`.

Hauptgründe:

1. `chatMessages.create` bindet Teilnehmer und Chat-ID nicht zuverlässig an das Chat-Dokument.
2. Mehrere Create-/Update-Regeln besitzen keine vollständige Schema-, Typ- und Längenprüfung.
3. `deviceTokens` und `bulletinFilters` prüfen beim Update den bisherigen Eigentümer nicht ausreichend.
4. Chat-Zustandsfelder anderer Teilnehmer können durch einen Teilnehmer überschrieben werden.
5. Verifikationsfotos sind ersetzbar und akzeptieren jedes `image/*` statt ausschliesslich serverseitig neu kodiertes JPEG.

Positiv: unbekannte Firestore-Pfade sind standardmässig gesperrt, Storage besitzt ein vollständiges Default-Deny, Adminrechte kommen aus Claims und PII-haltige Benutzerprofile sind nur für Eigentümer und Administratoren lesbar.

## Reale Vollständigkeit der zwölf Bereiche

| Nr. | Bereich | Repo | Live-Firebase | Ergebnis |
|---|---|---|---|---|
| 1 | Chats | UI und Callable-Fallback vorhanden | Private-Chat-Callable und Push-Trigger aktiv; Regeln haben Integritätslücken; Android besitzt kein FCM | Teilweise |
| 2 | Beiträge | UI für Bearbeiten/Status ruft `quartinautEnhancements` | Function fehlt; Vorgänge sind nicht live nutzbar | Nicht live |
| 3 | Foto-Uploads | Picker, Komprimierung und `photo.put` vorhanden | Erweiterungs-Function fehlt; neue Uploads funktionieren nicht | Nicht live |
| 4 | Radar | Filter-UI und `radar.list` vorhanden | Erweiterungs-Function fehlt; keine native Push-Registrierung | Nicht live |
| 5 | KI-Inserate | Lokale ML-Kit-Erkennung und Titelübergabe | Kein Backend erforderlich; Beschreibung und Fotoübergabe fehlen | Teilweise lokal |
| 6 | Ausleih-Kalender | V50-Aktionen und Zeitraumfelder vorhanden | `quartinautV50` aktiv; keine Live-Reservierungsdokumente, keine Monatsansicht | Teilweise |
| 7 | Schweizkarte 2026 | Gemeindeverzeichnis 2026, Geometrie 2025 | Keine amtlichen 2026-Polygone/Wappen im Backend | Teilweise |
| 8 | Vereinsverwaltung | V50-Anmeldung und einfache Statusaktionen | V50 aktiv; keine vollständige Mitglieder-/Beitragsverwaltung | Teilweise |
| 9 | Vertrauensprofile | `trust.profile` und `trust.review` vorgesehen | Erweiterungs-Function und neue Review-Collection fehlen | Nicht live |
| 10 | Gemeindekalender | Listen, Kalenderexport, Reminder-UI | Erweiterungs-Reminder fehlt; keine native Benachrichtigungsplanung | Teilweise |
| 11 | QR-Übergabe | QR-Erzeugung/-Scan ruft Erweiterungsdienst | Erweiterungs-Function fehlt | Nicht live |
| 12 | Offline | 72-Stunden-Cache öffentlicher Inhalte und Gemeindeliste | Lokal nutzbar; keine vollständige Sync-/Konfliktlogik | Teilweise lokal |

## Freigabeschranken für die nächste Phase

- Keine unbeschränkte Veröffentlichung von Firestore- oder Storage-Regeln.
- Neue Regeln zuerst gegen Emulator-Angriffstests sowie bestehende Web- und Android-Abfragen prüfen.
- Eigene Firebase-Android-App und stabile Signierung einrichten, bevor App Check oder produktive FCM-Tokens aktiviert werden.
- `quartinautEnhancements` erst nach Funktions-, Emulator- und Zwei-Konten-Tests isoliert deployen.
- Änderungen an bestehenden Collections additiv und rückwärtskompatibel halten; Datenmigrationen separat freigeben lassen.
