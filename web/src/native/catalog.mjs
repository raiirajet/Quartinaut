export const SECTIONS = [
  {
    "id": "entdecken",
    "title": "Entdecken & Informieren",
    "description": "Angebote finden, Neues erfahren und Orte erkunden",
    "links": [
      {
        "route": "board",
        "title": "Schwarzes Brett",
        "description": "Hilfegesuche und Angebote aus dem Quartier",
        "symbol": "📋"
      },
      {
        "route": "market",
        "title": "Marktplatz",
        "description": "Kaufen, verkaufen, tauschen und verschenken",
        "symbol": "🛍️"
      },
      {
        "route": "lend",
        "title": "Leihbörse",
        "description": "Gegenstände aus deiner Nähe ausleihen",
        "symbol": "🧰"
      },
      {
        "route": "lost",
        "title": "Verloren & Gefunden",
        "description": "Vermisste und gefundene Dinge",
        "symbol": "🔎"
      },
      {
        "route": "enh-radar",
        "title": "Quartinaut Radar",
        "description": "Passende Neuigkeiten aus Gemeinde und Kanton",
        "symbol": "📡"
      },
      {
        "route": "search",
        "title": "Alles durchsuchen",
        "description": "Beiträge, Gemeinden und Mitteilungen finden",
        "symbol": "🔍"
      },
      {
        "route": "map",
        "title": "Schweizkarte",
        "description": "Kantone und Gemeinden erkunden",
        "symbol": "🇨🇭"
      },
      {
        "route": "enh-map",
        "title": "Schweizkarte+",
        "description": "Interaktive Gemeinde- und Kantonsansicht",
        "symbol": "🗺️"
      },
      {
        "route": "municipal-compare",
        "title": "Gemeinden vergleichen",
        "description": "Zwei Gemeinden gegenüberstellen",
        "symbol": "🏘️"
      }
    ]
  },
  {
    "id": "erstellen",
    "title": "Erstellen & Veröffentlichen",
    "description": "Beiträge, Gesuche und Meldungen erfassen",
    "links": [
      {
        "route": "create",
        "title": "Eintrag erstellen",
        "description": "Alle verfügbaren Beitragstypen wählen",
        "symbol": "➕"
      },
      {
        "route": "hub-create:market",
        "title": "Marktplatz-Inserat",
        "description": "Verkaufen, verschenken oder tauschen",
        "symbol": "🛍️"
      },
      {
        "route": "hub-create:lend",
        "title": "Ausleih-Angebot",
        "description": "Einen Gegenstand zur Ausleihe anbieten",
        "symbol": "🧰"
      },
      {
        "route": "hub-create:lost",
        "title": "Fundmeldung",
        "description": "Verlorenes oder Gefundenes veröffentlichen",
        "symbol": "🔎"
      },
      {
        "route": "create-request",
        "title": "Hilfe suchen",
        "description": "Ein neues Anliegen erstellen",
        "symbol": "🙋"
      },
      {
        "route": "create-offer",
        "title": "Hilfe anbieten",
        "description": "Unterstützung im Quartier anbieten",
        "symbol": "🤝"
      },
      {
        "route": "hub-create:project",
        "title": "Quartieraktion organisieren",
        "description": "Gemeinsame Aktivitäten veröffentlichen",
        "symbol": "🌱"
      },
      {
        "route": "hub-create:group",
        "title": "Verein vorstellen",
        "description": "Vereins- oder Gruppeneintrag erstellen",
        "symbol": "👥"
      },
      {
        "route": "hub-create:issue",
        "title": "Mangel melden",
        "description": "Ein Problem in der Gemeinde dokumentieren",
        "symbol": "⚠️"
      },
      {
        "route": "hub-create:calendar",
        "title": "Termin eintragen",
        "description": "Gemeindetermin erstellen, falls berechtigt",
        "symbol": "📆"
      },
      {
        "route": "enh-assist",
        "title": "Inserat-Assistent",
        "description": "Titel und Kategorien vorbereiten",
        "symbol": "✨"
      }
    ]
  },
  {
    "id": "meine",
    "title": "Meine Aktivitäten",
    "description": "Deine Einträge, Reservierungen und Kontakte",
    "links": [
      {
        "route": "enh-posts",
        "title": "Meine Beiträge",
        "description": "Bearbeiten, pausieren und abschliessen",
        "symbol": "📝"
      },
      {
        "route": "enh-favorites",
        "title": "Meine Favoriten",
        "description": "Gespeicherte Inserate und Angebote",
        "symbol": "⭐"
      },
      {
        "route": "personal-center",
        "title": "Mein Quartinaut",
        "description": "Aktivitäten, Verlauf und Schnellzugriffe",
        "symbol": "👤"
      },
      {
        "route": "v50market",
        "title": "Meine Reservationen",
        "description": "Marktplatz-Reservationen verwalten",
        "symbol": "🛒"
      },
      {
        "route": "v50loans",
        "title": "Meine Ausleihen",
        "description": "Laufende Ausleihen und Rückgaben",
        "symbol": "📅"
      },
      {
        "route": "enh-loans",
        "title": "Ausleih-Planer",
        "description": "Zeiträume und Anfragen koordinieren",
        "symbol": "🗓️"
      },
      {
        "route": "enh-qr",
        "title": "QR-Übergabe",
        "description": "Übergaben sicher bestätigen",
        "symbol": "🔳"
      },
      {
        "route": "chats",
        "title": "Private Nachrichten",
        "description": "Deine privaten Unterhaltungen",
        "symbol": "💬"
      },
      {
        "route": "calendar-planner",
        "title": "Meine Termine",
        "description": "Termine in Android-Kalender übernehmen",
        "symbol": "📅"
      }
    ]
  },
  {
    "id": "gemeinde",
    "title": "Gemeinde & Gemeinschaft",
    "description": "Vereine, Veranstaltungen und offizielle Informationen",
    "links": [
      {
        "route": "group",
        "title": "Vereine & Gruppen",
        "description": "Gemeinschaften in deiner Nähe entdecken",
        "symbol": "👥"
      },
      {
        "route": "enh-clubs",
        "title": "Vereinszentrale",
        "description": "Anmeldungen und Mitglieder verwalten",
        "symbol": "🏘️"
      },
      {
        "route": "v50associations",
        "title": "Meine Vereinsanmeldungen",
        "description": "Teilnahmen und Wartelisten",
        "symbol": "✅"
      },
      {
        "route": "project",
        "title": "Quartieraktionen",
        "description": "Gemeinsame Aktionen und Freiwilligenarbeit",
        "symbol": "🌱"
      },
      {
        "route": "calendar",
        "title": "Gemeindekalender",
        "description": "Termine, Veranstaltungen und Entsorgung",
        "symbol": "📆"
      },
      {
        "route": "enh-calendar",
        "title": "Gemeindekalender+",
        "description": "Kalender, Entsorgung und Erinnerungen",
        "symbol": "🗓️"
      },
      {
        "route": "official-calendar",
        "title": "Offizielle Termine",
        "description": "Bestätigte Schweizer Termine und Feiertage",
        "symbol": "🇨🇭"
      },
      {
        "route": "community-pulse",
        "title": "Gemeinde aktuell",
        "description": "Neuigkeiten und Beiträge im Überblick",
        "symbol": "📣"
      },
      {
        "route": "official",
        "title": "Offizielle Mitteilungen",
        "description": "Nachrichten deiner Gemeinde",
        "symbol": "📢"
      },
      {
        "route": "alerts",
        "title": "Gemeinde-Alarme",
        "description": "Wichtige Hinweise und Warnungen",
        "symbol": "🚨"
      },
      {
        "route": "issue",
        "title": "Gemeldete Mängel",
        "description": "Meldungen zu Problemen vor Ort ansehen",
        "symbol": "⚠️"
      }
    ]
  },
  {
    "id": "sicherheit",
    "title": "Sicherheit & Einstellungen",
    "description": "Vertrauen, Datenschutz und Offline-Nutzung",
    "links": [
      {
        "route": "enh-trust",
        "title": "Vertrauensprofile",
        "description": "Verifizierungen und Bewertungen ansehen",
        "symbol": "🛡️"
      },
      {
        "route": "safety-center",
        "title": "Sicherheit",
        "description": "Meldungen, Privatsphäre und Schutzfunktionen",
        "symbol": "🔐"
      },
      {
        "route": "help",
        "title": "Hilfe & Datenschutz",
        "description": "Hinweise und Kontaktmöglichkeiten",
        "symbol": "❓"
      },
      {
        "route": "enh-offline",
        "title": "Offline-Modus",
        "description": "Gespeicherte Daten ohne Internet nutzen",
        "symbol": "📱"
      },
      {
        "route": "settings",
        "title": "Einstellungen",
        "description": "Darstellung und App-Verhalten anpassen",
        "symbol": "⚙️"
      },
      {
        "route": "sources",
        "title": "Quellenverweise",
        "description": "Herkunft der Wappen, Karten und Daten",
        "symbol": "📚"
      },
      {
        "route": "diagnostics",
        "title": "Verbindungsdiagnose",
        "description": "Datenverbindung und Synchronisation prüfen",
        "symbol": "🔧"
      }
    ]
  }
];
export const LINKS=SECTIONS.flatMap(s=>s.links);
