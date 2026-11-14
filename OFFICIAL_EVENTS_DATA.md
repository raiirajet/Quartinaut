# Offizielle Schweizer Termine und Feiertage – nativer Quellenkalender
Stand der zugrunde liegenden Recherche: **13.11.2026**. Integration: **14.11.2026**.

## Quelle
Anhang „Quartinaut: offiziell bestätigte Schweizer Feiertage und öffentliche Veranstaltungstermine“.
Die dort verlinkte externe Excel-Tabelle mit weiteren Originalzeilen war in dieser
Konversation **nicht als Datei verfügbar**. Eingebunden sind ausschliesslich die
61 aus dem Bericht lesbaren Veranstaltungszeilen, separat kontrollierte und
ausdrücklich veröffentlichte Luzerner Markttage sowie offizielle kantonale
Feiertagskalender ausgewählter Kantone. Es handelt sich nicht um eine
Vollerhebung aller 26 Kantone oder Gemeinden.

## Datenstruktur
app/src/main/assets/official_calendar_ch_2026_2030.json enthält
194 Einträge: 109 Ereignisse,
81 Feiertage,
1 Terminserien und
3 noch offene Kandidaten.

Statuswerte:
- confirmed_exact_date – konkret datierter Termin mit zugeordneter Original-URL
- reported_official – offiziell laut Bericht, keine einzelne URL zuordenbar
- needs_review – Abweichung zur aktuellen Originalquelle
- official_recurrence_rule – offizielle Regel, nicht als konkretes Datum bestätigt
- year_confirmed_date_pending – Austragungsjahr bestätigt, Datum noch nicht bekannt

**Bekannter Konflikt:** Der Bericht nennt den Stans Herbstmarkt am 17.11.2026,
die offizielle Gemeindeseite https://www.stans.ch/warenmarkt jedoch am
11.11.2026. Die Berichtzeile bleibt zur Nachvollziehbarkeit erhalten, ist aber
explizit als needs_review gekennzeichnet und nicht kalendertauglich.

## Interaktion
- Einfach tippen öffnet Datum, Geltungsbereich, Quelle, Bestätigungsgrad und
  gegebenenfalls den Link zur Originalquelle.
- Lang drücken zeigt direkt ein kompaktes Quellen-Popup.
- Offizielle Quellen öffnen nur über HTTPS.
- Exakte Einzeltermine können als Ganztagstermin in einen installierten
  Android-Kalender übernommen werden (keine fiktiven Uhrzeiten).
- Filtern nach Jahr, Kanton, Art und Bestätigungsgrad; Suchfunktion.
- Read-only / vollständig lokal eingebettet; keine Änderungen an produktiven
  Firestore- oder Storage-Daten.
- Quellen müssen bei einer späteren App-Aktualisierung erneut geprüft werden.

## Aktualisierung
Die offizielle Quelle ist pro Datensatz gespeichert. Bevor eine Zeile
von reported_official auf confirmed_exact_date geändert wird, muss die
explizite Datumsbestätigung in der verlinkten Originalquelle geprüft werden.
Regionale und konfessionelle Feiertagsgeltung darf nicht auf einen ganzen
Kanton verallgemeinert werden.
