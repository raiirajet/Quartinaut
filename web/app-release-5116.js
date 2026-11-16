// src/site-ui.mjs
var nextFieldId = 0;
function dateOnlyLabel(start, end = "", fallback = "Datum noch offen") {
  const format = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return "";
    const date = /* @__PURE__ */ new Date(value + "T12:00:00Z");
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return "";
    return new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(date);
  };
  const first = format(start), last = format(end);
  return first ? last && end !== start ? first + " \u2013 " + last : first : String(fallback || "Datum noch offen");
}
function validationText(control) {
  const v = control.validity;
  if (v.valueMissing) return control.tagName === "SELECT" ? "Bitte w\xE4hle eine Option." : control.type === "checkbox" ? "Bitte best\xE4tige diese Angabe." : "Bitte f\xFClle dieses Feld aus.";
  if (v.typeMismatch && control.type === "email") return "Bitte gib eine g\xFCltige E-Mail-Adresse ein.";
  if (v.typeMismatch && control.type === "url") return "Bitte gib eine vollst\xE4ndige Webadresse mit https:// ein.";
  if (v.tooShort) return `Bitte gib mindestens ${control.minLength} Zeichen ein.`;
  if (v.tooLong) return `Bitte verwende h\xF6chstens ${control.maxLength} Zeichen.`;
  if (v.rangeUnderflow) return `Der Wert muss mindestens ${control.min} betragen.`;
  if (v.rangeOverflow) return `Der Wert darf h\xF6chstens ${control.max} betragen.`;
  if (v.badInput) return "Bitte gib einen g\xFCltigen Wert ein.";
  if (v.stepMismatch) return "Bitte pr\xFCfe die Zahl und die erlaubten Schritte.";
  if (v.patternMismatch) return "Bitte pr\xFCfe das Format deiner Eingabe.";
  return "Bitte pr\xFCfe deine Eingabe.";
}
function addDescription(control, id) {
  const ids = new Set((control.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
  ids.add(id);
  control.setAttribute("aria-describedby", [...ids].join(" "));
}
function styleLabel(control) {
  const label = control.labels?.[0];
  if (!label) return;
  label.classList.add("qn-field");
  if (control.matches("[type=checkbox],[type=radio]")) {
    label.classList.add("qn-choice-field");
    if (control.required && !label.querySelector(".qn-required")) {
      const star = document.createElement("span");
      star.className = "qn-required";
      star.setAttribute("aria-hidden", "true");
      star.textContent = "*";
      label.append(star);
    }
    return;
  }
  if (label.querySelector(".qn-field-label")) return;
  const text = [...label.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
  if (!text.length) return;
  const caption = document.createElement("span");
  caption.className = "qn-field-label";
  caption.textContent = text.map((n) => n.textContent.trim()).join(" ");
  text.forEach((n) => n.remove());
  if (control.required) {
    const star = document.createElement("span");
    star.className = "qn-required";
    star.setAttribute("aria-hidden", "true");
    star.textContent = " *";
    caption.append(star);
  }
  label.prepend(caption);
}
function prepareControl(control) {
  styleLabel(control);
  if (control.dataset.qnPrepared) return;
  control.dataset.qnPrepared = "true";
  if (!control.id) control.id = "qn-field-" + ++nextFieldId;
  const form = control.form;
  if (control.maxLength > 0 && control.tagName === "TEXTAREA") {
    const counter = document.createElement("small");
    counter.className = "qn-field-counter";
    counter.id = control.id + "-count";
    const refresh = () => counter.textContent = `${control.value.length} von ${control.maxLength} Zeichen`;
    control.after(counter);
    addDescription(control, counter.id);
    control.addEventListener("input", refresh);
    form?.addEventListener("quartinaut:draft-restored", refresh);
    refresh();
  }
  if (control.type === "hidden" || control.matches("[type=submit],[type=button],[type=reset],[type=range]")) return;
  let touched = false, helper = null, siteMessage = false;
  const clear = () => {
    if (siteMessage) {
      control.setCustomValidity("");
      siteMessage = false;
    }
    control.removeAttribute("aria-invalid");
    if (helper) helper.hidden = true;
  };
  const report = () => {
    if (!helper) {
      helper = document.createElement("small");
      helper.className = "qn-field-error";
      helper.id = control.id + "-error";
      helper.setAttribute("aria-live", "polite");
      control.after(helper);
      addDescription(control, helper.id);
    }
    const message = control.validity.customError && !siteMessage ? control.validationMessage : validationText(control);
    control.setCustomValidity(message);
    siteMessage = true;
    control.setAttribute("aria-invalid", "true");
    helper.textContent = message;
    helper.hidden = false;
  };
  control.addEventListener("invalid", () => {
    touched = true;
    report();
  });
  control.addEventListener("input", () => {
    clear();
    if (touched && !control.validity.valid) report();
  });
  control.addEventListener("change", () => {
    clear();
  });
  control.addEventListener("quartinaut:validation-reset", clear);
  control.addEventListener("blur", () => {
    if (touched && !control.validity.valid) report();
  });
}
function setupForm(form) {
  if (form.dataset.qnFormReady) return;
  form.dataset.qnFormReady = "true";
  if (form.querySelector("[required]") && !form.querySelector(".qn-form-legend")) {
    const p = document.createElement("p");
    p.className = "qn-form-legend";
    p.textContent = "Mit * gekennzeichnete Felder sind erforderlich.";
    form.prepend(p);
  }
  if (form.dataset.v50Form === "loan.request") {
    const start = form.elements.namedItem("from"), end = form.elements.namedItem("to");
    const clearRange = () => {
      if (end?.dataset.qnRangeError) {
        end.setCustomValidity("");
        delete end.dataset.qnRangeError;
        end.removeAttribute("aria-invalid");
        end.dispatchEvent(new Event("quartinaut:validation-reset"));
      }
    };
    for (const control of [start, end]) for (const event of ["input", "change"]) control?.addEventListener(event, clearRange);
    form.addEventListener("submit", (event) => {
      if (start?.value && end?.value && new Date(end.value) <= new Date(start.value)) {
        end.dataset.qnRangeError = "true";
        end.setCustomValidity("Die R\xFCckgabe muss nach der \xDCbergabe liegen.");
        end.reportValidity();
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }
}
function groupTransactions(root) {
  root.querySelectorAll(".v50-panel").forEach((panel) => {
    if (panel.dataset.qnGrouped) return;
    panel.dataset.qnGrouped = "true";
    const form = [...panel.children].find((el) => el.tagName === "FORM");
    if (!form) return;
    const following = [];
    for (let el = form.nextElementSibling; el; el = el.nextElementSibling) following.push(el);
    if (!following.length) return;
    const layout = document.createElement("div");
    layout.className = "qn-transaction-layout";
    const input = document.createElement("section");
    input.className = "qn-transaction-form";
    const results = document.createElement("section");
    results.className = "qn-transaction-results";
    form.before(layout);
    input.append(form);
    following.forEach((el) => {
      if (el.tagName === "H3") {
        const h = document.createElement("h2");
        h.textContent = el.textContent;
        results.append(h);
        el.remove();
      } else results.append(el);
    });
    layout.append(input, results);
  });
}
function enhanceInterface(root, { page = "", title = true } = {}) {
  if (!root) return;
  if (page) root.dataset.page = page;
  groupTransactions(root);
  root.querySelectorAll("form").forEach(setupForm);
  root.querySelectorAll("input,select,textarea").forEach(prepareControl);
  root.querySelectorAll(".segmented[role=group] button").forEach((button) => button.setAttribute("aria-pressed", String(button.classList.contains("active"))));
  root.querySelectorAll("article button,.card button").forEach((button) => {
    if (button.hasAttribute("aria-label") || button.hasAttribute("aria-labelledby")) return;
    const text = button.textContent.trim();
    if (!["\xD6ffnen", "Ansehen", "Bearbeiten", "Entfernen", "L\xF6schen", "Melden", "Freigeben", "Ablehnen"].includes(text)) return;
    const name = button.closest("article,.card")?.querySelector("h2,h3")?.textContent.trim();
    if (name) button.setAttribute("aria-label", text + " \u2013 " + name.slice(0, 100));
  });
  if (title) {
    const heading = root.querySelector("h1")?.textContent.trim();
    if (heading) document.title = heading.includes("Quartinaut") ? heading : heading + " \xB7 Quartinaut";
  }
}

// src/native/catalog.mjs
var SECTIONS = [
  {
    "id": "entdecken",
    "title": "Entdecken & Informieren",
    "description": "Angebote finden, Neues erfahren und Orte erkunden",
    "links": [
      {
        "route": "board",
        "title": "Schwarzes Brett",
        "description": "Hilfegesuche und Angebote aus dem Quartier",
        "symbol": "\u{1F4CB}"
      },
      {
        "route": "market",
        "title": "Marktplatz",
        "description": "Kaufen, verkaufen, tauschen und verschenken",
        "symbol": "\u{1F6CD}\uFE0F"
      },
      {
        "route": "lend",
        "title": "Leihb\xF6rse",
        "description": "Gegenst\xE4nde aus deiner N\xE4he ausleihen",
        "symbol": "\u{1F9F0}"
      },
      {
        "route": "lost",
        "title": "Verloren & Gefunden",
        "description": "Vermisste und gefundene Dinge",
        "symbol": "\u{1F50E}"
      },
      {
        "route": "enh-radar",
        "title": "Quartinaut Radar",
        "description": "Passende Neuigkeiten aus Gemeinde und Kanton",
        "symbol": "\u{1F4E1}"
      },
      {
        "route": "search",
        "title": "Alles durchsuchen",
        "description": "Beitr\xE4ge, Gemeinden und Mitteilungen finden",
        "symbol": "\u{1F50D}"
      },
      {
        "route": "map",
        "title": "Schweizkarte",
        "description": "Kantone und Gemeinden erkunden",
        "symbol": "\u{1F1E8}\u{1F1ED}"
      },
      {
        "route": "enh-map",
        "title": "Schweizkarte+",
        "description": "Interaktive Gemeinde- und Kantonsansicht",
        "symbol": "\u{1F5FA}\uFE0F"
      },
      {
        "route": "municipal-compare",
        "title": "Gemeinden vergleichen",
        "description": "Zwei Gemeinden gegen\xFCberstellen",
        "symbol": "\u{1F3D8}\uFE0F"
      }
    ]
  },
  {
    "id": "erstellen",
    "title": "Erstellen & Ver\xF6ffentlichen",
    "description": "Beitr\xE4ge, Gesuche und Meldungen erfassen",
    "links": [
      {
        "route": "create",
        "title": "Eintrag erstellen",
        "description": "Alle verf\xFCgbaren Beitragstypen w\xE4hlen",
        "symbol": "\u2795"
      },
      {
        "route": "hub-create:market",
        "title": "Marktplatz-Inserat",
        "description": "Verkaufen, verschenken oder tauschen",
        "symbol": "\u{1F6CD}\uFE0F"
      },
      {
        "route": "hub-create:lend",
        "title": "Ausleih-Angebot",
        "description": "Einen Gegenstand zur Ausleihe anbieten",
        "symbol": "\u{1F9F0}"
      },
      {
        "route": "hub-create:lost",
        "title": "Fundmeldung",
        "description": "Verlorenes oder Gefundenes ver\xF6ffentlichen",
        "symbol": "\u{1F50E}"
      },
      {
        "route": "create-request",
        "title": "Hilfe suchen",
        "description": "Ein neues Anliegen erstellen",
        "symbol": "\u{1F64B}"
      },
      {
        "route": "create-offer",
        "title": "Hilfe anbieten",
        "description": "Unterst\xFCtzung im Quartier anbieten",
        "symbol": "\u{1F91D}"
      },
      {
        "route": "hub-create:project",
        "title": "Quartieraktion organisieren",
        "description": "Gemeinsame Aktivit\xE4ten ver\xF6ffentlichen",
        "symbol": "\u{1F331}"
      },
      {
        "route": "hub-create:group",
        "title": "Verein vorstellen",
        "description": "Vereins- oder Gruppeneintrag erstellen",
        "symbol": "\u{1F465}"
      },
      {
        "route": "hub-create:issue",
        "title": "Mangel melden",
        "description": "Ein Problem in der Gemeinde dokumentieren",
        "symbol": "\u26A0\uFE0F"
      },
      {
        "route": "hub-create:calendar",
        "title": "Termin eintragen",
        "description": "Gemeindetermin erstellen, falls berechtigt",
        "symbol": "\u{1F4C6}"
      },
      {
        "route": "enh-assist",
        "title": "Inserat-Assistent",
        "description": "Titel und Kategorien vorbereiten",
        "symbol": "\u2728"
      }
    ]
  },
  {
    "id": "meine",
    "title": "Meine Aktivit\xE4ten",
    "description": "Deine Eintr\xE4ge, Reservierungen und Kontakte",
    "links": [
      {
        "route": "enh-posts",
        "title": "Meine Beitr\xE4ge",
        "description": "Bearbeiten, pausieren und abschliessen",
        "symbol": "\u{1F4DD}"
      },
      {
        "route": "enh-favorites",
        "title": "Meine Favoriten",
        "description": "Gespeicherte Inserate und Angebote",
        "symbol": "\u2B50"
      },
      {
        "route": "personal-center",
        "title": "Mein Quartinaut",
        "description": "Aktivit\xE4ten, Verlauf und Schnellzugriffe",
        "symbol": "\u{1F464}"
      },
      {
        "route": "v50market",
        "title": "Meine Reservationen",
        "description": "Marktplatz-Reservationen verwalten",
        "symbol": "\u{1F6D2}"
      },
      {
        "route": "v50loans",
        "title": "Meine Ausleihen",
        "description": "Laufende Ausleihen und R\xFCckgaben",
        "symbol": "\u{1F4C5}"
      },
      {
        "route": "enh-loans",
        "title": "Ausleih-Planer",
        "description": "Zeitr\xE4ume und Anfragen koordinieren",
        "symbol": "\u{1F5D3}\uFE0F"
      },
      {
        "route": "enh-qr",
        "title": "QR-\xDCbergabe",
        "description": "\xDCbergaben sicher best\xE4tigen",
        "symbol": "\u{1F533}"
      },
      {
        "route": "chats",
        "title": "Private Nachrichten",
        "description": "Deine privaten Unterhaltungen",
        "symbol": "\u{1F4AC}"
      },
      {
        "route": "calendar-planner",
        "title": "Meine Termine",
        "description": "Termine in Android-Kalender \xFCbernehmen",
        "symbol": "\u{1F4C5}"
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
        "description": "Gemeinschaften in deiner N\xE4he entdecken",
        "symbol": "\u{1F465}"
      },
      {
        "route": "enh-clubs",
        "title": "Vereinszentrale",
        "description": "Anmeldungen und Mitglieder verwalten",
        "symbol": "\u{1F3D8}\uFE0F"
      },
      {
        "route": "v50associations",
        "title": "Meine Vereinsanmeldungen",
        "description": "Teilnahmen und Wartelisten",
        "symbol": "\u2705"
      },
      {
        "route": "project",
        "title": "Quartieraktionen",
        "description": "Gemeinsame Aktionen und Freiwilligenarbeit",
        "symbol": "\u{1F331}"
      },
      {
        "route": "calendar",
        "title": "Gemeindekalender",
        "description": "Termine, Veranstaltungen und Entsorgung",
        "symbol": "\u{1F4C6}"
      },
      {
        "route": "enh-calendar",
        "title": "Gemeindekalender+",
        "description": "Kalender, Entsorgung und Erinnerungen",
        "symbol": "\u{1F5D3}\uFE0F"
      },
      {
        "route": "official-calendar",
        "title": "Offizielle Termine",
        "description": "Best\xE4tigte Schweizer Termine und Feiertage",
        "symbol": "\u{1F1E8}\u{1F1ED}"
      },
      {
        "route": "community-pulse",
        "title": "Gemeinde aktuell",
        "description": "Neuigkeiten und Beitr\xE4ge im \xDCberblick",
        "symbol": "\u{1F4E3}"
      },
      {
        "route": "official",
        "title": "Offizielle Mitteilungen",
        "description": "Nachrichten deiner Gemeinde",
        "symbol": "\u{1F4E2}"
      },
      {
        "route": "alerts",
        "title": "Gemeinde-Alarme",
        "description": "Wichtige Hinweise und Warnungen",
        "symbol": "\u{1F6A8}"
      },
      {
        "route": "issue",
        "title": "Gemeldete M\xE4ngel",
        "description": "Meldungen zu Problemen vor Ort ansehen",
        "symbol": "\u26A0\uFE0F"
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
        "symbol": "\u{1F6E1}\uFE0F"
      },
      {
        "route": "safety-center",
        "title": "Sicherheit",
        "description": "Meldungen, Privatsph\xE4re und Schutzfunktionen",
        "symbol": "\u{1F510}"
      },
      {
        "route": "help",
        "title": "Hilfe & Datenschutz",
        "description": "Hinweise und Kontaktm\xF6glichkeiten",
        "symbol": "\u2753"
      },
      {
        "route": "enh-offline",
        "title": "Offline-Modus",
        "description": "Gespeicherte Daten ohne Internet nutzen",
        "symbol": "\u{1F4F1}"
      },
      {
        "route": "settings",
        "title": "Einstellungen",
        "description": "Darstellung und App-Verhalten anpassen",
        "symbol": "\u2699\uFE0F"
      },
      {
        "route": "sources",
        "title": "Quellenverweise",
        "description": "Herkunft der Wappen, Karten und Daten",
        "symbol": "\u{1F4DA}"
      },
      {
        "route": "diagnostics",
        "title": "Verbindungsdiagnose",
        "description": "Datenverbindung und Synchronisation pr\xFCfen",
        "symbol": "\u{1F527}"
      }
    ]
  }
];
var LINKS = SECTIONS.flatMap((s) => s.links);

// src/native/location.mjs
function streetWithoutHouseNumber(value) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+\d+[a-z]*(?:\s*(?:[-–/])\s*\d+[a-z]*)?\s*$/i, "").trim().slice(0, 140);
}
function roundedCenter(coords) {
  const lat = Math.round(coords.latitude * 100) / 100, lng = Math.round(coords.longitude * 100) / 100;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 45 || lat > 48 || lng < 5 || lng > 11) throw Error("Der Standort muss in der Schweiz liegen.");
  return { lat, lng };
}
function determineLocation(geo = globalThis.navigator?.geolocation) {
  if (!geo) return Promise.reject(Error("Dieser Browser unterst\xFCtzt keine Standortermittlung."));
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (fn, value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      fn(value);
    };
    const timer = setTimeout(() => finish(reject, Error("Kein Standort empfangen. Standortdienst pr\xFCfen und erneut versuchen.")), 21e3);
    geo.getCurrentPosition((p) => finish(resolve, p.coords), (e) => finish(reject, Error(e.code === 1 ? "Standortfreigabe abgelehnt. Bitte in den Website-Einstellungen des Browsers erlauben." : e.code === 3 ? "Die Standortsuche hat zu lange gedauert. Bitte erneut versuchen." : "Kein Standort verf\xFCgbar. Bitte den Standortdienst pr\xFCfen.")), { enableHighAccuracy: true, timeout: 2e4, maximumAge: 12e4 });
  });
}
async function determineStreet(coords, fetcher = fetch) {
  const x = coords.longitude, y = coords.latitude;
  const params = new URLSearchParams({ geometry: `${x},${y}`, geometryType: "esriGeometryPoint", tolerance: "15", layers: "all:ch.swisstopo.amtliches-strassenverzeichnis", mapExtent: `${x - 2e-3},${y - 2e-3},${x + 2e-3},${y + 2e-3}`, imageDisplay: "200,200,96", sr: "4326", returnGeometry: "false" });
  const response = await fetcher("https://api3.geo.admin.ch/rest/services/api/MapServer/identify?" + params, { signal: AbortSignal.timeout(6e3), credentials: "omit", referrerPolicy: "no-referrer" });
  if (!response.ok) return "";
  const data = await response.json();
  const attributes = data.results?.[0]?.attributes || {};
  return streetWithoutHouseNumber(attributes.stn_label || attributes.stn_name || attributes.strname || attributes.name || "");
}
function locationControl() {
  return `<div class="qn-location"><button class="secondary-button" type="button" data-qn-locate>Standort einmalig bestimmen</button><progress hidden aria-label="Standort wird ermittelt"></progress><p role="status" aria-live="polite" data-qn-location-status>Noch kein Standort festgelegt.</p><p class="help">Nur der Stra\xDFenname wird hier angezeigt, ohne Hausnummer. F\xFCr die Stra\xDFenabfrage wird deine Position einmalig an die Schweizer Geodaten-API (geo.admin.ch) \xFCbermittelt. Firebase erh\xE4lt nur einen auf etwa 1 km gerundeten Mittelpunkt.</p></div>`;
}
function bindLocation(root, onCenter) {
  root.querySelectorAll("[data-qn-locate]").forEach((button) => button.addEventListener("click", async () => {
    const box = button.closest(".qn-location"), status = box.querySelector("[data-qn-location-status]"), progress = box.querySelector("progress");
    button.disabled = true;
    progress.hidden = false;
    status.textContent = "Standort wird ermittelt \u2026";
    try {
      const coords = await determineLocation(), center = roundedCenter(coords);
      await onCenter(center);
      if (!box.isConnected) return;
      status.textContent = "Standort ermittelt. Stra\xDFe wird gesucht \u2026";
      let street = "";
      try {
        street = await determineStreet(coords);
      } catch {
      }
      if (!box.isConnected) return;
      status.textContent = street ? `${coords.accuracy > 100 ? "Stra\xDFe in Standortn\xE4he" : "Ermittelte Stra\xDFe"}: ${street} \xB7 ohne Hausnummer.` : "Standort ermittelt. Ein Stra\xDFenname ist hier nicht verf\xFCgbar.";
      if (coords.accuracy > 100 && street) status.textContent += " Der Browser meldet einen ungef\xE4hren Standort; die Stra\xDFe kann abweichen.";
    } catch (e) {
      if (box.isConnected) status.textContent = e.message;
    } finally {
      button.disabled = false;
      progress.hidden = true;
    }
  }));
}

// src/v50-ics.mjs
var esc = (v) => String(v || "").replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/[,;]/g, (c) => "\\" + c);
var utc = (x) => new Date(x).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
function makeIcs(entry, kind) {
  const event = kind === "calendar", date = String(entry.date || "").replace(/-/g, "");
  if (event && !/^\d{8}$/.test(date)) throw Error("Ung\xFCltiger Kalendertermin.");
  const allDay = event && entry.allDay === true;
  const endDate = String(entry.endDate || entry.date || "").replace(/-/g, "");
  const start = allDay ? `DTSTART;VALUE=DATE:${date}` : event ? `DTSTART;TZID=Europe/Zurich:${date}T080000` : `DTSTART:${utc(entry.from)}`;
  const end = allDay ? `DTEND;VALUE=DATE:${endDate}` : event ? `DTEND;TZID=Europe/Zurich:${date}T090000` : `DTEND:${utc(entry.to)}`;
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Quartinaut//5.0//DE", "BEGIN:VEVENT", `UID:quartinaut-${esc(entry.id)}@quartinaut.web.app`, `DTSTAMP:${utc(/* @__PURE__ */ new Date())}`, start, end, `SUMMARY:${esc(entry.title || "Ausleihe")}`, `DESCRIPTION:${esc(entry.description || "")}`, "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Quartinaut Erinnerung", event ? "TRIGGER:-PT12H" : "TRIGGER:-PT24H", "END:VALARM", "END:VEVENT", "END:VCALENDAR", ""].join("\r\n");
}
function saveIcs(content, id) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" }), u = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = u;
  a.download = "quartinaut-" + String(id || "termin").replace(/[^\w-]/g, "").slice(0, 70) + ".ics";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 1e3);
}

// src/native/parity.mjs
var TILES = { home: 0, start: 0, plus: 1, hub: 1, entdecken: 1, create: 2, erstellen: 2, saved: 3, gemeinde: 4, "community-pulse": 4, sicherheit: 5, "safety-center": 5, "enh-trust": 5, chats: 6, board: 7, bulletin: 7, market: 8, lend: 9, loans: 9, v50loans: 9, "enh-loans": 9, lost: 10, "enh-radar": 11, map: 12, swissmap: 12, "enh-map": 13, "municipal-compare": 14, need: 15, "create-request": 15, offer: 16, "create-offer": 16, group: 17, v50associations: 17, calendar: 18, "enh-calendar": 18, "official-calendar": 18, "calendar-planner": 18, events: 19, official: 20, issue: 21, alerts: 22, project: 23, "enh-posts": 24, "enh-assist": 24, "enh-favorites": 25, v50market: 26, "enh-qr": 27, search: 28, inbox: 29, profile: 30, "personal-center": 30, meine: 30, settings: 31, admin: 31, "enh-offline": 32, block: 33, sources: 34, help: 34, diagnostics: 35 };
function icon(key) {
  const n = TILES[key] ?? TILES[key.replace("hub-create:", "").replace("hub-section:", "")] ?? 1;
  return `<span class="qn-icon" aria-hidden="true" style="--ix:${n % 6};--iy:${Math.floor(n / 6)}"></span>`;
}
var EXTRA_ROUTES = ["create", "personal-center", "community-pulse", "municipal-compare", "calendar-planner", "safety-center", "settings", "sources", "diagnostics", "enhancements", "enh-posts", "enh-radar", "enh-assist", "enh-loans", "enh-map", "enh-clubs", "enh-trust", "enh-calendar", "enh-qr", "enh-offline", "enh-favorites", "official-calendar", "qn-request", ...SECTIONS.map((s) => "hub-section:" + s.id)];
var ALIASES = { board: "bulletin", plus: "hub", official: "inbox", alerts: "alarme", map: "swissmap", help: "safety-center" };
function createNativeParity(b) {
  const e = b.escape, model = { uid: "", epoch: 0, rows: [], favorites: [], radar: [], reminders: [], calendar: [], calendarLoaded: false, loading: /* @__PURE__ */ new Set(), errors: {}, center: null, chatId: "", chats: [], messages: [], recent: [], requestId: "", source: null, postsFilter: "all" };
  let scopeRefresh = 0, refreshTimer = null, chatTimer = null;
  const uid2 = () => b.auth()?.uid || "";
  const heading = (title, subtitle = "") => `<header class="qn-heading"><h1>${e(title)}</h1>${subtitle ? `<p>${e(subtitle)}</p>` : ""}</header>`;
  const tile = (route, title, description = "", symbol = route) => `<button type="button" class="qn-tile" data-qn-route="${e(route)}">${icon(symbol)}<span><strong>${e(title)}</strong><small>${e(description)}</small></span><span aria-hidden="true">\u203A</span></button>`;
  const empty = (text) => `<p class="empty">${e(text)}</p>`;
  const status = (key) => `${model.loading.has(key) ? '<p role="status">Wird geladen \u2026</p>' : ""}${model.errors[key] ? `<p class="qn-error" role="alert">${e(model.errors[key])}</p><button class="secondary-button" data-qn-retry="${e(key)}">Erneut versuchen</button>` : ""}`;
  function reset() {
    model.uid = uid2();
    model.epoch++;
    model.rows = [];
    model.favorites = [];
    model.radar = [];
    model.reminders = [];
    model.errors = {};
    model.loading.clear();
    model.center = null;
    model.chatId = "";
    model.requestId = "";
    model.chats = [];
    model.messages = [];
    model.recent = [];
    scopeRefresh++;
    clearTimeout(refreshTimer);
    clearInterval(chatTimer);
    b.setRegional([]);
    b.backgroundReset();
  }
  function ensureAccount() {
    if (model.uid !== uid2()) reset();
  }
  async function guarded(key, work) {
    ensureAccount();
    if (!uid2() || model.loading.has(key)) return;
    const expected = uid2(), epoch = model.epoch;
    model.loading.add(key);
    delete model.errors[key];
    if (!["mutation", "trust"].includes(key)) b.schedule();
    try {
      const result = await work();
      if (uid2() === expected && model.epoch === epoch) return result;
    } catch (err) {
      if (uid2() === expected && model.epoch === epoch) {
        model.errors[key] = err.message || "Die Verbindung konnte nicht hergestellt werden.";
        if (["mutation", "trust", "chats"].includes(key)) b.toast(model.errors[key]);
      }
    } finally {
      if (uid2() === expected && model.epoch === epoch) {
        model.loading.delete(key);
        if (!["mutation", "trust"].includes(key)) b.schedule();
      }
    }
  }
  async function enhancement(action, args = {}) {
    const scoped = String(args.id || "").startsWith("arq_");
    if (["posts.mine", "favorites.list", "radar.list"].includes(action)) {
      const result = await Promise.allSettled(["quartinautEnhancements", "quartinautAudience"].map((name) => b.call(name, { action, ...args })));
      if (result.every((x) => x.status === "rejected")) throw result[0].reason;
      if (result.some((x) => x.status === "rejected")) b.toast("Ein Teil der Beitr\xE4ge konnte nicht geladen werden. Bitte sp\xE4ter aktualisieren.");
      return { items: result.flatMap((x) => x.status === "fulfilled" ? x.value.items || [] : []) };
    }
    return b.call(scoped ? "quartinautAudience" : "quartinautEnhancements", { action, ...args });
  }
  async function refreshRegional() {
    ensureAccount();
    if (!uid2() || model.loading.has("regional")) return;
    const expected = uid2(), epoch = model.epoch, sequence = ++scopeRefresh;
    model.loading.add("regional");
    try {
      const result = await b.call("quartinautAudience", { action: "feed" });
      const docs = await b.readAudience(result.ids || []);
      if (uid2() !== expected || model.epoch !== epoch || scopeRefresh !== sequence) return;
      b.setRegional(docs);
      delete model.errors.regional;
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        b.setRegional([]);
        if (!document.hidden) void refreshRegional();
      }, 24e4);
    } catch (err) {
      if (uid2() === expected && model.epoch === epoch) {
        b.setRegional([]);
        model.errors.regional = err.message || "Regionale Anliegen konnten nicht geladen werden.";
      }
    } finally {
      if (uid2() === expected && model.epoch === epoch) {
        model.loading.delete("regional");
        b.schedule();
      }
    }
  }
  async function load(key, args = {}) {
    ensureAccount();
    const expected = uid2(), epoch = model.epoch;
    return guarded(key, async () => {
      let value;
      if (key === "posts") value = (await enhancement("posts.mine")).items;
      else if (key === "favorites") value = (await enhancement("favorites.list")).items;
      else if (key === "radar") value = (await enhancement("radar.list", args)).items;
      else if (key === "reminders") value = (await enhancement("reminders.list")).items;
      else if (key === "chats") value = (await b.call("quartinautPrivateChats", { action: "list" })).chats;
      else if (key === "calendar") {
        const results = await Promise.all(["official_calendar_ch_2026_2030.json", "municipal_calendar_verified_sg.json"].map((f) => fetch("./assets/native/" + f).then((r) => {
          if (!r.ok) throw Error("Terminkatalog nicht erreichbar.");
          return r.json();
        })));
        value = results.flatMap((r) => r.items || []);
      }
      if (expected !== uid2() || epoch !== model.epoch) return;
      const prop = { posts: "rows", favorites: "favorites", radar: "radar", reminders: "reminders", chats: "chats", calendar: "calendar" }[key];
      if (prop) model[prop] = value || [];
      if (key === "calendar") model.calendarLoaded = true;
      if (key === "favorites") b.refreshBookmarks();
    });
  }
  function go(route, { history: history2 = true } = {}) {
    ensureAccount();
    if (route === "create-request" || route === "create-offer") {
      b.newRequest(route === "create-offer" ? "Biete" : "Suche");
      return;
    }
    if (route.startsWith("hub-create:")) {
      b.openHubCreate(route.split(":")[1]);
      return;
    }
    if (["market", "lend", "lost", "group", "issue", "project", "calendar", "v50market", "v50loans", "v50associations", "v50calendar"].includes(route)) {
      b.openHub(route);
      return;
    }
    if (route === "help") {
      b.help();
      return;
    }
    route = ALIASES[route] || route;
    if (route === "hub") {
      b.openHub("all");
      return;
    }
    if (route === "enh-map") {
      b.setRoute("swissmap");
      return;
    }
    if (route === "enh-loans") {
      b.openHub("v50loans");
      return;
    }
    if (route === "enh-calendar") {
      b.openHub("v50calendar");
      return;
    }
    if (route === "enh-clubs") {
      b.openHub("v50associations");
      return;
    }
    if (route === "enhancements") {
      route = "hub";
    }
    if (route === "admin") {
      b.setRoute("profile");
      queueMicrotask(() => document.querySelector(".v453-admin-settings")?.scrollIntoView());
      return;
    }
    if (history2 && uid2() && route !== "home") {
      model.recent = [route, ...model.recent.filter((x) => x !== route)].slice(0, 7);
      try {
        sessionStorage.setItem("quartinaut-recent:" + uid2(), JSON.stringify(model.recent));
      } catch {
      }
    }
    b.setRoute(route);
    if (route === "enh-posts") void load("posts");
    if (route === "enh-favorites") void load("favorites");
    if (route === "enh-radar") void load("radar");
    if (["official-calendar", "calendar-planner"].includes(route)) {
      if (!model.calendarLoaded) void load("calendar");
      void b.loadTransactions();
      if (route === "calendar-planner") void load("reminders");
    }
    if (route === "chats") void load("chats");
  }
  function directory(section) {
    if (section) {
      const s = SECTIONS.find((s2) => s2.id === section);
      return s ? heading(s.title, s.description) + '<div class="qn-task-grid">' + s.links.map((x) => tile(x.route, x.title, x.description)).join("") + "</div>" : "";
    }
    return heading("Quartier+", "Was m\xF6chtest du machen? W\xE4hle deine Aufgabe \u2013 ohne lange Men\xFCs.") + `<div class="qn-actions"><button class="primary-button" data-qn-route="create">Eintrag erstellen</button><button class="secondary-button" data-qn-route="search">Suchen</button></div><label for="qn-catalog-search">Funktionen finden</label><input id="qn-catalog-search" type="search" placeholder="Zum Beispiel Ausleihen, Vereine oder Datenschutz"><p role="status" id="qn-catalog-result"></p><div class="qn-catalog">${SECTIONS.map((s) => `<section data-qn-section="${s.id}">${tile("hub-section:" + s.id, s.title, s.description)}<div class="qn-catalog-preview">${s.links.slice(0, 3).map((x) => tile(x.route, x.title)).join("")}</div></section>`).join("")}</div><div id="qn-catalog-matches" hidden></div>`;
  }
  function insights() {
    const profile = b.state().profile, area = profile.area || "", canton = profile.cantonCode || profile.location?.cantonCode || "";
    const options = [["market", "Marktplatz"], ["lend", "Ausleihen"], ["calendar", "Veranstaltungen"], ["group", "Vereine"], ["project", "Quartieraktionen"], ["lost", "Fundb\xFCro"]];
    let interests = ["market", "lend", "calendar"];
    try {
      const saved = JSON.parse(localStorage.getItem("quartinaut-home-interests:" + uid2()) || "null");
      if (Array.isArray(saved)) interests = saved.filter((k) => options.some((x) => x[0] === k));
    } catch {
    }
    const available = b.hub().filter((x) => x.status === "published" && (x.area === area || x.cantonCode === canton));
    const requests = b.state().requests.filter((x) => x.status === "offen" && x.area === area);
    const suggestions = available.filter((x) => interests.includes(x.kind)).sort((a, c) => Number(c.area === area) - Number(a.area === area) || String(c.createdAt).localeCompare(String(a.createdAt))).slice(0, 3);
    return `<div class="qn-section-title"><div><small>IN DEINER GEMEINDE</small><h2>Jetzt interessant</h2></div><button class="ghost-button" data-qn-route="community-pulse">Alle ansehen</button></div><div class="qn-stats">${[["bulletin", requests.length, "Anliegen"], ["market", available.length, "Angebote"], ["inbox", b.state().officialNotices.length, "Mitteilungen"]].map(([route, count, label]) => `<button data-qn-route="${route}"><strong>${count}</strong><small>${label}</small></button>`).join("")}</div><div class="qn-section-title"><div><h2>F\xFCr dich entdeckt</h2><small>${e(options.filter((x) => interests.includes(x[0])).map((x) => x[1]).join(" \xB7 ") || "Keine Themen ausgew\xE4hlt")}</small></div><button class="ghost-button" data-qn-interests>Interessen</button></div>${suggestions.length ? suggestions.map((x) => tile("open:" + x.id, x.title, x.area + " \xB7 " + (options.find((y) => y[0] === x.kind)?.[1] || ""), x.kind)).join("") : empty("Noch keine passenden Angebote geladen. W\xE4hle deine Interessen oder entdecke Quartier+.")}`;
  }
  function home() {
    const s = b.state(), first = (s.profile.name || "Nachbar").trim().split(/\s+/)[0];
    return `<div class="qn-home-layout">
    <section class="qn-home-primary" aria-label="Dein Quartier heute">
      <section class="v2-hero qn-hero"><span class="qn-area">${e(s.profile.area || "Deine Gemeinde")}</span><span class="eyebrow">QUARTINAUT \xB7 DEINE GEMEINDE</span><h1>Gr\xFCezi, ${e(first)}!</h1><p>Was m\xF6chtest du heute machen?</p><button class="v4-hero-search" data-qn-route="search">Beitr\xE4ge, Vereine, Angebote suchen <span aria-hidden="true">\u2192</span></button></section>
      <div class="qn-actions qn-home-actions"><button class="primary-button" data-qn-route="create">Eintrag erstellen</button><button class="secondary-button" data-qn-route="hub">Dein Quartier entdecken</button></div>
      <section class="qn-home-insights">${insights()}</section>
      <section class="qn-home-notices">${b.notices()}</section>
    </section>
    <aside class="qn-home-sidebar" aria-label="Deine Schnellzugriffe">
      <section class="qn-home-personal"><h2>Dein Quartinaut</h2>${tile("personal-center", "Mein Quartinaut", "Meine Aktivit\xE4ten")}${tile("community-pulse", "Gemeinde aktuell", "Lokale Neuigkeiten")}${tile("official-calendar", "Offizielle Termine & Feiertage", "Mit Originalquellen")}</section>
      ${b.quickActions()}
      <details class="qn-panel"><summary>Pers\xF6nlicher \xDCberblick \xB7 F\xFCr dich</summary>${b.priorities()}</details>
    </aside>
    <section class="qn-home-more" aria-label="Mehr aus deinem Quartier">${tile("swissmap", "Schweizkarte", "26 Kantone \xB7 2'110 Gemeinden")}
      <details class="qn-panel"><summary>Weitere Bereiche anzeigen</summary><div class="qn-task-grid">${["bulletin", "hub", "settings", "enh-posts", "alarme", "sources", "diagnostics"].map((r) => tile(r, { bulletin: "Schwarzes Brett", hub: "Quartier+", settings: "Einstellungen", "enh-posts": "Meine Beitr\xE4ge", alarme: "Gemeinde-Alarme", sources: "Quellenverweise", diagnostics: "Verbindungsdiagnose" }[r])).join("")}</div>${b.adminOverview()}</details>
    </section>
  </div>`;
  }
  function listing(row, { manage = false, favorite = false } = {}) {
    const id = row.itemId || row.id, request = row.kind === "request" || id.startsWith("arq_"), collection = request ? "requests" : "communityHubItems";
    return `<article class="qn-panel qn-listing"><div class="qn-listing-head">${icon(request ? "bulletin" : row.kind)}<div><h2>${e(row.title || "Beitrag")}</h2><p>${e(row.area || "")}${row.status ? " \xB7 " + e(b.statusLabel(row.status)) : ""}</p></div></div>${row.description ? `<p>${e(row.description)}</p>` : ""}<div class="qn-actions"><button class="secondary-button" data-qn-open="${e(id)}" data-kind="${request ? "request" : "hub"}">\xD6ffnen</button><button class="ghost-button" data-qn-trust="${e(id)}" data-collection="${collection}">Vertrauensprofil</button>${favorite ? `<button class="ghost-button" data-qn-favorite="${e(id)}" data-collection="${collection}">Favorit entfernen</button>` : ""}${manage ? `<button class="ghost-button" data-qn-edit="${e(id)}" data-collection="${collection}">Bearbeiten</button><button class="ghost-button" data-qn-post-status="${e(id)}" data-collection="${collection}" data-status="${request ? "erledigt" : "completed"}">Abschliessen</button><button class="ghost-button" data-qn-post-status="${e(id)}" data-collection="${collection}" data-status="${request ? "archiviert" : "archived"}">Archivieren</button>${!request && ["published", "paused"].includes(row.status) ? `<button class="ghost-button" data-qn-post-status="${e(id)}" data-collection="${collection}" data-status="${row.status === "paused" ? "published" : "paused"}">${row.status === "paused" ? "Fortsetzen" : "Pausieren"}</button>` : ""}<button class="ghost-button" data-qn-delete="${e(id)}" data-collection="${collection}">L\xF6schen</button>` : ""}</div></article>`;
  }
  function personal() {
    const profile = b.state().profile;
    const recentName = (route) => LINKS.find((x) => x.route === route)?.title || SECTIONS.find((x) => "hub-section:" + x.id === route)?.title || { hub: "Quartier+", bulletin: "Schwarzes Brett", swissmap: "Schweizkarte", inbox: "Mitteilungen", profile: "Profil" }[route] || "Quartier+";
    return heading("Mein Quartinaut", "Deine Beitr\xE4ge, Kontakte und Termine an einem Ort") + `<p class="qn-context">Deine Gemeinde: ${e(profile.area || "Noch nicht hinterlegt")}</p><div class="qn-task-grid">` + tile("enh-posts", "Eigene Beitr\xE4ge", "Bearbeiten, pausieren oder abschliessen") + tile("enh-favorites", "Gespeicherte Beitr\xE4ge", "Auf App und Website synchronisiert") + tile("chats", "Nachrichten", "Private Unterhaltungen") + tile("v50loans", "Ausleihen und Reservationen", "Anfragen und R\xFCckgaben") + tile("calendar-planner", "Meine Termine", "Kalenderexport und Erinnerungen") + "</div>" + (model.recent.length ? '<section class="qn-content-section"><h2>Zuletzt ge\xF6ffnet</h2><div class="qn-task-grid">' + model.recent.map((route) => tile(route, recentName(route))).join("") + "</div></section>" : "");
  }
  function pulse() {
    const state2 = b.state();
    return heading("Gemeinde aktuell", state2.profile.area || "Neuigkeiten aus deiner Gemeinde") + b.notices() + '<section class="qn-content-section"><h2>Aktuelle Anliegen</h2><div class="qn-results-grid">' + (state2.requests.filter((x) => x.status === "offen").slice(0, 12).map(b.requestCard).join("") || empty("Zurzeit sind keine freigegebenen Anliegen geladen.")) + '</div></section><section class="qn-content-section"><h2>Angebote & Aktivit\xE4ten</h2><div class="qn-results-grid">' + (b.hub().filter((x) => x.status === "published").slice(0, 12).map(b.hubCard).join("") || empty("Zurzeit sind keine passenden Angebote geladen.")) + "</div></section>";
  }
  function creator() {
    return heading("Eintrag erstellen", "Was m\xF6chtest du mit deinem Quartier teilen?") + '<div class="qn-task-grid">' + SECTIONS.find((s) => s.id === "erstellen").links.filter((x) => x.route !== "create").map((x) => tile(x.route, x.title, x.description)).join("") + "</div>";
  }
  function assist() {
    return heading("Inserat-Assistent", "Titel und Beschreibung vorbereiten. Du pr\xFCfst den Text vor der Ver\xF6ffentlichung.") + `<form id="qn-assist"><label>Was m\xF6chtest du anbieten oder suchen?<textarea name="description" required minlength="5" maxlength="1200"></textarea></label><label>Bereich<select name="kind"><option value="market">Marktplatz</option><option value="lend">Leihb\xF6rse</option><option value="lost">Fundmeldung</option><option value="request">Hilfe suchen</option><option value="offer">Hilfe anbieten</option></select></label><button class="primary-button">Entwurf vorbereiten</button></form><div id="qn-assist-result" aria-live="polite"></div>`;
  }
  function safety() {
    return heading("Vertrauen & Sicherheit", "Deine Privatsph\xE4re und Kontakte verwalten") + `<section class="qn-panel"><h2>Standort & Privatsph\xE4re</h2><p>Ein ungef\xE4hrer Standort gen\xFCgt. Genaue Positionen, Stra\xDFe und Hausnummer erscheinen in keinem \xF6ffentlichen Beitrag.</p><p>Freigaben lassen sich in den Website-Einstellungen deines Browsers verwalten. Nachrichten sind nur f\xFCr die beiden beteiligten Personen zug\xE4nglich.</p><button class="secondary-button" data-qn-permissions>Standort, Kamera und Benachrichtigungen</button></section>` + tile("enh-trust", "Vertrauensprofile", "Verifizierungen und Bewertungen") + tile("settings", "Einstellungen", "Darstellung und Benachrichtigungen") + `<button class="secondary-button" data-qn-privacy>Datenschutz lesen</button><button class="secondary-button" data-qn-intro>Einf\xFChrung erneut ansehen</button>`;
  }
  function diagnostics() {
    return heading("Verbindungsdiagnose", "Verbindung und Synchronisation pr\xFCfen") + `<section class="qn-panel"><dl><dt>Netzwerk</dt><dd>${navigator.onLine ? "Verbunden" : "Offline"}</dd><dt>Firebase-Projekt</dt><dd>quartinaut</dd><dt>Web-Version</dt><dd>5.11.6 \xB7 Android Build 33</dd><dt>Regionale Anliegen</dt><dd>${model.errors.regional ? e(model.errors.regional) : model.loading.has("regional") ? "Verbindung wird gepr\xFCft" : "Letzter Abruf erfolgreich"}</dd></dl><button class="secondary-button" data-qn-check>Firebase-Zugriff pr\xFCfen</button><p id="qn-check-result" role="status"></p><p>Die Pr\xFCfung \xFCbermittelt keine Nachrichtentexte oder privaten Eingaben.</p></section>`;
  }
  function offline() {
    return heading("Offline-Modus", "\xD6ffentliche Karten und eigene Entw\xFCrfe auf diesem Ger\xE4t nutzen.") + `<section class="qn-panel"><p>F\xFCr private Nachrichten, Bilder und regionale Anliegen ist eine Internetverbindung n\xF6tig. Deine Entw\xFCrfe bleiben auf diesem Ger\xE4t und werden erst nach deinem Absenden ver\xF6ffentlicht.</p><p>Netzwerk: ${navigator.onLine ? "Verbunden" : "Offline"}</p><button class="secondary-button" data-qn-cache-public>Karten und Wappen f\xFCr offline speichern</button><p data-qn-cache-status role="status"></p></section>` + tile("drafts", "Meine Entw\xFCrfe", "Auf diesem Ger\xE4t weiterbearbeiten") + tile("swissmap", "Schweizkarte", "\xD6ffentliche Karten, Kantone und Gemeinden") + tile("diagnostics", "Verbindungsdiagnose", "Netzwerk und Firebase pr\xFCfen");
  }
  function sources() {
    return heading("Quellenverweise", "Herkunft der Wappen, Karten, Gemeinden und Termine") + [
      ["Bundesamt f\xFCr Statistik", "Amtliches Gemeindeverzeichnis mit BFS-Zuordnung.", "https://www.bfs.admin.ch/bfs/de/home/grundlagen/agvch.html"],
      ["Swiss Flags \u2013 Yann Lerjen", "Kantonswappen, MIT-Lizenz; Lizenzdatei im Wappenbestand.", "https://github.com/ylerjen/swiss-flags"],
      ["Wikidata & Wikimedia Commons", "Gemeindewappen nach BFS-Nummern. Quellen je Bild im lokalen Verzeichnis.", "https://commons.wikimedia.org/wiki/Category:Coats_of_arms_of_municipalities_of_Switzerland"],
      ["BFS-Gemeindegrenzen", "Geometrie von 2025; Namensverzeichnis von 2026. Gemeindefusionen k\xF6nnen abweichen.", "https://www.agvchapp.bfs.admin.ch/de/boundaries"],
      ["Schweizer Geodaten-API", "Einmalige Stra\xDFenabfrage; keine Hausnummer.", "https://api3.geo.admin.ch"],
      ["Eidgen\xF6ssisches Institut f\xFCr Geistiges Eigentum", "Wappen sind keine amtliche Beglaubigung.", "https://www.ige.ch/de/etwas-schuetzen/herkunftsangaben/grundlegendes/swissness/schweizerwappen"]
    ].map(([title, copy, url]) => `<article class="qn-panel"><h2>${e(title)}</h2><p>${e(copy)}</p><a class="secondary-button" href="${url}" target="_blank" rel="noopener noreferrer">Originalquelle \xF6ffnen</a></article>`).join("");
  }
  function comparison() {
    return heading("Gemeinden vergleichen", "BFS-Zuordnung und \xF6ffentliche Registrierungszahlen") + `<form id="qn-compare" class="qn-panel"><label>Erste Gemeinde<input name="first" list="qn-municipalities" required placeholder="Gemeindename"></label><label>Zweite Gemeinde<input name="second" list="qn-municipalities" required placeholder="Gemeindename"></label><datalist id="qn-municipalities">${b.locations().flatMap((c) => c.municipalities.map((m) => `<option value="${e(m.name + " (" + c.code + ")")}"></option>`)).join("")}</datalist><button class="primary-button">Vergleichen</button></form><div class="qn-grid" id="qn-compare-result" aria-live="polite"></div>`;
  }
  function officialCalendar() {
    return heading("Offizielle Termine", "Feiertage und Termine mit Quellen und Best\xE4tigungsstand") + `<p>Recherche: 13.11.2026. Der Katalog ersetzt keine laufende Gemeindepublikation. Best\xE4tigungsgrad und Originalquelle pro Eintrag beachten.</p>${status("calendar")}<div class="qn-panel"><label for="qn-calendar-q">Termine durchsuchen</label><input id="qn-calendar-q" type="search" placeholder="Titel, Ort oder Kanton"><label for="qn-calendar-year">Jahr</label><select id="qn-calendar-year"><option value="all">Alle Jahre</option>${[2026, 2027, 2028, 2029, 2030].map((y) => `<option>${y}</option>`).join("")}</select></div><div id="qn-calendar-results">${calendarRows(model.calendar)}</div>`;
  }
  function calendarRows(rows) {
    return rows.map((row) => `<article class="qn-panel"><h2>${e(row.title)}</h2><p>${e(dateOnlyLabel(row.start, row.end, row.dateLabel))} \xB7 ${e([row.city, row.canton].filter(Boolean).join(", "))}</p><p>${e(row.sourceNote || "")}</p><p>${e({ confirmed_exact_date: "Datum in verlinkter Originalquelle", reported_official: "Offizielle Stelle laut Recherchebericht", needs_review: "Datumsabweichung: \xFCberpr\xFCfen", official_recurrence_rule: "Offizielle Regel \u2013 kein best\xE4tigter Einzeltermin", year_confirmed_date_pending: "Jahr best\xE4tigt \u2013 Datum noch offen" }[row.status] || "Best\xE4tigungsgrad unbekannt")}</p>${/^https:\/\//.test(row.sourceUrl || "") ? `<a class="secondary-button" href="${e(row.sourceUrl)}" target="_blank" rel="noopener noreferrer">${e(row.sourceName || "Originalquelle")}</a>` : ""}${row.calendarExact && row.start && row.status !== "needs_review" && !["pending", "series"].includes(row.kind) ? `<button class="ghost-button" data-qn-official-ics="${e(row.id)}">In Kalender \xFCbernehmen (.ics)</button>` : ""}</article>`).join("") || empty("Keine passenden Termine.");
  }
  function planner() {
    return heading("Meine Termine", "Gemeindetermine, eigene Erinnerungen und Kalenderexport") + status("reminders") + `<h2>Meine Erinnerungen</h2>${model.reminders.map((r) => `<article class="qn-panel"><h3>${e(r.title)}</h3><p>${e(r.date)} \xB7 ${e(r.hoursBefore)} Stunden vorher</p><button class="ghost-button" data-qn-reminder-remove="${e(r.eventId)}">Erinnerung entfernen</button></article>`).join("") || empty("Noch keine Erinnerungen gespeichert.")}<p>Gespeicherte Erinnerungen sind mit deinem Konto synchronisiert. F\xFCr einen verl\xE4sslichen Ger\xE4tehinweis \xFCbernimm den Termin in deinen Kalender.</p><h2>Gemeindetermine</h2>${b.calendarEntries().map((row) => `<article class="qn-panel"><h3>${e(row.title)}</h3><p>${e(dateOnlyLabel(row.date || row.start, "", row.date || row.start))}</p><button class="secondary-button" data-qn-reminder="${e(row.id)}">Erinnerung speichern</button><button class="ghost-button" data-qn-event-ics="${e(row.id)}">Kalenderexport (.ics)</button></article>`).join("") || empty("Keine freigegebenen Gemeindetermine geladen.")} ${tile("official-calendar", "Offizielle Termine & Feiertage", "Mit Quellen und Kalenderexport")}`;
  }
  function handover() {
    return heading("QR-\xDCbergabe", "Die andere beteiligte Person best\xE4tigt die \xDCbergabe einer akzeptierten Ausleihe.") + `<form id="qn-handover-create" class="qn-panel"><label>Best\xE4tigte Ausleihe<select name="loanId" required><option value="">Ausleihe w\xE4hlen</option>${b.loans().filter((x) => x.status === "accepted").map((x) => `<option value="${e(x.id)}">${e(b.hub().find((h) => h.id === x.listingId)?.title || "Best\xE4tigte Ausleihe")}</option>`).join("")}</select></label><button class="primary-button">\xDCbergabecode erstellen</button></form><div id="qn-handover-result" aria-live="polite"></div><form id="qn-handover-confirm" class="qn-panel"><label>\xDCbergabecode der anderen Person<input name="token" required minlength="36" maxlength="120" autocomplete="off"></label><button class="primary-button">\xDCbergabe best\xE4tigen</button><button type="button" class="secondary-button" data-qn-scan>QR-Code mit Kamera scannen</button><video id="qn-qr-video" hidden playsinline></video><button type="button" class="ghost-button" data-qn-scan-stop hidden>Kamera stoppen</button><p id="qn-scan-status" role="status"></p></form>`;
  }
  function trust() {
    const reviews = [...b.loans().filter((x) => x.status === "returned" && x.borrowerUid === uid2()).map((x) => ({ ...x, reviewType: "loan" })), ...b.marketEntries().filter((x) => x.status === "completed" && x.buyerUid === uid2()).map((x) => ({ ...x, reviewType: "market" }))];
    return heading("Vertrauensprofile", "Verifizierungen und Bewertungen sichtbarer Beitr\xE4ge") + (reviews.length ? `<section class="qn-panel"><h2>Abgeschlossene Transaktion bewerten</h2><form id="qn-trust-review"><label>Transaktion<select name="transaction" required>${reviews.map((x) => `<option value="${e(x.reviewType + ":" + x.id)}">${e(b.hub().find((h) => h.id === x.listingId)?.title || "Abgeschlossene " + (x.reviewType === "loan" ? "Ausleihe" : "Reservation"))}</option>`).join("")}</select></label><label>Bewertung<select name="score">${[5, 4, 3, 2, 1].map((n) => `<option>${n}</option>`).join("")}</select></label><label>Kommentar<textarea name="comment" required minlength="5" maxlength="300"></textarea></label><button class="primary-button" type="submit">Bewertung abgeben</button></form><p>Nur abgeschlossene eigene Transaktionen, je Transaktion eine Bewertung.</p></section>` : "") + b.state().requests.filter((x) => x.status === "offen").slice(0, 15).map((x) => tile("trust:" + x.id, x.authorName || "Quartiermitglied", x.title)).join("") + b.hub().filter((x) => x.status === "published").slice(0, 15).map((x) => `<button class="qn-tile" data-qn-trust="${e(x.id)}" data-collection="communityHubItems">${icon("enh-trust")}<span><strong>${e(x.ownerName || "Quartiermitglied")}</strong><small>${e(x.title)}</small></span></button>`).join("");
  }
  function renderRoute(route) {
    ensureAccount();
    if (!uid2()) return null;
    if (route === "home") return home();
    if (route === "hub" && b.hubSection() === "all") return directory();
    if (route.startsWith("hub-section:")) return directory(route.split(":")[1]);
    if (route === "create") return creator();
    if (route === "personal-center") return personal();
    if (route === "community-pulse") return pulse();
    if (route === "municipal-compare") return comparison();
    if (route === "official-calendar") return officialCalendar();
    if (route === "calendar-planner") return planner();
    if (route === "enh-qr") return handover();
    if (route === "enh-trust") return trust();
    if (route === "safety-center") return safety();
    if (route === "sources") return sources();
    if (route === "diagnostics") return diagnostics();
    if (route === "enh-offline") return offline();
    if (route === "enh-assist") return assist();
    if (route === "settings") return b.settings({ pageTitle: "Einstellungen", webSettings: `<section class="qn-settings-overview" aria-label="Schnelle Einstellungen"><div class="qn-panel"><h2>Darstellung</h2><label for="qn-theme">Farbdesign</label><select id="qn-theme">${[["system", "Automatisch \xB7 System"], ["light", "Hell \xB7 Weiss"], ["green", "Gr\xFCn \xB7 Quartinaut"], ["dark", "Dunkel \xB7 Tiefschwarz"], ["red", "Schweiz \xB7 Wappenrot"]].map(([id, label]) => `<option value="${id}" ${b.theme() === id ? "selected" : ""}>${label}</option>`).join("")}</select></div><div class="qn-panel"><h2>Berechtigungen</h2><p>Standort, Kamera und Benachrichtigungen f\xFCr diesen Browser verwalten.</p><button class="secondary-button" data-qn-permissions>Berechtigungen \xF6ffnen</button></div><div class="qn-panel"><h2>Quartinaut auf Android</h2><p>Nutze deine Beitr\xE4ge und Nachrichten mit demselben Konto auch in der App.</p><a class="secondary-button qn-app-download" href="https://github.com/raiirajet/Quartinaut/releases/tag/android-v33-preview" target="_blank" rel="noopener noreferrer">Android-App herunterladen</a></div></section>` });
    if (route === "enh-posts") return heading("Meine Beitr\xE4ge", "Bearbeiten, pausieren, archivieren und abschliessen") + status("posts") + `<button class="secondary-button" data-qn-retry="posts">Aktualisieren</button><label for="qn-post-filter">Status</label><select id="qn-post-filter">${[["all", "Alle"], ["active", "Aktiv"], ["pending", "In Pr\xFCfung"], ["completed", "Abgeschlossen"]].map(([id, label]) => `<option value="${id}" ${model.postsFilter === id ? "selected" : ""}>${label}</option>`).join("")}</select><div class="qn-results-grid">` + model.rows.filter((r) => model.postsFilter === "all" || (model.postsFilter === "active" ? ["offen", "published", "paused"].includes(r.status) : model.postsFilter === "pending" ? ["pending", "wartet_freigabe"].includes(r.status) : ["completed", "erledigt", "archived", "archiviert"].includes(r.status))).map((r) => listing(r, { manage: true })).join("") + "</div>" + (!model.rows.length && !model.loading.has("posts") ? empty("Du hast noch keine Beitr\xE4ge erstellt.") : "");
    if (route === "enh-favorites") return heading("Meine Favoriten", "Mit deinem Konto in App und Website synchronisiert") + status("favorites") + `<button class="secondary-button" data-qn-retry="favorites">Aktualisieren</button><div class="qn-results-grid">` + model.favorites.map((r) => listing(r, { favorite: true })).join("") + "</div>" + (!model.favorites.length ? empty("Noch keine Beitr\xE4ge gespeichert.") : "") + `<details class="qn-panel"><summary>Weitere Web-Merklisten</summary>${b.oldFavorites().replace(/<h1>/g, "<h2>").replace(/<\/h1>/g, "</h2>")}</details>`;
    if (route === "enh-radar") return heading("Quartinaut Radar", "Passende Neuigkeiten aus Gemeinde und Kanton") + `<form id="qn-radar" class="qn-panel"><label>Reichweite<select name="scope"><option value="canton">Kanton</option><option value="municipality">Gemeinde</option></select></label><label>Kategorie<select name="tag"><option value="">Alle</option>${["request", "market", "lend", "lost", "group", "project", "calendar"].map((k) => `<option value="${k}">${e({ request: "Anliegen", market: "Marktplatz", lend: "Ausleihen", lost: "Fundb\xFCro", group: "Vereine", project: "Quartieraktionen", calendar: "Termine" }[k])}</option>`).join("")}</select></label><button class="primary-button">Radar aktualisieren</button></form>${status("radar")}<p>Der Radar zeigt aktuell geladene Treffer. Er richtet keine automatische Push-Suche ein.</p><div class="qn-results-grid">` + model.radar.map((r) => listing(r)).join("") + "</div>" + (!model.radar.length ? empty("Keine passenden Treffer geladen.") : "");
    if (route === "chats") return chatView();
    if (route === "qn-request") {
      const row = b.state().requests.find((x) => x.id === model.requestId);
      return row ? heading("Anliegen") + b.requestCard(row) : heading("Anliegen") + empty("Dieser Beitrag ist nicht mehr erreichbar.");
    }
    return null;
  }
  function chatView() {
    const chat = model.chats.find((x) => x.id === model.chatId);
    const list = model.chats.map((c) => `<button class="qn-tile" data-qn-chat="${e(c.id)}">${icon("chats")}<span><strong>${e(c.requestTitle || "Privater Chat")}</strong><small>${e(c.lastMessagePreview || "Unterhaltung \xF6ffnen")}</small></span></button>`).join("") || empty("Noch keine privaten Unterhaltungen. \xD6ffne einen Beitrag, um Kontakt aufzunehmen.");
    const thread = chat ? `<section class="qn-panel qn-chat-thread"><button class="ghost-button" data-qn-chat-back>Alle Nachrichten</button><h2>${e(chat.requestTitle || "Privater Chat")}</h2><div class="qn-actions"><button class="ghost-button" data-qn-chat-mute>${chat.mutedBy?.includes(uid2()) ? "Stummschaltung aufheben" : "Stummschalten"}</button><button class="ghost-button" data-qn-chat-block>${chat.blockedBy?.includes(uid2()) ? "Sperre aufheben" : "Person sperren"}</button><button class="ghost-button" data-qn-chat-report>Unterhaltung melden</button></div><div class="qn-chat-messages" aria-live="polite">${model.messages.map((m) => `<article class="qn-message ${m.senderUid === uid2() ? "mine" : ""}"><p>${e(m.text || "")}</p>${m.messageType === "image" && m.media?.storagePath ? `<img data-qn-chat-image="${e(m.media.storagePath)}" alt="Privates Chatbild" loading="lazy">` : ""}<small>${e(b.date(m.createdAt))}${m.readAt ? " \xB7 Gelesen" : ""}</small></article>`).join("") || empty("Noch keine Nachrichten.")}</div><form id="qn-chat-send"><label>Nachricht<textarea name="text" maxlength="500"></textarea></label><label>Bild (optional)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label><button class="primary-button" type="submit">Senden</button><p role="status" id="qn-chat-status"></p></form></section>` : `<section class="qn-chat-placeholder qn-panel"><div>${icon("chats")}<h2>Deine Nachrichten</h2><p>W\xE4hle links eine Unterhaltung aus oder nimm \xFCber einen Beitrag Kontakt auf.</p><button type="button" class="secondary-button" data-qn-route="bulletin">Schwarzes Brett \xF6ffnen</button></div></section>`;
    return heading("Nachrichten", "Deine privaten Unterhaltungen") + status("chats") + status("messages") + `<button class="secondary-button" data-qn-retry="chats">Aktualisieren</button><div class="qn-chat-layout ${chat ? "qn-chat-selected" : "qn-chat-unselected"}"><aside class="qn-chat-sidebar" aria-label="Unterhaltungen"><h2>Unterhaltungen</h2>${list}</aside>${thread}</div>`;
  }
  async function chatMessages(render2 = true) {
    const expected = uid2(), epoch = model.epoch, id = model.chatId;
    if (!id) return;
    try {
      const r = await b.call("quartinautPrivateChats", { action: "messages", chatId: id });
      if (uid2() !== expected || epoch !== model.epoch || id !== model.chatId) return;
      const changed = JSON.stringify(r.messages) !== JSON.stringify(model.messages);
      model.messages = r.messages || [];
      delete model.errors.messages;
      if (render2 && changed && !document.querySelector("#qn-chat-send textarea")?.value) b.schedule();
      await b.call("quartinautPrivateChats", { action: "read", chatId: id });
    } catch (err) {
      if (uid2() === expected && epoch === model.epoch) model.errors.messages = err.message;
    }
  }
  async function startChat(id) {
    await guarded("chats", async () => {
      const expected = uid2(), epoch = model.epoch;
      const r = await b.call(id.startsWith("arq_") ? "quartinautAudience" : "quartinautPrivateChats", { action: id.startsWith("arq_") ? "chat.start" : "start", id, requestId: id });
      if (uid2() !== expected || epoch !== model.epoch) return;
      model.chatId = r.chat?.id || r.chatId || r.id;
      const list = await b.call("quartinautPrivateChats", { action: "list" });
      if (uid2() !== expected || epoch !== model.epoch) return;
      model.chats = list.chats || [];
      await chatMessages(false);
      b.setRoute("chats");
    });
  }
  async function mutate(action, args, then) {
    return guarded("mutation", async () => {
      const expected = uid2(), epoch = model.epoch;
      const result = await enhancement(action, args);
      if (expected !== uid2() || epoch !== model.epoch) return;
      if (then) await then(result);
      b.toast("Gespeichert.");
    });
  }
  function permissions() {
    b.modal("Browser-Berechtigungen", `<p>Freigaben gelten pro Ger\xE4t und Browser. Du kannst sie \xFCber das Symbol links neben der Website-Adresse \xE4ndern.</p>${locationControl()}<button class="secondary-button" data-qn-notifications>Benachrichtigungen erlauben</button><button class="secondary-button" data-qn-camera>Kamera erlauben</button><p data-qn-camera-status role="status"></p>`, (modal) => {
      bindLocation(modal, async (center) => {
        if (uid2()) {
          await b.call("quartinautAudience", { action: "location.set", center });
          model.center = center;
          void refreshRegional();
        }
      });
      modal.querySelector("[data-qn-notifications]").onclick = () => b.run(b.notifications);
      modal.querySelector("[data-qn-camera]").onclick = async () => {
        const status2 = modal.querySelector("[data-qn-camera-status]");
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach((t) => t.stop());
          status2.textContent = "Kamera freigegeben. Die Vorschau wird nur beim Scannen ge\xF6ffnet.";
        } catch {
          status2.textContent = "Kamerafreigabe nicht erteilt. Bitte die Website-Einstellungen pr\xFCfen.";
        }
      };
    });
  }
  function requestAudience(form) {
    const container = document.createElement("section");
    container.className = "qn-panel";
    container.dataset.qnAudience = "";
    container.innerHTML = `<h2>Wer soll deinen Beitrag sehen?</h2><label>Reichweite<select name="audienceLevel"><option value="canton">Kanton</option><option value="municipality">Gemeinde</option><option value="radius">Umkreis</option><option value="country">Schweizweit</option></select></label><div data-qn-radius hidden><label>Entfernung ab ungef\xE4hrem Standort<select name="audienceRadiusKm">${[5, 10, 25, 50].map((k) => `<option value="${k}" ${k === 10 ? "selected" : ""}>${k} km</option>`).join("")}</select></label>${locationControl()}</div><p>Profilgemeinde: ${e(b.state().profile.area || "")}</p><p class="help">Die Sichtbarkeit wird von Firebase gepr\xFCft. Eine Gemeinde oder schweizweite Ver\xF6ffentlichung ben\xF6tigt keine Standortfreigabe.</p>`;
    const oldRadius = form.querySelector('[name="radiusKm"]');
    if (oldRadius) {
      oldRadius.closest("label").hidden = true;
      oldRadius.disabled = true;
    }
    const opt = form.querySelector('[name="shareApproxLocation"]');
    if (opt) {
      opt.checked = false;
      opt.disabled = true;
      opt.closest("label").hidden = true;
    }
    form.querySelector('.v2-wizard-step[data-step="0"]')?.prepend(container);
    const scope = container.querySelector('[name="audienceLevel"]');
    scope.onchange = () => {
      container.querySelector("[data-qn-radius]").hidden = scope.value !== "radius";
    };
    form.addEventListener("quartinaut:draft-restored", scope.onchange);
    bindLocation(container, async (center) => {
      const expected = uid2();
      await b.call("quartinautAudience", { action: "location.set", center });
      if (uid2() !== expected || !form.isConnected) throw Error("Konto gewechselt. Bitte Standort erneut ermitteln.");
      form.qnCenter = center;
      model.center = center;
      void refreshRegional();
    });
  }
  async function createRegional(form, data, photos, close) {
    const scope = data.audienceLevel || "canton";
    if (scope === "canton") return false;
    const expected = uid2(), epoch = model.epoch, button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const radiusKm = Number(data.audienceRadiusKm || 10);
      if (scope === "radius" && !form.qnCenter) throw Error("Bitte zuerst deinen Standort einmalig bestimmen.");
      const opId = form.dataset.qnOperation || "req_" + crypto.randomUUID().replaceAll("-", "");
      form.dataset.qnOperation = opId;
      b.saveDraft(form);
      const paths = photos.selected.length ? await b.uploadPhotos("requests", opId, photos.selected) : [];
      if (uid2() !== expected || model.epoch !== epoch) throw Error("Konto gewechselt; bitte erneut anmelden.");
      const result = await b.call("quartinautAudience", { action: "create", opId, item: { title: String(data.title || "").trim(), text: String(data.text || "").trim(), type: data.type || "Suche", category: data.category || "Alltagshilfe", urgency: data.urgency || "Heute", audienceLevel: scope, radiusKm, center: scope === "radius" ? form.qnCenter : null, photoPaths: paths } });
      if (uid2() !== expected || model.epoch !== epoch) return true;
      form.dataset.photoSaved = "yes";
      close(true);
      await refreshRegional();
      go(result.status === "offen" ? "bulletin" : "enh-posts");
      b.toast(result.status === "offen" ? "Anliegen ver\xF6ffentlicht." : "Anliegen zur Freigabe eingereicht.");
    } catch (err) {
      b.photoStatus(form, err.message, true);
      b.toast(err.message);
    } finally {
      button.disabled = false;
    }
    return true;
  }
  async function openTarget(kind, id) {
    if (kind === "request" && id.startsWith("arq_")) {
      await refreshRegional();
      if (!b.state().requests.some((x) => x.id === id)) throw Error("Anliegen nicht sichtbar oder abgelaufen.");
      model.requestId = id;
      b.setRoute("qn-request");
    } else await b.openTarget(kind, id);
  }
  function bind() {
    ensureAccount();
    if (!uid2()) return;
    const route = b.state().route;
    document.body.dataset.qnRoute = route;
    const root = document.querySelector("#main");
    root.querySelectorAll("[data-qn-route]").forEach((btn) => btn.onclick = () => {
      const r = btn.dataset.qnRoute;
      if (r.startsWith("trust:")) void showTrust(r.slice(6), "requests");
      else if (r.startsWith("open:")) b.run(() => openTarget("hub", r.slice(5)));
      else go(r);
    });
    root.querySelectorAll("[data-qn-retry]").forEach((btn) => btn.onclick = () => void load(btn.dataset.qnRetry));
    const search = root.querySelector("#qn-catalog-search");
    if (search) search.oninput = () => {
      const q = search.value.toLocaleLowerCase("de-CH").trim(), rows = LINKS.filter((x) => (x.title + " " + x.description).toLocaleLowerCase("de-CH").includes(q));
      root.querySelector(".qn-catalog").hidden = !!q;
      const matches = root.querySelector("#qn-catalog-matches");
      matches.hidden = !q;
      matches.innerHTML = rows.map((x) => tile(x.route, x.title, x.description)).join("");
      root.querySelector("#qn-catalog-result").textContent = q ? rows.length + " Funktionen gefunden" : "";
      matches.querySelectorAll("[data-qn-route]").forEach((btn) => btn.onclick = () => go(btn.dataset.qnRoute));
    };
    root.querySelector("#qn-theme")?.addEventListener("change", (ev) => b.setTheme(ev.target.value));
    root.querySelector("#qn-post-filter")?.addEventListener("change", (ev) => {
      model.postsFilter = ev.target.value;
      b.schedule();
    });
    root.querySelector("[data-qn-interests]")?.addEventListener("click", () => {
      const options = [["market", "Marktplatz"], ["lend", "Ausleihen"], ["calendar", "Veranstaltungen"], ["group", "Vereine"], ["project", "Quartieraktionen"], ["lost", "Fundb\xFCro"]];
      let saved = ["market", "lend", "calendar"];
      try {
        saved = JSON.parse(localStorage.getItem("quartinaut-home-interests:" + uid2()) || "null") || saved;
      } catch {
      }
      b.modal("Deine Interessen", `<form id="qn-interests">${options.map(([key, label]) => `<label class="check-row"><input type="checkbox" name="interest" value="${key}" ${saved.includes(key) ? "checked" : ""}><span>${label}</span></label>`).join("")}<p>Die Themen bleiben auf diesem Ger\xE4t und werden nur f\xFCr die hier geladenen Angebote verwendet.</p><button class="primary-button" type="submit">Speichern</button></form>`, (m, close) => m.querySelector("#qn-interests").onsubmit = (ev) => {
        ev.preventDefault();
        localStorage.setItem("quartinaut-home-interests:" + uid2(), JSON.stringify(new FormData(ev.currentTarget).getAll("interest")));
        close();
        b.schedule();
      });
    });
    root.querySelector("[data-qn-personalize]")?.addEventListener("click", () => {
      b.setRoute("profile");
      queueMicrotask(() => {
        const panel = document.querySelector("#v41-start");
        if (panel) {
          panel.open = true;
          panel.scrollIntoView();
        }
      });
    });
    root.querySelector("[data-qn-permissions]")?.addEventListener("click", permissions);
    root.querySelector("[data-qn-privacy]")?.addEventListener("click", () => b.legal("privacy"));
    root.querySelector("[data-qn-intro]")?.addEventListener("click", b.intro);
    root.querySelector("#qn-trust-review")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const f = ev.currentTarget, d = Object.fromEntries(new FormData(f)), [type, transactionId] = d.transaction.split(":");
      void mutate("trust.review", { type, transactionId, score: Number(d.score), comment: d.comment }, () => f.reset());
    });
    root.querySelector("#qn-radar")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const d = Object.fromEntries(new FormData(ev.currentTarget));
      void load("radar", { scope: d.scope, tags: d.tag ? [d.tag] : [] });
    });
    root.querySelectorAll("[data-qn-open]").forEach((btn) => btn.onclick = () => b.run(() => openTarget(btn.dataset.kind, btn.dataset.qnOpen)));
    root.querySelectorAll("[data-qn-trust]").forEach((btn) => btn.onclick = () => void showTrust(btn.dataset.qnTrust, btn.dataset.collection));
    root.querySelectorAll("[data-qn-favorite]").forEach((btn) => btn.onclick = () => void toggleFavorite(btn.dataset.qnFavorite, btn.dataset.collection));
    root.querySelectorAll("[data-qn-edit]").forEach((btn) => btn.onclick = () => edit(btn.dataset.qnEdit, btn.dataset.collection));
    root.querySelectorAll("[data-qn-post-status]").forEach((btn) => btn.onclick = () => void mutate("post.status", { id: btn.dataset.qnPostStatus, collection: btn.dataset.collection, status: btn.dataset.status }, () => {
      void refreshRegional();
      return load("posts");
    }));
    root.querySelectorAll("[data-qn-delete]").forEach((btn) => btn.onclick = () => b.modal("Beitrag l\xF6schen", `<p>Der ver\xF6ffentlichte Inhalt und seine Fotos werden entfernt. Historische private Unterhaltungen bleiben erhalten.</p><button class="primary-button" data-qn-confirm-delete>Beitrag l\xF6schen</button>`, (m, close) => m.querySelector("[data-qn-confirm-delete]").onclick = () => void mutate("post.delete", { id: btn.dataset.qnDelete, collection: btn.dataset.collection }, () => {
      close();
      void refreshRegional();
      return load("posts");
    })));
    root.querySelector("[data-qn-check]")?.addEventListener("click", async () => {
      const el = root.querySelector("#qn-check-result");
      el.textContent = "Verbindung wird gepr\xFCft \u2026";
      const started = performance.now();
      try {
        await b.call("quartinautHub", { action: "settings.get" });
        el.textContent = `Firebase erreichbar \xB7 ${Math.round(performance.now() - started)} ms`;
      } catch (err) {
        el.textContent = err.message;
      }
    });
    root.querySelector("#qn-compare")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const d = Object.fromEntries(new FormData(ev.currentTarget));
      root.querySelector("#qn-compare-result").innerHTML = [d.first, d.second].map((label) => {
        for (const c of b.locations()) {
          const m = c.municipalities.find((m2) => m2.name + " (" + c.code + ")" === label);
          if (m) return `<article class="qn-panel"><img class="qn-coat" src="${e(b.coat(m.bfsCode))}" alt="Wappen ${e(m.name)}"><h2>${e(m.name)}</h2><p>Kanton: ${e(c.name)} (${e(c.code)})</p><p>BFS: ${e(m.bfsCode)}</p><p>Gemeinden im Kanton: ${c.municipalities.length}</p><p>\xD6ffentliche Registrierungen im Kanton: ${Number(b.state().publicStats?.cantonCounts?.[c.code] || 0)}</p></article>`;
        }
        return empty("Bitte eine Gemeinde aus der Vorschlagsliste w\xE4hlen.");
      }).join("");
    });
    root.querySelector("#qn-assist")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const d = Object.fromEntries(new FormData(ev.currentTarget));
      const description = String(d.description || "").trim(), title = description.split(/[.!?\n]/)[0].slice(0, 80);
      root.querySelector("#qn-assist-result").innerHTML = `<section class="qn-panel"><h2>Dein Entwurf</h2><p><strong>${e(title)}</strong></p><p>${e(description)}</p><button class="primary-button" data-qn-use-draft>Im Editor pr\xFCfen</button></section>`;
      root.querySelector("[data-qn-use-draft]").onclick = () => {
        go(d.kind === "request" ? "create-request" : d.kind === "offer" ? "create-offer" : "hub-create:" + d.kind);
        queueMicrotask(() => {
          const f = document.querySelector("#requestForm,#v3HubCreate");
          if (f) {
            const t = f.querySelector('[name="title"]'), body = f.querySelector('[name="text"],[name="description"]');
            if (t) t.value = title;
            if (body) body.value = description;
            f.dispatchEvent(new Event("input", { bubbles: true }));
          }
        });
      };
    });
    root.querySelectorAll("[data-qn-official-ics]").forEach((btn) => btn.onclick = () => officialIcs(model.calendar.find((x) => x.id === btn.dataset.qnOfficialIcs)));
    const filterCalendar = () => {
      const q = root.querySelector("#qn-calendar-q").value.toLocaleLowerCase("de-CH"), year = root.querySelector("#qn-calendar-year").value;
      root.querySelector("#qn-calendar-results").innerHTML = calendarRows(model.calendar.filter((x) => (year === "all" || String(x.start || "").startsWith(year)) && [x.title, x.city, x.canton].join(" ").toLocaleLowerCase("de-CH").includes(q)));
      root.querySelectorAll("[data-qn-official-ics]").forEach((btn) => btn.onclick = () => officialIcs(model.calendar.find((x) => x.id === btn.dataset.qnOfficialIcs)));
    };
    root.querySelector("#qn-calendar-q")?.addEventListener("input", filterCalendar);
    root.querySelector("#qn-calendar-year")?.addEventListener("change", filterCalendar);
    root.querySelectorAll("[data-qn-event-ics]").forEach((btn) => btn.onclick = () => {
      const x = b.calendarEntries().find((x2) => x2.id === btn.dataset.qnEventIcs);
      try {
        saveIcs(makeIcs(x, "calendar"), x.id);
      } catch (err) {
        b.toast(err.message);
      }
    });
    root.querySelectorAll("[data-qn-reminder]").forEach((btn) => btn.onclick = () => b.modal("Erinnerung speichern", `<label>Vorlauf<select id="qn-hours">${[1, 3, 12, 24, 48, 72].map((h) => `<option value="${h}">${h} Stunden</option>`).join("")}</select></label><button class="primary-button" data-qn-save-reminder>Speichern</button>`, (m, close) => m.querySelector("[data-qn-save-reminder]").onclick = () => void mutate("reminders.save", { id: btn.dataset.qnReminder, hoursBefore: Number(m.querySelector("#qn-hours").value) }, () => {
      close();
      return load("reminders");
    })));
    root.querySelectorAll("[data-qn-reminder-remove]").forEach((btn) => btn.onclick = () => void mutate("reminders.remove", { id: btn.dataset.qnReminderRemove }, () => load("reminders")));
    root.querySelector("#qn-handover-create")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      void mutate("handover.create", Object.fromEntries(new FormData(ev.currentTarget)), (r) => {
        const box = root.querySelector("#qn-handover-result");
        box.innerHTML = `<section class="qn-panel"><h2>\xDCbergabecode</h2><div id="qn-qr"></div><p><code>${e(r.token)}</code></p><p>G\xFCltig bis ${e(b.date(r.expiresAt))}. Der Code kann nur einmal von der anderen beteiligten Person best\xE4tigt werden.</p></section>`;
        if (window.qrcode) {
          const qr = window.qrcode(0, "M");
          qr.addData(r.token);
          qr.make();
          box.querySelector("#qn-qr").innerHTML = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
        }
      });
    });
    root.querySelector("#qn-handover-confirm")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const form = ev.currentTarget;
      void mutate("handover.confirm", { token: String(new FormData(form).get("token") || "").trim() }, () => {
        form.reset();
        return b.loadTransactions();
      });
    });
    root.querySelector("[data-qn-scan]")?.addEventListener("click", () => void scan(root));
    root.querySelector("[data-qn-cache-public]")?.addEventListener("click", () => void cachePublic(root));
    root.querySelectorAll("[data-qn-chat]").forEach((btn) => btn.onclick = () => {
      model.chatId = btn.dataset.qnChat;
      model.messages = [];
      b.schedule();
      void chatMessages();
    });
    root.querySelector("[data-qn-chat-back]")?.addEventListener("click", () => {
      model.chatId = "";
      b.schedule();
    });
    root.querySelector("[data-qn-chat-mute]")?.addEventListener("click", () => void chatAction("mute"));
    root.querySelector("[data-qn-chat-block]")?.addEventListener("click", () => void chatAction("block"));
    root.querySelector("[data-qn-chat-report]")?.addEventListener("click", () => b.modal("Unterhaltung melden", '<label>Grund<select id="qn-report-reason"><option value="spam">Spam</option><option value="harassment">Bel\xE4stigung</option><option value="fraud">Betrug</option><option value="unsafe">Unsicher</option><option value="other">Anderer Grund</option></select></label><label>Beschreibung<textarea id="qn-report-text" maxlength="500"></textarea></label><button class="primary-button" id="qn-report-submit">Meldung senden</button>', (m, close) => m.querySelector("#qn-report-submit").onclick = () => b.run(async () => {
      await b.call("quartinautPrivateChats", { action: "report", chatId: model.chatId, operationId: "report_" + crypto.randomUUID().replaceAll("-", ""), reason: m.querySelector("#qn-report-reason").value, note: m.querySelector("#qn-report-text").value });
      close();
      b.toast("Meldung gesendet.");
    })));
    root.querySelector("#qn-chat-send")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      void sendChat(ev.currentTarget);
    });
    if (route === "chats" && model.chatId) {
      clearInterval(chatTimer);
      chatTimer = setInterval(() => {
        if (document.hidden || b.state().route !== "chats") {
          clearInterval(chatTimer);
          return;
        }
        void chatMessages();
      }, 12e3);
    } else {
      clearInterval(chatTimer);
    }
    root.querySelectorAll("[data-qn-chat-image]").forEach((img) => b.chatImage(img.dataset.qnChatImage).then((src) => {
      if (img.isConnected) img.src = src;
    }).catch(() => {
      img.alt = "Bild konnte nicht geladen werden.";
    }));
    if (route === "bulletin") {
      const div = document.createElement("section");
      div.className = "qn-panel";
      div.innerHTML = "<h2>Anliegen im Umkreis</h2><p>Einmaligen Standort freigeben, um passende regionale Anliegen zu sehen.</p>" + locationControl() + (model.errors.regional ? `<p role="alert">${e(model.errors.regional)}</p>` : "");
      root.querySelector(".v2-board-results")?.before(div);
      bindLocation(div, async (center) => {
        await b.call("quartinautAudience", { action: "location.set", center });
        model.center = center;
        await refreshRegional();
      });
    }
    document.querySelectorAll('[data-route="saved"]').forEach((btn) => {
      btn.onclick = (ev) => {
        ev.stopImmediatePropagation();
        go("enh-favorites");
      };
    });
    document.querySelectorAll(".v3-hub-symbol").forEach((el) => {
      const btn = el.closest("[data-v3-open]");
      if (btn) el.innerHTML = icon(btn.dataset.v3Open);
    });
    updateHeader();
  }
  async function showTrust(id, collection) {
    await guarded("trust", async () => {
      const result = await enhancement("trust.profile", { id, collection });
      const p = result.profile || result;
      b.modal("Vertrauensprofil", `<h2>${e(p.displayName || "Quartiermitglied")}</h2><p>${p.verified ? "Verifiziert" : "Nicht verifiziert"}</p><p>${e(p.totalReviews || 0)} Bewertungen \xB7 ${e(p.averageRating || 0)} / 5</p><p>Kontoart: ${e(p.accountType || "resident")}</p>`);
    });
  }
  async function toggleFavorite(id, collection) {
    await mutate("favorite.toggle", { id, collection }, () => load("favorites"));
  }
  function edit(id, collection) {
    const row = model.rows.find((x) => x.id === id) || b.state().requests.find((x) => x.id === id);
    if (!row) return;
    b.modal("Beitrag bearbeiten", `<form id="qn-edit"><label>Titel<input name="title" minlength="5" maxlength="100" required value="${e(row.title)}"></label><label>Beschreibung<textarea name="description" minlength="12" maxlength="1200" required>${e(row.description || row.text || "")}</textarea></label>${["market", "lend"].includes(row.kind) ? `<label>Preis (CHF)<input name="priceChf" type="number" min="0" step="0.05" value="${Number(row.priceChf || 0)}"></label>` : ""}<p>Eine Inhalts\xE4nderung wird vor der Ver\xF6ffentlichung erneut gepr\xFCft.</p><button class="primary-button">Speichern und einreichen</button></form>`, (m, close) => m.querySelector("#qn-edit").onsubmit = (ev) => {
      ev.preventDefault();
      const d = Object.fromEntries(new FormData(ev.currentTarget));
      if (d.priceChf !== void 0) d.priceChf = Number(d.priceChf);
      void mutate("post.edit", { id, collection, ...d }, () => {
        close();
        void refreshRegional();
        return load("posts");
      });
    });
  }
  function updateHeader() {
    const route = b.state().route, title = document.querySelector("#main h1")?.textContent.trim() || "Quartinaut";
    const brand = document.querySelector(".brand-copy strong");
    if (brand) brand.textContent = route === "home" ? "Quartinaut" : title;
    const back = document.querySelector("#qn-back");
    if (back) back.hidden = route === "home";
    const group = ["home", "create", "chats"].includes(route) ? route : ["profile", "settings"].includes(route) ? "profile" : "hub";
    document.querySelectorAll(".bottom-nav .nav-item,.qn-desktop-nav [data-qn-nav]").forEach((button) => {
      const key = button.dataset.qnNav || button.dataset.route, active = key === group;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
    document.querySelector(".v2-profile-link")?.setAttribute("aria-current", group === "profile" ? "page" : "false");
  }
  function officialIcs(row) {
    if (!row?.calendarExact || !row.start || row.status === "needs_review") return;
    try {
      const end = new Date(row.end || row.start);
      end.setUTCDate(end.getUTCDate() + 1);
      saveIcs(makeIcs({ id: row.id, title: row.title, date: row.start, endDate: end.toISOString().slice(0, 10), allDay: true, description: `${row.sourceName || ""}
${row.sourceUrl || ""}`, location: row.venue || row.city }, "calendar"), row.id);
    } catch (err) {
      b.toast(err.message);
    }
  }
  async function chatAction(action) {
    const c = model.chats.find((x) => x.id === model.chatId);
    if (!c) return;
    await b.run(async () => {
      await b.call("quartinautPrivateChats", { action, chatId: c.id, ...action === "mute" ? { muted: !c.mutedBy?.includes(uid2()) } : { blocked: !c.blockedBy?.includes(uid2()) } });
      await load("chats");
    });
  }
  async function sendChat(form) {
    if (form.dataset.sending) return;
    const text = form.elements.text.value.trim(), photo = form.elements.photo.files[0], expected = uid2(), epoch = model.epoch, chatId = model.chatId, button = form.querySelector('[type="submit"]');
    form.dataset.sending = "yes";
    button.disabled = true;
    const status2 = form.querySelector("#qn-chat-status");
    if (!text && !photo) {
      delete form.dataset.sending;
      button.disabled = false;
      status2.textContent = "Bitte eine Nachricht oder ein Bild w\xE4hlen.";
      return;
    }
    status2.textContent = "Nachricht wird gesendet \u2026";
    try {
      form.dataset.operation ||= "msg_" + crypto.randomUUID().replaceAll("-", "");
      const messageId = form.dataset.operation;
      let media;
      if (photo) media = await b.uploadChatImage(chatId, messageId, photo);
      await b.call("quartinautPrivateChats", { action: "send", chatId, operationId: messageId, text, ...media ? { messageType: "image", media } : {} });
      if (expected !== uid2() || model.epoch !== epoch) return;
      form.reset();
      delete form.dataset.operation;
      await chatMessages(false);
      b.schedule();
    } catch (err) {
      status2.textContent = err.message || "Nachricht konnte nicht gesendet werden. Dein Text bleibt erhalten.";
    } finally {
      delete form.dataset.sending;
      button.disabled = false;
    }
  }
  async function scan(root) {
    const status2 = root.querySelector("#qn-scan-status");
    if (!("BarcodeDetector" in window)) {
      status2.textContent = "Dieser Browser kann QR-Codes nicht erkennen. Bitte den \xDCbergabecode einf\xFCgen.";
      return;
    }
    let stream, frame, stopped = false;
    const video = root.querySelector("#qn-qr-video"), stopButton = root.querySelector("[data-qn-scan-stop]");
    const stop = () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
      video.hidden = true;
      stopButton.hidden = true;
      video.srcObject = null;
    };
    stopButton.onclick = stop;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      video.srcObject = stream;
      video.hidden = false;
      stopButton.hidden = false;
      await video.play();
      const detector = new BarcodeDetector({ formats: ["qr_code"] });
      const run = async () => {
        if (stopped || !video.isConnected || document.hidden) {
          stop();
          return;
        }
        const codes = await detector.detect(video);
        const value = codes[0]?.rawValue;
        if (value && /^[A-Za-z0-9_-]{36,120}$/.test(value)) {
          root.querySelector('[name="token"]').value = value;
          status2.textContent = "Code erkannt. Bitte \xDCbergabe best\xE4tigen.";
          stop();
          return;
        }
        frame = requestAnimationFrame(() => void run().catch((err) => {
          stop();
          status2.textContent = err.message;
        }));
      };
      void run();
    } catch {
      stop();
      status2.textContent = "Kamera konnte nicht ge\xF6ffnet werden. Website-Berechtigungen pr\xFCfen oder Code einf\xFCgen.";
    }
  }
  async function cachePublic(root) {
    const status2 = root.querySelector("[data-qn-cache-status]"), button = root.querySelector("[data-qn-cache-public]");
    button.disabled = true;
    try {
      const cache = await caches.open("quartinaut-public-data-v5114"), manifest = await fetch("./assets/native/public-manifest.json").then((r) => r.json());
      let done = 0;
      const work = [...manifest];
      await Promise.all(Array.from({ length: 4 }, async () => {
        while (work.length) {
          const path = work.shift();
          const response = await fetch(path, { credentials: "omit" });
          if (!response.ok) throw Error("\xD6ffentliche Datei nicht erreichbar.");
          await cache.put(path, response);
          status2.textContent = `${++done} von ${manifest.length} \xF6ffentlichen Dateien gespeichert.`;
        }
      }));
      status2.textContent = "\xD6ffentliche Karte und Wappen sind offline bereit.";
    } catch (err) {
      status2.textContent = err.message;
    } finally {
      button.disabled = false;
    }
  }
  document.addEventListener("click", (ev) => {
    const button = ev.target.closest?.("[data-v44-save]");
    if (!button || !uid2()) return;
    const bar = button.closest("[data-social-id]");
    if (!bar) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    void toggleFavorite(bar.dataset.socialId, bar.dataset.socialKind === "request" ? "requests" : "communityHubItems");
  }, true);
  window.addEventListener("focus", () => {
    if (uid2()) void refreshRegional();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      b.setRegional([]);
      clearInterval(chatTimer);
    } else if (uid2()) {
      void refreshRegional();
      if (b.state().route === "chats") {
        void load("chats");
        void chatMessages();
      }
    }
  });
  return {
    go,
    renderRoute,
    bind,
    reset,
    entered(route) {
      if (route === "chats") void load("chats");
      if (route === "enh-posts") void load("posts");
      if (route === "enh-favorites") void load("favorites");
      if (route === "enh-radar") void load("radar");
      if (["official-calendar", "calendar-planner"].includes(route)) {
        if (!model.calendarLoaded) void load("calendar");
        void b.loadTransactions();
        if (route === "calendar-planner") void load("reminders");
      }
      if (["enh-qr", "enh-trust"].includes(route)) void b.loadTransactions();
    },
    refreshRegional,
    requestAudience,
    createRegional,
    enhancement,
    startChat,
    permissions,
    load,
    edit,
    openTarget,
    model,
    favoriteSaved: (id) => model.favorites.some((x) => (x.itemId || x.id) === id),
    initialize() {
      ensureAccount();
      document.querySelectorAll("[data-qn-nav]").forEach((btn) => btn.onclick = () => go(btn.dataset.qnNav));
      document.querySelector("#qn-back")?.addEventListener("click", () => {
        if (window.history.state?.quartinaut) window.history.back();
        else go("home");
      });
      document.querySelector("#qn-search")?.addEventListener("click", () => go("search"));
    },
    async signedIn() {
      ensureAccount();
      const expected = uid2(), epoch = model.epoch;
      try {
        model.recent = JSON.parse(sessionStorage.getItem("quartinaut-recent:" + uid2()) || "[]");
      } catch {
      }
      await Promise.allSettled([refreshRegional(), load("favorites"), b.backgroundLoad()]);
      if (expected === uid2() && epoch === model.epoch) {
        if (b.state().route === "chats") void load("chats");
        if (b.state().route === "enh-posts") void load("posts");
        if (["official-calendar", "calendar-planner"].includes(b.state().route)) void load("calendar");
        b.schedule();
      }
    }
  };
}

// src/v462/dashboard-background.js
var cloud = null;
var cloudPhotos = /* @__PURE__ */ new Map();
function configureDashboardCloud(api) {
  cloud = api;
}
function resetCloudDashboardPhoto() {
  cloudPhotos.clear();
}
async function loadCloudDashboardPhoto(uid2) {
  if (!cloud || cloud.currentUid() !== uid2) return;
  const r = await cloud.call("quartinautAppearance", { action: "get" });
  if (cloud.currentUid() !== uid2) return;
  cloudPhotos.set(uid2, r.hasImage && r.base64 ? "data:image/jpeg;base64," + r.base64 : "");
}
var MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
var MAX_SAVED_CHARS = 48e4;
var ALLOWED_TYPES = Object.freeze(["image/jpeg", "image/png", "image/webp"]);
function dashboardPhotoKey(uid2) {
  return `quartinaut-dashboard-photo-v462:${String(uid2 || "guest").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 128)}`;
}
function isValidDashboardPhoto(data) {
  return typeof data === "string" && data.length < MAX_SAVED_CHARS && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data);
}
function readDashboardPhoto(uid2, storage = localStorage) {
  if (cloudPhotos.has(uid2)) return cloudPhotos.get(uid2);
  try {
    const data = storage.getItem(dashboardPhotoKey(uid2));
    return isValidDashboardPhoto(data) ? data : "";
  } catch {
    return "";
  }
}
async function saveDashboardPhoto(uid2, data, storage = localStorage) {
  if (!isValidDashboardPhoto(data)) throw new Error("Das Hintergrundbild ist zu gross oder hat ein ung\xFCltiges Format.");
  if (cloud && cloud.currentUid() === uid2) {
    await cloud.call("quartinautAppearance", { action: "save", base64: data.split(",")[1] });
    if (cloud.currentUid() !== uid2) throw Error("Konto gewechselt.");
    cloudPhotos.set(uid2, data);
    storage.removeItem(dashboardPhotoKey(uid2));
    return;
  }
  storage.setItem(dashboardPhotoKey(uid2), data);
}
async function clearDashboardPhoto(uid2, storage = localStorage) {
  if (cloud && cloud.currentUid() === uid2) {
    await cloud.call("quartinautAppearance", { action: "remove" });
    if (cloud.currentUid() !== uid2) throw Error("Konto gewechselt.");
    cloudPhotos.set(uid2, "");
  }
  storage.removeItem(dashboardPhotoKey(uid2));
}

// src/v2/preferences.js
var PREFIX = "quartinaut-v2-preferences:";
var DEFAULT_PREFERENCES = Object.freeze({ categories: [] });
function keyFor(uid2) {
  return PREFIX + String(uid2 || "guest").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100);
}
function readPreferences(uid2) {
  try {
    const raw = JSON.parse(localStorage.getItem(keyFor(uid2)) || "null");
    return {
      categories: Array.isArray(raw?.categories) ? [...new Set(raw.categories.filter((x) => typeof x === "string"))].slice(0, 30) : []
    };
  } catch {
    return { ...DEFAULT_PREFERENCES, categories: [] };
  }
}
function updatePreferences(uid2, changes) {
  const previous = readPreferences(uid2);
  const next = { categories: Array.isArray(changes?.categories) ? [...new Set(changes.categories.filter((x) => typeof x === "string"))].slice(0, 30) : previous.categories };
  try {
    localStorage.setItem(keyFor(uid2), JSON.stringify(next));
  } catch {
  }
  return next;
}
function matchHelpRequests(requests, { uid: uid2 = "", categories = [], area = "", score = () => 0 } = {}) {
  const wanted = new Set(categories);
  return requests.filter((r) => r && r.status === "offen" && r.type === "Suche" && String(r.uid || r.authorId || "") !== uid2).map((r) => ({ request: r, points: (wanted.has(r.category) ? 100 : 0) + (r.area === area ? 30 : 0) + Number(score(r) || 0) })).sort((a, b) => b.points - a.points || String(b.request.createdAt || "").localeCompare(String(a.request.createdAt || ""))).map((item) => item.request);
}
function requestJourney(request, chats = []) {
  if (!request) return { label: "Unbekannt", step: 0, detail: "" };
  if (request.status === "wartet_freigabe") return { label: "In Pr\xFCfung", step: 1, detail: "Dein Anliegen wartet auf Freigabe." };
  if (request.status === "abgelehnt") return { label: "\xDCberarbeiten", step: 1, detail: "Bitte den Ablehnungsgrund pr\xFCfen." };
  if (request.status === "erledigt" || request.status === "archiviert") return { label: "Abgeschlossen", step: 3, detail: "Dieses Anliegen ist abgeschlossen." };
  if (request.status === "abgelaufen") return { label: "Abgelaufen", step: 3, detail: "Die Laufzeit ist beendet." };
  const hasConversation = chats.some((c) => c && (c.requestId === request.id || c.reqId === request.id));
  return hasConversation ? { label: "Im Gespr\xE4ch", step: 2, detail: "\xD6ffne deine Chats, um die Hilfe zu koordinieren." } : { label: "Ver\xF6ffentlicht", step: 1, detail: "Nachbarn k\xF6nnen jetzt antworten." };
}

// src/v2/wizard.js
function mountRequestWizard(form) {
  if (!form || form.dataset.wizardMounted) return;
  form.dataset.wizardMounted = "true";
  form.classList.add("v2-request-wizard");
  const original = [...form.children], labels = ["Ort & Reichweite", "Beschreibung", "Vorschau & Absenden"];
  const steps = labels.map((label, i) => {
    const section = document.createElement("section");
    section.className = "v2-wizard-step";
    section.dataset.step = i;
    section.setAttribute("aria-label", label);
    section.hidden = i !== 0;
    return section;
  });
  function move(el) {
    const names = [...el.querySelectorAll("[name]")].map((x) => x.name);
    if (el.name) names.push(el.name);
    const i = names.includes("type") ? 0 : names.length ? 1 : 2;
    steps[i].append(el);
  }
  for (const el of original) {
    if (el.classList.contains("form-grid") && el.querySelector('[name="type"]')) [...el.children].forEach(move);
    else if (el.matches('button[type="submit"]')) steps[2].append(el);
    else move(el);
  }
  const progress = document.createElement("div");
  progress.className = "v2-wizard-progress";
  progress.setAttribute("aria-label", "Fortschritt");
  const status = document.createElement("p");
  status.className = "v2-wizard-status";
  status.setAttribute("aria-live", "polite");
  form.prepend(progress, status, ...steps);
  let current = 0;
  const preview = document.createElement("article");
  preview.className = "qn-panel";
  preview.dataset.qnPreview = "";
  steps[2].prepend(preview);
  const confirm2 = document.createElement("label");
  confirm2.className = "check-row";
  confirm2.innerHTML = '<input type="checkbox" required name="publicationConfirmed"><span>Ich habe die Angaben gepr\xFCft. Es werden keine privaten Kontaktdaten oder Hausnummern ver\xF6ffentlicht.</span>';
  steps[2].insertBefore(confirm2, steps[2].querySelector('button[type="submit"]'));
  form.addEventListener("quartinaut:draft-restored", (event) => {
    current = Math.max(0, Math.min(2, Number(event.detail?.step) || 0));
    show();
  });
  for (let i = 0; i < 3; i++) {
    const footer = document.createElement("div");
    footer.className = "v2-wizard-controls";
    if (i > 0) footer.append(control("Zur\xFCck", -1));
    if (i < 2) footer.append(control(i === 0 ? "Weiter \xB7 Beschreibung" : "Weiter \xB7 Vorschau", 1));
    const submit = steps[i].querySelector('button[type="submit"]');
    if (submit) steps[i].insertBefore(footer, submit);
    else steps[i].append(footer);
  }
  function control(label, direction) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.className = direction < 0 ? "ghost-button" : "primary-button";
    button.onclick = () => {
      if (direction > 0) {
        for (const input of steps[current].querySelectorAll("input,textarea,select")) {
          if (!input.disabled && !input.closest("[hidden]") && !input.checkValidity()) {
            input.reportValidity();
            input.focus();
            return;
          }
        }
        if (current === 0 && form.elements.audienceLevel?.value === "radius" && !form.qnCenter) {
          const status2 = form.querySelector("[data-qn-location-status]");
          if (status2) status2.textContent = "Bitte zuerst den Standort einmalig bestimmen.";
          return;
        }
      }
      current = Math.max(0, Math.min(2, current + direction));
      show();
      form.dispatchEvent(new Event("quartinaut:wizard-step"));
    };
    return button;
  }
  function show() {
    form.dataset.wizardStep = current;
    steps.forEach((step, i) => step.hidden = i !== current);
    progress.replaceChildren(...labels.map((label, i) => {
      const span = document.createElement("span");
      span.className = i <= current ? "is-active" : "";
      span.textContent = i + 1 + ". " + label;
      if (i === current) span.setAttribute("aria-current", "step");
      return span;
    }));
    status.textContent = `Schritt ${current + 1} von 3 \xB7 ${labels[current]}`;
    preview.replaceChildren();
    if (current === 2) {
      const values = new FormData(form);
      for (const [title, value] of [["Titel", values.get("title")], ["Beschreibung", values.get("text")], ["Kategorie", values.get("category")], ["Reichweite", { canton: "Kanton", municipality: "Gemeinde", country: "Schweizweit", radius: "Umkreis von " + values.get("audienceRadiusKm") + " km" }[values.get("audienceLevel") || "canton"]], ["Dringlichkeit", values.get("urgency")]]) {
        const p = document.createElement("p"), strong = document.createElement("strong");
        strong.textContent = title + ": ";
        p.append(strong, document.createTextNode(String(value || "")));
        preview.append(p);
      }
    }
    form.closest(".modal-card")?.scrollTo({ top: 0, behavior: "instant" });
  }
  show();
}

// src/v2/pwa-updates.js
var PWA_RELEASE = "5.11.6";
var acceptedUpdate = false;
function banner(message, action, handler) {
  let host = document.getElementById("v2UpdateBanner");
  if (!host) {
    host = document.createElement("div");
    host.id = "v2UpdateBanner";
    host.className = "v2-update-banner";
    host.setAttribute("role", "status");
    document.querySelector(".topbar")?.after(host);
  }
  host.replaceChildren();
  const span = document.createElement("span");
  span.textContent = message;
  host.append(span);
  if (action) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action;
    button.className = "secondary-button small";
    button.addEventListener("click", handler);
    host.append(button);
  }
}
function setupConnectivity() {
  const host = document.getElementById("v2Connectivity");
  if (!host) return;
  const refresh = () => {
    host.hidden = navigator.onLine;
    host.textContent = navigator.onLine ? "" : "Offline: Bereits geladene Inhalte sind eventuell noch verf\xFCgbar. Senden ben\xF6tigt Internet.";
  };
  window.addEventListener("online", refresh);
  window.addEventListener("offline", refresh);
  refresh();
}
async function setupPwaUpdates() {
  if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;
  let registration;
  try {
    registration = await navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
  } catch (error) {
    console.warn("[Quartinaut] Service Worker nicht verf\xFCgbar", error);
    return;
  }
  if (!registration) return;
  const offerUpdate = () => {
    if (!registration.waiting || !navigator.serviceWorker.controller) return;
    banner("Eine neue Quartinaut-Version ist bereit.", "Jetzt aktualisieren", () => {
      const editing = !!document.querySelector(".modal-backdrop form") || !!document.querySelector("form:focus-within");
      if (editing && !window.confirm("Ein Formular ist ge\xF6ffnet. Ungespeicherte Eingaben k\xF6nnten verloren gehen. Trotzdem aktualisieren?")) return;
      acceptedUpdate = true;
      registration.waiting?.postMessage({ type: "SKIP_WAITING" });
    });
  };
  if (registration.waiting) offerUpdate();
  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    worker?.addEventListener("statechange", () => {
      if (worker.state === "installed") offerUpdate();
    });
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (acceptedUpdate) location.reload();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) registration.update().catch(() => {
    });
  });
  window.addEventListener("online", () => registration.update().catch(() => {
  }));
  window.QUARTINAUT_UI_RELEASE = PWA_RELEASE;
}

// src/v3/community.js
var HUB_MODULES = Object.freeze([
  { id: "lend", icon: "\u{1F6E0}\uFE0F", title: "Leihb\xF6rse", description: "Werkzeuge und Dinge teilen", kind: "lend" },
  { id: "group", icon: "\u{1F465}", title: "Vereine & Gruppen", description: "Gemeinsam etwas unternehmen", kind: "group" },
  { id: "lost", icon: "\u{1F50E}", title: "Fundb\xFCro", description: "Verloren oder gefunden", kind: "lost" },
  { id: "market", icon: "\u{1F6CD}\uFE0F", title: "Marktplatz", description: "Kaufen, tauschen, verschenken", kind: "market" },
  { id: "match", icon: "\u2728", title: "Quartinaut Match", description: "Passendes aus deiner N\xE4he", kind: null },
  { id: "digest", icon: "\u{1F514}", title: "Benachrichtigungen", description: "Deine Themen & Zusammenfassung", kind: null },
  { id: "rsvp", icon: "\u{1F4C5}", title: "Anl\xE4sse & Zusagen", description: "Teilnehmen und Pl\xE4tze verwalten", kind: null },
  { id: "draft", icon: "\u270D\uFE0F", title: "Textassistent", description: "Beitr\xE4ge einfacher erstellen", kind: null },
  { id: "issue", icon: "\u{1F6A7}", title: "M\xE4ngelmelder", description: "Anliegen an Gemeinden", kind: "issue" },
  { id: "calendar", icon: "\u{1F5D3}\uFE0F", title: "Gemeindekalender", description: "Termine & Entsorgung", kind: "calendar" },
  { id: "stats", icon: "\u{1F4CA}", title: "Verwaltungs-Dashboard", description: "\xDCbersichten f\xFCr Berechtigte", kind: null },
  { id: "project", icon: "\u{1F91D}", title: "Quartier-Projekte", description: "Bei Aktionen mithelfen", kind: "project" }
]);
var HUB_CATEGORIES = Object.freeze({
  lend: ["Werkzeug", "Garten", "Haushalt", "Freizeit", "Sonstiges"],
  market: ["Zu verkaufen", "Zu verschenken", "Tauschen"],
  lost: ["Verloren", "Gefunden"],
  group: ["Verein", "Sport", "Familie", "Hobby", "Nachbarschaft"],
  issue: ["Strasse", "Abfall", "Beleuchtung", "Spielplatz", "Sonstiges"],
  calendar: ["Entsorgung", "Gemeindetermin", "Veranstaltung", "Information"],
  project: ["Quartieraktion", "Freiwilligenarbeit", "Umwelt", "Nachbarschaft"]
});
var HOME_OPTIONS = Object.freeze([
  { value: "home", title: "Mein Quartier" },
  { value: "hub", title: "Quartier+ \u2013 weitere Funktionen" },
  { value: "bulletin", title: "Schwarzes Brett" },
  { value: "events", title: "Veranstaltungen" },
  { value: "inbox", title: "Mitteilungen" },
  { value: "chats", title: "Chats" }
]);
var NOTIFY_TOPICS = Object.freeze([
  ["chats", "Private Nachrichten"],
  ["alerts", "Gemeinde-Alarme"],
  ["help", "Nachbarschaftshilfe"],
  ["events", "Veranstaltungen"],
  ["groups", "Gruppen und Vereine"],
  ["market", "Marktplatz"],
  ["lending", "Leihb\xF6rse"],
  ["municipality", "Gemeindeinformationen"]
]);
var HOME_KEY = "quartinaut-v3-home:";
function homeKey(uid2) {
  return HOME_KEY + String(uid2 || "guest").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100);
}
function cleanHome(value) {
  return HOME_OPTIONS.some((o) => o.value === value) ? value : "home";
}
function loadHome(uid2) {
  try {
    return cleanHome(localStorage.getItem(homeKey(uid2)));
  } catch {
    return "home";
  }
}
function saveHome(uid2, view) {
  const v = cleanHome(view);
  try {
    localStorage.setItem(homeKey(uid2), v);
  } catch {
  }
  return v;
}
function matchingItems(items, { interests = [], areaKey = "", uid: uid2 = "" } = {}) {
  const wanted = interests.map((x) => String(x).toLocaleLowerCase("de-CH"));
  return items.filter((x) => x && x.status === "published" && x.ownerUid !== uid2 && x.kind !== "issue").map((x) => {
    const text = String([x.kind, x.title, x.description, x.category].join(" ")).toLocaleLowerCase("de-CH");
    const score = (x.areaKey === areaKey ? 50 : 0) + wanted.reduce((s, w) => s + (text.includes(w) ? 30 : 0), 0) + Math.min(15, Math.max(0, 15 - (Date.now() - Date.parse(x.createdAt || 0)) / 864e5));
    return { item: x, score };
  }).sort((a, b) => b.score - a.score).map((x) => x.item);
}
function localDraft(text, kind = "help") {
  const raw = String(text || "").trim().slice(0, 500);
  if (!raw) return { title: "", description: "" };
  const summary = raw.replace(/\s+/g, " ").replace(/[\.!?]+$/, "");
  const title = summary.charAt(0).toUpperCase() + summary.slice(1, 80);
  const intro = { lend: "Ich m\xF6chte Folgendes verleihen: ", market: "Ich biete in unserer Gemeinde Folgendes an: ", lost: "Verloren/Gefunden: ", group: "Gemeinsam in unserer Gemeinde: ", project: "Bei dieser Quartieraktion geht es um: ", help: "Mein Anliegen: " }[kind] || "Mein Anliegen: ";
  return { title, description: intro + summary + ". Bitte melde dich bei Interesse direkt \xFCber Quartinaut." };
}

// src/v46/features.js
var V46_FILTERS = Object.freeze(["all", "mine", "photos", "new", "saved"]);
var V46_SEARCH_TYPES = Object.freeze(["all", "request", "hub", "group", "event", "notice", "person"]);
var V46_INBOX_TYPES = Object.freeze(["all", "unread", "chat", "alert", "reservation", "other"]);
var clean = (value) => String(value ?? "").trim().slice(0, 300);
var normalizeSearch = (value) => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("de-CH");
function safeScope(uid2) {
  return String(uid2 || "guest").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100) || "guest";
}
function readUserData(uid2, type, fallback) {
  try {
    const raw = localStorage.getItem(`quartinaut-v46:${safeScope(uid2)}:${type}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeUserData(uid2, type, value) {
  try {
    localStorage.setItem(`quartinaut-v46:${safeScope(uid2)}:${type}`, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
function publicSearchIndex({ requests = [], hubs = [], events = [], notices = [] } = {}) {
  const result = [];
  const push = (type, item, title, description, area, at) => {
    if (!item?.id) return;
    result.push({ type, id: String(item.id), title: clean(title), description: clean(description), area: clean(area), at: String(at || ""), item });
  };
  requests.filter((x) => x && x.status === "offen").forEach((x) => push("request", x, x.title, x.text, x.area, x.createdAt));
  hubs.filter((x) => x && x.status === "published" && x.kind !== "issue").forEach((x) => push(x.kind === "group" ? "group" : "hub", x, x.title, x.description, x.area, x.createdAt));
  events.filter((x) => x && x.status === "published").forEach((x) => push("event", x, x.title, x.description, x.area, x.startsAt));
  notices.filter((x) => x && x.status === "online").forEach((x) => push("notice", x, x.title, x.text, x.area, x.createdAt));
  const people = /* @__PURE__ */ new Map();
  for (const req of requests.filter((x) => x && x.status === "offen" && !x.anonymousOffer)) {
    const name = clean(req.authorName);
    if (!name || /^anonym/i.test(name)) continue;
    const key = normalizeSearch(name);
    if (!people.has(key)) people.set(key, { type: "person", id: `person-${people.size}`, title: name, description: "\xD6ffentliche Beitr\xE4ge", area: clean(req.area), at: String(req.createdAt || ""), item: { name } });
  }
  result.push(...people.values());
  return result;
}
function filterFeed(rows, { kind = "all", area = "", lastSeenAt = "", uid: uid2 = "", savedKeys = [] } = {}) {
  const areaNorm = normalizeSearch(area), saved = new Set(savedKeys);
  return rows.filter((x) => {
    if (kind === "mine") return Boolean(areaNorm) && normalizeSearch(x.area) === areaNorm;
    if (kind === "photos") return Array.isArray(x.photoPaths) && x.photoPaths.length > 0;
    if (kind === "new") return Boolean(lastSeenAt) && Date.parse(x.createdAt || 0) > Date.parse(lastSeenAt);
    if (kind === "saved") return saved.has(`request:${x.id}`) || saved.has(`hub:${x.id}`);
    return true;
  });
}
function safeMapPoint(item) {
  if (item?.mapPublic !== true && item?.locationVisibility !== "public") return null;
  const geo = item?.publicCoordinates || item?.geo || item?.coordinates || item?.location || item;
  const lat = Number(geo?.lat), lng = Number(geo?.lng ?? geo?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 45.8 || lat > 47.9 || lng < 5.9 || lng > 10.6) return null;
  return { lat, lng, id: String(item.id || ""), title: clean(item.title), kind: clean(item.kind), area: clean(item.area) };
}
function cleanCollection(raw, max = 100) {
  return Array.isArray(raw) ? [...new Set(raw.filter((x) => typeof x === "string").map(clean).filter(Boolean))].slice(0, max) : [];
}
function safeDrafts(storage, uid2, prefix = "quartinaut-draft-v42:") {
  const start = prefix + safeScope(uid2) + ":";
  const entries = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(start)) continue;
    try {
      const data = JSON.parse(storage.getItem(key));
      if (!data?.saved || Date.now() - data.saved > 72 * 36e5) continue;
      const values = data.values || [];
      const title = values.find((v) => v.name === "title")?.value || values.find((v) => v.name === "topic")?.value || "Unbenannter Entwurf";
      entries.push({ key, title: clean(title).slice(0, 90), saved: data.saved, form: key.slice(start.length).split(":")[0], context: key.slice(start.length) });
    } catch {
    }
  }
  return entries.sort((a, b) => b.saved - a.saved).slice(0, 100);
}

// src/v47/dashboard-editor.js
function cropGeometry(iw, ih, width, height, zoom2 = 1, dx = 0, dy = 0) {
  const base = Math.max(width / iw, height / ih);
  const scale = base * Math.max(1, Math.min(4, Number(zoom2) || 1));
  const renderedWidth = iw * scale, renderedHeight = ih * scale;
  const maxX = Math.max(0, (renderedWidth - width) / 2), maxY = Math.max(0, (renderedHeight - height) / 2);
  const offsetX = Math.max(-maxX, Math.min(maxX, dx)), offsetY = Math.max(-maxY, Math.min(maxY, dy));
  return { scale, x: (width - renderedWidth) / 2 + offsetX, y: (height - renderedHeight) / 2 + offsetY, dx: offsetX, dy: offsetY };
}
function decodePhoto(file) {
  if (!file || !ALLOWED_TYPES.includes(file.type)) throw new Error("Bitte JPG, PNG oder WebP ausw\xE4hlen.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Das Foto darf h\xF6chstens 8 MB gross sein.");
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.naturalWidth * img.naturalHeight > 7e7) reject(new Error("Fotoaufl\xF6sung zu hoch."));
      else resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Das Bild konnte nicht ge\xF6ffnet werden."));
    };
    img.src = url;
  });
}
async function openDashboardPhotoEditor(file, { expectedUid, currentUid, onSave }) {
  const img = await decodePhoto(file);
  if (currentUid() !== expectedUid) throw new Error("Das Konto wurde gewechselt.");
  return new Promise((resolve, reject) => {
    const backdrop = document.createElement("div");
    backdrop.className = "v47-editor-backdrop";
    backdrop.innerHTML = `<section class="v47-editor" role="dialog" aria-modal="true" aria-labelledby="v47EditorTitle">
      <h2 id="v47EditorTitle">Hintergrund zuschneiden</h2><p>Ziehe das Foto mit dem Finger in Position. Vergr\xF6ssern oder verkleinern mit dem Regler.</p>
      <div class="v47-editor-frame"><canvas width="1000" height="460" aria-label="Vorschau des zugeschnittenen Hintergrunds"></canvas></div>
      <label for="v47EditorZoom">Bildgr\xF6sse</label><input id="v47EditorZoom" type="range" min="100" max="400" value="100" step="2">
      <p class="v47-editor-status" role="status" aria-live="polite"></p>
      <div class="v47-editor-actions"><button type="button" data-editor-cancel class="ghost-button">Abbrechen</button><button type="button" data-editor-save class="primary-button">Vorschau \xFCbernehmen</button></div>
    </section>`;
    const previouslyFocused = document.activeElement;
    document.body.append(backdrop);
    const canvas = backdrop.querySelector("canvas"), ctx = canvas.getContext("2d");
    const slider = backdrop.querySelector("#v47EditorZoom"), save = backdrop.querySelector("[data-editor-save]");
    const status = backdrop.querySelector(".v47-editor-status");
    let zoom2 = 1, dx = 0, dy = 0, pointer = null, done = false;
    const preview = () => {
      const g = cropGeometry(img.naturalWidth, img.naturalHeight, canvas.width, canvas.height, zoom2, dx, dy);
      dx = g.dx;
      dy = g.dy;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, g.x, g.y, img.naturalWidth * g.scale, img.naturalHeight * g.scale);
    };
    const events = new AbortController();
    function finish(err) {
      if (done) return;
      done = true;
      events.abort();
      backdrop.remove();
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
      if (err) reject(err);
      else resolve();
    }
    const cancel = () => finish();
    backdrop.querySelector("[data-editor-cancel]").addEventListener("click", cancel);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) cancel();
    });
    const keyHandler = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = [...backdrop.querySelectorAll('button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) {
        e.preventDefault();
        return;
      }
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keyHandler, { signal: events.signal });
    slider.addEventListener("input", () => {
      zoom2 = Number(slider.value) / 100;
      preview();
    });
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", (e) => {
      pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!pointer || pointer.id !== e.pointerId) return;
      const rect = canvas.getBoundingClientRect();
      dx += (e.clientX - pointer.x) * canvas.width / rect.width;
      dy += (e.clientY - pointer.y) * canvas.height / rect.height;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      preview();
    });
    canvas.addEventListener("pointerup", () => {
      pointer = null;
    });
    canvas.addEventListener("pointercancel", () => {
      pointer = null;
    });
    save.addEventListener("click", async () => {
      save.disabled = true;
      status.textContent = "Bild wird vorbereitet \u2026";
      try {
        if (currentUid() !== expectedUid) throw new Error("Das Konto wurde gewechselt.");
        let data = "";
        for (let i = 0; i < 6; i++) {
          data = canvas.toDataURL("image/jpeg", Math.max(0.46, 0.82 - i * 0.06));
          if (isValidDashboardPhoto(data)) break;
        }
        if (!isValidDashboardPhoto(data)) throw new Error("Bild f\xFCr dieses Ger\xE4t zu gross. Bitte eine kleinere Datei ausw\xE4hlen.");
        await onSave(data);
        if (currentUid() !== expectedUid) throw new Error("Das Konto wurde gewechselt.");
        finish();
      } catch (error) {
        status.textContent = error.message || "Bild konnte nicht gespeichert werden.";
        save.disabled = false;
      }
    });
    preview();
    slider.focus();
  });
}

// src/v47/sync.js
function favoriteDocId(kind, value) {
  const input = `${String(kind)}:${String(value)}`;
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function normalizedFavorite(kind, value) {
  const allowed = ["request", "hub", "group", "people", "groups", "searches"];
  const v = String(value || "").trim().slice(0, 120);
  if (!allowed.includes(kind) || !v || /[\u0000-\u001f]/.test(v)) return null;
  return { kind, value: v, id: favoriteDocId(kind, v) };
}
function contentVersion(item) {
  const raw = [item.key, item.title, item.detail, item.at, item.version || ""].map((x) => String(x ?? "")).join("");
  let a = 2166136261;
  const bytes = new TextEncoder().encode(raw);
  for (const byte of bytes) {
    a ^= byte;
    a = Math.imul(a, 16777619);
  }
  return `v1-${(a >>> 0).toString(16).padStart(8, "0")}`;
}
function makeOperationId(prefix = "op") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `${prefix}_${crypto.randomUUID()}`;
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") crypto.getRandomValues(bytes);
  else throw new Error("Sichere Vorgangskennung nicht verf\xFCgbar.");
  return `${prefix}_${[...bytes].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}
var safeUid = (uid2) => String(uid2 || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 128);
var keyFor2 = (uid2, kind) => `quartinaut-v47:${safeUid(uid2)}:${kind}`;
function readJson(storage, key, fallback) {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function saveJson(storage, key, value) {
  storage.setItem(key, JSON.stringify(value));
}
function createOwnerSync({ uid: uid2, storage = localStorage, callable, subscribe, onChange = () => {
}, onError = () => {
} }) {
  if (!uid2) throw new Error("Synchronisierung ben\xF6tigt ein angemeldetes Konto.");
  let closed = false, busy = false;
  const unsubscribers = [];
  const serverFavorites = /* @__PURE__ */ new Map();
  const serverReads = /* @__PURE__ */ new Map();
  const queueKey = keyFor2(uid2, "pending");
  const favoritesKey = keyFor2(uid2, "favorites");
  const readsKey = keyFor2(uid2, "reads");
  let favorites = new Map(readJson(storage, favoritesKey, []).map((x) => [x.id, x]));
  let reads = new Map(readJson(storage, readsKey, []).map((x) => [x.id, x]));
  const queue = () => readJson(storage, queueKey, []).filter((x) => x?.opId && x?.action);
  function overlayPending() {
    const fav = new Map(serverFavorites);
    const seen = new Map(serverReads);
    for (const op of queue()) {
      if (op.action === "favorite.set") fav.set(op.payload.id, { ...op.payload, active: op.payload.active });
      if (op.action === "favorite.import") for (const item of op.payload.items || []) {
        if (!fav.has(item.id)) fav.set(item.id, { ...item, active: true, legacy: true });
      }
      if (op.action === "read.mark") seen.set(op.payload.id, op.payload);
    }
    favorites = fav;
    reads = seen;
    saveJson(storage, favoritesKey, [...fav.values()]);
    saveJson(storage, readsKey, [...seen.values()]);
    onChange();
  }
  async function flush() {
    if (busy || closed || typeof navigator !== "undefined" && navigator.onLine === false) return;
    busy = true;
    try {
      let steps = 0;
      while (!closed && steps++ < 500) {
        const pending = queue();
        if (!pending.length) break;
        const next = pending[0];
        try {
          await callable("quartinautUserSync", { action: next.action, opId: next.opId, ...next.payload });
        } catch (error) {
          if (!closed) onError(error);
          break;
        }
        if (closed) break;
        saveJson(storage, queueKey, queue().filter((x) => x.opId !== next.opId));
      }
    } finally {
      busy = false;
      if (!closed) onChange();
    }
  }
  function enqueue(action, payload) {
    if (closed) return;
    const pending = queue();
    pending.push({ action, payload, opId: makeOperationId("sync") });
    saveJson(storage, queueKey, pending);
    overlayPending();
    void flush();
  }
  function setFavorite(kind, value, active) {
    const entry = normalizedFavorite(kind, value);
    if (!entry) throw new Error("Ung\xFCltiger Favorit.");
    enqueue("favorite.set", { ...entry, active: Boolean(active) });
  }
  function markRead(entry) {
    const id = favoriteDocId("read", entry.key);
    enqueue("read.mark", { id, key: entry.key, version: contentVersion(entry) });
  }
  function isRead(entry) {
    const doc = reads.get(favoriteDocId("read", entry.key));
    return Boolean(doc && doc.version === contentVersion(entry));
  }
  function favoriteList(kind) {
    return [...favorites.values()].filter((x) => x.active && (!kind || kind === x.kind));
  }
  function isFavorite(kind, value) {
    return favorites.get(favoriteDocId(kind, value))?.active === true;
  }
  async function importLegacy(items) {
    const marker = keyFor2(uid2, "migration-submitted");
    if (closed || readJson(storage, marker, false)) return;
    const unique = [...new Map(items.map((x) => normalizedFavorite(x.kind, x.value)).filter(Boolean).map((x) => [x.id, x])).values()];
    for (let i = 0; i < unique.length; i += 200) enqueue("favorite.import", { items: unique.slice(i, i + 200) });
    if (!closed) saveJson(storage, marker, true);
  }
  function subscribeOwnerCollections() {
    if (closed) return;
    unsubscribers.push(subscribe(uid2, "favorites", (docs) => {
      if (closed) return;
      serverFavorites.clear();
      for (const doc of docs) if (doc?.id) serverFavorites.set(doc.id, doc);
      overlayPending();
    }));
    unsubscribers.push(subscribe(uid2, "reads", (docs) => {
      if (closed) return;
      serverReads.clear();
      for (const doc of docs) if (doc?.id) serverReads.set(doc.id, doc);
      overlayPending();
    }));
  }
  function dispose() {
    closed = true;
    unsubscribers.forEach((fn) => fn?.());
    unsubscribers.length = 0;
  }
  return { uid: uid2, setFavorite, favoriteList, isFavorite, markRead, isRead, flush, importLegacy, subscribeOwnerCollections, dispose };
}

// src/v48/accessibility.js
function sortCurrentPageResults(rows = [], order = "relevance") {
  const result = [...rows];
  if (order === "name") return result.sort((a, b) => String(a?.title || "").localeCompare(String(b?.title || ""), "de-CH"));
  if (order === "area") return result.sort((a, b) => String(a?.area || "").localeCompare(String(b?.area || ""), "de-CH"));
  return result;
}
function installAccessibilityShell(root = document) {
  const nav = root.querySelector(".bottom-nav");
  if (nav) {
    const sync = () => nav.querySelectorAll(".nav-item").forEach((item) => {
      if (item.classList.contains("active")) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    sync();
    const observer = new MutationObserver(sync);
    nav.querySelectorAll(".nav-item").forEach((item) => observer.observe(item, { attributes: true, attributeFilter: ["class"] }));
  }
  return true;
}

// src/v54/presentation.mjs
var V53_SHORTCUTS = Object.freeze([
  { id: "need", label: "Hilfe suchen", hint: "Unterst\xFCtzung finden", icon: "\u270B", action: "new-need" },
  { id: "offer", label: "Hilfe anbieten", hint: "Nachbarn unterst\xFCtzen", icon: "\u2661", action: "new-offer" },
  { id: "market", label: "Marktplatz", hint: "Kaufen & verschenken", icon: "\u{1F6CD}\uFE0F", hub: "market" },
  { id: "group", label: "Vereine", hint: "Gemeinsam aktiv", icon: "\u{1F465}", hub: "group" },
  { id: "loans", label: "Leihb\xF6rse", hint: "Gegenst\xE4nde ausleihen", icon: "\u{1F9F0}", hub: "lend" },
  { id: "calendar", label: "Gemeindekalender", hint: "Termine & Entsorgung", icon: "\u{1F4C5}", v50: "v50calendar" },
  { id: "events", label: "Veranstaltungen", hint: "Lokale Anl\xE4sse", icon: "\u{1F389}", route: "events" },
  { id: "bulletin", label: "Schwarzes Brett", hint: "Gesuche & Angebote", icon: "\u{1F4CB}", route: "bulletin" },
  { id: "inbox", label: "Mitteilungen", hint: "Neues und Anfragen", icon: "\u{1F514}", route: "inbox" },
  { id: "chats", label: "Nachrichten", hint: "Privat austauschen", icon: "\u{1F4AC}", route: "chats" },
  { id: "saved", label: "Favoriten", hint: "Gespeicherte Beitr\xE4ge", icon: "\u2B50", route: "saved" },
  { id: "map", label: "Quartierkarte", hint: "Deine Umgebung", icon: "\u{1F4CD}", route: "map" },
  { id: "swissmap", label: "Schweizkarte", hint: "Kantone & Gemeinden", icon: "\u{1F1E8}\u{1F1ED}", route: "swissmap" }
]);
var V53_PRIORITY = Object.freeze([
  { id: "inbox", label: "Mitteilungen & Anfragen" },
  { id: "events", label: "Termine & Veranstaltungen" },
  { id: "loans", label: "Ausleihen & Reservierungen" },
  { id: "bulletin", label: "Meine Anliegen" },
  { id: "saved", label: "Meine Favoriten" },
  { id: "map", label: "Quartierkarte" }
]);
function uniqueKnown(values, known) {
  if (!Array.isArray(values)) return [];
  const allowed = new Set(known), seen = /* @__PURE__ */ new Set(), result = [];
  for (const value of values) {
    if (typeof value !== "string" || !allowed.has(value) || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}
function cleanQuickLinks(values) {
  const ids = uniqueKnown(values, V53_SHORTCUTS.map((x) => x.id));
  return ids.length >= 2 ? ids.slice(0, 8) : ["need", "market", "calendar"];
}
function cleanPriorityOrder(values) {
  const defaults = V53_PRIORITY.map((x) => x.id), ids = uniqueKnown(values, defaults);
  return [...ids, ...defaults.filter((x) => !ids.includes(x))];
}
function cleanDensity(value) {
  return value === "compact" ? "compact" : "comfortable";
}
var STATUS = Object.freeze({
  offen: "Offen",
  wartet_freigabe: "In Pr\xFCfung",
  erledigt: "Erledigt",
  archiviert: "Archiviert",
  abgelaufen: "Abgelaufen",
  gel\u00F6scht: "Gel\xF6scht",
  paused: "Pausiert",
  archived: "Archiviert",
  deleted: "Gel\xF6scht",
  requested: "Angefragt",
  accepted: "Best\xE4tigt",
  declined: "Abgelehnt",
  cancelled: "Storniert",
  confirmed: "Angemeldet",
  waitlisted: "Auf Warteliste",
  returned: "Zur\xFCckgegeben",
  borrowed: "Ausgeliehen",
  reserved: "Reserviert",
  available: "Verf\xFCgbar",
  expired: "Abgelaufen",
  completed: "Abgeschlossen",
  published: "Ver\xF6ffentlicht",
  pending: "In Pr\xFCfung",
  submitted: "Eingereicht",
  in_review: "In Bearbeitung",
  rejected: "Abgelehnt",
  approved: "Freigegeben",
  open: "Offen",
  active: "Aktiv"
});
function statusLabel(value) {
  return STATUS[String(value || "").toLowerCase()] || String(value || "Unbekannt");
}
var GROUPS = Object.freeze([
  { id: "sharing", icon: "\u{1F9F0}", label: "Teilen & Kaufen", description: "Ausleihen, reservieren, verkaufen und finden", ids: ["lend", "v50loans", "market", "v50market", "lost"] },
  { id: "community", icon: "\u{1F465}", label: "Gemeinschaft & Vereine", description: "Gruppen, Anmeldungen und gemeinsame Projekte", ids: ["group", "v50associations", "project", "rsvp"] },
  { id: "municipality", icon: "\u{1F3E1}", label: "Gemeinde & Termine", description: "Kalender, Entsorgung, Meldungen und Verwaltung", ids: ["calendar", "v50calendar", "event-link", "swiss-map-link", "issue", "stats"] },
  { id: "help", icon: "\u{1F91D}", label: "Nachbarschaftshilfe", description: "Hilfe suchen, anbieten und passende Beitr\xE4ge finden", ids: ["help-request", "help-offer", "bulletin-link", "match"] },
  { id: "personal", icon: "\u2661", label: "F\xFCr mich", description: "Mitteilungen, Favoriten, Vorschl\xE4ge und Textassistent", ids: ["digest", "draft", "inbox-link", "saved-link"] }
]);
function hubGroups() {
  return GROUPS.map((g) => ({ ...g, ids: [...g.ids] }));
}

// src/v54/wappen.mjs
var CANTON_COAT_FILES = Object.freeze({
  AG: "Wappen Aargau matt.svg",
  AI: "Wappen Appenzell Innerrhoden matt.svg",
  AR: "Wappen Appenzell Ausserrhoden matt.svg",
  BE: "Wappen Bern matt.svg",
  BL: "Wappen Basel-Landschaft matt.svg",
  BS: "Wappen Basel-Stadt matt.svg",
  FR: "Wappen Freiburg matt.svg",
  GE: "Wappen Genf matt.svg",
  GL: "Wappen Glarus matt.svg",
  GR: "Wappen Graub\xFCnden matt.svg",
  JU: "Wappen Jura matt.svg",
  LU: "Wappen Luzern matt.svg",
  NE: "Wappen Neuenburg matt.svg",
  NW: "Wappen Nidwalden matt.svg",
  OW: "Wappen Obwalden matt.svg",
  SG: "Wappen St. Gallen matt.svg",
  SH: "Wappen Schaffhausen matt.svg",
  SO: "Wappen Solothurn matt.svg",
  SZ: "Wappen Schwyz matt.svg",
  TG: "Wappen Thurgau matt.svg",
  TI: "Wappen Tessin matt.svg",
  UR: "Wappen Uri matt.svg",
  VD: "Wappen Waadt matt.svg",
  VS: "Wappen Wallis matt.svg",
  ZG: "Wappen Zug matt.svg",
  ZH: "Wappen Z\xFCrich matt.svg"
});
var found = /* @__PURE__ */ new Map();
var inFlight = /* @__PURE__ */ new Map();
var pendingFailures = /* @__PURE__ */ new Map();
var validCode = (x) => /^\d{1,5}$/.test(String(x ?? ""));
function commonsCoatUrl(file) {
  if (typeof file !== "string" || !file.trim() || file.length > 240 || /[<>\\/#?]/.test(file)) return "";
  return "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(file.trim().replaceAll(" ", "_"));
}
function commonsSourceUrl(file) {
  if (typeof file !== "string" || !file.trim() || file.length > 240 || /[<>\\/#?]/.test(file)) return "";
  return "https://commons.wikimedia.org/wiki/File:" + encodeURIComponent(file.trim().replaceAll(" ", "_"));
}
function cantonCoat(code) {
  const file = CANTON_COAT_FILES[String(code || "").toUpperCase()];
  return file ? { file, url: "./assets/native/wappen/cantons/" + String(code).toUpperCase() + ".svg", source: commonsSourceUrl(file) } : null;
}
function municipalityCoat(code) {
  const url = globalThis.QUARTINAUT_LOCAL_COATS?.[String(code)];
  return url ? { file: "BFS " + code, url, source: "./assets/native/wappen/sources.json" } : found.get(String(code)) || null;
}
function coatFileFromWikidata(value) {
  if (typeof value !== "string") return null;
  try {
    const u = new URL(value);
    if (!["commons.wikimedia.org", "upload.wikimedia.org"].includes(u.hostname)) return null;
    if (u.hostname === "commons.wikimedia.org" && !u.pathname.startsWith("/wiki/Special:FilePath/")) return null;
    const file = decodeURIComponent(u.pathname.split("/").at(-1)).replaceAll("_", " ");
    return commonsCoatUrl(file) ? file : null;
  } catch {
    return null;
  }
}
async function fetchChunk(codes) {
  const query = `SELECT ?code ?image WHERE { VALUES ?code { ${codes.map((code) => '"' + code + '"').join(" ")} } ?item wdt:P771 ?code; wdt:P94 ?image. }`;
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query);
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), 11e3);
  try {
    const res = await fetch(url, { headers: { Accept: "application/sparql-results+json" }, signal: control.signal });
    if (!res.ok) throw new Error("Wikidata HTTP " + res.status);
    const data = await res.json();
    if (!Array.isArray(data?.results?.bindings)) throw new Error("Ung\xFCltige Wappenantwort");
    const listed = new Set(codes);
    for (const binding of data.results.bindings) {
      const code = String(binding?.code?.value || "");
      if (!listed.has(code)) continue;
      const file = coatFileFromWikidata(binding?.image?.value);
      if (file && !found.has(code)) found.set(code, { file, url: commonsCoatUrl(file), source: commonsSourceUrl(file) });
    }
    for (const code of codes) if (!found.has(code)) found.set(code, null);
  } finally {
    clearTimeout(timer);
  }
}
async function loadMunicipalityCoats(codes) {
  if (globalThis.QUARTINAUT_LOCAL_COATS) return codes.filter((x) => globalThis.QUARTINAUT_LOCAL_COATS[String(x)]).length;
  const clean2 = [...new Set((codes || []).map((x) => String(x)))].filter(validCode);
  const wait = [];
  const newCodes = [];
  const now = Date.now();
  for (const code of clean2) {
    if (found.has(code)) continue;
    if (inFlight.has(code)) {
      wait.push(inFlight.get(code));
      continue;
    }
    if (now - (pendingFailures.get(code) || 0) < 6e4) continue;
    newCodes.push(code);
  }
  for (let i = 0; i < newCodes.length; i += 45) {
    const chunk = newCodes.slice(i, i + 45);
    const promise = fetchChunk(chunk).catch(() => {
      for (const code of chunk) pendingFailures.set(code, Date.now());
    }).finally(() => {
      for (const code of chunk) inFlight.delete(code);
    });
    for (const code of chunk) inFlight.set(code, promise);
    wait.push(promise);
  }
  await Promise.all(wait);
  return clean2.filter((x) => municipalityCoat(x)).length;
}

// src/v54/swiss-map.mjs
var SVG_NS = "http://www.w3.org/2000/svg";
var CAPITALS = { "ZH": "Z\xFCrich", "BE": "Bern", "LU": "Luzern", "UR": "Altdorf", "SZ": "Schwyz", "OW": "Sarnen", "NW": "Stans", "GL": "Glarus", "ZG": "Zug", "FR": "Freiburg / Fribourg", "SO": "Solothurn", "BS": "Basel", "BL": "Liestal", "SH": "Schaffhausen", "AR": "Herisau", "AI": "Appenzell", "SG": "St. Gallen", "GR": "Chur", "AG": "Aarau", "TG": "Frauenfeld", "TI": "Bellinzona", "VD": "Lausanne", "VS": "Sitten / Sion", "NE": "Neuenburg / Neuch\xE2tel", "GE": "Genf / Gen\xE8ve", "JU": "Delsberg / Del\xE9mont" };
var GEO_SOURCE = {
  url: "https://cdn.jsdelivr.net/gh/samkhavandi/Swiss_Geography_Look_Ups@main/geometries/municipality_2025.geojson",
  alternate: "https://raw.githubusercontent.com/samkhavandi/Swiss_Geography_Look_Ups/main/geometries/municipality_2025.geojson",
  info: "https://www.agvchapp.bfs.admin.ch/de/boundaries",
  date: "2025-01-01"
};
var boundaryCache = null;
var boundaryPending = null;
var escapeText = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function searchKey(s) {
  return String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
function geoId(feature) {
  const p = feature?.properties || {};
  return String(p.bfs_nr ?? p.BFS_NR ?? p.BFS_Nummer ?? p.bfsCode ?? feature?.id ?? "").replace(/\.0$/, "").trim();
}
function cantonFeatures(collection, municipalities) {
  const ids = new Set(municipalities.map((m) => String(m.bfsCode)));
  return (collection?.features || []).filter((f) => ids.has(geoId(f)) && ["Polygon", "MultiPolygon"].includes(f?.geometry?.type));
}
function geometryRings(geom) {
  if (geom?.type === "Polygon") return geom.coordinates || [];
  if (geom?.type === "MultiPolygon") return (geom.coordinates || []).flatMap((p) => p || []);
  return [];
}
function polygonLabelPoint(rings) {
  if (!rings?.length) return null;
  const clean2 = rings.map((r) => r.filter((p) => Number.isFinite(p?.[0]) && Number.isFinite(p?.[1]))).filter((r) => r.length >= 3);
  if (!clean2.length) return null;
  const area = (r) => Math.abs(r.reduce((a, p, i) => {
    const n = r[(i + 1) % r.length];
    return a + p[0] * n[1] - n[0] * p[1];
  }, 0)) / 2;
  const ring = clean2.reduce((a, b) => area(a) >= area(b) ? a : b);
  const xs = ring.map((x) => x[0]), ys = ring.map((x) => x[1]);
  const box = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  if (!box.width || !box.height) return null;
  for (const y of [box.y + box.height * 0.5, box.y + box.height * 0.35, box.y + box.height * 0.65]) {
    const cuts = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      if (a[1] <= y && b[1] > y || b[1] <= y && a[1] > y) cuts.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
    }
    cuts.sort((a, b) => a - b);
    const spans = [];
    for (let i = 0; i + 1 < cuts.length; i += 2) spans.push([cuts[i], cuts[i + 1]]);
    if (spans.length) {
      const widest = spans.reduce((a, b) => a[1] - a[0] >= b[1] - b[0] ? a : b);
      return { ...box, cx: (widest[0] + widest[1]) / 2, cy: y, usableWidth: widest[1] - widest[0], area: area(ring) };
    }
  }
  return { ...box, cx: box.x + box.width / 2, cy: box.y + box.height / 2, usableWidth: box.width, area: area(ring) };
}
function cantonPaths(features, width = 960, height = 600) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, sumLat = 0, count = 0;
  for (const f of features) for (const ring of geometryRings(f.geometry)) for (const p of ring) {
    if (!Array.isArray(p) || !Number.isFinite(+p[0]) || !Number.isFinite(+p[1])) continue;
    sumLat += +p[1];
    count++;
  }
  if (!count) return [];
  const factor = Math.cos(sumLat / count * Math.PI / 180);
  for (const f of features) for (const ring of geometryRings(f.geometry)) for (const p of ring) {
    if (!Array.isArray(p) || !Number.isFinite(+p[0]) || !Number.isFinite(+p[1])) continue;
    const x = +p[0] * factor, y = -+p[1];
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const dx = Math.max(1e-3, maxX - minX), dy = Math.max(1e-3, maxY - minY), s = Math.min((width - 64) / dx, (height - 64) / dy);
  const offX = (width - dx * s) / 2, offY = (height - dy * s) / 2;
  const xy = (p) => [offX + (+p[0] * factor - minX) * s, offY + (-+p[1] - minY) * s];
  return features.map((f) => {
    const projected = [];
    const d = geometryRings(f.geometry).map((ring) => {
      let last = null, out = "", current = [];
      for (let i = 0; i < ring.length; i++) {
        const p = ring[i];
        if (!Array.isArray(p) || !Number.isFinite(+p[0]) || !Number.isFinite(+p[1])) continue;
        const [x, y] = xy(p);
        current.push([x, y]);
        if (last && i < ring.length - 1 && Math.hypot(x - last[0], y - last[1]) < 0.7) continue;
        out += (last ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
        last = [x, y];
      }
      if (current.length > 2) projected.push(current);
      return out ? out + "Z" : "";
    }).filter(Boolean).join("");
    return { id: geoId(f), d, label: polygonLabelPoint(projected) };
  }).filter((r) => r.d);
}
async function boundaries() {
  if (boundaryCache) return boundaryCache;
  if (!boundaryPending) boundaryPending = (async () => {
    for (const url of ["./assets/native/municipality_2025.geojson", GEO_SOURCE.url, GEO_SOURCE.alternate]) {
      const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 12e3);
      try {
        const response = await fetch(url, { cache: "force-cache", signal: controller.signal });
        if (!response.ok) continue;
        const json = await response.json();
        if (json?.type === "FeatureCollection" && Array.isArray(json.features) && json.features.length > 1900) {
          boundaryCache = json;
          return json;
        }
      } catch {
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new Error("Geodaten nicht verf\xFCgbar");
  })().finally(() => {
    boundaryPending = null;
  });
  return boundaryPending;
}
var svgNode = (tag, attrs = {}) => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
};
function zoom(svg, shape, pad = 0.16) {
  try {
    if (!shape) return;
    const b = shape.getBBox();
    if (b.width && b.height) svg.setAttribute("viewBox", `${b.x - b.width * pad} ${b.y - b.height * pad} ${b.width * (1 + pad * 2)} ${b.height * (1 + pad * 2)}`);
  } catch {
  }
}
var coatIcon = (coat, name, code = "") => coat?.url ? `<span class="v541-coat-icon"><img src="${escapeText(coat.url)}" alt="Wappen ${escapeText(name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer"></span>` : `<span class="v541-coat-icon v541-coat-missing" aria-label="Wappen nicht verf\xFCgbar"><span aria-hidden="true">\u{1F6E1}</span></span>`;
var cantonRow = (c, count) => `<button class="v54-item" data-v54-canton="${escapeText(c.code)}" type="button">${coatIcon(cantonCoat(c.code), c.name)}<span class="v54-item-code">${escapeText(c.code)}</span><span class="v54-item-main"><strong>${escapeText(c.name)}</strong><small>${c.municipalities.length} Gemeinden</small></span><span class="v54-item-hint">${count ? `${count} Registrierungen` : ""} \u203A</span></button>`;
var municipalityRow = (c, m, current) => `<button class="v54-item ${current === String(m.bfsCode) ? "is-current" : ""}" data-v54-municipality="${escapeText(m.bfsCode)}" type="button">${coatIcon(municipalityCoat(m.bfsCode), m.name)}<span class="v54-item-main"><strong>${escapeText(m.name)}</strong><small>Kanton ${escapeText(c.code)}</small></span><span aria-hidden="true">\u203A</span></button>`;
function mountSwissMapExplorer(host, { cantons: cantons2 = [], counts = {}, ownArea = "", goRoute = () => {
} } = {}) {
  const root = host?.closest("[data-v54-explorer]"), baseSvg = host?.querySelector("svg");
  if (!root || !baseSvg) return;
  const base = baseSvg.cloneNode(true), side = root.querySelector("[data-v54-profile]"), list = root.querySelector("[data-v54-list]"), crumb = root.querySelector("[data-v54-breadcrumb]"), search = root.querySelector("[data-v54-search]"), status = root.querySelector("[data-v54-status]"), back = root.querySelector("[data-v54-back]"), legend = root.querySelector("[data-v54-legend]"), mapCurrent = root.querySelector("[data-v541-map-current]"), labelToggle = root.querySelector("[data-v541-label-toggle]");
  const byCode = new Map(cantons2.map((c) => [c.code, c]));
  const sortedCantons = [...cantons2].sort((a, b) => a.name.localeCompare(b.name, "de-CH"));
  let canton = null, municipality = null, q = "", request = 0, labelMode = "names";
  const getMunicipality = (c, id) => c?.municipalities.find((m) => String(m.bfsCode) === String(id));
  function countrySvg() {
    const svg = base.cloneNode(true);
    svg.classList.add("v54-country-svg");
    svg.querySelectorAll("[data-code]").forEach((p) => {
      const c = byCode.get(p.dataset.code);
      p.setAttribute("role", "button");
      p.setAttribute("tabindex", "0");
      p.setAttribute("aria-label", `${c?.name || p.dataset.code} \xF6ffnen`);
    });
    host.replaceChildren(svg);
  }
  function cantonSvg(c) {
    const svg = base.cloneNode(true);
    svg.classList.add("v54-zoom-svg");
    svg.querySelector(".canton-label-layer")?.remove();
    const selected = svg.querySelector(`[data-code="${c.code}"]`);
    svg.querySelectorAll("[data-code]").forEach((p) => {
      p.removeAttribute("tabindex");
      p.removeAttribute("role");
      p.classList.toggle("v54-dimmed", p !== selected);
    });
    host.replaceChildren(svg);
    zoom(svg, selected, 0.09);
  }
  function renderMunicipalityLabels() {
    const svg = host.querySelector(".v54-municipalities-svg");
    if (!svg) return;
    svg.querySelector(".v541-label-layer")?.remove();
    const group = svgNode("g", { class: "v541-label-layer", "aria-hidden": "true" });
    const placed = [];
    const paths = [...svg.querySelectorAll("[data-v54-map-municipality]")].map((p) => ({ p, l: p.__v541Label })).filter((x) => x.l).sort((a, b) => b.l.area - a.l.area);
    for (const { p, l } of paths) {
      const m = getMunicipality(canton, p.dataset.v54MapMunicipality);
      if (!m) continue;
      const coat = labelMode === "arms" ? municipalityCoat(m.bfsCode) : null;
      const drawCoat = Boolean(coat?.url && l.width >= 43 && l.height >= 48 && l.usableWidth >= 36);
      const text = String(m.name), desired = Math.min(250, text.length * 6.5 + 9);
      if (!drawCoat && (l.width < Math.max(50, desired * 0.9) || l.height < 27 || l.usableWidth < desired * 0.85)) continue;
      const x = l.cx, y = l.cy, w = drawCoat ? 32 : desired;
      if (placed.some((o) => Math.abs(o.x - x) < (o.w + w) / 2 + 7 && Math.abs(o.y - y) < (drawCoat ? 38 : 24))) continue;
      if (drawCoat) {
        const badge = svgNode("image", { x: (x - 12).toFixed(1), y: (y - 15).toFixed(1), width: 24, height: 30, href: coat.url, preserveAspectRatio: "xMidYMid meet" });
        group.appendChild(badge);
      } else {
        const t = svgNode("text", { x: x.toFixed(1), y: y.toFixed(1), class: "v541-municipality-label", "font-size": 11 });
        t.textContent = text;
        group.appendChild(t);
      }
      placed.push({ x, y, w });
    }
    svg.appendChild(group);
  }
  function updateMapCaption() {
    if (mapCurrent) {
      if (!canton) mapCurrent.innerHTML = "<strong>CH</strong><span>Schweiz \xB7 26 Kantone</span>";
      else if (!municipality) mapCurrent.innerHTML = `${coatIcon(cantonCoat(canton.code), canton.name)}<strong>${escapeText(canton.code)}</strong><span>${escapeText(canton.name)} \xB7 Gemeinden entdecken</span>`;
      else {
        const m = getMunicipality(canton, municipality);
        mapCurrent.innerHTML = `${coatIcon(municipalityCoat(m?.bfsCode), m?.name || "Gemeinde")}<span>${escapeText(m?.name || "")} \xB7 ${escapeText(canton.code)}</span>`;
      }
    }
    if (labelToggle) {
      labelToggle.hidden = !canton;
      labelToggle.textContent = labelMode === "names" ? "Karte: Gemeindenamen" : "Karte: Wappen";
      labelToggle.setAttribute("aria-label", labelMode === "names" ? "Wappen auf geeigneten Gemeindefl\xE4chen anzeigen" : "Gemeindenamen auf der Karte anzeigen");
      labelToggle.setAttribute("aria-pressed", String(labelMode === "arms"));
    }
  }
  function scheduleCoats(c, selectedId = null) {
    const token = request;
    const ids = selectedId ? [String(selectedId)] : c.municipalities.map((m) => String(m.bfsCode));
    void loadMunicipalityCoats(ids).then(() => {
      if (token !== request || !host.isConnected) return;
      const position = list.scrollTop;
      renderList();
      list.scrollTop = position;
      updateMapCaption();
      if (municipality) {
        profile();
      }
      if (labelMode === "arms") renderMunicipalityLabels();
    });
  }
  function municipalitySvg(c, features) {
    const paths = cantonPaths(features);
    if (!paths.length) return false;
    const svg = svgNode("svg", { viewBox: "0 0 960 600", role: "group", "aria-label": `Gemeindegrenzen ${c.name} (Stand 2025)` });
    svg.classList.add("v54-municipalities-svg");
    const group = svgNode("g");
    const codes = new Map(c.municipalities.map((m) => [String(m.bfsCode), m]));
    for (const { id, d, label } of paths) {
      const m = codes.get(id);
      if (!m) continue;
      const p = svgNode("path", { d, "fill-rule": "evenodd", "data-v54-map-municipality": id, role: "button", tabindex: "0", "aria-label": `${m.name} \u2013 Steckbrief \xF6ffnen` });
      p.__v541Label = label;
      const title = svgNode("title");
      title.textContent = `${m.name}`;
      p.appendChild(title);
      group.appendChild(p);
    }
    svg.appendChild(group);
    host.replaceChildren(svg);
    renderMunicipalityLabels();
    highlightMunicipality();
    return true;
  }
  function highlightMunicipality() {
    const svg = host.querySelector(".v54-municipalities-svg");
    if (!svg) return;
    svg.querySelectorAll("[data-v54-map-municipality]").forEach((p) => p.classList.toggle("is-selected", p.dataset.v54MapMunicipality === municipality));
    if (municipality) zoom(svg, svg.querySelector(`[data-v54-map-municipality="${municipality}"]`), 0.7);
    else svg.setAttribute("viewBox", "0 0 960 600");
  }
  function profile() {
    const facts = (rows) => `<div class="v54-facts">${rows.map(([a, b]) => `<span><small>${escapeText(a)}</small><strong>${escapeText(b)}</strong></span>`).join("")}</div>`;
    if (!canton) {
      side.innerHTML = `<span class="v54-kicker">Schweiz \xB7 \xDCbersicht</span><h3>Entdecke die Schweiz</h3>${facts([["Kantone", cantons2.length], ["Gemeinden", cantons2.reduce((n, c) => n + c.municipalities.length, 0).toLocaleString("de-CH")]])}<p>Tippe auf einen Kanton. Die Farben zeigen wie bisher die Quartinaut-Registrierungen.</p>`;
    } else if (!municipality) {
      const coat = cantonCoat(canton.code);
      side.innerHTML = `<span class="v54-kicker">Kanton \xB7 Steckbrief</span><div class="v541-profile-heading">${coatIcon(coat, canton.name)}<div><h3>${escapeText(canton.name)}</h3><span class="v541-shortcode">${escapeText(canton.code)}</span></div></div>${facts([["K\xFCrzel", canton.code], ["Hauptort", CAPITALS[canton.code] || "\u2013"], ["Gemeinden", canton.municipalities.length], ["Quartinaut-Registrierungen", counts[canton.code] || 0]])}<p>Gemeinde auf der Karte oder in der Liste ausw\xE4hlen.</p><a class="v541-coat-source" href="${escapeText(coat?.source || "#")}" target="_blank" rel="noopener noreferrer">Kantonswappen \xB7 Quelle &amp; Lizenz \u2197</a>`;
    } else {
      const m = getMunicipality(canton, municipality);
      if (!m) return;
      const own = `${m.name} (${canton.code})`.toLowerCase() === String(ownArea).toLowerCase();
      const official = `https://www.agvchapp.bfs.admin.ch/de/communes/results?BfsNr=${encodeURIComponent(m.bfsCode)}`;
      const coat = municipalityCoat(m.bfsCode);
      side.innerHTML = `<span class="v54-kicker">Gemeinde \xB7 Steckbrief</span><div class="v541-profile-heading">${coatIcon(coat, m.name)}<h3>${escapeText(m.name)}</h3></div>${facts([["Kanton", canton.name], ["Kantonsk\xFCrzel", canton.code], ["Land", "Schweiz"], ["Quartinaut", own ? "Deine Gemeinde" : "Gemeinde entdecken"]])}<p>Aktuelle amtliche Gemeindedaten und Fusionen findest du im BFS-Verzeichnis. Einwohnerzahlen und Fl\xE4che werden ohne gepr\xFCfte Werte nicht gesch\xE4tzt.</p><div class="v54-actions"><a href="${official}" class="secondary-button small" target="_blank" rel="noopener noreferrer">Amtlicher Steckbrief \u2197</a>${own ? '<button class="ghost-button small" type="button" data-route="hub">Mein Quartier+ \xF6ffnen</button>' : ""}</div>${coat?.source ? `<a class="v541-coat-source" href="${escapeText(coat.source)}" target="_blank" rel="noopener noreferrer">Gemeindewappen \xB7 Quelle &amp; Lizenz \u2197</a>` : '<small class="v541-coat-source">Gemeindewappen derzeit nicht verf\xFCgbar</small>'}`;
    }
    crumb.innerHTML = '<button type="button" data-v54-reset>Schweiz</button>' + (canton ? ` <span>\u203A</span> <button type="button" data-v54-canton="${escapeText(canton.code)}">${escapeText(canton.name.split(" / ")[0])}</button>` : "") + (municipality ? ` <span>\u203A</span> <span aria-current="page">${escapeText(getMunicipality(canton, municipality)?.name || "")}</span>` : "");
    back.hidden = !canton;
    search.placeholder = canton ? "Gemeinde suchen \u2026" : "Kanton oder Gemeinde suchen \u2026";
    updateMapCaption();
    renderList();
  }
  function renderList() {
    const needle = searchKey(q);
    if (canton) {
      const matches2 = [...canton.municipalities].sort((a, b) => a.name.localeCompare(b.name, "de-CH")).filter((m) => searchKey(m.name).includes(needle));
      list.innerHTML = `<p class="v54-list-counter">${matches2.length} Gemeinden in ${escapeText(canton.name)}</p>` + matches2.slice(0, 120).map((m) => municipalityRow(canton, m, municipality)).join("") + (matches2.length > 120 ? '<p class="v54-list-counter">Weitere Gemeinden \xFCber die Suche finden.</p>' : "") + (!matches2.length ? "<p>Keine Gemeinde gefunden.</p>" : "");
      return;
    }
    if (!needle) {
      list.innerHTML = `<p class="v54-list-counter">26 Kantone</p>` + sortedCantons.map((c) => cantonRow(c, counts[c.code])).join("");
      return;
    }
    const matches = [];
    for (const c of sortedCantons) {
      if (searchKey(c.name).includes(needle) || searchKey(c.code) === needle) matches.push({ c });
      for (const m of c.municipalities) if (searchKey(m.name).includes(needle)) matches.push({ c, m });
    }
    list.innerHTML = `<p class="v54-list-counter">${matches.length} Treffer</p>` + matches.slice(0, 60).map((x) => x.m ? municipalityRow(x.c, x.m, "") : cantonRow(x.c, counts[x.c.code])).join("") + (matches.length > 60 ? "<p>Suche bitte pr\xE4zisieren.</p>" : "") + (!matches.length ? "<p>Kein Treffer.</p>" : "");
  }
  function reset() {
    request++;
    canton = null;
    municipality = null;
    q = "";
    search.value = "";
    countrySvg();
    legend.hidden = false;
    status.textContent = "Kanton w\xE4hlen, um die Gemeinden zu entdecken.";
    profile();
  }
  function chooseCanton(code) {
    const chosen = byCode.get(String(code || "").toUpperCase());
    if (!chosen) return;
    request++;
    const token = request;
    canton = chosen;
    municipality = null;
    q = "";
    search.value = "";
    cantonSvg(chosen);
    legend.hidden = true;
    profile();
    status.textContent = "Gemeindegrenzen werden geladen \u2026";
    scheduleCoats(chosen);
    void boundaries().then((data) => {
      if (token !== request || !host.isConnected) return;
      const features = cantonFeatures(data, chosen.municipalities);
      if (municipalitySvg(chosen, features)) status.textContent = `Gemeindegrenzen Stand 01.01.2025 (${features.length} Fl\xE4chen). Gemeindeverzeichnis Stand 05.11.2026.`;
      else status.textContent = "Grenzen fehlen. Alle Gemeinden sind \xFCber die Liste ausw\xE4hlbar.";
    }).catch(() => {
      if (token === request && host.isConnected) status.textContent = "Grenzen derzeit nicht erreichbar. Gemeinden \xFCber die Liste ausw\xE4hlen.";
    });
  }
  function chooseMunicipality(id) {
    const mid = String(id || "");
    let found2 = canton;
    if (!getMunicipality(found2, mid)) {
      found2 = cantons2.find((c) => getMunicipality(c, mid));
      if (!found2) return;
      chooseCanton(found2.code);
    }
    municipality = mid;
    highlightMunicipality();
    profile();
    scheduleCoats(found2, mid);
    side.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }
  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-v54-reset]")) {
      reset();
      return;
    }
    if (e.target.closest("[data-v541-label-toggle]")) {
      labelMode = labelMode === "names" ? "arms" : "names";
      renderMunicipalityLabels();
      updateMapCaption();
      return;
    }
    const route = e.target.closest("[data-route]");
    if (route) {
      goRoute(route.dataset.route);
      return;
    }
    if (e.target.closest("[data-v54-back]")) {
      if (municipality) {
        municipality = null;
        highlightMunicipality();
        profile();
      } else reset();
      return;
    }
    const m = e.target.closest("[data-v54-municipality],[data-v54-map-municipality]");
    if (m) {
      chooseMunicipality(m.dataset.v54Municipality || m.dataset.v54MapMunicipality);
      return;
    }
    const c = e.target.closest("[data-v54-canton],[data-code]");
    if (c) chooseCanton(c.dataset.v54Canton || c.dataset.code);
  });
  root.addEventListener("keydown", (e) => {
    if (!["Enter", " "].includes(e.key) || !e.target.matches('svg [role="button"]')) return;
    e.preventDefault();
    e.target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  search.addEventListener("input", () => {
    q = search.value;
    renderList();
  });
  root.addEventListener("error", (e) => {
    if (e.target?.matches?.(".v541-coat-icon img")) {
      const badge = e.target.closest(".v541-coat-icon");
      if (badge) {
        badge.classList.add("v541-coat-missing");
        badge.innerHTML = '<span aria-hidden="true">\u{1F6E1}</span>';
      }
    }
  }, true);
  reset();
}

// app-source-5116.mjs
var v48SearchOrder = "relevance";
var STORAGE_KEY = "quartinaut-app-v4";
var USER_PREFS_PREFIX = "quartinaut-user-prefs-v1:";
var LOCAL_STATE_PREFIX = "quartinaut-local-state-v1:";
var MAX_COLLECTION_RESULTS = 250;
var AUTH_SESSION_KEY = "quartinaut-auth-session-v1";
var AUTH_USERS_KEY = "quartinaut-auth-users-v1";
var LOCATION_DATA_URL = "./assets/data/ch-locations-2026.json";
var PENDING_GOOGLE_REG_KEY = "quartinaut-pending-google-registration-v1";
var VIEWER_GEO_KEY = "quartinaut-viewer-geo-v1";
var ONBOARDING_VERSION = 2;
var ONBOARDING_SEEN_KEY = `quartinaut-onboarding-seen-v${ONBOARDING_VERSION}`;
var NOTIFICATION_BANNER_DISMISSED_KEY = "quartinaut-notification-banner-dismissed-v1";
var THEME_KEY = "quartinaut-theme";
var FIREBASE_VAPID_KEY = window.QUARTINAUT_FIREBASE_VAPID_KEY || "";
var FIREBASE_CONFIG = window.QUARTINAUT_FIREBASE_CONFIG || {};
var FIREBASE_APP_CHECK_SITE_KEY = window.QUARTINAUT_APP_CHECK_SITE_KEY || "";
var FIREBASE_READY = Boolean(FIREBASE_CONFIG.apiKey && !String(FIREBASE_CONFIG.apiKey).includes("ERSETZEN"));
var APP_ICON_192 = "assets/icons/icon-192.png";
var byId = (id) => document.getElementById(id);
var nowIso = () => (/* @__PURE__ */ new Date()).toISOString();
var uid = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
var hoursFromNow = (h) => new Date(Date.now() + h * 36e5).toISOString();
var TTL_HOURS = { "Heute": 24, "Morgen": 48, "Diese Woche": 168, "Nicht dringend": 336 };
function expiryForUrgency(urgency) {
  return hoursFromNow(TTL_HOURS[urgency] || 72);
}
var FALLBACK_LOCATION_DATA = {
  source: "Fallback",
  snapshotDate: "2026-01-01",
  cantons: [
    { id: "1", bfsCode: "1", code: "ZH", name: "Z\xFCrich", municipalities: [{ bfsCode: "261", name: "Z\xFCrich", shortName: "Z\xFCrich" }] },
    { id: "2", bfsCode: "2", code: "BE", name: "Bern / Berne", municipalities: [{ bfsCode: "351", name: "Bern", shortName: "Bern" }] }
  ]
};
var CATEGORIES = [
  "Alltagshilfe",
  "Kinder",
  "Werkzeug",
  "Mobilit\xE4t",
  "Tiere",
  "Information",
  "Notfall",
  "Gesundheit",
  "Seniorenhilfe",
  "Digitalhilfe",
  "Wohnen",
  "Bildung",
  "Nachhaltigkeit",
  "Firmen / Arbeit"
];
var OFFICIAL_NOTICE_CATEGORIES = [
  "Allgemein",
  "Verkehr",
  "Versorgung",
  "Entsorgung",
  "Veranstaltung",
  "Verwaltung",
  "Schule",
  "Sicherheit"
];
var NOTIFICATION_SOURCES = ["alerts", "officialNotices", "requests"];
var MAX_NOTIFICATION_KEYWORD_RULES = 20;
var SWISS_CANTON_CODES = [
  "ZH",
  "BE",
  "LU",
  "UR",
  "SZ",
  "OW",
  "NW",
  "GL",
  "ZG",
  "FR",
  "SO",
  "BS",
  "BL",
  "SH",
  "AR",
  "AI",
  "SG",
  "GR",
  "AG",
  "TG",
  "TI",
  "VD",
  "VS",
  "NE",
  "GE",
  "JU"
];
var DISTANCE_FILTER_VALUES = ["Alle", "2", "5", "10", "20", "50"];
var DEFAULT_REQUEST_RADIUS_KM = 15;
var VERSION = "6.7.2-auth-login-fallback";
var UI_VERSION = "5.11.6";
var CHAT_TRASH_RETENTION_DAYS = 30;
var CHAT_TRASH_RETENTION_MS = CHAT_TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1e3;
var ADMIN_INVITE_CODES = /* @__PURE__ */ new Set();
var DEFAULT_INVITE_CODE = "QRT-2026";
var PRIMARY_ADMIN_EMAILS = /* @__PURE__ */ new Set();
var FIRESTORE_COLLECTIONS = {
  users: "users",
  requests: "requests",
  alerts: "alerts",
  officialNotices: "officialNotices",
  moderation: "moderationCases",
  inviteCodes: "inviteCodes",
  locationChangeRequests: "locationChangeRequests",
  verificationRequests: "verificationRequests",
  changeRequests: "changeRequests",
  deviceTokens: "deviceTokens",
  alertReads: "alertReads",
  areaCategoryPriority: "areaCategoryPriority",
  bulletinFilters: "bulletinFilters",
  notificationPreferences: "notificationPreferences",
  pushDeliveries: "pushDeliveries",
  pushTests: "pushTests",
  publicStats: "publicStats",
  auditLog: "auditLog",
  chats: "chats",
  chatMessages: "chatMessages",
  communityEvents: "communityEvents",
  communityReviews: "communityReviews",
  communityTrust: "communityTrust"
};
var seed = {
  version: VERSION,
  route: "home",
  chatView: "active",
  locale: "",
  filter: { q: "", category: "Alle", type: "Alle", distanceKm: "Alle" },
  dashboard: {
    version: 2,
    order: [],
    hidden: [],
    collapsed: ["kennzahlen", "kantonskarte", "firmen", "erststart", "so-funktionierts"]
  },
  onboarding: {
    version: 0,
    completed: false,
    completedAt: "",
    skipped: false,
    checklist: {}
  },
  adminUsers: {
    view: "active",
    q: "",
    status: "all",
    role: "all",
    accountType: "all",
    verification: "all",
    canton: "all",
    sort: "updatedAt",
    dir: "desc",
    page: 1,
    pageSize: 20
  },
  profile: {
    name: "",
    initials: "",
    area: "",
    location: null,
    role: "resident",
    accountType: "resident",
    accountStatus: "active",
    companyName: "",
    companyPurpose: "",
    companyStatus: "none",
    municipalityName: "",
    municipalityDepartment: "",
    municipalityWebsite: "",
    municipalityStatus: "none",
    adminScopeArea: "",
    verified: false,
    verificationStatus: "none",
    verificationLabel: "",
    titleVisible: true,
    titlePreset: "auto",
    titleGrants: [],
    passkeyReady: false,
    notifications: false,
    geoOptIn: true
  },
  requests: [],
  chats: [],
  chatMessages: [],
  communityEvents: [],
  communityTrust: { count: 0, average: 0 },
  eligibleReviews: [],
  publicTrust: {},
  alerts: [],
  officialNotices: [],
  alertReads: [],
  deviceTokens: [],
  areaCategoryPriority: [],
  bulletinFilters: [],
  notificationPreferences: null,
  pushDeliveries: [],
  registeredUsers: [],
  publicStats: { cantonCounts: {}, totalUsers: 0, updatedAt: "" },
  archive: [],
  inviteCodes: [],
  moderation: [],
  locationChangeRequests: [],
  verificationRequests: [],
  changeRequests: [],
  auditLog: [],
  changelog: []
};
var nativeWeb = null;
var regionalRequests = [];
var privateChatUrls = /* @__PURE__ */ new Map();
function resetPrivateWebMemory() {
  resetCloudDashboardPhoto();
  for (const src of privateChatUrls.values()) URL.revokeObjectURL(src);
  privateChatUrls.clear();
}
var VALID_ROUTES = [...EXTRA_ROUTES, "home", "bulletin", "chats", "alarme", "profile", "events", "inbox", "hub", "search", "map", "swissmap", "saved", "drafts"];
var state = loadState();
try {
  const routeParam = new URLSearchParams(location.search).get("route");
  if (routeParam && VALID_ROUTES.includes(routeParam)) state.route = routeParam;
} catch {
}
var authMode = "login";
var emailAuthNotice = "";
var authState = { ready: false, mode: FIREBASE_READY ? "firebase" : "local", user: null, error: "" };
var firebaseProfileRetryHandler = null;
var firebaseAuthApi = null;
var firebaseStoreApi = null;
var firebaseFunctionsApi = null;
var firebaseAppCheckApi = null;
var firebaseAppInstance = null;
var firebaseMessagingApi = null;
var firebaseStorageApi = null;
var messagingWorkerRegistration = null;
var chatsUnsubscribe = null;
var chatMessagesUnsubscribe = null;
var renderQueued = false;
var activeChatUnsubscribe = null;
var contentUnsubscribe = null;
var activeChatPagination = null;
var dashboardDragId = "";
var dashboardPointerDrag = null;
var readReceiptInFlight = /* @__PURE__ */ new Set();
var currentPushToken = "";
var locationData = FALLBACK_LOCATION_DATA;
var viewerGeo = null;
var viewerGeoPromise = null;
var swissMapSvgTemplate = null;
var swissMapSvgPromise = null;
var swissMapRenderedCacheKey = "";
var swissMapRenderedCache = null;
var swissMapHydrationId = 0;
var onboardingTourScheduled = false;
var deferredInstallPrompt = null;
var chatTrashPruneKey = "";
var saveStateTimer = null;
var saveStateDirty = false;
var activeAccountUid = "";
var accountEpoch = 0;
var v47Sync = null;
var v47SearchGeneration = 0;
var v47SearchState = { rows: [], cursor: null, history: [null], loading: false, error: "", page: 0, next: null };
var v47ActiveDeepLink = "";
var dashboardEditing = false;
var editCards = /* @__PURE__ */ new Set();
var activeModalClosers = /* @__PURE__ */ new Set();
try {
  const storedGeo = JSON.parse(localStorage.getItem(VIEWER_GEO_KEY));
  if (storedGeo && Number.isFinite(Number(storedGeo.lat)) && Number.isFinite(Number(storedGeo.lng))) {
    viewerGeo = storedGeo;
  }
} catch {
  viewerGeo = null;
}
function globalUiSnapshot(candidate = {}) {
  return {
    version: VERSION,
    route: VALID_ROUTES.includes(candidate.route) ? candidate.route : "home",
    locale: typeof candidate.locale === "string" ? candidate.locale.slice(0, 12) : "",
    filter: candidate.filter && typeof candidate.filter === "object" ? { q: String(candidate.filter.q || "").slice(0, 100), category: String(candidate.filter.category || "Alle").slice(0, 80), type: String(candidate.filter.type || "Alle").slice(0, 50), distanceKm: String(candidate.filter.distanceKm || "Alle").slice(0, 10) } : structuredClone(seed.filter)
  };
}
function safeLocalRead(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}
function safeLocalWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn("[Quartinaut] Lokale Einstellungen konnten nicht gespeichert werden.", String(error?.name || error));
    return false;
  }
}
function loadState() {
  const old = safeLocalRead(STORAGE_KEY);
  const neutral = globalUiSnapshot(old || {});
  if (!FIREBASE_READY && old?.version === VERSION) {
    const previousLocalSession = safeLocalRead(AUTH_SESSION_KEY);
    const previousUid = previousLocalSession?.uid;
    if (previousUid && !safeLocalRead(LOCAL_STATE_PREFIX + previousUid)) {
      if (!safeLocalWrite(LOCAL_STATE_PREFIX + previousUid, old)) return mergeDeep(structuredClone(seed), neutral);
    }
  }
  safeLocalWrite(STORAGE_KEY, neutral);
  return mergeDeep(structuredClone(seed), neutral);
}
function loadScopedState(uidValue, mode = "firebase") {
  if (!uidValue) return loadState();
  const base = loadState();
  const saved = safeLocalRead((mode === "local" ? LOCAL_STATE_PREFIX : USER_PREFS_PREFIX) + uidValue);
  if (!saved || saved.version !== VERSION) return base;
  if (mode === "local") return mergeDeep(base, saved);
  return mergeDeep(base, {
    dashboard: saved.dashboard || {},
    onboarding: saved.onboarding || {},
    chatView: saved.chatView === "trash" ? "trash" : "active"
  });
}
function resetAccountSession(nextUid = "", mode = "firebase") {
  if (activeAccountUid === nextUid) return;
  nativeWeb?.reset();
  regionalRequests = [];
  for (const close of [...activeModalClosers]) close();
  accountEpoch++;
  v47SearchGeneration++;
  if (v47Sync) {
    v47Sync.dispose();
    v47Sync = null;
  }
  v47SearchState = { rows: [], cursor: null, history: [null], loading: false, error: "", page: 0, next: null };
  v46SearchUi.q = "";
  v46SearchUi.category = "";
  v46SearchUi.from = "";
  v46SearchUi.to = "";
  if (saveStateTimer) {
    clearTimeout(saveStateTimer);
    saveStateTimer = null;
  }
  saveStateDirty = false;
  stopRealtimeSubscriptions();
  photoUrlCache.clear();
  readReceiptInFlight.clear();
  v44Social.summaries.clear();
  v44Social.attempted.clear();
  hubState.loaded = false;
  hubState.loading = false;
  hubState.items = [];
  hubState.joins = [];
  hubState.threads = [];
  hubState.messages = [];
  hubState.settings = null;
  hubState.stats = null;
  hubState.rsvps = [];
  hubState.eventRows = [];
  hubState.activeThread = "";
  communityBackend.eventsReady = false;
  communityBackend.reviewsReady = false;
  communityBackend.error = "";
  activeAccountUid = nextUid;
  state = nextUid ? loadScopedState(nextUid, mode) : loadState();
}
function currentAccountEpoch(uidValue, epoch) {
  return Boolean(uidValue) && activeAccountUid === uidValue && authState.user?.uid === uidValue && accountEpoch === epoch;
}
function mergeDeep(base, incoming) {
  for (const [key, value] of Object.entries(incoming || {})) {
    if (value && typeof value === "object" && !Array.isArray(value) && base[key] && typeof base[key] === "object" && !Array.isArray(base[key])) {
      base[key] = mergeDeep(base[key], value);
    } else {
      base[key] = value;
    }
  }
  return base;
}
function saveStateNow() {
  if (saveStateTimer) {
    clearTimeout(saveStateTimer);
    saveStateTimer = null;
  }
  saveStateDirty = false;
  safeLocalWrite(STORAGE_KEY, globalUiSnapshot(state));
  const currentUid = authState?.user?.uid;
  if (!currentUid || currentUid !== activeAccountUid) return;
  if (authState.mode === "local") {
    const scoped2 = structuredClone(state);
    if (scoped2.dashboard) delete scoped2.dashboard.editing;
    safeLocalWrite(LOCAL_STATE_PREFIX + currentUid, scoped2);
    return;
  }
  const scoped = {
    version: VERSION,
    dashboard: sanitizeDashboardLayout(state.dashboard || {}),
    onboarding: normalizeOnboardingState(state.onboarding),
    chatView: state.chatView === "trash" ? "trash" : "active"
  };
  safeLocalWrite(USER_PREFS_PREFIX + currentUid, scoped);
}
function saveState() {
  saveStateDirty = true;
  if (saveStateTimer) return;
  saveStateTimer = setTimeout(saveStateNow, 220);
}
window.addEventListener("pagehide", () => {
  if (saveStateDirty) saveStateNow();
});
window.addEventListener("beforeunload", () => {
  if (saveStateDirty) saveStateNow();
});
function pruneExpired() {
  const now = Date.now();
  let changed = false;
  for (const req of state.requests) {
    if (req.status === "offen" && req.expiresAt && new Date(req.expiresAt).getTime() < now) {
      req.status = "abgelaufen";
      state.archive.unshift({ id: req.id, title: req.title, closedAt: nowIso(), closedAtText: "automatisch abgelaufen (TTL)" });
      changed = true;
    }
  }
  const beforeAlerts = state.alerts.length;
  state.alerts = state.alerts.filter((alert) => !alert.validUntil || new Date(alert.validUntil).getTime() > now);
  if (state.alerts.length !== beforeAlerts) changed = true;
  if (changed) {
    state.archive = state.archive.slice(0, 30);
    saveState();
  }
}
async function initLocations() {
  try {
    const response = await fetch(LOCATION_DATA_URL, { cache: "force-cache" });
    if (!response.ok) throw new Error("Standortdaten konnten nicht geladen werden.");
    locationData = await response.json();
  } catch {
    locationData = FALLBACK_LOCATION_DATA;
  }
}
function cantons() {
  return locationData?.cantons || FALLBACK_LOCATION_DATA.cantons;
}
function firstCanton() {
  return cantons()[0];
}
function municipalitiesForCanton(cantonBfsCode) {
  return cantons().find((canton) => String(canton.bfsCode) === String(cantonBfsCode))?.municipalities || [];
}
function findMunicipality(bfsCode) {
  for (const canton of cantons()) {
    const municipality = canton.municipalities.find((item) => String(item.bfsCode) === String(bfsCode));
    if (municipality) return { canton, municipality };
  }
  return null;
}
function buildLocation(cantonBfsCode, municipalityBfsCode) {
  const selected = findMunicipality(municipalityBfsCode);
  if (selected && String(selected.canton.bfsCode) === String(cantonBfsCode)) {
    return {
      cantonCode: selected.canton.code,
      cantonName: selected.canton.name,
      cantonBfsCode: selected.canton.bfsCode,
      municipalityBfsCode: selected.municipality.bfsCode,
      municipalityName: selected.municipality.name
    };
  }
  const canton = cantons().find((item) => String(item.bfsCode) === String(cantonBfsCode)) || firstCanton();
  const municipality = canton?.municipalities?.[0];
  if (!canton || !municipality) return null;
  return {
    cantonCode: canton.code,
    cantonName: canton.name,
    cantonBfsCode: canton.bfsCode,
    municipalityBfsCode: municipality.bfsCode,
    municipalityName: municipality.name
  };
}
function locationLabel(location2 = state.profile.location) {
  if (!location2) return state.profile.area || "Kein Standort gesetzt";
  return `${location2.municipalityName} (${location2.cantonCode})`;
}
function parseDistanceFilterKm(value = state.filter.distanceKm) {
  if (!value || value === "Alle") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
function normalizeGeoCoordinates(geoLike) {
  if (!geoLike) return null;
  const lat = Number(geoLike.lat);
  const lng = Number(geoLike.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const accuracyM = Number(geoLike.accuracyM || 0);
  return {
    lat: Number(lat.toFixed(5)),
    lng: Number(lng.toFixed(5)),
    accuracyM: Number.isFinite(accuracyM) ? Math.max(0, Math.round(accuracyM)) : 0,
    capturedAt: normalizeStoredDate(geoLike.capturedAt) || nowIso()
  };
}
function storeViewerGeo(geo) {
  const normalized = normalizeGeoCoordinates(geo);
  if (!normalized) return null;
  viewerGeo = normalized;
  localStorage.setItem(VIEWER_GEO_KEY, JSON.stringify(normalized));
  return normalized;
}
function viewerGeoIsFresh(geo = viewerGeo) {
  if (!geo?.capturedAt) return false;
  const ageMs = Date.now() - new Date(geo.capturedAt).getTime();
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs < 45 * 60 * 1e3;
}
async function ensureViewerGeo({ force = false, silent = false } = {}) {
  if (!force && viewerGeoIsFresh()) return viewerGeo;
  if (viewerGeoPromise) return viewerGeoPromise;
  if (!navigator.geolocation) {
    if (!silent) toast("Distanzfilter ben\xF6tigt Standortfreigabe im Browser.");
    return null;
  }
  viewerGeoPromise = new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const normalized = normalizeGeoCoordinates({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: position.coords.accuracy,
          capturedAt: nowIso()
        });
        resolve(storeViewerGeo(normalized));
      },
      () => {
        if (!silent) toast("Standortzugriff abgelehnt. Distanzfilter bleibt aus.");
        resolve(null);
      },
      {
        enableHighAccuracy: false,
        timeout: 7e3,
        maximumAge: 3e5
      }
    );
  }).finally(() => {
    viewerGeoPromise = null;
  });
  return viewerGeoPromise;
}
function distanceBetweenKm(origin, target) {
  const originGeo = normalizeGeoCoordinates(origin);
  const targetGeo = normalizeGeoCoordinates(target);
  if (!originGeo || !targetGeo) return null;
  const toRad = (deg) => deg * Math.PI / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(targetGeo.lat - originGeo.lat);
  const dLng = toRad(targetGeo.lng - originGeo.lng);
  const lat1 = toRad(originGeo.lat);
  const lat2 = toRad(targetGeo.lat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((earthRadiusKm * c).toFixed(1));
}
function requestDistanceKm(req) {
  if (!req?.geo || !viewerGeo) return null;
  return distanceBetweenKm(viewerGeo, req.geo);
}
function requestRadiusKm(req) {
  const value = Number(req?.radiusKm);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(1, Math.round(value));
}
function requestIsReachable(req, selectedDistanceKm = parseDistanceFilterKm()) {
  if (String(req.id || "").startsWith("arq_")) return regionalRequests.some((x) => x.id === req.id);
  const distance = requestDistanceKm(req);
  const requestRadius = requestRadiusKm(req);
  if (requestRadius > 0 && distance !== null && distance > requestRadius) return false;
  if (!selectedDistanceKm) return true;
  if (distance === null) return false;
  return distance <= selectedDistanceKm;
}
function locationOptions(location2 = null) {
  const selectedCanton = location2?.cantonBfsCode || firstCanton()?.bfsCode || "";
  const selectedMunicipality = location2?.municipalityBfsCode || municipalitiesForCanton(selectedCanton)[0]?.bfsCode || "";
  return {
    cantonSelect: `<select name="cantonBfsCode" id="locationCanton" required>${cantons().map((canton) => `<option value="${escapeHtml(canton.bfsCode)}" ${String(canton.bfsCode) === String(selectedCanton) ? "selected" : ""}>${escapeHtml(canton.name)} (${escapeHtml(canton.code)})</option>`).join("")}</select>`,
    municipalitySelect: `<select name="municipalityBfsCode" id="locationMunicipality" required>${municipalitiesForCanton(selectedCanton).map((municipality) => `<option value="${escapeHtml(municipality.bfsCode)}" ${String(municipality.bfsCode) === String(selectedMunicipality) ? "selected" : ""}>${escapeHtml(municipality.name)}</option>`).join("")}</select>`
  };
}
function bindLocationPicker(root = document) {
  const cantonSelect = root.querySelector("#locationCanton");
  const municipalitySelect = root.querySelector("#locationMunicipality");
  if (!cantonSelect || !municipalitySelect) return;
  cantonSelect.addEventListener("change", () => {
    municipalitySelect.innerHTML = municipalitiesForCanton(cantonSelect.value).map((municipality) => `<option value="${escapeHtml(municipality.bfsCode)}">${escapeHtml(municipality.name)}</option>`).join("");
  });
}
function profileName(user = authState.user) {
  return user?.displayName || state.profile.name || "Quartinaut-Nutzer/in";
}
function verifiedMark(verified = state.profile.verified) {
  return verified ? '<span class="verified-mark" title="Verifiziert" aria-label="Verifiziert">\u2713</span>' : "";
}
function syncCurrentUser(updates) {
  if (!authState.user) return;
  authState.user = { ...authState.user, ...updates };
  if (authState.mode === "local") {
    saveLocalSession(authState.user);
    const users = loadLocalUsers();
    if (authState.user.email && users[authState.user.email]) {
      users[authState.user.email] = { ...users[authState.user.email], ...updates };
      saveLocalUsers(users);
    }
  }
}
function loadLocalSession() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY));
  } catch {
    return null;
  }
}
function saveLocalSession(user) {
  if (!user) {
    localStorage.removeItem(AUTH_SESSION_KEY);
    return;
  }
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user));
}
function loadLocalUsers() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_USERS_KEY)) || {};
  } catch {
    return {};
  }
}
function saveLocalUsers(users) {
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
}
async function sha256(value) {
  const input = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", input);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function initialsFromName(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return initials || "ICH";
}
function normalizeEmail(email = "") {
  return String(email).trim().toLowerCase();
}
function inviteRole(inviteCode = "") {
  return "resident";
}
function isPrimaryAdminEmail(email = "") {
  return PRIMARY_ADMIN_EMAILS.has(normalizeEmail(email));
}
function roleFromAuthClaims(claims = {}) {
  if (claims.admin === true || claims.role === "admin") return "admin";
  if (claims.role === "area_admin") return "area_admin";
  return "";
}
function roleLabel(role = state.profile.role) {
  if (role === "admin") return "Admin";
  if (role === "area_admin") return "Gemeindeadmin";
  return "Bewohner/in";
}
function normalizeAccountType(type = "resident") {
  return ["resident", "company", "municipality"].includes(type) ? type : "resident";
}
function accountTypeLabel(type = state.profile.accountType) {
  if (type === "company") return "Firma";
  if (type === "municipality") return "Gemeinde";
  return "Privatperson";
}
function accountStatusLabel(status = state.profile.accountStatus) {
  if (status === "deleted") return "Gel\xF6scht";
  if (status === "disabled") return "Deaktiviert";
  if (status === "limited") return "Eingeschr\xE4nkt";
  if (status === "pending_verification") return "Wartet auf Freigabe";
  if (status === "pending_email") return "E-Mail-Best\xE4tigung ausstehend";
  return "Aktiv";
}
function accountStatusBadge(status = "active") {
  const cls = status === "deleted" ? "danger" : status === "disabled" || status === "pending_verification" || status === "pending_email" ? "warn" : status === "limited" ? "info" : "done";
  return `<span class="badge ${cls}">${escapeHtml(accountStatusLabel(status))}</span>`;
}
function isAccountDisabled(user = authState.user) {
  return (user?.accountStatus || state.profile.accountStatus || "active") === "disabled";
}
function isAccountPendingApproval(user = authState.user) {
  return (user?.accountStatus || state.profile.accountStatus || "active") === "pending_verification";
}
function isArchivedUser(user = {}) {
  return (user.accountStatus || "active") === "disabled" || (user.accountStatus || "") === "deleted" || (user.verificationStatus || "") === "deleted" || Boolean(user.deletedAt);
}
var TITLE_PRESET_LABELS = {
  auto: "Automatisch",
  admin: "Admin",
  resident: "Bewohner/in",
  verified: "Verifiziert",
  registry: "Gemeinderegister",
  district: "Quartierverein",
  municipality: "Gemeinde",
  none: "Kein Titel"
};
function normalizeTitleGrants(value) {
  return Array.isArray(value) ? value.filter((item) => ["verified", "registry", "district"].includes(item)) : [];
}
function titlePresetLabel(preset = "auto") {
  return TITLE_PRESET_LABELS[preset] || TITLE_PRESET_LABELS.auto;
}
function allowedTitlePresets(profile = state.profile) {
  const allowed = /* @__PURE__ */ new Set(["auto", "resident", "none"]);
  if (["admin", "area_admin"].includes(profile.role)) allowed.add("admin");
  if (profile.accountType === "municipality" && profile.verified) allowed.add("municipality");
  if (profile.verified) allowed.add("verified");
  normalizeTitleGrants(profile.titleGrants).forEach((grant) => allowed.add(grant));
  return [...allowed];
}
function normalizeTitlePresetForProfile(preset = "auto", profile = state.profile) {
  return allowedTitlePresets(profile).includes(preset) ? preset : "auto";
}
function titlePresetOptions(profile = state.profile) {
  const selected = normalizeTitlePresetForProfile(profile.titlePreset || "auto", profile);
  return allowedTitlePresets(profile).map((value) => `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(titlePresetLabel(value))}</option>`).join("");
}
function verificationTitleOptions(selected = "verified") {
  return ["verified", "resident", "registry", "district"].map((value) => `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(titlePresetLabel(value))}</option>`).join("");
}
function profileTitle(profile = state.profile) {
  if (profile.titleVisible === false) return "";
  const preset = normalizeTitlePresetForProfile(profile.titlePreset || "auto", profile);
  if (preset === "none") return "";
  if (preset === "admin") return "Admin";
  if (preset === "resident") return "Bewohner/in";
  if (preset === "registry") return "Gemeinderegister";
  if (preset === "district") return "Quartierverein";
  if (preset === "municipality") return "Gemeinde";
  if (preset === "verified") return profile.verificationLabel || "Verifiziert";
  if (profile.role === "admin") return "Admin";
  if (profile.role === "area_admin") return "Gemeindeadmin";
  if (profile.verified) return profile.verificationLabel || "Verifiziert";
  return "Bewohner/in";
}
function trustLevelMeta(profile = state.profile) {
  const role = profile.role || "resident";
  if (role === "admin") return { key: "admin", label: "Admin", detail: "Plattform-Administration", cls: "official" };
  if (role === "area_admin") return { key: "area_admin", label: "Gemeindeadmin", detail: profile.adminScopeArea || "Gebietsverwaltung", cls: "official" };
  if (profile.accountType === "municipality") {
    if (profile.municipalityStatus === "verified") return { key: "municipality_verified", label: "Gemeinde gepr\xFCft", detail: profile.municipalityName || profile.area || "best\xE4tigte Gemeinde", cls: "official" };
    if (profile.municipalityStatus === "rejected") return { key: "municipality_rejected", label: "Gemeinde abgelehnt", detail: "Freigabe wurde abgelehnt", cls: "warn" };
    return { key: "municipality_pending", label: "Gemeinde in Pr\xFCfung", detail: "Freigabe durch Plattform-Admin ausstehend", cls: "info" };
  }
  if (profile.accountType === "company") {
    if (profile.companyStatus === "verified") return { key: "company_verified", label: "Firma gepr\xFCft", detail: profile.companyName || "best\xE4tigte Firma", cls: "official" };
    if (profile.companyStatus === "rejected") return { key: "company_rejected", label: "Firma abgelehnt", detail: profile.companyName || "nicht freigegeben", cls: "warn" };
    return { key: "company_pending", label: "Firma ungepr\xFCft", detail: profile.companyName || "Pr\xFCfung offen", cls: "info" };
  }
  if (profile.verified) return { key: "verified", label: profile.verificationLabel || "Verifiziert", detail: "Identit\xE4t best\xE4tigt", cls: "official" };
  if (profile.verificationStatus === "pending") return { key: "pending", label: "Verifizierung offen", detail: "Antrag eingereicht", cls: "info" };
  return { key: "unverified", label: "Unverifiziert", detail: "Nur registriert", cls: "" };
}
function trustBadge(profile = state.profile, options = {}) {
  const meta = trustLevelMeta(profile);
  const detail = options.detail && meta.detail ? ` title="${escapeHtml(meta.detail)}"` : "";
  return `<span class="badge ${meta.cls}"${detail}>${escapeHtml(meta.label)}</span>`;
}
function profileFromRequest(req = {}) {
  const user = state.registeredUsers.find((item) => item.uid === (req.uid || req.authorId));
  if (user) return user;
  return {
    role: req.authorRole || "resident",
    verified: Boolean(req.authorVerified),
    verificationStatus: req.authorVerificationStatus || "",
    verificationLabel: req.authorVerificationLabel || "",
    accountType: req.authorAccountType || "resident",
    companyName: req.companyName || "",
    companyStatus: req.companyStatus || "none",
    municipalityStatus: req.municipalityStatus || "none",
    municipalityName: req.municipalityName || ""
  };
}
function companyNameForProfile(profile = state.profile) {
  return String(profile.companyName || "").trim();
}
function applyAuthenticatedUser(user) {
  if (!user) return;
  const location2 = user.location || null;
  const role = user.role || "resident";
  const verified = Boolean(user.verified);
  const verificationLabel = user.verificationLabel || (verified ? "Verifiziert" : "");
  const titlePreset = user.titlePreset || "auto";
  state.profile = {
    ...structuredClone(seed.profile),
    name: user.displayName || "",
    initials: user.initials || initialsFromName(user.displayName || user.email),
    area: location2 ? locationLabel(location2) : user.area || "",
    location: location2,
    role,
    accountType: normalizeAccountType(user.accountType || "resident"),
    accountStatus: user.accountStatus || "active",
    companyName: user.companyName || "",
    companyPurpose: user.companyPurpose || "",
    companyStatus: user.companyStatus || "none",
    municipalityName: user.municipalityName || "",
    municipalityDepartment: user.municipalityDepartment || "",
    municipalityWebsite: user.municipalityWebsite || "",
    municipalityStatus: user.municipalityStatus || "none",
    adminScopeArea: user.adminScopeArea || "",
    verified,
    verificationStatus: user.verificationStatus || "none",
    verificationLabel,
    titleVisible: user.titleVisible ?? true,
    titlePreset: normalizeTitlePresetForProfile(titlePreset, { ...user, verified, role, titleGrants: user.titleGrants }),
    titleGrants: normalizeTitleGrants(user.titleGrants),
    notifications: Boolean(user.notifications),
    passkeyReady: Boolean(user.passkeyReady)
  };
  if (user.dashboard) {
    state.dashboard = { ...state.dashboard, ...sanitizeDashboardLayout(user.dashboard) };
    delete state.dashboard.editing;
  }
  state.onboarding = normalizeOnboardingState(user.onboarding || state.onboarding);
  if (user.locale) setLocale(user.locale);
  saveState();
}
function isFirebaseMode() {
  return authState.mode === "firebase" && Boolean(firebaseAuthApi && firebaseStoreApi && firebaseAppInstance);
}
async function authClaims(firebaseUser, forceRefresh = false) {
  if (!firebaseUser?.getIdTokenResult) return {};
  try {
    const token = await firebaseUser.getIdTokenResult(forceRefresh);
    return token?.claims || {};
  } catch {
    return {};
  }
}
async function ensureServerAdminClaim(firebaseUser, profileDoc = {}, claims = {}) {
  return claims;
}
function parseJsonStorage(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function savePendingGoogleRegistration(data) {
  localStorage.setItem(PENDING_GOOGLE_REG_KEY, JSON.stringify({ ...data, createdAt: nowIso() }));
}
function loadPendingGoogleRegistration() {
  const payload = parseJsonStorage(PENDING_GOOGLE_REG_KEY, null);
  if (!payload?.createdAt) return null;
  const ageMs = Date.now() - new Date(payload.createdAt).getTime();
  if (ageMs > 12 * 36e5) {
    localStorage.removeItem(PENDING_GOOGLE_REG_KEY);
    return null;
  }
  return payload;
}
function clearPendingGoogleRegistration() {
  localStorage.removeItem(PENDING_GOOGLE_REG_KEY);
}
function validateInviteCode(inputCode = "") {
  const code = String(inputCode || "").trim().toUpperCase();
  if (!code) return "";
  if (code !== DEFAULT_INVITE_CODE && !ADMIN_INVITE_CODES.has(code)) {
    throw new Error("Ung\xFCltiger Einladungscode. Bitte die Quartinaut-Verwaltung kontaktieren.");
  }
  return code;
}
function normalizeStoredDate(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  return String(value);
}
function sanitizeLocation(locationLike) {
  if (!locationLike) return null;
  if (locationLike.municipalityBfsCode && locationLike.cantonBfsCode) {
    return buildLocation(locationLike.cantonBfsCode, locationLike.municipalityBfsCode);
  }
  return null;
}
function makeAuthUser(firebaseUser, profileDoc = {}, claims = {}) {
  const location2 = sanitizeLocation(profileDoc.location) || null;
  const displayName = profileDoc.displayName || firebaseUser.displayName || firebaseUser.email || "Quartinaut-Nutzer/in";
  const verified = Boolean(profileDoc.verified);
  const claimRole = roleFromAuthClaims(claims);
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName,
    initials: profileDoc.initials || initialsFromName(displayName),
    area: location2 ? locationLabel(location2) : profileDoc.area || "",
    location: location2,
    role: claimRole || "resident",
    accountType: normalizeAccountType(profileDoc.accountType || "resident"),
    accountStatus: profileDoc.accountStatus || "active",
    companyName: profileDoc.companyName || "",
    companyPurpose: profileDoc.companyPurpose || "",
    companyStatus: profileDoc.companyStatus || "none",
    municipalityName: profileDoc.municipalityName || "",
    municipalityDepartment: profileDoc.municipalityDepartment || "",
    municipalityWebsite: profileDoc.municipalityWebsite || "",
    municipalityStatus: profileDoc.municipalityStatus || "none",
    adminScopeArea: claims.adminScopeArea || profileDoc.adminScopeArea || "",
    verified,
    verificationStatus: profileDoc.verificationStatus || "none",
    verificationLabel: profileDoc.verificationLabel || (verified ? "Verifiziert" : ""),
    titleVisible: profileDoc.titleVisible ?? true,
    titlePreset: profileDoc.titlePreset || "auto",
    titleGrants: normalizeTitleGrants(profileDoc.titleGrants),
    dashboard: sanitizeDashboardLayout(profileDoc.dashboard || {}),
    onboarding: normalizeOnboardingState(profileDoc.onboarding),
    locale: profileDoc.locale || currentLocale(),
    notifications: Boolean(profileDoc.notifications),
    passkeyReady: Boolean(profileDoc.passkeyReady)
  };
}
async function upsertFirebaseUserDoc(firebaseUser) {
  const { db, doc, getDoc, setDoc } = firebaseStoreApi;
  const userRef = doc(db, FIRESTORE_COLLECTIONS.users, firebaseUser.uid);
  const snapshot = await getDoc(userRef);
  const existing = snapshot.exists() ? snapshot.data() : null;
  const pendingRaw = loadPendingGoogleRegistration();
  const passwordOnly = firebaseUser.providerData?.some((item) => item.providerId === "password") && !firebaseUser.providerData?.some((item) => item.providerId === "google.com");
  const pending = passwordOnly ? pendingRaw?.provider === "password" && normalizeEmail(pendingRaw.email) === normalizeEmail(firebaseUser.email) ? pendingRaw : null : pendingRaw?.provider === "password" ? null : pendingRaw;
  if (!existing) {
    const registration = pending?.location && pending?.displayName ? {
      displayName: pending.displayName,
      inviteCode: pending.inviteCode,
      location: sanitizeLocation(pending.location),
      accountType: normalizeAccountType(pending.accountType),
      companyName: String(pending.companyName || "").trim(),
      companyPurpose: String(pending.companyPurpose || "").trim(),
      municipalityDepartment: String(pending.municipalityDepartment || "").trim(),
      municipalityWebsite: String(pending.municipalityWebsite || "").trim()
    } : null;
    if (!registration?.location || !registration?.displayName) {
      clearPendingGoogleRegistration();
      throw new Error(passwordOnly ? "Dieses E-Mail-Konto ist noch nicht registriert. Bitte erst dein Profil vervollst\xE4ndigen." : 'Dieses Google-Konto ist noch nicht registriert. Bitte zuerst "Konto erstellen" nutzen.');
    }
    const inviteCode = validateInviteCode(registration.inviteCode);
    const location2 = sanitizeLocation(registration.location);
    if (!location2) throw new Error("Registrierung ben\xF6tigt eine g\xFCltige Standortauswahl.");
    const area2 = locationLabel(location2);
    const accountType = normalizeAccountType(registration.accountType);
    const isMunicipality = accountType === "municipality";
    const profileDoc2 = {
      uid: firebaseUser.uid,
      email: normalizeEmail(firebaseUser.email || ""),
      displayName: registration.displayName,
      initials: initialsFromName(registration.displayName),
      area: area2,
      areaKey: normalizeAreaKey(area2),
      cantonCode: cantonCodeForLocation(location2),
      location: location2,
      role: isMunicipality ? "resident" : inviteRole(inviteCode),
      accountType,
      accountStatus: isMunicipality ? "pending_verification" : "active",
      companyName: accountType === "company" ? registration.companyName : "",
      companyPurpose: accountType === "company" ? registration.companyPurpose : "",
      companyStatus: accountType === "company" ? "pending" : "none",
      municipalityName: isMunicipality ? location2.municipalityName : "",
      municipalityDepartment: isMunicipality ? registration.municipalityDepartment : "",
      municipalityWebsite: isMunicipality ? registration.municipalityWebsite : "",
      municipalityStatus: isMunicipality ? "pending" : "none",
      adminScopeArea: "",
      verified: false,
      verificationStatus: isMunicipality ? "pending" : "none",
      verificationLabel: "",
      titleVisible: true,
      titlePreset: "auto",
      titleGrants: [],
      dashboard: dashboardLayoutPayload(),
      onboarding: normalizeOnboardingState(),
      locale: currentLocale(),
      notifications: false,
      passkeyReady: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      lastLoginAt: nowIso()
    };
    await setDoc(userRef, profileDoc2, { merge: false });
    if (!isMunicipality) {
      await setDoc(doc(db, FIRESTORE_COLLECTIONS.notificationPreferences, firebaseUser.uid), {
        uid: firebaseUser.uid,
        tenantId: "quartinaut",
        enabled: false,
        area: area2,
        areaKey: normalizeAreaKey(area2),
        cantonCode: cantonCodeForLocation(location2),
        criticalAlerts: true,
        alerts: { enabled: true, severities: ["warn", "info"] },
        officialNotices: { enabled: true, priorities: ["wichtig"], categories: [] },
        bulletin: { enabled: false, types: [], categories: [] },
        chats: { enabled: true },
        keywordRules: [],
        quietHours: { enabled: false, start: "22:00", end: "07:00", timezone: "Europe/Zurich" },
        createdAt: nowIso(),
        updatedAt: nowIso()
      }, { merge: false });
    }
    if (firebaseUser.displayName !== registration.displayName) {
      await firebaseAuthApi.updateProfile(firebaseUser, { displayName: registration.displayName });
    }
    clearPendingGoogleRegistration();
    return profileDoc2;
  }
  const mergedLocation = sanitizeLocation(existing.location) || sanitizeLocation(pending?.location) || fallbackLocation || null;
  const displayName = existing.displayName || firebaseUser.displayName || pending?.displayName || state.profile.name || "Quartinaut-Nutzer/in";
  const verified = Boolean(existing.verified);
  const area = mergedLocation ? locationLabel(mergedLocation) : existing.area || "";
  const profileDoc = {
    ...existing,
    uid: firebaseUser.uid,
    email: normalizeEmail(firebaseUser.email || existing.email || ""),
    displayName,
    initials: existing.initials || initialsFromName(displayName),
    area,
    areaKey: normalizeAreaKey(area),
    cantonCode: cantonCodeForLocation(mergedLocation || existing),
    location: mergedLocation,
    role: existing.role || inviteRole(pending?.inviteCode || ""),
    accountType: normalizeAccountType(existing.accountType || "resident"),
    accountStatus: existing.accountStatus || "active",
    companyName: existing.companyName || "",
    companyPurpose: existing.companyPurpose || "",
    companyStatus: existing.companyStatus || (existing.accountType === "company" ? "pending" : "none"),
    municipalityName: existing.municipalityName || (existing.accountType === "municipality" ? mergedLocation?.municipalityName || "" : ""),
    municipalityDepartment: existing.municipalityDepartment || "",
    municipalityWebsite: existing.municipalityWebsite || "",
    municipalityStatus: existing.municipalityStatus || (existing.accountType === "municipality" ? "pending" : "none"),
    adminScopeArea: existing.adminScopeArea || "",
    verified,
    verificationStatus: existing.verificationStatus || "none",
    verificationLabel: existing.verificationLabel || (verified ? "Verifiziert" : ""),
    titleVisible: existing.titleVisible ?? true,
    titlePreset: existing.titlePreset || "auto",
    titleGrants: normalizeTitleGrants(existing.titleGrants),
    dashboard: sanitizeDashboardLayout(existing.dashboard || {}),
    onboarding: normalizeOnboardingState(existing.onboarding),
    locale: existing.locale || currentLocale(),
    notifications: Boolean(existing.notifications),
    passkeyReady: Boolean(existing.passkeyReady),
    createdAt: normalizeStoredDate(existing.createdAt) || nowIso(),
    updatedAt: nowIso(),
    lastLoginAt: nowIso()
  };
  void setDoc(userRef, { lastLoginAt: nowIso() }, { merge: true }).catch(
    (error) => reportBackgroundError("Bestehendes Profil aktualisieren", error, { notify: false, collection: FIRESTORE_COLLECTIONS.users })
  );
  if (pending?.displayName && firebaseUser.displayName !== pending.displayName) {
    await firebaseAuthApi.updateProfile(firebaseUser, { displayName: pending.displayName }).catch((error) => reportBackgroundError("Google-Profilnamen synchronisieren", error));
  }
  clearPendingGoogleRegistration();
  return profileDoc;
}
function mapFirestoreDocs(snapshot) {
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
}
function mergeById(items = []) {
  return [...items.reduce((map, item) => {
    if (item?.id) map.set(item.id, { ...map.get(item.id) || {}, ...item });
    return map;
  }, /* @__PURE__ */ new Map()).values()];
}
function sortByCreatedDesc(items) {
  return items.slice().sort((a, b) => new Date(normalizeStoredDate(b.createdAt) || 0) - new Date(normalizeStoredDate(a.createdAt) || 0));
}
function isAdminRole() {
  return ["admin", "area_admin"].includes(authState.user?.role || "");
}
function isPlatformAdminRole() {
  return authState.user?.role === "admin";
}
function isAreaAdminRole() {
  return authState.user?.role === "area_admin";
}
function currentAreaKey() {
  return normalizeAreaKey(state.profile.area || authState.user?.area || "");
}
function currentCantonCode() {
  return cantonCodeForLocation(state.profile.location || authState.user?.location || { area: state.profile.area || authState.user?.area || "" });
}
async function readCollection(collectionName, options = {}) {
  if (collectionName === "chats") {
    return (await callQuartinaut("quartinautPrivateChats", { action: "list" })).chats || [];
  }
  const { db, collection, getDocs, query, orderBy, where, limit } = firebaseStoreApi;
  const { ownUid = "", participantUid = "", ownerUid = "", area = "", areaKey = "", cantonCode = "", status = "", orderField = "createdAt" } = options;
  const maxResults = Math.min(350, Math.max(1, Number(options.maxResults) || MAX_COLLECTION_RESULTS));
  const col = collection(db, collectionName);
  const constraints = [];
  if (ownUid) constraints.push(where("uid", "==", ownUid));
  if (participantUid) constraints.push(where("participants", "array-contains", participantUid));
  if (ownerUid) constraints.push(where("requestOwnerUid", "==", ownerUid));
  if (status) constraints.push(where("status", "==", status));
  if (area) constraints.push(where("area", "==", area));
  if (cantonCode) constraints.push(where("cantonCode", "==", cantonCode));
  else if (areaKey) constraints.push(where("areaKey", "==", areaKey));
  try {
    return mapFirestoreDocs(await getDocs(query(col, ...constraints, orderBy(orderField, "desc"), limit(maxResults))));
  } catch (error) {
    const code = String(error?.code || "");
    if (code.includes("permission-denied")) {
      console.warn("[Quartinaut] Firestore-Zugriff verweigert:", collectionName);
      return [];
    }
    if (!code.includes("failed-precondition") || !constraints.length) throw error;
    console.warn("[Quartinaut] Sortierindex fehlt; eng begrenzter Fallback:", collectionName);
    return sortByCreatedDesc(mapFirestoreDocs(await getDocs(query(col, ...constraints, limit(maxResults)))));
  }
}
async function readFirebaseDoc(collectionName, id) {
  if (!isFirebaseMode() || !id) return null;
  const { db, doc, getDoc } = firebaseStoreApi;
  const snapshot = await getDoc(doc(db, collectionName, id));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}
function normalizeRequestDoc(req) {
  return {
    ...req,
    createdAt: normalizeStoredDate(req.createdAt) || nowIso(),
    submittedAt: normalizeStoredDate(req.submittedAt) || "",
    approvedAt: normalizeStoredDate(req.approvedAt) || "",
    rejectedAt: normalizeStoredDate(req.rejectedAt) || "",
    resubmittedAt: normalizeStoredDate(req.resubmittedAt) || "",
    expiresAt: normalizeStoredDate(req.expiresAt) || "",
    replies: Array.isArray(req.replies) ? req.replies.map((reply) => ({ ...reply, at: normalizeStoredDate(reply.at) || nowIso() })) : [],
    reports: Number(req.reports || 0),
    status: req.status || "offen",
    rejectionReason: req.rejectionReason || "",
    escalationLevel: req.escalationLevel || "keine",
    recurringMode: req.recurringMode || "einmalig",
    recurringParentId: req.recurringParentId || "",
    anonymousOffer: Boolean(req.anonymousOffer),
    radiusKm: requestRadiusKm(req) || DEFAULT_REQUEST_RADIUS_KM,
    geo: normalizeGeoCoordinates(req.geo)
  };
}
function normalizeSimpleCreated(item) {
  return { ...item, createdAt: normalizeStoredDate(item.createdAt) || nowIso() };
}
function normalizeAlertDoc(item) {
  const normalized = normalizeSimpleCreated(item);
  return {
    ...normalized,
    areaKey: normalized.areaKey || normalizeAreaKey(normalized.area || ""),
    cantonCode: normalized.cantonCode || cantonCodeForLocation({ area: normalized.area || "" }),
    scopeLevel: normalized.scopeLevel === "canton" ? "canton" : "municipality",
    validUntil: normalizeStoredDate(normalized.validUntil) || ""
  };
}
function normalizeOfficialNoticeDoc(item) {
  const normalized = normalizeSimpleCreated(item);
  return {
    ...normalized,
    title: String(normalized.title || ""),
    text: String(normalized.text || ""),
    category: String(normalized.category || "Allgemein"),
    priority: ["info", "wichtig"].includes(normalized.priority) ? normalized.priority : "info",
    status: ["entwurf", "online", "archiviert"].includes(normalized.status) ? normalized.status : "online",
    areaKey: normalized.areaKey || normalizeAreaKey(normalized.area || ""),
    cantonCode: normalized.cantonCode || cantonCodeForLocation({ area: normalized.area || "" }),
    scopeLevel: normalized.scopeLevel === "canton" ? "canton" : "municipality",
    validFrom: normalizeStoredDate(normalized.validFrom) || "",
    validUntil: normalizeStoredDate(normalized.validUntil) || ""
  };
}
function normalizeChatDoc(chat) {
  return {
    ...chat,
    participants: Array.isArray(chat.participants) ? chat.participants : [],
    participantLabels: chat.participantLabels || {},
    mutedBy: Array.isArray(chat.mutedBy) ? chat.mutedBy : [],
    readBy: chat.readBy && typeof chat.readBy === "object" ? chat.readBy : {},
    trashedBy: chat.trashedBy && typeof chat.trashedBy === "object" ? chat.trashedBy : {},
    purgedBy: chat.purgedBy && typeof chat.purgedBy === "object" ? chat.purgedBy : {},
    createdAt: normalizeStoredDate(chat.createdAt) || nowIso(),
    lastMessageAt: normalizeStoredDate(chat.lastMessageAt) || normalizeStoredDate(chat.createdAt) || nowIso()
  };
}
function normalizeChatMessage(msg) {
  return {
    ...msg,
    participants: Array.isArray(msg.participants) ? msg.participants : [],
    participantLabels: msg.participantLabels || {},
    createdAt: normalizeStoredDate(msg.createdAt) || nowIso(),
    readAt: normalizeStoredDate(msg.readAt) || "",
    deliveryStatus: ["pending", "sent", "failed"].includes(msg.deliveryStatus) ? msg.deliveryStatus : "sent"
  };
}
async function syncStateFromFirestore() {
  if (!isFirebaseMode() || !authState.user) return;
  if (isAccountPendingApproval()) return;
  const expectedUid = authState.user.uid;
  const expectedEpoch = accountEpoch;
  const admin = isAdminRole();
  const platformAdmin = isPlatformAdminRole();
  const localAdmin = isAreaAdminRole();
  const scope = platformAdmin ? {} : localAdmin ? { area: state.profile.area } : { cantonCode: currentCantonCode(), areaKey: currentAreaKey() };
  const hasContentScope = platformAdmin || Boolean(scope.area || scope.cantonCode || scope.areaKey);
  const [
    requests,
    ownRequests2,
    alerts,
    officialNotices,
    moderation,
    inviteCodes,
    locationChangeRequests,
    verificationRequests,
    changeRequests,
    alertReads,
    deviceTokens,
    areaCategoryPriority,
    bulletinFilters,
    notificationPreferences,
    pushDeliveries,
    registeredUsers,
    publicStatsDoc,
    auditLog,
    chats
  ] = await Promise.all([
    hasContentScope ? readCollection(FIRESTORE_COLLECTIONS.requests, admin ? scope : { ...scope, status: "offen" }) : Promise.resolve([]),
    admin ? Promise.resolve([]) : readCollection(FIRESTORE_COLLECTIONS.requests, { ownUid: expectedUid }),
    readCollection(FIRESTORE_COLLECTIONS.alerts),
    hasContentScope ? readCollection(FIRESTORE_COLLECTIONS.officialNotices, admin ? {} : { ...scope, status: "online" }) : Promise.resolve([]),
    platformAdmin ? readCollection(FIRESTORE_COLLECTIONS.moderation) : Promise.resolve([]),
    platformAdmin ? readCollection(FIRESTORE_COLLECTIONS.inviteCodes) : Promise.resolve([]),
    readCollection(FIRESTORE_COLLECTIONS.locationChangeRequests, platformAdmin ? {} : { ownUid: expectedUid }),
    readCollection(FIRESTORE_COLLECTIONS.verificationRequests, platformAdmin ? {} : { ownUid: expectedUid }),
    readCollection(FIRESTORE_COLLECTIONS.changeRequests, platformAdmin ? {} : { ownUid: expectedUid }),
    readCollection(FIRESTORE_COLLECTIONS.alertReads, platformAdmin ? {} : { ownUid: expectedUid }),
    readCollection(FIRESTORE_COLLECTIONS.deviceTokens, platformAdmin ? {} : { ownUid: expectedUid }),
    readCollection(FIRESTORE_COLLECTIONS.areaCategoryPriority, { orderField: "updatedAt" }),
    readCollection(FIRESTORE_COLLECTIONS.bulletinFilters, { ownUid: expectedUid, orderField: "updatedAt" }),
    readFirebaseDoc(FIRESTORE_COLLECTIONS.notificationPreferences, expectedUid),
    platformAdmin ? readCollection(FIRESTORE_COLLECTIONS.pushDeliveries, { orderField: "attemptedAt" }) : Promise.resolve([]),
    platformAdmin ? readCollection(FIRESTORE_COLLECTIONS.users, { orderField: "updatedAt" }) : localAdmin && scope.area ? readCollection(FIRESTORE_COLLECTIONS.users, { area: scope.area, orderField: "updatedAt" }) : Promise.resolve([]),
    readPublicCantonStatsDoc(),
    platformAdmin ? readCollection(FIRESTORE_COLLECTIONS.auditLog, { orderField: "createdAt" }) : Promise.resolve([]),
    readCollection(FIRESTORE_COLLECTIONS.chats, { participantUid: expectedUid, orderField: "lastMessageAt" })
  ]);
  if (!currentAccountEpoch(expectedUid, expectedEpoch)) return;
  state.requests = mergeById([...requests, ...ownRequests2, ...regionalRequests]).map(normalizeRequestDoc);
  state.alerts = alerts.map(normalizeAlertDoc);
  state.officialNotices = officialNotices.map(normalizeOfficialNoticeDoc);
  state.moderation = moderation.map(normalizeSimpleCreated);
  state.inviteCodes = inviteCodes.map(normalizeSimpleCreated);
  state.locationChangeRequests = locationChangeRequests.map((item) => ({
    ...normalizeSimpleCreated(item),
    currentLocation: sanitizeLocation(item.currentLocation),
    targetLocation: sanitizeLocation(item.targetLocation),
    decidedAt: normalizeStoredDate(item.decidedAt) || ""
  }));
  state.verificationRequests = verificationRequests.map((item) => ({
    ...normalizeSimpleCreated(item),
    decidedAt: normalizeStoredDate(item.decidedAt) || ""
  }));
  state.changeRequests = changeRequests.map((item) => ({
    ...normalizeSimpleCreated(item),
    decidedAt: normalizeStoredDate(item.decidedAt) || ""
  }));
  state.alertReads = alertReads.map((item) => ({
    ...normalizeSimpleCreated(item),
    readAt: normalizeStoredDate(item.readAt) || normalizeStoredDate(item.createdAt) || nowIso()
  }));
  state.deviceTokens = deviceTokens.map((item) => ({
    ...normalizeSimpleCreated(item),
    updatedAt: normalizeStoredDate(item.updatedAt) || nowIso()
  }));
  state.areaCategoryPriority = areaCategoryPriority.map((item) => ({
    ...item,
    updatedAt: normalizeStoredDate(item.updatedAt) || nowIso(),
    priority: Array.isArray(item.priority) ? item.priority.filter((cat) => CATEGORIES.includes(cat)) : []
  }));
  state.bulletinFilters = bulletinFilters.map((item) => ({
    ...normalizeSimpleCreated(item),
    updatedAt: normalizeStoredDate(item.updatedAt) || nowIso(),
    filter: normalizeBulletinFilter(item.filter || item)
  }));
  state.notificationPreferences = normalizeNotificationPreferences(notificationPreferences || {});
  state.pushDeliveries = pushDeliveries.map((item) => ({
    ...item,
    attemptedAt: normalizeStoredDate(item.attemptedAt) || nowIso()
  }));
  state.registeredUsers = registeredUsers.map((user) => ({
    ...user,
    location: sanitizeLocation(user.location),
    titleGrants: normalizeTitleGrants(user.titleGrants),
    accountType: normalizeAccountType(user.accountType || "resident"),
    accountStatus: user.accountStatus || "active",
    updatedAt: normalizeStoredDate(user.updatedAt) || nowIso()
  }));
  state.auditLog = auditLog.map(normalizeSimpleCreated).slice(0, 80);
  state.chats = mergeById(chats).map(normalizeChatDoc);
  state.publicStats = {
    cantonCounts: sanitizeCantonCounts(publicStatsDoc?.cantonCounts || {}),
    totalUsers: Number(publicStatsDoc?.totalUsers || 0),
    updatedAt: normalizeStoredDate(publicStatsDoc?.updatedAt) || ""
  };
  if (admin && state.registeredUsers.length) {
    if (!currentAccountEpoch(expectedUid, expectedEpoch)) return;
    await publishPublicCantonStats().catch((error) => reportBackgroundError("Kantonsstatistik ver\xF6ffentlichen", error));
  }
  if (!currentAccountEpoch(expectedUid, expectedEpoch)) return;
  await loadCommunityFeatures();
  if (!currentAccountEpoch(expectedUid, expectedEpoch)) return;
  saveState();
}
async function updateFirebaseProfile(updates = {}) {
  if (!isFirebaseMode() || !authState.user) return;
  const { db, doc, setDoc } = firebaseStoreApi;
  const userRef = doc(db, FIRESTORE_COLLECTIONS.users, authState.user.uid);
  const editable = ["titleVisible", "titlePreset", "locale", "notifications", "dashboard", "onboarding", "passkeyReady"];
  const safe = Object.fromEntries(Object.entries(updates).filter(([key]) => editable.includes(key)));
  await setDoc(userRef, { ...safe, updatedAt: nowIso() }, { merge: true });
}
async function setFirebaseDoc(collectionName, id, data, merge = true) {
  const { db, doc, setDoc } = firebaseStoreApi;
  const ref = doc(db, collectionName, id);
  if (merge) {
    await setDoc(ref, data, { merge: true });
    return;
  }
  await setDoc(ref, data);
}
function actionErrorMessage(error, fallback = "Aktion konnte nicht ausgef\xFChrt werden.") {
  const raw = String(error?.message || error?.code || fallback);
  if (raw.includes("messaging/permission-blocked") || raw.includes("permission was not granted and blocked")) {
    return "Benachrichtigungen sind im Browser blockiert. Bitte in den Website-Einstellungen f\xFCr quartinaut.web.app auf \u201EZulassen\u201C stellen.";
  }
  if (raw.includes("permission-denied") || raw.includes("Missing or insufficient permissions")) {
    if (["admin", "area_admin"].includes(state.profile.role || "") && !isAdminRole()) {
      return "Adminrechte sind noch nicht aktiv. Bitte abmelden und erneut mit Google anmelden.";
    }
    return "Keine Berechtigung zum Speichern. Bitte einmal neu anmelden und erneut versuchen.";
  }
  if (raw.includes("network") || raw.includes("offline") || raw.includes("unavailable")) {
    return "Speichern ist gerade nicht m\xF6glich. Bitte Verbindung pr\xFCfen und erneut versuchen.";
  }
  return raw || fallback;
}
function reportBackgroundError(context, error, options = {}) {
  const message = actionErrorMessage(error, options.fallback || `${context} konnte nicht abgeschlossen werden.`);
  const details = {
    context,
    code: error?.code || "",
    message: error?.message || String(error || ""),
    collection: options.collection || "",
    notify: Boolean(options.notify)
  };
  console.warn(`[Quartinaut] ${context}`, details, error);
  if (options.notify) toast(message);
  return null;
}
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Foto konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}
function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Foto konnte nicht verarbeitet werden."));
    image.src = dataUrl;
  });
}
function dataUrlByteSize(dataUrl = "") {
  const base64 = String(dataUrl).split(",")[1] || "";
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor(base64.length * 3 / 4) - padding);
}
async function loadDrawableImage(dataUrl) {
  if (window.createImageBitmap) {
    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      return await createImageBitmap(blob, { imageOrientation: "from-image" });
    } catch {
    }
  }
  return loadImage(dataUrl);
}
async function prepareVerificationPhoto(file) {
  if (!file) throw new Error("Bitte ein Foto deines Ausweises hochladen.");
  if (!String(file.type || "").startsWith("image/")) throw new Error("Bitte eine Bilddatei hochladen.");
  if (/\.hei[cf]$/i.test(file.name || "") || /hei[cf]/i.test(file.type || "")) {
    throw new Error("HEIC/HEIF kann dieser Browser nicht zuverl\xE4ssig lesen. Bitte als JPG oder PNG hochladen.");
  }
  const raw = await readFileAsDataUrl(file);
  const image = await loadDrawableImage(raw);
  const targetBytes = 82e4;
  const maxSides = [1800, 1600, 1400, 1280, 1120, 1e3, 900, 800, 700, 620, 560];
  const qualities = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42];
  let best = null;
  for (const maxSide of maxSides) {
    const scale = Math.min(1, maxSide / Math.max(image.width || maxSide, image.height || maxSide));
    const width = Math.max(1, Math.round((image.width || maxSide) * scale));
    const height = Math.max(1, Math.round((image.height || maxSide) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    for (const quality of qualities) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      const bytes = dataUrlByteSize(dataUrl);
      const candidate = { dataUrl, bytes, width, height, quality };
      if (!best || candidate.bytes < best.bytes) best = candidate;
      if (bytes <= targetBytes) {
        return {
          dataUrl,
          name: `${(file.name || "ausweisfoto").replace(/\.[^.]+$/, "")}.jpg`,
          type: "image/jpeg",
          size: bytes,
          originalSize: file.size,
          width,
          height,
          quality,
          uploadedAt: nowIso()
        };
      }
    }
  }
  if (!best || best.bytes > 89e4) throw new Error("Das Foto konnte nicht klein genug komprimiert werden. Bitte Bild zuschneiden und erneut versuchen.");
  return {
    dataUrl: best.dataUrl,
    name: `${(file.name || "ausweisfoto").replace(/\.[^.]+$/, "")}.jpg`,
    type: "image/jpeg",
    size: best.bytes,
    originalSize: file.size,
    width: best.width,
    height: best.height,
    quality: best.quality,
    uploadedAt: nowIso()
  };
}
function postPhotoField() {
  return `<fieldset class="v43-photo-field"><legend>Fotos zum Beitrag (optional)</legend>
    <label class="v43-photo-pick">\u{1F4F7} Fotos ausw\xE4hlen <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple data-post-photo-input aria-label="Bis zu drei Fotos ausw\xE4hlen"></label>
    <p class="help">Maximal 3 Fotos. JPG, PNG oder WebP; die Bilder werden verkleinert und ohne Foto-Standortdaten gespeichert. Keine Ausweisfotos oder privaten Adressen hochladen.</p>
    <div class="v43-photo-preview" data-post-photo-preview aria-live="polite"></div>
    <p class="v43-photo-status" data-post-photo-status role="status" aria-live="polite">Noch keine Fotos ausgew\xE4hlt.</p>
  </fieldset>`;
}
var POST_PHOTO_LIMIT = 3;
var POST_PHOTO_BYTES = 85e4;
var photoPickerState = /* @__PURE__ */ new WeakMap();
var photoDraftDbPromise;
function photoDraftDb() {
  if (!("indexedDB" in window)) return Promise.resolve(null);
  if (photoDraftDbPromise) return photoDraftDbPromise;
  photoDraftDbPromise = new Promise((resolve) => {
    try {
      const open = indexedDB.open("quartinaut-post-photo-drafts", 1);
      open.onupgradeneeded = () => {
        if (!open.result.objectStoreNames.contains("images")) open.result.createObjectStore("images");
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => resolve(null);
      open.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return photoDraftDbPromise;
}
async function photoDraftTransaction(key, images) {
  const db = await photoDraftDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction("images", "readwrite");
      const store = tx.objectStore("images");
      if (images === null) store.delete(key);
      else store.put({ saved: Date.now(), images }, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}
async function photoDraftLoad(key) {
  const db = await photoDraftDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const req = db.transaction("images", "readonly").objectStore("images").get(key);
      req.onsuccess = () => {
        const v = req.result;
        if (!v || Date.now() - Number(v.saved) > 72 * 36e5) return resolve([]);
        resolve(Array.isArray(v.images) ? v.images.slice(0, POST_PHOTO_LIMIT) : []);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}
async function preparePostPhoto(file) {
  if (file.size > 15 * 1024 * 1024) throw new Error("Das Foto ist zu gross (maximal 15 MB Originalgr\xF6sse).");
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) throw new Error("Bitte ein JPG-, PNG- oder WebP-Foto w\xE4hlen.");
  if (/\.hei[cf]$/i.test(file.name) || /hei[cf]/i.test(file.type)) throw new Error("HEIC/HEIF wird hier nicht zuverl\xE4ssig unterst\xFCtzt. Bitte Foto als JPG speichern.");
  const source = await readFileAsDataUrl(file);
  const image = await loadDrawableImage(source);
  const width0 = image.width || image.naturalWidth, height0 = image.height || image.naturalHeight;
  if (!width0 || !height0) throw new Error("Das Foto konnte nicht ge\xF6ffnet werden.");
  for (const max of [1600, 1280, 1024, 800, 640, 500]) {
    const scale = Math.min(1, max / Math.max(width0, height0));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width0 * scale));
    canvas.height = Math.max(1, Math.round(height0 * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Fotoverarbeitung ist auf diesem Ger\xE4t nicht verf\xFCgbar.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.83, 0.7, 0.58, 0.45]) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      const size = dataUrlByteSize(dataUrl);
      if (size <= POST_PHOTO_BYTES) return { dataUrl, size, width: canvas.width, height: canvas.height };
    }
  }
  throw new Error("Foto konnte nicht ausreichend verkleinert werden.");
}
function photoDraftKey(form, context) {
  return `quartinaut-photos-v43:${authState.user?.uid || "guest"}:${form.id}:${context || "default"}`;
}
function postPhotoStatus(form, text, problem = false) {
  const el = form.querySelector("[data-post-photo-status]");
  if (el) {
    el.textContent = text;
    el.classList.toggle("v43-error", problem);
  }
}
function renderSelectedPhotos(form) {
  const model = photoPickerState.get(form);
  if (!model) return;
  const target = form.querySelector("[data-post-photo-preview]");
  if (!target) return;
  const all = [...model.existing.map((path, index) => ({ path, index, old: true })), ...model.selected.map((photo, index) => ({ photo, index, old: false }))];
  target.innerHTML = all.map((item) => `<div class="v43-photo-chip">${item.old ? `<img data-post-photo-path="${escapeHtml(item.path)}" alt="Vorhandenes Beitragsfoto" loading="lazy">` : `<img src="${item.photo.dataUrl}" alt="Foto-Vorschau" loading="lazy">`}
    <button type="button" data-move-photo="-1" data-photo-class="${item.old ? "old" : "new"}" data-photo-index="${item.index}" aria-label="Foto nach links verschieben" ${item.index === 0 ? "disabled" : ""}>\u2190</button>
    <button type="button" data-move-photo="1" data-photo-class="${item.old ? "old" : "new"}" data-photo-index="${item.index}" aria-label="Foto nach rechts verschieben" ${item.index === (item.old ? model.existing.length : model.selected.length) - 1 ? "disabled" : ""}>\u2192</button>
    <button type="button" data-remove-photo="${item.old ? "old" : "new"}" data-photo-index="${item.index}" aria-label="Foto entfernen">\xD7</button></div>`).join("");
  postPhotoStatus(form, `${all.length} von ${POST_PHOTO_LIMIT} Fotos ausgew\xE4hlt.`);
  if (all.some((x) => x.old)) void hydratePostPhotoImages(target);
}
async function mountPostPhotoPicker(form, context, existing = []) {
  const key = photoDraftKey(form, context);
  const model = { selected: [], existing: validPostPhotoPaths(existing), key, changed: false };
  photoPickerState.set(form, model);
  const input = form.querySelector("[data-post-photo-input]");
  const pending = photoDraftLoad(key).then((photos) => {
    if (!form.isConnected || model.changed) return;
    model.selected = photos.filter((p) => p && /^data:image\/jpeg;base64,/.test(p.dataUrl) && p.size <= POST_PHOTO_BYTES).slice(0, POST_PHOTO_LIMIT - model.existing.length);
    renderSelectedPhotos(form);
  });
  model.ready = pending;
  input?.addEventListener("change", async () => {
    model.changed = true;
    await pending;
    const files = [...input.files || []];
    input.value = "";
    if (!files.length) return;
    const available = POST_PHOTO_LIMIT - model.existing.length - model.selected.length;
    if (files.length > available) {
      postPhotoStatus(form, `Es sind h\xF6chstens ${POST_PHOTO_LIMIT} Fotos erlaubt. Bitte zuerst ein Foto entfernen.`, true);
      return;
    }
    postPhotoStatus(form, "Fotos werden vorbereitet \u2026");
    try {
      const processed = [];
      for (const f of files) processed.push(await preparePostPhoto(f));
      model.selected.push(...processed);
      await photoDraftTransaction(key, model.selected);
      renderSelectedPhotos(form);
    } catch (error) {
      postPhotoStatus(form, error.message || "Foto konnte nicht vorbereitet werden.", true);
    }
  });
  form.querySelector("[data-post-photo-preview]")?.addEventListener("click", async (event) => {
    const mover = event.target.closest("[data-move-photo]");
    if (mover) {
      model.changed = true;
      await pending;
      const list = mover.dataset.photoClass === "old" ? model.existing : model.selected;
      const from = Number(mover.dataset.photoIndex), to = from + Number(mover.dataset.movePhoto);
      if (to < 0 || to >= list.length) return;
      [list[from], list[to]] = [list[to], list[from]];
      await photoDraftTransaction(key, model.selected);
      renderSelectedPhotos(form);
      return;
    }
    const btn = event.target.closest("[data-remove-photo]");
    if (!btn) return;
    model.changed = true;
    await pending;
    const index = Number(btn.dataset.photoIndex);
    if (btn.dataset.removePhoto === "old") model.existing.splice(index, 1);
    else model.selected.splice(index, 1);
    await photoDraftTransaction(key, model.selected);
    renderSelectedPhotos(form);
  });
  form.closest(".modal-backdrop")?.addEventListener("modal:close", () => {
    if (form.dataset.photoSaved === "yes") void photoDraftTransaction(key, null);
    else void photoDraftTransaction(key, model.selected);
  }, { once: true });
  renderSelectedPhotos(form);
  return model;
}
function validPostPhotoPaths(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x) => typeof x === "string" && /^post-photos\/(requests|community|groups)\/[A-Za-z0-9_-]{5,128}\/[A-Za-z0-9_-]{5,128}\/[0-2]\.jpg$/.test(x)).slice(0, POST_PHOTO_LIMIT);
}
function postPhotoGallery(paths) {
  const photos = validPostPhotoPaths(paths);
  if (!photos.length) return "";
  return `<div class="v44-carousel" data-v44-carousel data-current="0" aria-label="Beitragsfotos, ${photos.length} Bilder">
    <div class="v44-carousel-track">${photos.map((path, index) => `<div class="v44-carousel-slide"><img alt="Beitragsfoto ${index + 1} von ${photos.length}" loading="lazy" data-post-photo-path="${escapeHtml(path)}"></div>`).join("")}</div>
    ${photos.length > 1 ? `<button type="button" class="v44-carousel-prev" data-v44-carousel-step="-1" aria-label="Vorheriges Foto">\u2039</button>
    <button type="button" class="v44-carousel-next" data-v44-carousel-step="1" aria-label="N\xE4chstes Foto">\u203A</button>
    <div class="v44-carousel-count" aria-live="polite">1 / ${photos.length}</div>
    <div class="v44-carousel-dots" aria-hidden="true">${photos.map((_, i) => `<span class="${i === 0 ? "active" : ""}"></span>`).join("")}</div>` : ""}
  </div>`;
}
async function removeOwnedPostPhotos(paths) {
  try {
    const api = await initFirebaseStorage();
    if (!api || !authState.user?.uid) return;
    for (const path of validPostPhotoPaths(paths)) {
      if (path.split("/")[2] !== authState.user.uid) continue;
      try {
        await api.deleteObject(api.ref(api.storage, path));
      } catch (error) {
        console.warn("[Quartinaut] Altes Beitragsfoto konnte nicht gel\xF6scht werden.", error);
      }
    }
  } catch (error) {
    console.warn("[Quartinaut] Foto-Bereinigung fehlgeschlagen.", error);
  }
}
var photoUrlCache = /* @__PURE__ */ new Map();
async function hydratePostPhotoImages(root = document) {
  const imgs = [...root.querySelectorAll?.("img[data-post-photo-path]") || []];
  if (!imgs.length || !isFirebaseMode() || !authState.user) return;
  const expectedUid = authState.user.uid, expectedEpoch = accountEpoch;
  await Promise.all(imgs.map(async (img) => {
    const path = img.dataset.postPhotoPath, cacheKey = expectedUid + ":" + path;
    if (!validPostPhotoPaths([path]).length) return;
    try {
      let src = photoUrlCache.get(cacheKey);
      if (!src) {
        const result = await callQuartinaut("quartinautPhoto", { action: "read", path });
        if (result?.mime !== "image/jpeg" || !/^\/9j/.test(String(result.base64 || "")) || result.base64.length > 13e5) throw new Error("Ung\xFCltiges Fotoformat.");
        if (!currentAccountEpoch(expectedUid, expectedEpoch)) return;
        src = "data:image/jpeg;base64," + result.base64;
        if (photoUrlCache.size >= 36) photoUrlCache.delete(photoUrlCache.keys().next().value);
        photoUrlCache.set(cacheKey, src);
      }
      if (img.isConnected && currentAccountEpoch(expectedUid, expectedEpoch)) img.src = src;
    } catch (error) {
      if (img.isConnected && currentAccountEpoch(expectedUid, expectedEpoch)) {
        img.alt = "Foto nicht verf\xFCgbar oder keine Berechtigung";
        img.classList.add("v43-photo-unavailable");
      }
      console.warn("[Quartinaut] Foto nicht verf\xFCgbar", String(error?.code || error?.message || ""));
    }
  }));
}
var postPhotoObserver = new MutationObserver(() => {
  if (document.querySelector("img[data-post-photo-path]:not([src])")) void hydratePostPhotoImages(document);
});
postPhotoObserver.observe(document.documentElement, { childList: true, subtree: true });
async function uploadPostPhotos(namespace, token, photos) {
  if (!photos.length) return [];
  const expected = authState.user?.uid, epoch = accountEpoch, paths = [];
  if (!expected) throw Error("Bitte anmelden.");
  for (let index = 0; index < photos.length; index++) {
    if (!currentAccountEpoch(expected, epoch)) throw Error("Sitzung gewechselt.");
    const result = await callQuartinaut("quartinautEnhancements", { action: "photo.put", namespace, token, index, jpegBase64: photos[index].dataUrl.split(",")[1] });
    paths.push(result.path);
  }
  return paths;
}
async function initFirebaseStorage() {
  if (!firebaseAppInstance) return null;
  if (firebaseStorageApi) return firebaseStorageApi;
  const storageModule = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js");
  const storage = storageModule.getStorage(firebaseAppInstance);
  firebaseStorageApi = { storage, ...storageModule };
  return firebaseStorageApi;
}
async function persistVerificationPhoto(requestId, photo) {
  if (!isFirebaseMode()) return { ...photo, storageMode: "local" };
  const api = await initFirebaseStorage();
  if (!api) throw new Error("Firebase Storage ist momentan nicht verf\xFCgbar.");
  const { storage, ref, uploadString } = api;
  const storagePath = `verification-photos/${authState.user.uid}/${requestId}.jpg`;
  const fileRef = ref(storage, storagePath);
  try {
    await uploadString(fileRef, photo.dataUrl, "data_url", { contentType: "image/jpeg" });
  } catch (error) {
    reportBackgroundError("Verifizierungsfoto speichern", error);
    throw new Error("Ausweisfoto konnte nicht sicher in Firebase Storage gespeichert werden. Bitte Storage/CORS-Freigabe pr\xFCfen und danach erneut versuchen.");
  }
  return {
    storageMode: "storage",
    storagePath,
    name: photo.name,
    type: photo.type,
    size: photo.size,
    uploadedAt: photo.uploadedAt
  };
}
async function deleteVerificationPhoto(req) {
  const storagePath = req?.idPhoto?.storagePath;
  if (!storagePath || !isFirebaseMode()) return;
  try {
    const { storage, ref, deleteObject } = await initFirebaseStorage();
    await deleteObject(ref(storage, storagePath));
  } catch (error) {
    if (String(error?.code || "") === "storage/object-not-found") return;
    throw new Error("Ausweisfoto konnte nicht aus Firebase Storage entfernt werden. Bitte erneut versuchen.");
  }
}
function verificationPhotoAvailable(req) {
  const photo = req?.idPhoto || {};
  return Boolean(photo.storagePath || !isFirebaseMode() && photo.dataUrl);
}
function verificationPhotoMetaText(req) {
  const photo = req?.idPhoto || {};
  const storedAt = photo.uploadedAt ? formatDate(photo.uploadedAt) : "unbekannt";
  if (photo.storagePath) return `Gesch\xFCtzt gespeichert: ${photo.storagePath} \xB7 ${storedAt}`;
  if (photo.dataUrl && !isFirebaseMode()) return `Lokale Vorschau \xB7 ${storedAt}`;
  return "Kein Ausweisfoto vorhanden.";
}
async function openVerificationPhotoModal(id) {
  const expectedUid = authState.user?.uid, expectedEpoch = accountEpoch;
  if (!expectedUid) throw new Error("Bitte anmelden.");
  const req = state.verificationRequests.find((item) => item.id === id);
  if (!req?.idPhoto) throw new Error("Ausweisfoto nicht gefunden.");
  const photo = req.idPhoto;
  let objectUrl = "";
  let photoUrl = "";
  if (photo.storagePath && isFirebaseMode()) {
    const { storage, ref, getBytes } = await initFirebaseStorage();
    const bytes = await getBytes(ref(storage, photo.storagePath), 9e5);
    if (!currentAccountEpoch(expectedUid, expectedEpoch)) return;
    objectUrl = URL.createObjectURL(new Blob([bytes], { type: photo.type || "image/jpeg" }));
    photoUrl = objectUrl;
  } else if (photo.dataUrl && !isFirebaseMode()) {
    photoUrl = photo.dataUrl;
  }
  if (!photoUrl) throw new Error("Ausweisfoto kann nicht geladen werden.");
  if (!currentAccountEpoch(expectedUid, expectedEpoch)) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    return;
  }
  openModal("Ausweisfoto pr\xFCfen", `
    <section class="form-grid">
      <p class="help">Dieses Foto ist nur f\xFCr die Namens- und Identit\xE4tspr\xFCfung vorgesehen. Nach Best\xE4tigung oder Ablehnung wird es aus dem Antrag entfernt.</p>
      <figure class="id-photo-preview">
        <img src="${escapeHtml(photoUrl)}" alt="Ausweisfoto von ${escapeHtml(req.displayName || "Nutzer/in")}" />
        <figcaption>${escapeHtml(req.registeredName || req.displayName || "Registrierter Name")}</figcaption>
      </figure>
    </section>
  `, (modal) => {
    if (objectUrl) modal.addEventListener("modal:close", () => URL.revokeObjectURL(objectUrl));
  });
}
async function readPublicCantonStatsDoc() {
  if (!isFirebaseMode()) return null;
  const { db, doc, getDoc } = firebaseStoreApi;
  try {
    const ref = doc(db, FIRESTORE_COLLECTIONS.publicStats, "cantonRegistrations");
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) return null;
    return snapshot.data();
  } catch {
    return null;
  }
}
async function publishPublicCantonStats() {
  if (!isFirebaseMode() || !isAdminRole()) return;
  const expectedUid = authState.user.uid, expectedEpoch = accountEpoch;
  const counts = sanitizeCantonCounts(cantonRegistrationCounts());
  const totalUsers = totalRegisteredUsersFromCounts(counts);
  const payload = {
    id: "cantonRegistrations",
    cantonCounts: counts,
    totalUsers,
    updatedAt: nowIso()
  };
  if (!currentAccountEpoch(expectedUid, expectedEpoch)) return;
  await setFirebaseDoc(FIRESTORE_COLLECTIONS.publicStats, "cantonRegistrations", payload, true);
  if (currentAccountEpoch(expectedUid, expectedEpoch)) state.publicStats = payload;
}
function tokenDocId(token = "") {
  const compact = String(token).replace(/[^a-zA-Z0-9]/g, "").slice(-28) || uid("tok");
  return `tok_${authState.user?.uid || "anon"}_${compact}`;
}
async function initFirebaseMessaging() {
  if (!firebaseAppInstance || !("Notification" in window) || !("serviceWorker" in navigator)) return;
  if (firebaseMessagingApi) return;
  try {
    const messagingModule = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging.js");
    const supported = await messagingModule.isSupported().catch(() => false);
    if (!supported) return;
    messagingWorkerRegistration = await navigator.serviceWorker.register("./firebase-messaging-sw.js", { scope: "/firebase-cloud-messaging-push-scope" }).catch((error) => reportBackgroundError("FCM-Service-Worker registrieren", error, { notify: true, fallback: "Benachrichtigungs-Service konnte nicht registriert werden." }));
    const messaging = messagingModule.getMessaging(firebaseAppInstance);
    firebaseMessagingApi = { messaging, ...messagingModule };
    messagingModule.onMessage(messaging, (payload) => {
      const title = payload?.notification?.title || payload?.data?.title || "Quartinaut";
      const body = payload?.notification?.body || payload?.data?.body || "Neue Meldung";
      toast(`Push: ${title}`);
      if (Notification.permission === "granted") {
        void showSystemNotification(title, body, {
          tag: payload?.data?.chatId ? `chat_${payload.data.chatId}` : payload?.data?.alertId ? `alert_${payload.data.alertId}` : "quartinaut-push",
          data: { alertId: payload?.data?.alertId || "", chatId: payload?.data?.chatId || "", route: payload?.data?.route || (payload?.data?.chatId ? "chats" : "alarme") }
        });
      }
    });
  } catch (error) {
    firebaseMessagingApi = null;
    reportBackgroundError("Firebase Messaging initialisieren", error, { notify: false });
  }
}
async function registerPushToken() {
  if (!isFirebaseMode() || !authState.user) return "";
  await initFirebaseMessaging();
  if (!firebaseMessagingApi) throw new Error("FCM wird auf diesem Ger\xE4t/Browserversion nicht unterst\xFCtzt.");
  if (!FIREBASE_VAPID_KEY) throw new Error("FCM VAPID-Key fehlt. Bitte in firebase-config.js setzen.");
  const registration = messagingWorkerRegistration || await navigator.serviceWorker.ready;
  const token = await firebaseMessagingApi.getToken(firebaseMessagingApi.messaging, {
    vapidKey: FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration
  });
  if (!token) throw new Error("Kein FCM-Token erhalten.");
  currentPushToken = token;
  const payload = {
    id: tokenDocId(token),
    uid: authState.user.uid,
    email: authState.user.email,
    displayName: profileName(),
    area: state.profile.area,
    areaKey: normalizeAreaKey(state.profile.area),
    cantonCode: cantonCodeFromArea(state.profile.area),
    token,
    active: true,
    updatedAt: nowIso(),
    createdAt: nowIso()
  };
  await setFirebaseDoc(FIRESTORE_COLLECTIONS.deviceTokens, payload.id, payload, true);
  const preferences = normalizeNotificationPreferences({
    ...currentNotificationPreferences(),
    uid: authState.user.uid,
    enabled: true,
    area: state.profile.area,
    areaKey: currentAreaKey(),
    cantonCode: currentCantonCode(),
    updatedAt: nowIso()
  });
  await setFirebaseDoc(FIRESTORE_COLLECTIONS.notificationPreferences, authState.user.uid, preferences, true);
  state.notificationPreferences = preferences;
  await updateFirebaseProfile({ notifications: true, hasPushToken: true });
  await syncStateFromFirestore();
  return token;
}
async function queueFcmSelfTest(pushToken = currentPushToken) {
  if (!isFirebaseMode() || !authState.user) throw new Error("FCM-Test ben\xF6tigt Firebase-Anmeldung.");
  const id = uid("push_test");
  await setFirebaseDoc(FIRESTORE_COLLECTIONS.pushTests, id, {
    id,
    uid: authState.user.uid,
    email: authState.user.email,
    displayName: profileName(),
    area: state.profile.area,
    areaKey: normalizeAreaKey(state.profile.area),
    cantonCode: cantonCodeFromArea(state.profile.area),
    tokenHint: pushToken ? `${pushToken.slice(0, 10)}\u2026${pushToken.slice(-8)}` : "",
    status: "requested",
    createdAt: nowIso(),
    updatedAt: nowIso()
  }, false);
  return id;
}
var LOGIN_ATTEMPT_KEY = "quartinaut-login-attempt-v2-0-4";
function currentLoginAttempt() {
  try {
    const attempt = JSON.parse(localStorage.getItem(LOGIN_ATTEMPT_KEY) || "null");
    if (!attempt || Date.now() - attempt.at > 10 * 60 * 1e3) {
      localStorage.removeItem(LOGIN_ATTEMPT_KEY);
      return null;
    }
    return attempt;
  } catch {
    return null;
  }
}
function noteLoginAttempt(stage) {
  try {
    localStorage.setItem(LOGIN_ATTEMPT_KEY, JSON.stringify({ at: Date.now(), stage }));
  } catch {
  }
}
function clearLoginAttempt() {
  try {
    localStorage.removeItem(LOGIN_ATTEMPT_KEY);
  } catch {
  }
}
function shouldPreferRedirectAuth() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
function loginSessionError() {
  const attempt = currentLoginAttempt();
  if (!attempt) return "";
  return "Google-Anmeldung wurde gestartet, aber die Firebase-Sitzung wurde hier nicht wiederhergestellt. \xD6ffne https://quartinaut.web.app direkt im normalen Chrome/Safari-Browser (nicht in einer anderen App), pr\xFCfe Pop-ups/Cookies und versuche es erneut. Keine Konten l\xF6schen.";
}
async function signInWithGoogleFlow() {
  if (!firebaseAuthApi) throw new Error("Google-Anmeldung ist momentan nicht verf\xFCgbar.");
  const { auth, provider, signInWithPopup, signInWithRedirect } = firebaseAuthApi;
  noteLoginAttempt("started");
  try {
    if (shouldPreferRedirectAuth()) {
      noteLoginAttempt("redirect_started");
      await signInWithRedirect(auth, provider);
      return;
    }
    const result = await signInWithPopup(auth, provider);
    if (result?.user) noteLoginAttempt("google_authenticated");
  } catch (error) {
    const code = String(error?.code || "");
    const message = String(error?.message || "");
    clearLoginAttempt();
    if (code === "auth/popup-blocked" || /Cross-Origin-Opener-Policy|window\.closed/i.test(message)) {
      throw new Error("Das Google-Anmeldefenster wurde blockiert. \xD6ffne quartinaut.web.app direkt in Chrome oder Safari und erlaube Pop-ups.");
    }
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      throw new Error("Die Google-Anmeldung wurde abgebrochen. Bitte erneut versuchen.");
    }
    if (code === "auth/unauthorized-domain") {
      throw new Error("Firebase Authentication: quartinaut.web.app ist noch nicht als autorisierte Domain eingetragen. Bitte Authentication \u2192 Einstellungen \u2192 Autorisierte Domains pr\xFCfen.");
    }
    throw error;
  }
}
function emailOnlyUnverified(firebaseUser) {
  return Boolean(firebaseUser?.email && !firebaseUser.emailVerified && !firebaseUser.providerData?.some((provider) => provider.providerId === "google.com"));
}
function readableEmailAuthError(error) {
  switch (String(error?.code || "")) {
    case "auth/operation-not-allowed":
      return "E-Mail/Passwort ist in Firebase noch nicht aktiviert. Die Verwaltung muss Authentication \u2192 Anmeldemethode \u2192 E-Mail/Passwort einschalten.";
    case "auth/email-already-in-use":
      return "Zu dieser E-Mail-Adresse gibt es bereits ein Konto. Bitte anmelden oder bei einem bestehenden Google-Konto zun\xE4chst das Konto verkn\xFCpfen lassen.";
    case "auth/weak-password":
      return "Bitte ein l\xE4ngeres, sicheres Passwort ausw\xE4hlen.";
    case "auth/invalid-email":
      return "Bitte eine g\xFCltige E-Mail-Adresse eingeben.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Anmeldung fehlgeschlagen. Pr\xFCfe E-Mail und Passwort oder nutze \u201EPasswort vergessen\u201C.";
    case "auth/too-many-requests":
      return "Zu viele Versuche. Bitte sp\xE4ter erneut versuchen.";
    case "auth/network-request-failed":
      return "Verbindung fehlgeschlagen. Bitte Internetverbindung pr\xFCfen und erneut versuchen.";
    default:
      return error?.message || "Die E-Mail-Anmeldung konnte nicht abgeschlossen werden.";
  }
}
function registrationFieldsFromForm(data) {
  const displayName = String(data.displayName || "").trim();
  const location2 = buildLocation(data.cantonBfsCode, data.municipalityBfsCode);
  const inviteCode = validateInviteCode(data.inviteCode);
  const accountType = normalizeAccountType(data.accountType);
  const companyName = String(data.companyName || "").trim();
  const municipalityDepartment = String(data.municipalityDepartment || "").trim();
  if (!displayName) throw new Error("Bitte einen Namen eingeben.");
  if (!location2) throw new Error("Bitte Kanton und Gemeinde/Ort ausw\xE4hlen.");
  if (accountType === "company" && companyName.length < 2) throw new Error("F\xFCr Firmenkonten bitte einen Firmennamen eingeben.");
  if (accountType === "municipality" && municipalityDepartment.length < 2) throw new Error("F\xFCr Gemeindekonten bitte Abteilung oder Funktion eingeben.");
  return {
    displayName,
    location: location2,
    inviteCode,
    accountType,
    companyName,
    companyPurpose: String(data.companyPurpose || "").trim(),
    municipalityDepartment,
    municipalityWebsite: String(data.municipalityWebsite || "").trim()
  };
}
async function registrationBackend(action, registration = null) {
  if (!firebaseFunctionsApi || !firebaseAuthApi?.auth.currentUser) {
    throw new Error("Der Registrierungsdienst ist nicht erreichbar. Bitte erneut versuchen.");
  }
  const call = firebaseFunctionsApi.httpsCallable(firebaseFunctionsApi.functions, "quartinautRegistration");
  const payload = { action };
  if (registration) payload.registration = registration;
  return (await call(payload)).data || {};
}
async function ensurePendingEmailProfile(firebaseUser) {
  if (!firebaseUser || firebaseUser.emailVerified || firebaseUser.providerData?.some((p) => p.providerId === "google.com")) return;
  const pending = loadPendingGoogleRegistration();
  if (pending?.provider !== "password" || normalizeEmail(pending.email) !== normalizeEmail(firebaseUser.email) || !pending?.location) return;
  await registrationBackend("ensure", pending);
}
function readableVerificationError(error) {
  const code = String(error?.code || "");
  if (code.includes("too-many-requests") || code.includes("quota-exceeded")) return "Firebase begrenzt derzeit den E-Mail-Versand. Bitte sp\xE4ter erneut versuchen oder die Versandlimits in Firebase Authentication pr\xFCfen.";
  if (code.includes("unauthorized-continue-uri") || code.includes("invalid-continue-uri")) return "Der E-Mail-Link konnte nicht erstellt werden. Bitte in Firebase Authentication unter \u201EAutorisierte Domains\u201C quartinaut.web.app pr\xFCfen.";
  if (code.includes("network-request-failed")) return "Netzwerkfehler beim E-Mail-Versand. Bitte Internet pr\xFCfen und die E-Mail erneut anfordern.";
  return `Best\xE4tigungs-E-Mail konnte nicht versandt werden${code ? ` (${code})` : ""}. ${error?.message || "Bitte erneut versuchen."}`;
}
async function registerWithFirebaseEmail(data) {
  const { auth, createUserWithEmailAndPassword, sendEmailVerification } = firebaseAuthApi;
  const email = normalizeEmail(data.email), password = String(data.password || "");
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("Bitte g\xFCltige E-Mail-Adresse eingeben.");
  if (password.length < 10) throw new Error("Das Passwort muss mindestens 10 Zeichen enthalten.");
  if (password !== String(data.passwordConfirm || "")) throw new Error("Die Passw\xF6rter stimmen nicht \xFCberein.");
  const registration = registrationFieldsFromForm(data);
  savePendingGoogleRegistration({ ...registration, email, provider: "password" });
  let firebaseUser;
  try {
    firebaseUser = (await createUserWithEmailAndPassword(auth, email, password)).user;
  } catch (error) {
    if (error?.code === "auth/email-already-in-use") clearPendingGoogleRegistration();
    throw new Error(readableEmailAuthError(error));
  }
  let profileError = "";
  try {
    await ensurePendingEmailProfile(firebaseUser);
  } catch (error) {
    profileError = `Das Konto wurde in Firebase Authentication erstellt, der Eintrag f\xFCr die Admin-Liste ist aber noch nicht best\xE4tigt (${error?.code || error?.message || "Registrierungsdienst"}).`;
    console.error("[Quartinaut] Registrierungsprofil konnte nicht gespeichert werden:", error);
  }
  let mailError = "";
  try {
    await sendEmailVerification(firebaseUser, { url: "https://quartinaut.web.app/?emailVerified=1" });
  } catch (error) {
    mailError = readableVerificationError(error);
  }
  emailAuthNotice = [
    mailError || "Firebase hat die Best\xE4tigungs-E-Mail zum Versand angenommen. Pr\xFCfe Posteingang und Spam. Danach \u201EE-Mail gepr\xFCft\u201C antippen.",
    profileError
  ].filter(Boolean).join(" ");
  authState = { ready: true, mode: "firebase", user: null, error: "", verifyPending: { email } };
  render();
}
async function loginWithFirebaseEmail(data) {
  const { auth, signInWithEmailAndPassword } = firebaseAuthApi;
  const email = normalizeEmail(data.email), password = String(data.password || "");
  if (!email || !password) throw new Error("Bitte E-Mail und Passwort eingeben.");
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    throw new Error(readableEmailAuthError(error));
  }
}
async function resendFirebaseEmailVerification() {
  const user = firebaseAuthApi?.auth.currentUser;
  if (!user) throw new Error("Bitte melde dich zuerst mit E-Mail und Passwort an.");
  try {
    await ensurePendingEmailProfile(user);
  } catch (error) {
    console.warn("[Quartinaut] Offenes Registrierungsprofil noch nicht synchronisiert:", error);
  }
  try {
    await firebaseAuthApi.sendEmailVerification(user, { url: "https://quartinaut.web.app/?emailVerified=1" });
    emailAuthNotice = "Firebase hat den erneuten E-Mail-Versand angenommen. Bitte auch Spam und Junk-Mail pr\xFCfen.";
  } catch (error) {
    emailAuthNotice = readableVerificationError(error);
  }
  render();
}
async function checkFirebaseEmailVerification() {
  const user = firebaseAuthApi?.auth.currentUser;
  if (!user) {
    authMode = "login";
    render();
    return;
  }
  await firebaseAuthApi.reload(user);
  if (!user.emailVerified) {
    emailAuthNotice = "Die E-Mail-Adresse ist noch nicht best\xE4tigt. \xD6ffne den Link in der E-Mail und versuche es dann erneut.";
    render();
    return;
  }
  emailAuthNotice = "";
  if (firebaseProfileRetryHandler) await firebaseProfileRetryHandler();
}
async function resetFirebaseEmailPassword() {
  const field = byId("firebaseEmailInput");
  const email = normalizeEmail(field?.value || "");
  if (!email) {
    emailAuthNotice = "Bitte zuerst deine E-Mail-Adresse ins Feld eingeben.";
    render();
    return;
  }
  try {
    await firebaseAuthApi.sendPasswordResetEmail(firebaseAuthApi.auth, email);
  } catch (error) {
    if (error?.code === "auth/operation-not-allowed") throw new Error(readableEmailAuthError(error));
  }
  emailAuthNotice = "Falls ein Konto f\xFCr diese Adresse besteht, erh\xE4ltst du eine E-Mail zum Zur\xFCcksetzen des Passworts.";
  render();
}
async function initAuth() {
  if (FIREBASE_READY) {
    try {
      const [appModule, authModule, firestoreModule, functionsModule] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js"),
        import("https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js")
      ]);
      const app = appModule.initializeApp(FIREBASE_CONFIG);
      if (FIREBASE_APP_CHECK_SITE_KEY) {
        const appCheckModule = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-check.js");
        const appCheck = appCheckModule.initializeAppCheck(app, {
          provider: new appCheckModule.ReCaptchaV3Provider(FIREBASE_APP_CHECK_SITE_KEY),
          isTokenAutoRefreshEnabled: true
        });
        firebaseAppCheckApi = { appCheck, ...appCheckModule };
      }
      const auth = authModule.getAuth(app);
      try {
        await authModule.setPersistence(auth, authModule.browserLocalPersistence);
      } catch (error) {
        reportBackgroundError("Anmeldesitzung dauerhaft speichern", error, { notify: false });
      }
      const provider = new authModule.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      let db;
      try {
        db = firestoreModule.initializeFirestore(app, {
          localCache: firestoreModule.persistentLocalCache({
            tabManager: firestoreModule.persistentMultipleTabManager()
          })
        });
      } catch (error) {
        reportBackgroundError("Firestore Offline-Persistenz aktivieren", error, { notify: false });
        db = firestoreModule.getFirestore(app);
      }
      const functions = functionsModule.getFunctions(app, "europe-west6");
      firebaseAppInstance = app;
      firebaseAuthApi = { auth, provider, ...authModule };
      firebaseStoreApi = { db, ...firestoreModule };
      firebaseFunctionsApi = { functions, ...functionsModule };
      let authCallbackGeneration = 0;
      const handleFirebaseUser = async (firebaseUser) => {
        const callbackGeneration = ++authCallbackGeneration;
        resetAccountSession(firebaseUser?.uid || "", "firebase");
        if (!firebaseUser) {
          stopRealtimeSubscriptions();
          authState = { ready: true, mode: "firebase", user: null, error: loginSessionError() };
          render();
          return;
        }
        stopRealtimeSubscriptions();
        authState = { ready: false, mode: "firebase", user: null, error: "" };
        render();
        try {
          if (emailOnlyUnverified(firebaseUser)) {
            try {
              await firebaseAuthApi.reload(firebaseUser);
            } catch {
            }
            if (emailOnlyUnverified(firebaseUser)) {
              try {
                await ensurePendingEmailProfile(firebaseUser);
              } catch (error) {
                console.warn("[Quartinaut] Registrierungsprofil noch nicht gespeichert:", error);
              }
              if (callbackGeneration !== authCallbackGeneration) return;
              authState = { ready: true, mode: "firebase", user: null, error: "", verifyPending: { email: firebaseUser.email } };
              render();
              return;
            }
          }
          if (firebaseUser.emailVerified && firebaseUser.providerData?.some((p) => p.providerId === "password")) {
            await registrationBackend("finalize");
          }
          const initialClaims = await authClaims(firebaseUser, false);
          const userDoc = await upsertFirebaseUserDoc(firebaseUser);
          let finalClaims = initialClaims;
          try {
            finalClaims = await ensureServerAdminClaim(firebaseUser, userDoc, initialClaims);
          } catch (claimError) {
            reportBackgroundError("Adminrechte pr\xFCfen", claimError, { notify: false });
          }
          if (callbackGeneration !== authCallbackGeneration || firebaseAuthApi.auth.currentUser?.uid !== firebaseUser.uid) return;
          const signedInUser = makeAuthUser(firebaseUser, userDoc, finalClaims);
          authState = { ready: true, mode: "firebase", user: signedInUser, error: "" };
          clearLoginAttempt();
          applyAuthenticatedUser(signedInUser);
          if (!new URLSearchParams(location.search).has("route")) state.route = loadHome(signedInUser.uid);
          render();
          void loadHub();
          void v47StartOwnerSync(signedInUser.uid);
          void v47ApplyDeepLink();
          const expectedUid = signedInUser.uid;
          if (isAccountPendingApproval(signedInUser)) {
            stopRealtimeSubscriptions();
            return;
          }
          void nativeWeb.signedIn();
          void syncStateFromFirestore().then(() => {
            if (authState.user?.uid !== expectedUid) return;
            startUserChatRealtime(expectedUid);
            startScopedContentRealtime(expectedUid);
            render();
          }).catch((error) => reportBackgroundError("Firebase-Daten synchronisieren", error, { notify: false, fallback: "Daten konnten nicht synchronisiert werden.", collection: "sync" }));
          void initFirebaseMessaging().then(() => authState.user?.uid === expectedUid && signedInUser.notifications ? registerPushToken().catch((error) => reportBackgroundError("Push-Token speichern", error, { notify: false, fallback: "Push-Token konnte nicht gespeichert werden.", collection: FIRESTORE_COLLECTIONS.deviceTokens })) : null).then(() => {
            if (authState.user?.uid === expectedUid) render();
          }).catch((error) => reportBackgroundError("Push initialisieren", error, { notify: false }));
        } catch (error) {
          if (callbackGeneration !== authCallbackGeneration || firebaseAuthApi.auth.currentUser?.uid !== firebaseUser.uid) return;
          const code = String(error?.code || "");
          let message = error?.message || "Benutzerprofil konnte nicht geladen werden.";
          if (/noch nicht registriert/i.test(message) && firebaseUser.emailVerified) {
            authMode = "register";
            authState = { ready: true, mode: "firebase", user: null, error: "", needsProfileCompletion: true };
            render();
            return;
          }
          if (code.includes("permission-denied")) message = "Anmeldung erfolgreich, aber Firestore verweigert den Zugriff auf dein Benutzerprofil (permission-denied). Die Firebase-Sicherheitsregeln m\xFCssen gepr\xFCft werden.";
          if (code.includes("unavailable") || code.includes("deadline-exceeded")) message = "Anmeldung erfolgreich, aber Firebase ist gerade nicht erreichbar. Pr\xFCfe deine Internetverbindung und versuche es erneut.";
          if (code.includes("failed-precondition")) message = "Anmeldung erfolgreich, aber Firestore konnte nicht gestartet werden (failed-precondition).";
          stopRealtimeSubscriptions();
          clearLoginAttempt();
          authState = { ready: true, mode: "firebase", user: null, error: "", profileError: message };
          reportBackgroundError("Benutzerprofil nach Firebase-Anmeldung", error, { notify: false });
          render();
        }
      };
      firebaseProfileRetryHandler = () => handleFirebaseUser(auth.currentUser);
      authModule.onAuthStateChanged(auth, handleFirebaseUser);
      void authModule.getRedirectResult(auth).then((result) => {
        if (result?.user) {
          noteLoginAttempt("google_authenticated");
          return;
        }
        if (!auth.currentUser && currentLoginAttempt() && !authState.profileError) {
          authState = { ready: true, mode: "firebase", user: null, error: loginSessionError() };
          render();
        }
      }).catch((error) => {
        const code = String(error?.code || "");
        if (code === "auth/no-auth-event") return;
        clearLoginAttempt();
        reportBackgroundError("Google-Redirect-Anmeldung", error, { notify: false });
        if (!authState.user && !authState.profileError) {
          authState = {
            ready: true,
            mode: "firebase",
            user: null,
            error: actionErrorMessage(error, "Google-Anmeldung fehlgeschlagen.")
          };
          render();
        }
      });
      return;
    } catch (error) {
      console.error("[Quartinaut] Firebase Auth konnte nicht geladen werden", error);
      authState = {
        ready: true,
        mode: "firebase",
        user: null,
        error: "Die Verbindung zur Anmeldung konnte nicht hergestellt werden. Bitte pr\xFCfe das Internet und versuche es erneut."
      };
      render();
      return;
    }
  }
  const restoredLocalUser = loadLocalSession();
  resetAccountSession(restoredLocalUser?.uid || "", "local");
  authState = { ready: true, mode: "local", user: restoredLocalUser, error: "" };
  applyAuthenticatedUser(authState.user);
  render();
}
async function signInWithLocalAuth(data) {
  const email = normalizeEmail(data.email);
  const password = String(data.password || "");
  if (!email || !password) throw new Error("E-Mail und Passwort sind erforderlich.");
  if (!email.includes("@")) throw new Error("Bitte eine g\xFCltige E-Mail-Adresse eingeben.");
  const users = loadLocalUsers();
  const stored = users[email];
  const passwordHash = await sha256(`${email}:${password}`);
  if (!stored || stored.passwordHash !== passwordHash) {
    throw new Error("Login fehlgeschlagen. Pr\xFCfe E-Mail und Passwort.");
  }
  const fallbackLocation2 = stored.location || (stored.area ? { municipalityName: stored.area, cantonCode: "", cantonName: "", cantonBfsCode: "", municipalityBfsCode: "" } : null);
  const user = {
    uid: stored.uid,
    email,
    displayName: stored.displayName,
    initials: stored.initials,
    area: fallbackLocation2 ? locationLabel(fallbackLocation2) : stored.area,
    location: fallbackLocation2,
    role: isPrimaryAdminEmail(email) ? "admin" : stored.role,
    accountType: normalizeAccountType(stored.accountType || "resident"),
    accountStatus: stored.accountStatus || "active",
    companyName: stored.companyName || "",
    companyPurpose: stored.companyPurpose || "",
    companyStatus: stored.companyStatus || (stored.accountType === "company" ? "pending" : "none"),
    municipalityName: stored.municipalityName || "",
    municipalityDepartment: stored.municipalityDepartment || "",
    municipalityWebsite: stored.municipalityWebsite || "",
    municipalityStatus: stored.municipalityStatus || (stored.accountType === "municipality" ? "pending" : "none"),
    adminScopeArea: stored.adminScopeArea || "",
    verified: Boolean(stored.verified),
    verificationStatus: stored.verificationStatus || "none",
    verificationLabel: stored.verificationLabel || (stored.verified ? "Verifiziert" : ""),
    titleVisible: stored.titleVisible ?? true,
    titlePreset: stored.titlePreset || "auto",
    titleGrants: normalizeTitleGrants(stored.titleGrants),
    onboarding: normalizeOnboardingState(stored.onboarding)
  };
  saveLocalSession(user);
  resetAccountSession(user.uid, "local");
  authState = { ready: true, mode: "local", user, error: "" };
  applyAuthenticatedUser(user);
}
async function registerWithLocalAuth(data) {
  const email = normalizeEmail(data.email);
  const password = String(data.password || "");
  const displayName = String(data.displayName || "").trim();
  const location2 = buildLocation(data.cantonBfsCode, data.municipalityBfsCode);
  const inviteCode = validateInviteCode(data.inviteCode);
  const accountType = normalizeAccountType(data.accountType);
  const companyName = String(data.companyName || "").trim();
  const companyPurpose = String(data.companyPurpose || "").trim();
  const municipalityDepartment = String(data.municipalityDepartment || "").trim();
  const municipalityWebsite = String(data.municipalityWebsite || "").trim();
  if (!email || !displayName || !password) throw new Error("Name, E-Mail und Passwort sind erforderlich.");
  if (!email.includes("@")) throw new Error("Bitte eine g\xFCltige E-Mail-Adresse eingeben.");
  if (password.length < 8) throw new Error("Das Passwort muss mindestens 8 Zeichen haben.");
  if (!location2) throw new Error("Bitte Kanton und Gemeinde/Ort ausw\xE4hlen.");
  if (accountType === "company" && companyName.length < 2) throw new Error("F\xFCr Firmenkonten bitte Firmennamen angeben.");
  if (accountType === "municipality" && municipalityDepartment.length < 2) throw new Error("F\xFCr Gemeindekonten bitte Abteilung oder Funktion angeben.");
  const users = loadLocalUsers();
  if (users[email]) throw new Error("F\xFCr diese E-Mail existiert bereits ein Konto.");
  const user = {
    uid: uid("user"),
    email,
    displayName,
    initials: initialsFromName(displayName),
    area: locationLabel(location2),
    location: location2,
    role: isPrimaryAdminEmail(email) ? "admin" : inviteRole(inviteCode),
    accountType,
    accountStatus: accountType === "municipality" && !isPrimaryAdminEmail(email) ? "pending_verification" : "active",
    companyName: accountType === "company" ? companyName : "",
    companyPurpose: accountType === "company" ? companyPurpose : "",
    companyStatus: accountType === "company" ? "pending" : "none",
    municipalityName: accountType === "municipality" ? location2.municipalityName : "",
    municipalityDepartment: accountType === "municipality" ? municipalityDepartment : "",
    municipalityWebsite: accountType === "municipality" ? municipalityWebsite : "",
    municipalityStatus: accountType === "municipality" && !isPrimaryAdminEmail(email) ? "pending" : accountType === "municipality" ? "verified" : "none",
    adminScopeArea: "",
    verified: accountType === "municipality" && isPrimaryAdminEmail(email),
    verificationStatus: accountType === "municipality" ? isPrimaryAdminEmail(email) ? "verified" : "pending" : "none",
    verificationLabel: accountType === "municipality" && isPrimaryAdminEmail(email) ? "Gemeinde" : "",
    titleVisible: true,
    titlePreset: "auto",
    titleGrants: [],
    onboarding: normalizeOnboardingState()
  };
  users[email] = { ...user, passwordHash: await sha256(`${email}:${password}`), createdAt: nowIso() };
  saveLocalUsers(users);
  saveLocalSession(user);
  resetAccountSession(user.uid, "local");
  authState = { ready: true, mode: "local", user, error: "" };
  applyAuthenticatedUser(user);
}
async function handleAuthSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = event.submitter || form.querySelector('button[type="submit"]');
  const authProvider = submit?.dataset?.authProvider || "google";
  const errorNode = byId("authError");
  const data = Object.fromEntries(new FormData(form));
  submit.disabled = true;
  if (errorNode) {
    errorNode.textContent = "";
    errorNode.classList.remove("critical");
  }
  try {
    if (authState.mode === "firebase") {
      if (!firebaseAuthApi) throw new Error("Firebase-Anmeldung ist momentan nicht verf\xFCgbar. Bitte verbinde dich erneut.");
      if (authProvider === "email") {
        if (authMode === "register") {
          if (authState.needsProfileCompletion && firebaseAuthApi.auth.currentUser?.emailVerified) {
            savePendingGoogleRegistration({ ...registrationFieldsFromForm(data), provider: "password", email: firebaseAuthApi.auth.currentUser.email });
            emailAuthNotice = "";
            await firebaseProfileRetryHandler?.();
          } else await registerWithFirebaseEmail(data);
        } else await loginWithFirebaseEmail(data);
      } else {
        if (authMode === "register") savePendingGoogleRegistration(registrationFieldsFromForm(data));
        await signInWithGoogleFlow();
      }
    } else if (authMode === "register") {
      await registerWithLocalAuth(data);
    } else {
      await signInWithLocalAuth(data);
    }
    if (authState.mode === "firebase") {
      if (authProvider === "google") toast("Google-Anmeldung wird abgeschlossen. Profil wird geladen.");
      else if (authMode === "login") toast("E-Mail-Anmeldung wird gepr\xFCft.");
    } else {
      toast(authMode === "register" ? "Konto erstellt und angemeldet." : "Angemeldet.");
      setRoute("home");
    }
  } catch (error) {
    const originalMessage = authProvider === "email" ? readableEmailAuthError(error) : error.message || "Anmeldung fehlgeschlagen.";
    const unregisteredGoogle = String(originalMessage).toLowerCase().includes("noch nicht registriert");
    const finalMessage = unregisteredGoogle ? "Dieses Google-Konto hat noch kein Quartinaut-Profil. Bitte Name und Gemeinde erfassen und dann mit Google fortfahren." : originalMessage;
    if (authProvider === "google" && (!unregisteredGoogle || authMode !== "register")) clearPendingGoogleRegistration();
    if (errorNode) {
      errorNode.textContent = finalMessage;
      errorNode.classList.toggle("critical", unregisteredGoogle);
    }
    if (unregisteredGoogle) {
      authMode = "register";
      render();
      requestAnimationFrame(() => {
        const nextErrorNode = byId("authError");
        if (nextErrorNode) {
          nextErrorNode.textContent = finalMessage;
          nextErrorNode.classList.add("critical");
        }
      });
      toast("Bitte Profil fertig erfassen.");
    }
  } finally {
    submit.disabled = false;
  }
}
async function signOutCurrentUser() {
  if (authState.mode === "firebase" && firebaseAuthApi) {
    await firebaseAuthApi.signOut(firebaseAuthApi.auth);
  }
  clearPendingGoogleRegistration();
  clearLoginAttempt();
  resetAccountSession("", authState.mode);
  saveLocalSession(null);
  hubState.stats = null;
  authState = { ...authState, user: null, ready: true };
  authMode = "register";
  render();
  toast("Abgemeldet.");
}
function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}
function cssEscape(value = "") {
  if (window.CSS?.escape) return CSS.escape(String(value));
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}
function iconSvg(name, className = "touch-icon") {
  const icons = {
    location: '<path d="M12 22s7-7.2 7-12a7 7 0 0 0-14 0c0 4.8 7 12 7 12Z"/><circle cx="12" cy="10" r="2.6"/>',
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>',
    bulletin: '<path d="M5 6h14"/><path d="M5 12h14"/><path d="M5 18h10"/>',
    alert: '<path d="M12 4 3.5 19h17L12 4Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    profile: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
    help: '<path d="M9.5 9a2.7 2.7 0 1 1 4.35 2.1c-.97.69-1.85 1.35-1.85 2.65"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9"/>',
    logout: '<path d="M10 6H6v12h4"/><path d="M14 8l4 4-4 4"/><path d="M18 12H9"/>',
    heart: '<path d="M20.8 8.5c0 4.3-8.8 10.9-8.8 10.9S3.2 12.8 3.2 8.5a5.1 5.1 0 0 1 8.8-3.3 5.1 5.1 0 0 1 8.8 3.3Z"/>',
    bookmark: '<path d="M6 3h12v18l-6-4-6 4V3Z"/>',
    share: '<path d="M12 16V3m0 0L7 8m5-5 5 5"/><path d="M5 13v7h14v-7"/>',
    chat: '<path d="M4 5.5h16v10H8l-4 3v-13Z"/><path d="M8 9h8"/><path d="M8 12h5"/>',
    bell: '<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    bellOff: '<path d="m3 3 18 18"/><path d="M9.7 4.5A6 6 0 0 1 18 10c0 1.4.13 2.5.34 3.38"/><path d="M6.34 13.38C6.13 12.5 6 11.4 6 10a6 6 0 0 1 .78-2.95"/><path d="M4 16h12"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m6 6 1 16h10l1-16"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    restore: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v6h6"/><path d="M12 7v5l3 2"/>',
    edit: '<path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
    translate: '<path d="M4 5h9"/><path d="M9 3v2"/><path d="M6 9c1.1 2.4 3.1 4 6 5"/><path d="M12 5c-.6 4.4-3 7.3-7 9"/><path d="M13 19l4-9 4 9"/><path d="M15 15h4"/>',
    download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    need: '<path d="M12 5v14"/><path d="M5 12h14"/><circle cx="12" cy="12" r="9"/>',
    offer: '<path d="M4 12h5l2-3 4 6 2-3h3"/><path d="M5 19h14"/><path d="M7 5h10"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    moon: '<path d="M20 14.5A7.7 7.7 0 0 1 9.5 4 7.8 7.8 0 1 0 20 14.5Z"/>',
    system: '<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M8 21h8"/><path d="M12 16v5"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>'
  };
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${icons[name] || icons.help}</svg>`;
}
function storedThemeChoice() {
  const old = localStorage.getItem(THEME_KEY);
  const value = old === "white" ? "light" : old === "amoled" ? "dark" : old;
  return ["light", "dark", "green", "red", "white", "amoled", "system"].includes(value) ? value : "system";
}
function systemPrefersDark() {
  return Boolean(window.matchMedia?.("(prefers-color-scheme: dark)").matches);
}
function resolvedTheme(choice = storedThemeChoice()) {
  if (choice === "amoled") return "dark";
  if (choice === "white") return "light";
  if (["dark", "light", "green", "red"].includes(choice)) return choice;
  return systemPrefersDark() ? "dark" : "light";
}
function themeLabel(choice = storedThemeChoice()) {
  return { system: "Automatisch \xB7 System", light: "Hell \xB7 Weiss", green: "Gr\xFCn \xB7 Quartinaut", dark: "Dunkel \xB7 Tiefschwarz", red: "Schweiz \xB7 Wappenrot", white: "Hell \xB7 Weiss", amoled: "Dunkel \xB7 Tiefschwarz" }[choice] || "Wie auf dem Ger\xE4t";
}
function themeIcon(choice = storedThemeChoice()) {
  if (choice === "dark" || choice === "amoled") return "moon";
  if (choice === "light" || choice === "white") return "sun";
  return "system";
}
function updateThemeMeta(activeTheme = resolvedTheme()) {
  const choice = storedThemeChoice();
  const themeColor = { light: "#ffffff", white: "#ffffff", dark: "#030504", amoled: "#030504", green: "#173e31", red: "#d52b1e" }[activeTheme] || "#ffffff";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColor);
}
function updateThemeControls(choice = storedThemeChoice()) {
  const quick = byId("qn-theme");
  if (quick) quick.value = choice;
  const button = byId("themeButton");
  if (button) {
    button.innerHTML = iconSvg(themeIcon(choice));
    button.setAttribute("aria-label", `Darstellung wechseln. Aktuell: ${themeLabel(choice)}`);
    button.setAttribute("title", `Darstellung: ${themeLabel(choice)}`);
  }
  const select = byId("themeChoiceSelect");
  if (select) select.value = choice;
  const profileSelect = byId("v41ThemeSelect");
  if (profileSelect) profileSelect.value = choice;
}
function applyTheme(choice = storedThemeChoice()) {
  const normalized = ["light", "dark", "green", "red", "white", "amoled", "system"].includes(choice) ? choice : "system";
  document.documentElement.dataset.themeChoice = normalized;
  document.documentElement.dataset.theme = normalized === "white" ? "light" : normalized === "amoled" ? "dark" : normalized === "system" ? resolvedTheme("system") : normalized;
  updateThemeMeta(resolvedTheme(normalized));
  updateThemeControls(normalized);
}
function setThemeChoice(choice, options = {}) {
  const normalized = ["light", "dark", "green", "red", "white", "amoled", "system"].includes(choice) ? choice : "system";
  localStorage.setItem(THEME_KEY, normalized);
  applyTheme(normalized);
  if (options.notify) toast(`Darstellung: ${themeLabel(normalized)}`);
}
function cycleThemeChoice() {
  const current = storedThemeChoice();
  const choices = ["system", "light", "green", "dark", "red"];
  const next = choices[(choices.indexOf(current) + 1) % choices.length];
  setThemeChoice(next, { notify: true });
}
function themeOptionsHtml() {
  const current = storedThemeChoice();
  return ["system", "light", "green", "dark", "red"].map((choice) => `<option value="${choice}" ${current === choice ? "selected" : ""}>${themeLabel(choice)}</option>`).join("");
}
var systemThemeQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
systemThemeQuery?.addEventListener?.("change", () => {
  if (storedThemeChoice() === "system") applyTheme("system");
});
function formatNumber(value) {
  return Number(value || 0).toLocaleString("de-CH");
}
function formatFileSize(bytes = 0) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return "0 KB";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
function formatDate(value = "") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unbekannt";
  return date.toLocaleString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
var I18N_LABELS = {
  de: "Deutsch",
  fr: "Fran\xE7ais",
  it: "Italiano"
};
var I18N_TEXT = {
  fr: {
    "Was brauchst du?": "De quoi as-tu besoin ?",
    "Lokale Nachbarschaftshilfe und Beitr\xE4ge aus deiner Gemeinde \u2013 Fotos, Kommentare und private Nachrichten.": "Entraide de voisinage et publications de ta commune : photos, commentaires et messages priv\xE9s.",
    "lokal \xB7 einfach \xB7 hilfreich": "local \xB7 simple \xB7 utile",
    "Ich brauche Hilfe": "J\u2019ai besoin d\u2019aide",
    "Ich biete Hilfe": "Je propose de l\u2019aide",
    "Lokale Alarme": "Alertes locales",
    "Startseite anpassen": "Personnaliser l\u2019accueil",
    "Zur\xFCcksetzen": "R\xE9initialiser",
    "Ausgeblendet": "Masqu\xE9",
    "Ausblenden": "Masquer",
    "Einklappen": "R\xE9duire",
    "Aufklappen": "D\xE9velopper",
    "Kennzahlen": "Indicateurs",
    "Relevante Anliegen": "Demandes pertinentes",
    "Live-Kantonskarte": "Carte cantonale en direct",
    "Firmen / Arbeit": "Entreprises / Emploi",
    "So funktioniert Quartinaut": "Fonctionnement de Quartinaut",
    "offene Anliegen": "demandes ouvertes",
    "aktive Vermittlungen": "mises en relation actives",
    "aktive Alarme": "alertes actives",
    "erledigt/archiviert": "termin\xE9/archiv\xE9",
    "Zum Schwarzen Brett": "Vers le tableau de quartier",
    "Noch keine offenen Anliegen. Erfasse mit \u201EIch brauche Hilfe\u201C das erste.": "Aucune demande ouverte. Cr\xE9e la premi\xE8re avec \xAB J\u2019ai besoin d\u2019aide \xBB.",
    "Schwarzes Brett": "Tableau de quartier",
    "Brett": "Tableau",
    "Kurz, konkret, lokal: Suche oder biete Hilfe. F\xFCr private Absprachen steht der Chat bereit.": "Court, concret et local : demande ou propose de l\u2019aide. Utilise la messagerie pour les accords priv\xE9s.",
    "Anliegen": "Demandes",
    "Sortiert nach Relevanz: Gebiet, Dringlichkeit, Zweck und Alter.": "Tri\xE9 par pertinence : zone, urgence, objet et \xE2ge.",
    "Neu": "Nouveau",
    "Suchbegriff eingeben": "Saisir un terme",
    "Suche": "Recherche",
    "Kategorie": "Cat\xE9gorie",
    "Typ": "Type",
    "Distanz": "Distance",
    "Alle": "Tous",
    "Biete": "Propose",
    "Filter l\xF6schen": "Supprimer le filtre",
    "Keine passenden Anliegen. Filter anpassen oder ein neues Anliegen erfassen.": "Aucune demande correspondante. Adapte le filtre ou cr\xE9e une nouvelle demande.",
    "Profil": "Profil",
    "Rolle": "R\xF4le",
    "Konto": "Compte",
    "Sprache": "Langue",
    "Erscheinungsbild": "Apparence",
    "Profil gespeichert.": "Profil enregistr\xE9.",
    "Verifizierung beantragen": "Demander la v\xE9rification",
    "Verifizierungsmethode": "M\xE9thode de v\xE9rification",
    "Gemeinderegister / Einwohnerkontrolle": "Registre communal / contr\xF4le des habitants",
    "Notiz": "Note",
    "Ausweisfoto": "Photo de pi\xE8ce d\u2019identit\xE9",
    "Standortwechsel beantragen": "Demander un changement de lieu",
    "Meine Daten exportieren": "Exporter mes donn\xE9es",
    "Konto l\xF6schen": "Supprimer le compte",
    "Abmelden": "D\xE9connexion",
    "Benachrichtigungen aktivieren": "Activer les notifications",
    "Benachrichtigungen blockiert": "Notifications bloqu\xE9es",
    "Anleitung": "Guide",
    "Pr\xFCfen": "V\xE9rifier",
    "Test senden": "Envoyer un test",
    "Push pr\xFCfen": "V\xE9rifier les notifications",
    "Chats": "Discussions",
    "Privater Direkt-Chat": "Discussion directe priv\xE9e",
    "Nachricht": "Message",
    "Nachricht schreiben": "\xC9crire un message",
    "Senden": "Envoyer",
    "Termin": "Rendez-vous",
    "Chat melden": "Signaler la discussion",
    "\xD6ffnen": "Ouvrir",
    "Stumm": "Muet",
    "Papierkorb": "Corbeille",
    "Wiederherstellen": "Restaurer",
    "Endg\xFCltig l\xF6schen": "Supprimer d\xE9finitivement",
    "Admin \xB7 Schnellzugriff": "Admin \xB7 Acc\xE8s rapide",
    "Alarm erstellen": "Cr\xE9er une alerte",
    "Code erstellen": "Cr\xE9er un code",
    "Moderation": "Mod\xE9ration",
    "Offene Antr\xE4ge": "Demandes ouvertes",
    "Einladungscodes": "Codes d\u2019invitation",
    "Admin-Auswertungen": "Statistiques admin",
    "Alle registrierten Nutzer": "Tous les utilisateurs inscrits",
    "Aktive Konten": "Comptes actifs",
    "Archiv": "Archive",
    "Suchen": "Rechercher",
    "Sortierung": "Tri",
    "Systempflege": "Maintenance syst\xE8me",
    "Kategorie-Priorit\xE4t": "Priorit\xE9 des cat\xE9gories",
    "Datenschutz": "Protection des donn\xE9es",
    "Nutzungsbedingungen": "Conditions d\u2019utilisation",
    "Impressum": "Mentions l\xE9gales",
    "Speichern": "Enregistrer",
    "Filter speichern": "Enregistrer le filtre",
    "Gespeicherten Filter laden": "Charger le filtre enregistr\xE9",
    "Sprache gespeichert.": "Langue enregistr\xE9e.",
    "Filter am Schwarzen Brett gespeichert. Passende neue Anliegen k\xF6nnen Push ausl\xF6sen.": "Filtre du tableau de quartier enregistr\xE9. Les nouvelles demandes correspondantes peuvent d\xE9clencher une notification.",
    "Gespeicherter Filter am Schwarzen Brett geladen.": "Filtre enregistr\xE9 du tableau de quartier charg\xE9.",
    "Gespeicherter Filter am Schwarzen Brett gel\xF6scht.": "Filtre enregistr\xE9 du tableau de quartier supprim\xE9.",
    "Wegleitung": "Guide",
    "Wegleitung anzeigen": "Afficher le guide",
    "\xDCberspringen": "Passer",
    "Zur\xFCck": "Retour",
    "Weiter": "Suivant",
    "Wegleitung abschliessen": "Terminer le guide",
    "Installation starten": "D\xE9marrer l\u2019installation",
    "Benachrichtigungen erlauben": "Autoriser les notifications",
    "Das digitale Schwarze Brett": "Le tableau de quartier num\xE9rique",
    "Nachrichten bleiben im 1:1-Chat": "Les messages restent dans la discussion priv\xE9e",
    "Konto erstellen": "Cr\xE9er un compte",
    "Anmelden": "Se connecter",
    "Kontotyp": "Type de compte",
    "Privatperson": "Particulier",
    "Firma": "Entreprise",
    "Gemeinde": "Commune",
    "Abteilung / Funktion": "Service / fonction",
    "Offizielle Webseite (optional)": "Site officiel (facultatif)",
    "Gemeinde freigeben": "Valider la commune",
    "Wartet auf Freigabe": "En attente de validation",
    "Dein Gemeindekonto wird gepr\xFCft.": "Ton compte communal est en cours de v\xE9rification."
  },
  it: {
    "Was brauchst du?": "Di cosa hai bisogno?",
    "Lokale Nachbarschaftshilfe und Beitr\xE4ge aus deiner Gemeinde \u2013 Fotos, Kommentare und private Nachrichten.": "Aiuto di vicinato e post del tuo comune: foto, commenti e messaggi privati.",
    "lokal \xB7 einfach \xB7 hilfreich": "locale \xB7 semplice \xB7 utile",
    "Ich brauche Hilfe": "Ho bisogno di aiuto",
    "Ich biete Hilfe": "Offro aiuto",
    "Lokale Alarme": "Allarmi locali",
    "Startseite anpassen": "Personalizza la home",
    "Zur\xFCcksetzen": "Ripristina",
    "Ausgeblendet": "Nascosto",
    "Ausblenden": "Nascondi",
    "Einklappen": "Comprimi",
    "Aufklappen": "Espandi",
    "Kennzahlen": "Indicatori",
    "Relevante Anliegen": "Richieste rilevanti",
    "Live-Kantonskarte": "Mappa cantonale live",
    "Firmen / Arbeit": "Aziende / Lavoro",
    "So funktioniert Quartinaut": "Come funziona Quartinaut",
    "offene Anliegen": "richieste aperte",
    "aktive Vermittlungen": "mediazioni attive",
    "aktive Alarme": "allarmi attivi",
    "erledigt/archiviert": "completato/archiviato",
    "Zum Schwarzen Brett": "Vai alla bacheca di quartiere",
    "Noch keine offenen Anliegen. Erfasse mit \u201EIch brauche Hilfe\u201C das erste.": "Nessuna richiesta aperta. Crea la prima con \xABHo bisogno di aiuto\xBB.",
    "Schwarzes Brett": "Bacheca di quartiere",
    "Brett": "Bacheca",
    "Kurz, konkret, lokal: Suche oder biete Hilfe. F\xFCr private Absprachen steht der Chat bereit.": "Breve, concreto e locale: cerca o offri aiuto. Per gli accordi privati usa la chat.",
    "Anliegen": "Richieste",
    "Sortiert nach Relevanz: Gebiet, Dringlichkeit, Zweck und Alter.": "Ordinato per rilevanza: zona, urgenza, scopo ed et\xE0.",
    "Neu": "Nuovo",
    "Suchbegriff eingeben": "Inserisci termine",
    "Suche": "Cerca",
    "Kategorie": "Categoria",
    "Typ": "Tipo",
    "Distanz": "Distanza",
    "Alle": "Tutti",
    "Biete": "Offro",
    "Filter l\xF6schen": "Elimina filtro",
    "Keine passenden Anliegen. Filter anpassen oder ein neues Anliegen erfassen.": "Nessuna richiesta corrispondente. Modifica il filtro o crea una nuova richiesta.",
    "Profil": "Profilo",
    "Rolle": "Ruolo",
    "Konto": "Account",
    "Sprache": "Lingua",
    "Erscheinungsbild": "Aspetto",
    "Profil gespeichert.": "Profilo salvato.",
    "Verifizierung beantragen": "Richiedi verifica",
    "Verifizierungsmethode": "Metodo di verifica",
    "Gemeinderegister / Einwohnerkontrolle": "Registro comunale / controllo abitanti",
    "Notiz": "Nota",
    "Ausweisfoto": "Foto documento",
    "Standortwechsel beantragen": "Richiedi cambio luogo",
    "Meine Daten exportieren": "Esporta i miei dati",
    "Konto l\xF6schen": "Elimina account",
    "Abmelden": "Esci",
    "Benachrichtigungen aktivieren": "Attiva notifiche",
    "Benachrichtigungen blockiert": "Notifiche bloccate",
    "Anleitung": "Guida",
    "Pr\xFCfen": "Controlla",
    "Test senden": "Invia test",
    "Push pr\xFCfen": "Controlla push",
    "Chats": "Chat",
    "Privater Direkt-Chat": "Chat diretto privato",
    "Nachricht": "Messaggio",
    "Nachricht schreiben": "Scrivi un messaggio",
    "Senden": "Invia",
    "Termin": "Appuntamento",
    "Chat melden": "Segnala chat",
    "\xD6ffnen": "Apri",
    "Stumm": "Silenzia",
    "Papierkorb": "Cestino",
    "Wiederherstellen": "Ripristina",
    "Endg\xFCltig l\xF6schen": "Elimina definitivamente",
    "Admin \xB7 Schnellzugriff": "Admin \xB7 Accesso rapido",
    "Alarm erstellen": "Crea allarme",
    "Code erstellen": "Crea codice",
    "Moderation": "Moderazione",
    "Offene Antr\xE4ge": "Richieste aperte",
    "Einladungscodes": "Codici invito",
    "Admin-Auswertungen": "Statistiche admin",
    "Alle registrierten Nutzer": "Tutti gli utenti registrati",
    "Aktive Konten": "Account attivi",
    "Archiv": "Archivio",
    "Suchen": "Cerca",
    "Sortierung": "Ordinamento",
    "Systempflege": "Manutenzione sistema",
    "Kategorie-Priorit\xE4t": "Priorit\xE0 categoria",
    "Datenschutz": "Privacy",
    "Nutzungsbedingungen": "Condizioni d\u2019uso",
    "Impressum": "Colophon",
    "Speichern": "Salva",
    "Filter speichern": "Salva filtro",
    "Gespeicherten Filter laden": "Carica filtro salvato",
    "Sprache gespeichert.": "Lingua salvata.",
    "Filter am Schwarzen Brett gespeichert. Passende neue Anliegen k\xF6nnen Push ausl\xF6sen.": "Filtro della bacheca di quartiere salvato. Le nuove richieste corrispondenti possono attivare una notifica.",
    "Gespeicherter Filter am Schwarzen Brett geladen.": "Filtro salvato della bacheca caricato.",
    "Gespeicherter Filter am Schwarzen Brett gel\xF6scht.": "Filtro salvato della bacheca eliminato.",
    "Wegleitung": "Guida",
    "Wegleitung anzeigen": "Mostra guida",
    "\xDCberspringen": "Salta",
    "Zur\xFCck": "Indietro",
    "Weiter": "Avanti",
    "Wegleitung abschliessen": "Termina guida",
    "Installation starten": "Avvia installazione",
    "Benachrichtigungen erlauben": "Consenti notifiche",
    "Das digitale Schwarze Brett": "La bacheca di quartiere digitale",
    "Nachrichten bleiben im 1:1-Chat": "I messaggi restano nella chat privata",
    "Konto erstellen": "Crea account",
    "Anmelden": "Accedi",
    "Kontotyp": "Tipo di account",
    "Privatperson": "Privato",
    "Firma": "Azienda",
    "Gemeinde": "Comune",
    "Abteilung / Funktion": "Ufficio / funzione",
    "Offizielle Webseite (optional)": "Sito ufficiale (facoltativo)",
    "Gemeinde freigeben": "Approva il comune",
    "Wartet auf Freigabe": "In attesa di approvazione",
    "Dein Gemeindekonto wird gepr\xFCft.": "Il tuo account comunale \xE8 in verifica."
  }
};
function currentLocale() {
  const stored = state.locale || localStorage.getItem("quartinaut-locale") || "";
  if (["de", "fr", "it"].includes(stored)) return stored;
  const browser = String(navigator.language || "de").slice(0, 2).toLowerCase();
  return ["de", "fr", "it"].includes(browser) ? browser : "de";
}
function localeOptionsHtml(selected = currentLocale()) {
  return Object.entries(I18N_LABELS).map(([code, label]) => `<option value="${code}" ${code === selected ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
}
function setLocale(locale = "de") {
  const safe = ["de", "fr", "it"].includes(locale) ? locale : "de";
  state.locale = safe;
  localStorage.setItem("quartinaut-locale", safe);
  document.documentElement.lang = safe;
  saveState();
}
var V46_I18N = {
  fr: { "Globale Suche": "Recherche globale", "Suchbegriff": "Terme recherch\xE9", "Beitr\xE4ge": "Publications", "Angebote": "Offres", "Vereine": "Associations", "Personen": "Personnes", "Anl\xE4sse": "\xC9v\xE9nements", "Gemeinde": "Commune", "Nur meine Gemeinde": "Uniquement ma commune", "Alle": "Tous", "Mitteilungen": "Notifications", "Ungelesen": "Non lus", "Ausleihen": "Pr\xEAts", "Weitere": "Autres", "Meine Favoriten": "Mes favoris", "Favoriten": "Favoris", "Suchanfragen": "Recherches enregistr\xE9es", "Entw\xFCrfe": "Brouillons", "Meine Entw\xFCrfe": "Mes brouillons", "Entw\xFCrfe verwalten": "G\xE9rer les brouillons", "Entw\xFCrfe \xF6ffnen": "Ouvrir les brouillons", "Weiterbearbeiten": "Continuer", "Verwerfen": "Supprimer", "Nur Fotos": "Photos uniquement", "Meine Gemeinde": "Ma commune", "Seit letztem Besuch": "Depuis ma derni\xE8re visite", "Alle Favoriten \xF6ffnen": "Voir tous les favoris", "Suchen": "Rechercher", "Suche": "Recherche", "Karte": "Carte", "Quartierkarte": "Carte du quartier", "Vereinsprofil": "Profil de l\u2019association", "Merken": "Enregistrer", "Entfernen": "Supprimer", "\xD6ffnen": "Ouvrir", "\xDCbergabe & R\xFCckgabe im Kalender": "Remise et retour dans le calendrier", "Kalenderdatei herunterladen": "T\xE9l\xE9charger un calendrier" },
  it: { "Globale Suche": "Ricerca globale", "Suchbegriff": "Termine di ricerca", "Beitr\xE4ge": "Pubblicazioni", "Angebote": "Offerte", "Vereine": "Associazioni", "Personen": "Persone", "Anl\xE4sse": "Eventi", "Gemeinde": "Comune", "Nur meine Gemeinde": "Solo il mio comune", "Alle": "Tutti", "Mitteilungen": "Notifiche", "Ungelesen": "Non letti", "Ausleihen": "Prestiti", "Weitere": "Altro", "Meine Favoriten": "I miei preferiti", "Favoriten": "Preferiti", "Suchanfragen": "Ricerche salvate", "Entw\xFCrfe": "Bozze", "Meine Entw\xFCrfe": "Le mie bozze", "Entw\xFCrfe verwalten": "Gestisci le bozze", "Entw\xFCrfe \xF6ffnen": "Apri le bozze", "Weiterbearbeiten": "Continua", "Verwerfen": "Elimina", "Nur Fotos": "Solo foto", "Meine Gemeinde": "Il mio comune", "Seit letztem Besuch": "Dall\u2019ultima visita", "Alle Favoriten \xF6ffnen": "Vedi i preferiti", "Suchen": "Cerca", "Suche": "Ricerca", "Karte": "Mappa", "Quartierkarte": "Mappa del quartiere", "Vereinsprofil": "Profilo dell\u2019associazione", "Merken": "Salva", "Entfernen": "Rimuovi", "\xD6ffnen": "Apri", "\xDCbergabe & R\xFCckgabe im Kalender": "Consegna e restituzione nel calendario", "Kalenderdatei herunterladen": "Scarica evento calendario" }
};
function translateText(value) {
  const locale = currentLocale();
  if (locale === "de") return value;
  const dictionary = I18N_TEXT[locale] || {};
  const raw = String(value || "");
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  const translated = V46_I18N[locale]?.[trimmed] || dictionary[trimmed];
  if (!translated) return raw;
  return raw.replace(trimmed, translated);
}
function applyI18n(root = document) {
  const locale = currentLocale();
  document.documentElement.lang = locale;
  if (locale === "de") return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || ["SCRIPT", "STYLE", "TEXTAREA"].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
      return node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    node.nodeValue = translateText(node.nodeValue);
  });
  root.querySelectorAll?.("[placeholder], [title], [aria-label]").forEach((el) => {
    ["placeholder", "title", "aria-label"].forEach((attr) => {
      if (el.hasAttribute(attr)) el.setAttribute(attr, translateText(el.getAttribute(attr)));
    });
  });
}
function dynamicTextTranslateButton(kind, id, label = "\xDCbersetzen") {
  return `<button class="ghost-button small translate-button" type="button" data-action="translate-dynamic" data-translate-kind="${escapeHtml(kind)}" data-translate-id="${escapeHtml(id)}">${iconSvg("translate")} ${escapeHtml(label)}</button>`;
}
function isEditCardOpen(cardId = "") {
  return editCards.has(cardId);
}
function setEditCardOpen(cardId = "", open = true) {
  if (!cardId) return;
  if (open) editCards.add(cardId);
  else editCards.delete(cardId);
  render();
  if (open) {
    requestAnimationFrame(() => {
      const escaped = cssEscape(cardId);
      document.querySelector(`[data-edit-card="${escaped}"] input, [data-edit-card="${escaped}"] select, [data-edit-card="${escaped}"] textarea, [data-edit-card="${escaped}"] button`)?.focus();
    });
  }
}
function editCardHeader(title, cardId, editing = isEditCardOpen(cardId)) {
  return `
    <div class="request-head edit-card-head">
      <h2>${escapeHtml(title)}</h2>
      <button class="icon-button small" type="button" data-action="toggle-edit-card" data-edit-card-id="${escapeHtml(cardId)}" aria-label="${escapeHtml(title)} bearbeiten" aria-expanded="${editing ? "true" : "false"}" title="${editing ? "Bearbeitung schliessen" : "Bearbeiten"}">
        ${iconSvg("edit")}
      </button>
    </div>
  `;
}
function dynamicTextForTranslation(kind = "", id = "") {
  if (kind === "request") {
    const req = state.requests.find((item) => item.id === id);
    if (!req) return null;
    return {
      title: req.title || "Anliegen",
      text: [req.title, req.text].filter(Boolean).join("\n\n"),
      source: "Eintrag am Schwarzen Brett"
    };
  }
  if (kind === "chat-message") {
    const msg = state.chatMessages.find((item) => item.id === id);
    if (!msg) return null;
    return {
      title: "Chat-Nachricht",
      text: msg.text || "",
      source: "Privater Chat"
    };
  }
  return null;
}
function translateTargetLanguage() {
  const locale = currentLocale();
  return ["de", "fr", "it"].includes(locale) ? locale : "de";
}
function googleTranslateUrl(text = "") {
  const target = translateTargetLanguage();
  return `https://translate.google.com/?sl=auto&tl=${encodeURIComponent(target)}&text=${encodeURIComponent(text.slice(0, 5e3))}&op=translate`;
}
function openDynamicTranslateModal(kind = "", id = "") {
  const item = dynamicTextForTranslation(kind, id);
  if (!item || !item.text.trim()) {
    toast("Kein \xFCbersetzbarer Text gefunden.");
    return;
  }
  openModal("Text \xFCbersetzen", `
    <section class="form-grid">
      <div class="card compact soft">
        <strong>${escapeHtml(item.source)}</strong>
        <p class="help">Dieser Text wird nicht automatisch an Drittanbieter gesendet. Erst mit \u201EExtern \xFCbersetzen\u201C \xF6ffnest du Google Translate in einem neuen Tab.</p>
      </div>
      <label>Originaltext
        <textarea readonly rows="8">${escapeHtml(item.text)}</textarea>
      </label>
      <div class="row-actions">
        <a class="primary-button" href="${escapeHtml(googleTranslateUrl(item.text))}" target="_blank" rel="noopener noreferrer">${iconSvg("translate")} Extern \xFCbersetzen</a>
        <button class="secondary-button" type="button" data-action="copy-translate-text">${iconSvg("check")} Text kopieren</button>
      </div>
    </section>
  `, (modal) => {
    modal.querySelector('[data-action="copy-translate-text"]')?.addEventListener("click", () => {
      navigator.clipboard?.writeText(item.text).then(() => toast("Text kopiert.")).catch(() => toast("Kopieren nicht m\xF6glich."));
    });
  });
}
function fmtTime(iso) {
  const d = new Date(iso);
  const today = /* @__PURE__ */ new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay ? d.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" });
}
function relative(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.max(1, Math.round(diff / 6e4));
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  return `vor ${Math.round(h / 24)} Tg.`;
}
function expiryLabel(iso) {
  if (!iso) return "";
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "l\xE4uft ab";
  const h = Math.round(diff / 36e5);
  if (h < 1) return "l\xE4uft in <1 Std. ab";
  if (h < 24) return `l\xE4uft in ${h} Std. ab`;
  return `l\xE4uft in ${Math.round(h / 24)} Tg. ab`;
}
function toast(message) {
  const node = byId("toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => node.classList.remove("show"), 2600);
}
function setRoute(route) {
  if (!VALID_ROUTES.includes(route)) route = "home";
  if (["bulletin", "hub"].includes(state.route) && !["bulletin", "hub"].includes(route)) v46PrefsUpdate({ bulletinLastSeenAt: nowIso() });
  if (route !== "profile") dashboardEditing = false;
  if (state.route !== route) {
    const url = new URL(location.href);
    url.searchParams.set("route", route);
    history.pushState({ quartinaut: true }, "", url);
  }
  state.route = route;
  saveState();
  render();
  if (["hub", "search", "map", "saved"].includes(route) && !hubState.loaded && !hubState.loading) void loadHub();
  nativeWeb?.entered(route);
  if (route === "search" && authState.user && !v47SearchState.loading && !v47SearchState.rows.length) void v47LoadSearch(0);
  byId("main")?.focus();
}
function isInstalledPwa() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
}
function isRegularBrowserMode() {
  return !isInstalledPwa();
}
function notificationPermissionState() {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}
function openNotificationBlockedHelpModal() {
  const isAndroid = /android/i.test(navigator.userAgent || "");
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent || "");
  const platformHint = isAndroid ? `
      <li>Chrome \xF6ffnen und auf <strong>quartinaut.web.app</strong> gehen.</li>
      <li>Auf das Schloss-Symbol oder die Seiteninfos tippen.</li>
      <li><strong>Website-Einstellungen \u2192 Benachrichtigungen \u2192 Zulassen</strong>.</li>
      <li>Seite neu laden und in Quartinaut auf <strong>\u201EBenachrichtigungen aktivieren\u201C</strong> tippen.</li>
    ` : isIOS ? `
      <li>Safari/Browser-Einstellungen \xF6ffnen.</li>
      <li>Benachrichtigungen f\xFCr den Browser und die Website erlauben.</li>
      <li>Quartinaut neu \xF6ffnen und erneut auf <strong>\u201EBenachrichtigungen aktivieren\u201C</strong> tippen.</li>
    ` : `
      <li>Browser-Men\xFC \xF6ffnen (\u22EE oder \u2261).</li>
      <li><strong>Einstellungen \u2192 Datenschutz/Sicherheit \u2192 Website-Einstellungen \u2192 Benachrichtigungen</strong>.</li>
      <li><strong>quartinaut.web.app</strong> auf <strong>Zulassen</strong> stellen.</li>
      <li>Seite neu laden und in Quartinaut auf <strong>\u201EBenachrichtigungen aktivieren\u201C</strong> tippen.</li>
    `;
  openModal("Benachrichtigungen sind blockiert", `
    <section class="form-grid legal-copy">
      <p>Der Browser blockiert Benachrichtigungen aktuell. Solange der Status auf \u201EBlockiert\u201C steht, kann Quartinaut die Freigabe nicht erneut selbst \xF6ffnen.</p>
      <ol class="help-list">
        ${platformHint}
      </ol>
      <div class="row-actions legal-shortcuts">
        <button class="secondary-button small" type="button" data-action="notification-retry-enable">Erneut aktivieren</button>
      </div>
    </section>
  `, (modal) => {
    modal.querySelector('[data-action="notification-retry-enable"]')?.addEventListener("click", () => runAsyncAction(enableNotifications));
  });
}
function renderNotificationPermissionBanner() {
  const banner2 = byId("permissionBanner");
  if (!banner2) return;
  const blocked = notificationPermissionState() === "denied";
  if (!blocked) localStorage.removeItem(NOTIFICATION_BANNER_DISMISSED_KEY);
  const dismissed = localStorage.getItem(NOTIFICATION_BANNER_DISMISSED_KEY) === "1";
  const show = blocked && Boolean(authState.user) && !isAccountPendingApproval() && isRegularBrowserMode() && ["alarme", "profile"].includes(state.route) && !dismissed;
  document.body.classList.toggle("has-permission-banner", show);
  if (!show) {
    banner2.hidden = true;
    banner2.innerHTML = "";
    return;
  }
  banner2.hidden = false;
  banner2.innerHTML = `
    <section class="permission-banner-card" role="alert" aria-live="assertive">
      <div class="permission-banner-copy">
        <strong>${iconSvg("bell")} Benachrichtigungen blockiert</strong>
        <span>In den Website-Einstellungen auf \u201EZulassen\u201C stellen.</span>
      </div>
      <div class="permission-banner-actions">
        <button class="ghost-button small" type="button" data-action="notification-help">${iconSvg("help")} Anleitung</button>
        <button class="secondary-button small" type="button" data-action="notification-check">${iconSvg("check")} Pr\xFCfen</button>
        <button class="icon-button permission-banner-dismiss" type="button" data-action="notification-dismiss" aria-label="Hinweis ausblenden">\xD7</button>
      </div>
    </section>
  `;
  banner2.querySelector('[data-action="notification-help"]')?.addEventListener("click", () => openNotificationBlockedHelpModal());
  banner2.querySelector('[data-action="notification-check"]')?.addEventListener("click", () => {
    if (notificationPermissionState() === "granted") {
      runAsyncAction(enableNotifications);
      return;
    }
    renderNotificationPermissionBanner();
    toast("Benachrichtigungen sind weiterhin blockiert.");
  });
  banner2.querySelector('[data-action="notification-dismiss"]')?.addEventListener("click", () => {
    localStorage.setItem(NOTIFICATION_BANNER_DISMISSED_KEY, "1");
    renderNotificationPermissionBanner();
  });
}
async function resolveNotificationRegistration() {
  if (!("serviceWorker" in navigator)) return null;
  if (messagingWorkerRegistration) return messagingWorkerRegistration;
  const fcmScoped = await navigator.serviceWorker.getRegistration("/firebase-cloud-messaging-push-scope/").catch((error) => reportBackgroundError("FCM-Service-Worker pr\xFCfen", error));
  if (fcmScoped) return fcmScoped;
  const anyRegistration = await navigator.serviceWorker.getRegistration().catch((error) => reportBackgroundError("Service-Worker pr\xFCfen", error));
  if (anyRegistration) return anyRegistration;
  return navigator.serviceWorker.ready.catch((error) => reportBackgroundError("Service-Worker bereitstellen", error));
}
async function showSystemNotification(title, body, extra = {}) {
  if (!("Notification" in window) || Notification.permission !== "granted") return false;
  const options = {
    body,
    icon: APP_ICON_192,
    badge: APP_ICON_192,
    tag: "quartinaut-local-notification",
    renotify: true,
    ...extra
  };
  const registration = await resolveNotificationRegistration();
  if (registration?.showNotification) {
    await registration.showNotification(title, options);
    return true;
  }
  new Notification(title, options);
  return true;
}
async function tryShowSystemNotification(title, body, extra = {}) {
  try {
    return { shown: await showSystemNotification(title, body, extra), error: "" };
  } catch (error) {
    return {
      shown: false,
      error: error?.message || String(error || "Unbekannter Fehler")
    };
  }
}
function percentage(value, total) {
  if (!total) return 0;
  return Math.round(Number(value) / Number(total) * 1e3) / 10;
}
function baseMunicipalityName(areaLabel = "") {
  return String(areaLabel || "").split(" (")[0].trim();
}
function normalizeAreaKey(areaLabel = "") {
  return String(areaLabel || "").trim().toLowerCase().replace(/\s+/g, " ");
}
function categoryPriority(area = state.profile.area) {
  const areaName = baseMunicipalityName(area);
  const record = state.areaCategoryPriority.find((item) => String(item.areaName) === areaName);
  return record?.priority || [];
}
function cantonCodeFromArea(areaLabel = "") {
  const match = String(areaLabel || "").match(/\(([^)]+)\)\s*$/);
  return match?.[1] ? String(match[1]).trim().toUpperCase() : "";
}
function cantonCodeForLocation(locationLike = {}) {
  if (typeof locationLike === "string") return cantonCodeFromArea(locationLike);
  const normalizedLocation = sanitizeLocation(locationLike);
  if (normalizedLocation?.cantonCode) return String(normalizedLocation.cantonCode).toUpperCase();
  if (locationLike?.cantonCode) return String(locationLike.cantonCode).trim().toUpperCase();
  return cantonCodeFromArea(locationLike?.area || "");
}
function userCantonCode(user = {}) {
  const normalizedLocation = sanitizeLocation(user.location);
  if (normalizedLocation?.cantonCode) return String(normalizedLocation.cantonCode).toUpperCase();
  return cantonCodeFromArea(user.area);
}
function registeredUsersForStats() {
  const users = isFirebaseMode() ? Array.isArray(state.registeredUsers) ? state.registeredUsers : [] : Object.values(loadLocalUsers()).map((entry) => ({ ...entry }));
  return users.filter((user) => !isArchivedUser(user));
}
function emptyCantonCounts() {
  const dynamicCodes = cantons().map((canton) => String(canton.code || "").toUpperCase()).filter(Boolean);
  const allCodes = [.../* @__PURE__ */ new Set([...SWISS_CANTON_CODES, ...dynamicCodes])];
  return Object.fromEntries(allCodes.map((code) => [code, 0]));
}
function sanitizeCantonCounts(raw = {}) {
  const normalized = emptyCantonCounts();
  for (const [code, value] of Object.entries(raw || {})) {
    const key = String(code || "").trim().toUpperCase();
    if (!key) continue;
    const count = Number(value || 0);
    normalized[key] = Number.isFinite(count) && count > 0 ? Math.round(count) : 0;
  }
  return normalized;
}
function cantonRegistrationCounts() {
  if (isFirebaseMode() && !isAdminRole()) {
    return sanitizeCantonCounts(state.publicStats?.cantonCounts || {});
  }
  const counts = emptyCantonCounts();
  for (const user of registeredUsersForStats()) {
    const code = userCantonCode(user);
    if (!code) continue;
    if (!(code in counts)) counts[code] = 0;
    counts[code] += 1;
  }
  return counts;
}
function totalRegisteredUsersFromCounts(counts = {}) {
  return Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
}
function swissMapFillColor(count, maxCount) {
  if (count <= 0) return "#dfe4e1";
  const intensity = maxCount > 0 ? Math.max(0, Math.min(1, count / maxCount)) : 1;
  if (intensity <= 0.2) return "#bddfc6";
  if (intensity <= 0.45) return "#8ec9a4";
  if (intensity <= 0.7) return "#5da77e";
  return "#2f6f4f";
}
async function loadSwissMapSvgTemplate() {
  if (swissMapSvgTemplate) return swissMapSvgTemplate;
  if (swissMapSvgPromise) return swissMapSvgPromise;
  swissMapSvgPromise = fetch("./assets/icons/quartinaut-logo.svg", { cache: "force-cache" }).then((response) => {
    if (!response.ok) throw new Error("SVG konnte nicht geladen werden");
    return response.text();
  }).then((svgText) => {
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    const source = doc.querySelector("svg");
    if (!source) throw new Error("Kein SVG gefunden");
    const ns = "http://www.w3.org/2000/svg";
    const clean2 = document.createElementNS(ns, "svg");
    const viewBox = source.getAttribute("viewBox") || "0 0 1024 1024";
    clean2.setAttribute("viewBox", viewBox);
    clean2.setAttribute("preserveAspectRatio", "xMidYMid meet");
    clean2.classList.add("swiss-map-svg");
    const mapLayer = document.createElementNS(ns, "g");
    mapLayer.setAttribute("class", "canton-layer");
    for (const code of SWISS_CANTON_CODES) {
      const path = source.querySelector(`#${code}`);
      if (!path) continue;
      const clone = path.cloneNode(true);
      clone.removeAttribute("style");
      mapLayer.appendChild(clone);
    }
    clean2.appendChild(mapLayer);
    swissMapSvgTemplate = clean2;
    return clean2;
  }).catch((error) => reportBackgroundError("Schweizer Karte laden", error)).finally(() => {
    swissMapSvgPromise = null;
  });
  return swissMapSvgPromise;
}
async function hydrateSwissMapVisual() {
  const host = document.querySelector("[data-swiss-map]");
  if (!host) return;
  const counts = cantonRegistrationCounts();
  const cacheKey = JSON.stringify(SWISS_CANTON_CODES.map((code) => [code, Number(counts[code] || 0)]));
  if (swissMapRenderedCache && swissMapRenderedCacheKey === cacheKey) {
    host.innerHTML = "";
    host.appendChild(swissMapRenderedCache.cloneNode(true));
    mountSwissMapExplorer(host, { cantons: cantons(), counts, ownArea: state.profile.area, goRoute: setRoute });
    return;
  }
  const template = await loadSwissMapSvgTemplate();
  if (!host.isConnected) return;
  if (!template) {
    host.innerHTML = '<p class="help">Karte konnte nicht geladen werden.</p>';
    return;
  }
  const svg = template.cloneNode(true);
  const maxCount = Math.max(0, ...Object.values(counts).map((value) => Number(value || 0)));
  const nameByCode = new Map(cantons().map((canton) => [String(canton.code || "").toUpperCase(), String(canton.name || canton.code || "")]));
  const activeCodes = [];
  const labelLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  labelLayer.setAttribute("class", "canton-label-layer");
  for (const code of SWISS_CANTON_CODES) {
    const path = svg.querySelector(`#${code}`);
    if (!path) continue;
    const count = Number(counts[code] || 0);
    if (count > 0) activeCodes.push(code);
    path.classList.add("canton-shape");
    path.style.fill = swissMapFillColor(count, maxCount);
    path.style.stroke = "rgba(4, 9, 7, 0.72)";
    path.style.strokeWidth = "0.95";
    path.style.vectorEffect = "non-scaling-stroke";
    path.setAttribute("data-code", code);
    path.setAttribute("data-count", String(count));
    path.querySelector("title")?.remove();
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = `${nameByCode.get(code) || code} (${code}): ${count}`;
    path.appendChild(title);
    let box = null;
    try {
      box = path.getBBox();
    } catch {
      box = null;
    }
    if (!box || !Number.isFinite(box.width) || !Number.isFinite(box.height) || box.width < 10 || box.height < 10) continue;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    marker.setAttribute("x", String(cx - 15));
    marker.setAttribute("y", String(cy - 13));
    marker.setAttribute("width", "30");
    marker.setAttribute("height", "26");
    marker.setAttribute("rx", "7");
    marker.setAttribute("class", `canton-label-badge ${count > 0 ? "active" : "inactive"}`);
    labelLayer.appendChild(marker);
    const codeText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    codeText.setAttribute("x", String(cx));
    codeText.setAttribute("y", String(cy - 1));
    codeText.setAttribute("class", "canton-label-code");
    codeText.textContent = code;
    labelLayer.appendChild(codeText);
    const countText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    countText.setAttribute("x", String(cx));
    countText.setAttribute("y", String(cy + 9));
    countText.setAttribute("class", "canton-label-count");
    countText.textContent = String(count);
    labelLayer.appendChild(countText);
  }
  if (host) host.dataset.activeCantons = activeCodes.join(",");
  svg.appendChild(labelLayer);
  swissMapRenderedCacheKey = cacheKey;
  swissMapRenderedCache = svg.cloneNode(true);
  host.innerHTML = "";
  host.appendChild(svg);
  mountSwissMapExplorer(host, { cantons: cantons(), counts, ownArea: state.profile.area, goRoute: setRoute });
}
function scheduleSwissMapHydration() {
  if (!document.querySelector("[data-swiss-map]")) return;
  const token = ++swissMapHydrationId;
  const run = () => {
    if (token !== swissMapHydrationId) return;
    void hydrateSwissMapVisual();
  };
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 700 });
  } else {
    window.setTimeout(run, 0);
  }
}
function orderedCategories(area = state.profile.area) {
  const priority = categoryPriority(area);
  if (!priority.length) return CATEGORIES;
  const fallback = CATEGORIES.filter((cat) => !priority.includes(cat));
  return [...priority, ...fallback];
}
function recurringBadge(req) {
  return req.recurringMode === "woechentlich" ? '<span class="badge info">W\xF6chentlich</span>' : "";
}
function escalationScore(req) {
  const level = req.escalationLevel || "keine";
  if (level === "P0") return 40;
  if (level === "P1") return 25;
  if (level === "P2") return 12;
  return 0;
}
function median(values) {
  const numbers = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!numbers.length) return 0;
  const mid = Math.floor(numbers.length / 2);
  if (numbers.length % 2) return numbers[mid];
  return Math.round((numbers[mid - 1] + numbers[mid]) / 2);
}
function formatDurationMinutes(minutes) {
  if (!minutes || minutes < 1) return "< 1 Min.";
  if (minutes < 60) return `${Math.round(minutes)} Min.`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)} Std.`;
  return `${(hours / 24).toFixed(1)} Tage`;
}
function relevantScore(req) {
  let score = 0;
  if (req.area === state.profile.area) score += 50;
  if (req.area === "Gemeindeweit") score += 12;
  if (req.urgency === "Heute") score += 25;
  if (req.urgency === "Morgen") score += 12;
  if (req.type === "Suche") score += 8;
  if (requestChats(req.id).length) score -= 6;
  const distance = requestDistanceKm(req);
  if (distance !== null) score += Math.max(0, 18 - distance);
  score += escalationScore(req);
  score -= Math.min(20, Math.floor((Date.now() - new Date(req.createdAt).getTime()) / 36e5));
  return score;
}
function requestMatches(req) {
  const q = state.filter.q.trim().toLowerCase();
  const categoryOk = state.filter.category === "Alle" || req.category === state.filter.category;
  const typeOk = state.filter.type === "Alle" || req.type === state.filter.type;
  const distanceOk = requestIsReachable(req, parseDistanceFilterKm(state.filter.distanceKm));
  const queryOk = !q || [req.title, req.text, req.area, req.category, req.author, req.authorName, req.companyName].some((v) => String(v).toLowerCase().includes(q));
  return req.status === "offen" && categoryOk && typeOk && distanceOk && queryOk;
}
function requestStatusLabel(status = "offen") {
  if (status === "wartet_freigabe") return "In Pr\xFCfung";
  if (status === "abgelehnt") return "Abgelehnt";
  if (status === "erledigt") return "Erledigt";
  if (status === "archiviert") return "Archiviert";
  if (status === "abgelaufen") return "Abgelaufen";
  return "Freigegeben";
}
function requestStatusBadge(req = {}) {
  const status = req.status || "offen";
  const cls = status === "offen" ? "done" : status === "abgelehnt" ? "danger" : status === "wartet_freigabe" ? "warn" : "info";
  return `<span class="badge ${cls}">${escapeHtml(requestStatusLabel(status))}</span>`;
}
function pendingPublicationRequests() {
  return state.requests.filter((req) => req.status === "wartet_freigabe").sort((a, b) => new Date(normalizeStoredDate(b.submittedAt || b.createdAt) || 0) - new Date(normalizeStoredDate(a.submittedAt || a.createdAt) || 0));
}
function ownRequests() {
  const uidValue = authState.user?.uid || "";
  return state.requests.filter((req) => requestOwnerUid(req) === uidValue);
}
function ownOpenRequests() {
  return ownRequests().filter((req) => req.status === "offen");
}
function ownPendingRequests() {
  return ownRequests().filter((req) => req.status === "wartet_freigabe");
}
function ownRejectedRequests() {
  return ownRequests().filter((req) => req.status === "abgelehnt");
}
function ownOpenProcessRequests() {
  const uidValue = authState.user?.uid || "";
  const location2 = state.locationChangeRequests.filter((req) => req.uid === uidValue && req.status === "offen");
  const verification = state.verificationRequests.filter((req) => req.uid === uidValue && ["offen", "zur\xFCckgestellt"].includes(req.status));
  const changes = state.changeRequests.filter((req) => req.uid === uidValue && ["offen", "in_pruefung"].includes(req.status));
  return [...location2, ...verification, ...changes];
}
function canManageOfficialNotices() {
  return isAdminRole() || state.profile.accountType === "municipality" && state.profile.municipalityStatus === "verified" && state.profile.verified;
}
function visibleAlerts() {
  if (isAdminRole()) return state.alerts;
  return state.alerts.filter((alert) => {
    const sameCanton = !alert.cantonCode || alert.cantonCode === currentCantonCode();
    if (!sameCanton) return false;
    if (alert.scopeLevel === "canton") return true;
    return Boolean(alert.areaKey && alert.areaKey === currentAreaKey());
  });
}
function visibleOfficialNotices() {
  const now = Date.now();
  return state.officialNotices.filter((notice) => {
    if (!canManageOfficialNotices()) {
      const sameCanton = !notice.cantonCode || notice.cantonCode === currentCantonCode();
      const sameMunicipality = notice.areaKey && notice.areaKey === currentAreaKey();
      if (!sameCanton) return false;
      if (notice.scopeLevel !== "canton" && !sameMunicipality) return false;
    }
    if (notice.status !== "online" && !canManageOfficialNotices()) return false;
    if (notice.validFrom && new Date(notice.validFrom).getTime() > now) return canManageOfficialNotices();
    if (notice.validUntil && new Date(notice.validUntil).getTime() < now) return canManageOfficialNotices();
    return true;
  }).sort((a, b) => Number(b.priority === "wichtig") - Number(a.priority === "wichtig") || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}
function requestQualityMessages(form) {
  const data = Object.fromEntries(new FormData(form));
  const title = String(data.title || "").trim();
  const text = String(data.text || "").trim();
  const messages = [];
  if (title.length > 0 && title.length < 8) messages.push("Titel ist sehr kurz. Besser: konkrete Aufgabe oder Angebot nennen.");
  if (text.length > 0 && text.length < 45) messages.push("Beschreibung ist knapp. Erg\xE4nze Ortsteil, Zeitfenster und was genau ben\xF6tigt wird.");
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text) || /(\+?\d[\d\s().-]{7,}\d)/.test(text)) {
    messages.push("Private Kontaktdaten besser nicht \xF6ffentlich posten. Antworten laufen \xFCber den privaten Chat.");
  }
  if (!String(data.urgency || "").trim()) messages.push("Dringlichkeit hilft bei der Sortierung.");
  if (String(data.escalationLevel || "keine") !== "keine") messages.push("Eskalationsstufen nur verwenden, wenn wirklich ein Risiko oder Zeitdruck besteht.");
  return messages;
}
function normalizeBulletinFilter(filter = {}) {
  const category = ["Alle", ...orderedCategories()].includes(filter.category) ? filter.category : "Alle";
  const type = ["Alle", "Suche", "Biete"].includes(filter.type) ? filter.type : "Alle";
  const distanceKm = DISTANCE_FILTER_VALUES.includes(String(filter.distanceKm || "Alle")) ? String(filter.distanceKm || "Alle") : "Alle";
  return {
    q: String(filter.q || "").slice(0, 80),
    category,
    type,
    distanceKm,
    areaKey: normalizeAreaKey(filter.areaKey || currentAreaKey()),
    cantonCode: String(filter.cantonCode || currentCantonCode() || "").toUpperCase()
  };
}
function normalizeChoiceArray(value, allowed = []) {
  const values = Array.isArray(value) ? value : [];
  return [...new Set(values.map(String).filter((item) => allowed.includes(item)))];
}
function normalizeNotificationKeywordRule(rule = {}, index = 0) {
  const term = String(rule.term || "").trim().replace(/\s+/g, " ").slice(0, 60);
  return {
    id: String(rule.id || `keyword_${index + 1}`).slice(0, 80),
    term,
    sources: normalizeChoiceArray(rule.sources, NOTIFICATION_SOURCES),
    categories: normalizeChoiceArray(rule.categories, [...CATEGORIES, ...OFFICIAL_NOTICE_CATEGORIES]),
    scope: rule.scope === "canton" ? "canton" : "municipality",
    enabled: rule.enabled !== false
  };
}
function defaultNotificationPreferences(overrides = {}) {
  const profileNotifications = Boolean(state?.profile?.notifications);
  return {
    uid: authState?.user?.uid || "",
    tenantId: "quartinaut",
    enabled: Boolean(overrides.enabled ?? profileNotifications),
    area: state?.profile?.area || "",
    areaKey: currentAreaKey(),
    cantonCode: currentCantonCode(),
    criticalAlerts: true,
    alerts: {
      enabled: true,
      severities: ["warn", "info"]
    },
    officialNotices: {
      enabled: true,
      priorities: ["wichtig"],
      categories: []
    },
    bulletin: {
      enabled: false,
      types: [],
      categories: []
    },
    chats: {
      enabled: true
    },
    keywordRules: [],
    quietHours: {
      enabled: false,
      start: "22:00",
      end: "07:00",
      timezone: "Europe/Zurich"
    },
    createdAt: nowIso(),
    updatedAt: nowIso(),
    ...overrides
  };
}
function normalizeNotificationPreferences(value = {}) {
  const base = defaultNotificationPreferences(value);
  const alerts = value.alerts && typeof value.alerts === "object" ? value.alerts : {};
  const officialNotices = value.officialNotices && typeof value.officialNotices === "object" ? value.officialNotices : {};
  const bulletin = value.bulletin && typeof value.bulletin === "object" ? value.bulletin : {};
  const chats = value.chats && typeof value.chats === "object" ? value.chats : {};
  const quietHours = value.quietHours && typeof value.quietHours === "object" ? value.quietHours : {};
  const keywordRules = (Array.isArray(value.keywordRules) ? value.keywordRules : []).slice(0, MAX_NOTIFICATION_KEYWORD_RULES).map(normalizeNotificationKeywordRule).filter((rule) => rule.term && rule.sources.length);
  return {
    ...base,
    uid: String(value.uid || authState?.user?.uid || ""),
    tenantId: "quartinaut",
    enabled: Boolean(value.enabled ?? base.enabled),
    area: state?.profile?.area || String(value.area || ""),
    areaKey: currentAreaKey() || normalizeAreaKey(value.areaKey || value.area || ""),
    cantonCode: currentCantonCode() || String(value.cantonCode || "").toUpperCase(),
    criticalAlerts: true,
    alerts: {
      enabled: alerts.enabled !== false,
      severities: normalizeChoiceArray(alerts.severities ?? ["warn", "info"], ["warn", "info"])
    },
    officialNotices: {
      enabled: officialNotices.enabled !== false,
      priorities: normalizeChoiceArray(officialNotices.priorities ?? ["wichtig"], ["wichtig", "info"]),
      categories: normalizeChoiceArray(officialNotices.categories, OFFICIAL_NOTICE_CATEGORIES)
    },
    bulletin: {
      enabled: Boolean(bulletin.enabled),
      types: normalizeChoiceArray(bulletin.types, ["Suche", "Biete"]),
      categories: normalizeChoiceArray(bulletin.categories, CATEGORIES)
    },
    chats: {
      enabled: chats.enabled !== false
    },
    keywordRules,
    quietHours: {
      enabled: Boolean(quietHours.enabled),
      start: /^\d{2}:\d{2}$/.test(String(quietHours.start || "")) ? String(quietHours.start) : "22:00",
      end: /^\d{2}:\d{2}$/.test(String(quietHours.end || "")) ? String(quietHours.end) : "07:00",
      timezone: "Europe/Zurich"
    },
    createdAt: normalizeStoredDate(value.createdAt) || base.createdAt,
    updatedAt: normalizeStoredDate(value.updatedAt) || base.updatedAt
  };
}
function currentNotificationPreferences() {
  return normalizeNotificationPreferences(state.notificationPreferences || {});
}
function ownSavedBulletinFilter() {
  const uidValue = authState.user?.uid || "";
  return state.bulletinFilters.find((item) => item.uid === uidValue) || null;
}
async function saveCurrentBulletinFilter() {
  if (!authState.user) throw new Error("Anmeldung erforderlich.");
  const current = ownSavedBulletinFilter();
  const now = nowIso();
  const payload = {
    id: `filter_${authState.user.uid}`,
    uid: authState.user.uid,
    email: authState.user.email || "",
    area: state.profile.area || "",
    areaKey: currentAreaKey(),
    cantonCode: currentCantonCode(),
    tenantId: "quartinaut",
    notifications: true,
    filter: normalizeBulletinFilter(state.filter),
    createdAt: current?.createdAt || now,
    updatedAt: now
  };
  state.bulletinFilters = mergeById([...state.bulletinFilters, payload]).map((item) => ({
    ...item,
    filter: normalizeBulletinFilter(item.filter || item)
  }));
  if (isFirebaseMode()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.bulletinFilters, payload.id, payload, true);
  }
  const prefs = currentNotificationPreferences();
  const convertedKeyword = payload.filter.q ? normalizeNotificationKeywordRule({
    id: "legacy_bulletin_filter",
    term: payload.filter.q,
    sources: ["requests"],
    categories: payload.filter.category === "Alle" ? [] : [payload.filter.category],
    scope: "municipality",
    enabled: true
  }) : null;
  const keywordRules = [
    ...prefs.keywordRules.filter((rule) => rule.id !== "legacy_bulletin_filter"),
    ...convertedKeyword ? [convertedKeyword] : []
  ].slice(0, MAX_NOTIFICATION_KEYWORD_RULES);
  await persistNotificationPreferences({
    ...prefs,
    bulletin: {
      enabled: true,
      types: payload.filter.type === "Alle" ? ["Suche", "Biete"] : [payload.filter.type],
      categories: payload.filter.category === "Alle" ? [] : [payload.filter.category]
    },
    keywordRules
  }, { notify: false });
  saveState();
  render();
  toast("Filter am Schwarzen Brett gespeichert. Passende neue Anliegen k\xF6nnen Push ausl\xF6sen.");
}
function loadSavedBulletinFilter() {
  const saved = ownSavedBulletinFilter();
  if (!saved) {
    toast("Noch kein Filter am Schwarzen Brett gespeichert.");
    return;
  }
  state.filter = { ...state.filter, ...normalizeBulletinFilter(saved.filter || saved) };
  saveState();
  render();
  toast("Gespeicherter Filter am Schwarzen Brett geladen.");
}
async function deleteSavedBulletinFilter() {
  const saved = ownSavedBulletinFilter();
  if (!saved) {
    toast("Noch kein Filter am Schwarzen Brett gespeichert.");
    return;
  }
  state.bulletinFilters = state.bulletinFilters.filter((item) => item.id !== saved.id);
  if (isFirebaseMode()) {
    const { db, doc, deleteDoc } = firebaseStoreApi;
    await deleteDoc(doc(db, FIRESTORE_COLLECTIONS.bulletinFilters, saved.id));
  }
  const prefs = currentNotificationPreferences();
  await persistNotificationPreferences({
    ...prefs,
    bulletin: { ...prefs.bulletin, enabled: false },
    keywordRules: prefs.keywordRules.filter((rule) => rule.id !== "legacy_bulletin_filter")
  }, { notify: false });
  saveState();
  render();
  toast("Gespeicherter Filter am Schwarzen Brett gel\xF6scht.");
}
function sortByLocalRelevance(a, b) {
  return relevantScore(b) - relevantScore(a);
}
function addChange(text) {
  state.changelog.unshift({ at: nowIso(), text });
  state.changelog = state.changelog.slice(0, 12);
}
async function writeAuditLog(action, target = {}, detail = "") {
  const payload = {
    id: uid("audit"),
    action,
    targetUid: target.uid || "",
    targetEmail: target.email || "",
    targetLabel: target.label || target.displayName || target.email || "",
    detail,
    actorUid: authState.user?.uid || "",
    actorEmail: authState.user?.email || "",
    actorLabel: profileName(),
    area: state.profile.area || "",
    createdAt: nowIso()
  };
  state.auditLog.unshift(payload);
  state.auditLog = state.auditLog.slice(0, 80);
  if (isFirebaseMode() && isPlatformAdminRole()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.auditLog, payload.id, payload, false).catch((error) => reportBackgroundError("Audit-Log schreiben", error));
  }
  saveState();
}
function stopRealtimeSubscriptions() {
  if (typeof chatsUnsubscribe === "function") chatsUnsubscribe();
  if (typeof chatMessagesUnsubscribe === "function") chatMessagesUnsubscribe();
  if (typeof activeChatUnsubscribe === "function") activeChatUnsubscribe();
  if (typeof contentUnsubscribe === "function") contentUnsubscribe();
  chatsUnsubscribe = null;
  chatMessagesUnsubscribe = null;
  activeChatUnsubscribe = null;
  contentUnsubscribe = null;
}
function updateNavBadges() {
  const chatButton = document.querySelector('[data-route="chats"]');
  if (!chatButton) return;
  const count = unreadChatCount();
  if (count > 0) chatButton.dataset.badge = String(Math.min(count, 99));
  else delete chatButton.dataset.badge;
}
function scopedContentQuery(collectionName, scope = {}) {
  const { db, collection, query, where, orderBy } = firebaseStoreApi;
  const constraints = [];
  if (scope.status) constraints.push(where("status", "==", scope.status));
  if (scope.cantonCode) constraints.push(where("cantonCode", "==", scope.cantonCode));
  else if (scope.areaKey) constraints.push(where("areaKey", "==", scope.areaKey));
  constraints.push(orderBy("createdAt", "desc"));
  return query(collection(db, collectionName), ...constraints);
}
function ownContentQuery(collectionName, uidValue) {
  const { db, collection, query, where, orderBy } = firebaseStoreApi;
  return query(collection(db, collectionName), where("uid", "==", uidValue), orderBy("createdAt", "desc"));
}
function refreshContentRoute() {
  state.requests = mergeById([...state.requests.filter((x) => !x.id.startsWith("arq_")), ...regionalRequests]);
  saveState();
  if (document.querySelector(".modal-backdrop")) return;
  if (["home", "bulletin", "alarme", "profile"].includes(state.route)) scheduleRender();
}
function scheduleRender() {
  if (document.querySelector(".qn-location button:disabled")) {
    setTimeout(scheduleRender, 400);
    return;
  }
  if (renderQueued) return;
  renderQueued = true;
  const frame = window.requestAnimationFrame || ((callback) => window.setTimeout(callback, 16));
  frame(() => {
    renderQueued = false;
    render();
  });
}
function startScopedContentRealtime(expectedUid = authState.user?.uid) {
  if (!isFirebaseMode() || !expectedUid || !firebaseStoreApi?.onSnapshot || isAccountPendingApproval()) return;
  if (typeof contentUnsubscribe === "function") contentUnsubscribe();
  const { onSnapshot } = firebaseStoreApi;
  const admin = isAdminRole();
  const scope = admin ? {} : { cantonCode: currentCantonCode(), areaKey: currentAreaKey() };
  if (!admin && !scope.cantonCode && !scope.areaKey) return;
  const unsubscribers = [];
  if (admin) {
    unsubscribers.push(onSnapshot(
      scopedContentQuery(FIRESTORE_COLLECTIONS.requests, scope),
      (snapshot) => {
        if (authState.user?.uid !== expectedUid) return;
        state.requests = mapFirestoreDocs(snapshot).map(normalizeRequestDoc);
        refreshContentRoute();
      },
      (error) => reportBackgroundError("Anliegen live laden", error, { notify: false, fallback: "Lokale Anliegen konnten nicht live geladen werden.", collection: FIRESTORE_COLLECTIONS.requests })
    ));
  } else {
    unsubscribers.push(onSnapshot(
      scopedContentQuery(FIRESTORE_COLLECTIONS.requests, { ...scope, status: "offen" }),
      (snapshot) => {
        if (authState.user?.uid !== expectedUid) return;
        const ownExisting = state.requests.filter((item) => requestOwnerUid(item) === expectedUid && item.status !== "offen");
        state.requests = mergeById([...mapFirestoreDocs(snapshot).map(normalizeRequestDoc), ...ownExisting]);
        refreshContentRoute();
      },
      (error) => reportBackgroundError("Anliegen live laden", error, { notify: false, fallback: "Lokale Anliegen konnten nicht live geladen werden.", collection: FIRESTORE_COLLECTIONS.requests })
    ));
    unsubscribers.push(onSnapshot(
      ownContentQuery(FIRESTORE_COLLECTIONS.requests, expectedUid),
      (snapshot) => {
        if (authState.user?.uid !== expectedUid) return;
        const publicExisting = state.requests.filter((item) => requestOwnerUid(item) !== expectedUid);
        state.requests = mergeById([...publicExisting, ...mapFirestoreDocs(snapshot).map(normalizeRequestDoc)]);
        refreshContentRoute();
      },
      (error) => reportBackgroundError("Eigene Anliegen live laden", error, { notify: false, fallback: "Eigene Anliegen konnten nicht live geladen werden.", collection: FIRESTORE_COLLECTIONS.requests })
    ));
  }
  unsubscribers.push(onSnapshot(
    scopedContentQuery(FIRESTORE_COLLECTIONS.alerts, scope),
    (snapshot) => {
      if (authState.user?.uid !== expectedUid) return;
      state.alerts = mapFirestoreDocs(snapshot).map(normalizeAlertDoc);
      pruneExpired();
      refreshContentRoute();
    },
    (error) => reportBackgroundError("Alarme live laden", error, { notify: false, fallback: "Lokale Alarme konnten nicht live geladen werden.", collection: FIRESTORE_COLLECTIONS.alerts })
  ));
  unsubscribers.push(onSnapshot(
    scopedContentQuery(FIRESTORE_COLLECTIONS.officialNotices, admin ? scope : { ...scope, status: "online" }),
    (snapshot) => {
      if (authState.user?.uid !== expectedUid) return;
      state.officialNotices = mapFirestoreDocs(snapshot).map(normalizeOfficialNoticeDoc);
      refreshContentRoute();
    },
    (error) => reportBackgroundError("Gemeinde-Hinweise live laden", error, { notify: false, fallback: "Offizielle Hinweise konnten nicht live geladen werden.", collection: FIRESTORE_COLLECTIONS.officialNotices })
  ));
  contentUnsubscribe = () => unsubscribers.forEach((unsubscribe) => {
    if (typeof unsubscribe === "function") unsubscribe();
  });
}
function startUserChatRealtime(expectedUid = authState.user?.uid) {
  if (!isFirebaseMode() || !expectedUid || !firebaseStoreApi?.onSnapshot || isAccountPendingApproval()) return;
  if (typeof chatsUnsubscribe === "function") chatsUnsubscribe();
  if (typeof chatMessagesUnsubscribe === "function") chatMessagesUnsubscribe();
  const { db, collection, query, where, orderBy, onSnapshot } = firebaseStoreApi;
  const chatUnsubscribers = [];
  function mergeRealtimeChats(snapshot) {
    if (authState.user?.uid !== expectedUid) return;
    const remoteChats = mapFirestoreDocs(snapshot).map(normalizeChatDoc);
    const remoteIds = new Set(remoteChats.map((chat) => chat.id));
    const messageBackedChats = state.chats.filter((chat) => !remoteIds.has(chat.id));
    state.chats = [...remoteChats, ...messageBackedChats].sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
    saveState();
    updateNavBadges();
    if (!document.querySelector(".modal-backdrop")) scheduleRender();
  }
  const participantChatQuery = query(
    collection(db, FIRESTORE_COLLECTIONS.chats),
    where("participants", "array-contains", expectedUid),
    orderBy("lastMessageAt", "desc")
  );
  chatUnsubscribers.push(onSnapshot(participantChatQuery, mergeRealtimeChats, (error) => reportBackgroundError("Chatliste live laden", error, { notify: false, fallback: "Private Chats konnten nicht live geladen werden.", collection: FIRESTORE_COLLECTIONS.chats })));
  chatsUnsubscribe = () => chatUnsubscribers.forEach((unsubscribe) => {
    if (typeof unsubscribe === "function") unsubscribe();
  });
  chatMessagesUnsubscribe = null;
}
var communityBackend = { eventsReady: false, reviewsReady: false, error: "" };
var INBOX_READ_KEY = "quartinaut-community-inbox-read-v1:";
function communityReadKey() {
  return INBOX_READ_KEY + String(authState.user?.uid || "guest");
}
function getInboxReads() {
  try {
    return JSON.parse(localStorage.getItem(communityReadKey()) || "{}") || {};
  } catch {
    return {};
  }
}
function readInboxItem(key) {
  if (!authState.user || !key) return;
  const reads = getInboxReads();
  reads[String(key)] = nowIso();
  try {
    localStorage.setItem(communityReadKey(), JSON.stringify(reads));
  } catch {
  }
}
function isInboxItemRead(key) {
  const entry = inboxEntries().find((item) => item.key === key);
  if (entry && v47Sync) return v47Sync.isRead(entry);
  return !isFirebaseMode() && Boolean(getInboxReads()[key]);
}
function communityDate(value) {
  try {
    return new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" }).format(new Date(value));
  } catch {
    return "Datum nicht verf\xFCgbar";
  }
}
async function callQuartinaut(name, payload = {}) {
  if (name === "quartinautPhoto" && state.requests.some((x) => x.id.startsWith("arq_") && x.photoPaths?.includes(payload.path))) return callQuartinautRaw("quartinautAudience", { action: "photo.read", path: payload.path });
  if (name === "quartinautSocial") {
    if (payload.action === "summary") {
      const scoped = (payload.posts || []).filter((x) => x.id.startsWith("arq_")), legacy = (payload.posts || []).filter((x) => !x.id.startsWith("arq_"));
      const results = await Promise.allSettled([...legacy.length ? [callQuartinautRaw(name, { ...payload, posts: legacy })] : [], ...scoped.map(async (x) => {
        const r = await callQuartinautRaw("quartinautAudience", { action: "social.comments.list", id: x.id });
        return { summaries: { ["request:" + x.id]: r.summary } };
      })]);
      return { summaries: Object.assign({}, ...results.filter((x) => x.status === "fulfilled").map((x) => x.value.summaries || {})) };
    }
    if (String(payload.id || "").startsWith("arq_")) return callQuartinautRaw("quartinautAudience", { ...payload, action: "social." + payload.action });
  }
  return callQuartinautRaw(name, payload);
}
async function callQuartinautRaw(name, payload = {}) {
  if (!isFirebaseMode() || !firebaseFunctionsApi?.httpsCallable || !firebaseFunctionsApi?.functions) throw new Error("Firebase-Verbindung ist nicht bereit.");
  const fn = firebaseFunctionsApi.httpsCallable(firebaseFunctionsApi.functions, name);
  const result = await fn(payload);
  return result?.data || {};
}
async function loadCommunityFeatures() {
  if (!authState.user) return;
  const expectedUid = authState.user.uid, expectedEpoch = accountEpoch;
  if (!isFirebaseMode()) {
    communityBackend.error = "Veranstaltungen und Bewertungen ben\xF6tigen Firebase.";
    communityBackend.eventsReady = false;
    communityBackend.reviewsReady = false;
    render();
    return;
  }
  const authorUids = [...new Set((state.requests || []).map((req) => req.uid || req.authorId).filter(Boolean))].slice(0, 30);
  const [eventsResult, trustResult, publicResult] = await Promise.allSettled([
    callQuartinaut("quartinautEvents", { action: "list" }),
    callQuartinaut("quartinautReviews", { action: "mine" }),
    callQuartinaut("quartinautReviews", { action: "summaries", uids: authorUids })
  ]);
  if (!currentAccountEpoch(expectedUid, expectedEpoch)) return;
  state.publicTrust = publicResult.status === "fulfilled" ? publicResult.value?.summaries || {} : {};
  if (eventsResult.status === "fulfilled") {
    state.communityEvents = Array.isArray(eventsResult.value?.events) ? eventsResult.value.events.slice(0, 160) : [];
    communityBackend.eventsReady = true;
  } else {
    state.communityEvents = [];
    communityBackend.eventsReady = false;
  }
  if (trustResult.status === "fulfilled") {
    state.communityTrust = { count: Number(trustResult.value?.summary?.count || 0), average: Number(trustResult.value?.summary?.average || 0) };
    state.eligibleReviews = Array.isArray(trustResult.value?.eligible) ? trustResult.value.eligible.slice(0, 20) : [];
    communityBackend.reviewsReady = true;
  } else {
    state.eligibleReviews = [];
    communityBackend.reviewsReady = false;
  }
  communityBackend.error = communityBackend.eventsReady && communityBackend.reviewsReady ? "" : "Einige neuen Funktionen ben\xF6tigen die Quartinaut-2.1-Cloud-Functions. Bestehende Chats und Beitr\xE4ge bleiben verf\xFCgbar.";
  saveState();
  if (authState.user) render();
}
function localCommunityEvents() {
  const areaKey = currentAreaKey(), canton = currentCantonCode(), own = authState.user?.uid;
  return (state.communityEvents || []).filter((e) => e && (e.uid === own || e.status === "published" && (e.areaKey === areaKey || e.cantonCode === canton)));
}
function upcomingCommunityEvents() {
  return localCommunityEvents().filter((e) => e.status === "published" && Date.parse(e.endsAt || e.startsAt) >= Date.now() - 36e5).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}
function renderMyQuartierPanel() {
  const events = upcomingCommunityEvents();
  const requests = (state.requests || []).filter((r) => r.status === "offen" && r.areaKey === currentAreaKey());
  return `<section class="v21-quartier-panel v461-quartier-panel" aria-label="Mein Quartier">
    <div class="v2-section-heading"><div><span class="v2-kicker">Aus deiner Umgebung</span><h2>Mein Quartier</h2></div></div>
    <div class="v21-summary-grid v461-summary-grid">
      <button data-community-route="bulletin" class="v21-summary-tile"><strong>${requests.length}</strong><span>Offene Anliegen</span></button>
      <button data-community-route="events" class="v21-summary-tile"><strong>${events.length}</strong><span>Kommende Anl\xE4sse</span></button>
    </div>
    ${events.length ? `<p class="v461-next-event"><strong>N\xE4chster Anlass:</strong> ${escapeHtml(events[0].title)} <small>${communityDate(events[0].startsAt)}</small></p>` : ""}
  </section>`;
}
function inboxEntries() {
  const items = [];
  for (const chat of (state.chats || []).filter((c) => isChatVisibleForUser(c) && chatHasUnread(c))) {
    items.push({ key: "chat:" + chat.id, type: "chat", title: "Neue Nachricht von " + chatPeerLabel(chat), detail: chat.requestTitle || "Privates Gespr\xE4ch", at: chat.lastMessageAt, route: "chats" });
  }
  for (const alert of visibleAlerts().filter((a) => !hasSeenAlert(a.id))) {
    items.push({ key: "alert:" + alert.id, title: "Gemeinde-Alarm: " + (alert.title || "Wichtige Meldung"), detail: String(alert.text || "").slice(0, 160), at: alert.createdAt, route: "alarme" });
  }
  for (const notice of (state.officialNotices || []).filter((n) => n.status === "online")) {
    items.push({ key: "notice:" + notice.id, title: "Gemeindemitteilung: " + notice.title, detail: String(notice.text || "").slice(0, 150), at: notice.createdAt, route: "home" });
  }
  for (const e of localCommunityEvents().filter((e2) => e2.status === "published" && Date.parse(e2.startsAt) > Date.now() - 864e5 * 2)) {
    items.push({ key: "event:" + e.id, title: "Veranstaltung: " + e.title, detail: communityDate(e.startsAt) + " \xB7 " + (e.venue || e.area || ""), at: e.createdAt || e.startsAt, route: "events" });
  }
  for (const req of ownRequests().filter((r) => ["wartet_freigabe", "abgelehnt", "erledigt"].includes(r.status))) {
    items.push({ key: "request:" + req.id + ":" + req.status, title: "Dein Anliegen: " + (req.title || "Ohne Titel"), detail: requestStatusLabel(req.status), at: req.updatedAt || req.createdAt, route: "home" });
  }
  for (const thread of hubState.threads || []) {
    if (!thread?.id) continue;
    items.push({ key: "hubmsg:" + thread.id, type: "reservation", title: "Quartier+-Anfrage: " + (thread.itemTitle || "Nachricht"), detail: String(thread.lastMessage || "").slice(0, 150), at: thread.updatedAt || thread.lastMessageAt, route: "hub" });
  }
  for (const item of hubState.items || []) {
    if (item?.kind !== "lend" || item.ownerUid !== authState.user?.uid || !["reserved", "borrowed"].includes(item.availability)) continue;
    items.push({ key: "loan:" + item.id + ":" + item.availability, type: "reservation", title: item.availability === "reserved" ? "Leihb\xF6rse: Reservation" : "Leihb\xF6rse: ausgeliehen", detail: String(item.title || "").slice(0, 100), at: item.updatedAt || item.createdAt, route: "hub" });
  }
  return items.sort((a, b) => Date.parse(b.at || 0) - Date.parse(a.at || 0)).slice(0, 100);
}
function isUnreadCommunityEntry(item) {
  if (item.key.startsWith("chat:") || item.key.startsWith("alert:")) return true;
  return v47Sync ? !v47Sync.isRead(item) : !isInboxItemRead(item.key);
}
function inboxUnreadCount() {
  return inboxEntries().filter(isUnreadCommunityEntry).length;
}
async function openInboxItem(key, route) {
  const item = inboxEntries().find((x) => x.key === key);
  if (!item) {
    toast("Die Mitteilung ist nicht mehr verf\xFCgbar.");
    return;
  }
  const [prefix, id] = key.split(":");
  if (prefix === "alert") {
    setRoute("alarme");
    return;
  }
  if (prefix === "chat") {
    if (isFirebaseMode()) await syncStateFromFirestore();
    const chat = state.chats.find((x) => x.id === id);
    if (!chat) throw new Error("Chat gel\xF6scht oder kein Zugriff mehr.");
    chatModalForChat(await ensureChatDocument(chat));
    return;
  }
  if (prefix === "hubmsg") {
    await openHubThread(id);
    return;
  }
  const kind = prefix === "loan" ? "hub" : prefix;
  if (!isFirebaseMode()) {
    setRoute(route || "home");
    readInboxItem(key);
    return;
  }
  const expectedUid = authState.user?.uid, expectedEpoch = accountEpoch;
  await v47OpenTarget(kind, id);
  if (!currentAccountEpoch(expectedUid, expectedEpoch)) return;
  v47Sync?.markRead(item);
  render();
}
function renderInbox() {
  const all = inboxEntries();
  const kind = v46InboxFilter();
  const items = all.filter((x) => kind === "all" || kind === "unread" && isUnreadCommunityEntry(x) || kind === "chat" && x.key.startsWith("chat:") || kind === "alert" && x.key.startsWith("alert:") || kind === "reservation" && (x.key.startsWith("hubmsg:") || x.key.startsWith("loan:")) || kind === "other" && !/^(chat|alert|hubmsg|loan):/.test(x.key));
  return `${renderV53CommunicationNav("inbox")}<section class="v2-page-header"><span class="v2-kicker">Alles im Blick</span><h1>Mitteilungen</h1>
    <p>Private Nachrichten, Gemeindeinformationen und neue Veranstaltungen an einem Ort.</p>
    <button class="secondary-button small" data-community-action="reload">Jetzt aktualisieren</button></section>
    <nav class="v46-filters" aria-label="Mitteilungen filtern">${[["all", "Alle"], ["unread", "Ungelesen"], ["chat", "Chats"], ["alert", "Alarme"], ["reservation", "Ausleihen"], ["other", "Weitere"]].map(([id, label]) => `<button type="button" data-v46-inbox="${id}" class="${kind === id ? "active" : ""}" aria-pressed="${kind === id}">${label}</button>`).join("")}</nav>
    <p class="v46-muted">${all.filter(isUnreadCommunityEntry).length} ungelesene Eintr\xE4ge \xB7 Eintr\xE4ge werden beim \xD6ffnen als gelesen markiert</p>
    <section class="v21-inbox-list">${items.length ? Object.entries(items.reduce((groups, item) => {
    const d = new Date(item.at), key = Number.isFinite(d.getTime()) ? d.toLocaleDateString("de-CH", { year: "numeric", month: "long", day: "numeric" }) : "Ohne Datum";
    (groups[key] ??= []).push(item);
    return groups;
  }, {})).map(([day, entries]) => `<section class="v48-inbox-day" aria-label="Mitteilungen vom ${escapeHtml(day)}"><h2>${escapeHtml(day)}</h2>${entries.map((item) => `<article class="card v21-inbox-entry ${isUnreadCommunityEntry(item) ? "v21-unread" : ""}">
      <div><h3>${escapeHtml(item.title || "Mitteilung")}</h3><small>${communityDate(item.at)}</small><p>${escapeHtml(item.detail || "")}</p></div>
      <div class="row-actions"><button class="secondary-button small" data-community-action="open-inbox" data-key="${escapeHtml(item.key)}" data-route="${escapeHtml(item.route)}">\xD6ffnen</button>
      </div>
    </article>`).join("")}</section>`).join("") : '<div class="empty">Noch keine neuen Mitteilungen.</div>'}</section>`;
}
function communityEventCard(e) {
  const own = e.uid === authState.user?.uid;
  const isPending = e.status === "pending", canDecide = isAdminRole() && isPending;
  return `<article class="card v21-event-card"><div class="badges"><span class="badge">${escapeHtml(e.category || "Quartier")}</span>
   ${own && e.status !== "published" ? `<span class="badge warn">${escapeHtml(e.status === "pending" ? "Wartet auf Freigabe" : e.status)}</span>` : ""}
   </div><h3>${escapeHtml(e.title)}</h3><p class="v21-event-time">${communityDate(e.startsAt)}</p>
   <p>${escapeHtml(e.description || "")}</p><p class="v2-caption">\u{1F4CD} ${escapeHtml(e.venue || e.area || "Gemeinde")}</p>
   ${canDecide ? `<div class="row-actions"><button class="secondary-button small" data-community-action="review-event" data-id="${escapeHtml(e.id)}" data-decision="approve">Freigeben</button>
   <button class="ghost-button small" data-community-action="review-event" data-id="${escapeHtml(e.id)}" data-decision="reject">Ablehnen</button></div>` : ""}
  </article>`;
}
function renderCommunityEvents() {
  const own = authState.user?.uid, upcoming = upcomingCommunityEvents();
  const submitted = localCommunityEvents().filter((e) => e.uid === own && e.status !== "published");
  const pending = isAdminRole() ? (state.communityEvents || []).filter((e) => e.status === "pending") : [];
  return `<section class="v2-page-header"><span class="v2-kicker">Gemeinsam unterwegs</span><h1>Veranstaltungen</h1>
    <p>Vereine, Nachbarn und Gemeinden teilen Anl\xE4sse aus deiner Umgebung. Neue Eintr\xE4ge werden vor der Ver\xF6ffentlichung gepr\xFCft.</p>
    <div class="row-actions"><button class="primary-button" data-community-action="new-event" ${communityBackend.eventsReady ? "" : "disabled"}>+ Veranstaltung einreichen</button>
    <button class="ghost-button small" data-community-action="reload">Aktualisieren</button></div>
    ${!communityBackend.eventsReady ? `<p class="form-error">${escapeHtml(communityBackend.error || "Die Veranstaltungsverwaltung wird noch eingerichtet.")}</p>` : ""}</section>
    <section class="v21-event-section"><h2>Demn\xE4chst in deiner N\xE4he</h2><div class="v21-event-grid">${upcoming.length ? upcoming.map(communityEventCard).join("") : '<div class="empty">Aktuell keine ver\xF6ffentlichten Anl\xE4sse vorhanden.</div>'}</div></section>
    ${submitted.length ? `<section class="v21-event-section"><h2>Meine Einreichungen</h2><div class="v21-event-grid">${submitted.map(communityEventCard).join("")}</div></section>` : ""}
    ${pending.length ? `<section class="v21-event-section"><h2>Veranstaltungen freigeben (${pending.length})</h2><div class="v21-event-grid">${pending.map(communityEventCard).join("")}</div></section>` : ""}`;
}
function openCommunityEventModal() {
  if (!communityBackend.eventsReady) {
    toast("Veranstaltungen werden nach der Backend-Einrichtung freigeschaltet.");
    return;
  }
  openModal("Veranstaltung vorschlagen", `<form class="form-grid" id="v21EventForm">
    <p class="help">F\xFCr \xF6ffentliche Anl\xE4sse im Quartier. Bitte keine privaten Telefonnummern oder Adressen von Dritten ver\xF6ffentlichen.</p>
    <label>Titel<input name="title" minlength="5" maxlength="100" required placeholder="z. B. Quartierflohmarkt"></label>
    <label>Kategorie<select name="category"><option>Nachbarschaft</option><option>Verein</option><option>Kultur</option><option>Sport</option><option>Gemeinde</option><option>Familie</option></select></label>
    <label>Datum und Beginn<input type="datetime-local" name="startsLocal" required></label>
    <label>Ende (optional)<input type="datetime-local" name="endsLocal"></label>
    <label>Treffpunkt / Veranstaltungsort<input name="venue" maxlength="120" required placeholder="\xD6ffentlicher Ort oder Treffpunkt"></label>
    <label>Beschreibung<textarea name="description" maxlength="600" minlength="15" required placeholder="Was erwartet die Besucherinnen und Besucher?"></textarea></label>
    <p class="help">Der Eintrag wird zuerst gepr\xFCft. Deine Gemeinde wird automatisch aus deinem Profil \xFCbernommen.</p>
    <button class="primary-button" type="submit">Zur Freigabe einreichen</button>
  </form>`, (modal, close) => {
    modal.querySelector("#v21EventForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector("button[type=submit]");
      button.disabled = true;
      const data = Object.fromEntries(new FormData(form).entries());
      runAsyncAction(async () => {
        try {
          await callQuartinaut("quartinautEvents", { action: "create", event: data });
          close();
          await loadCommunityFeatures();
          setRoute("events");
          toast("Veranstaltung wurde zur Pr\xFCfung eingereicht.");
        } finally {
          button.disabled = false;
        }
      });
    });
  });
}
async function decideCommunityEvent(id, decision) {
  if (!isAdminRole()) throw new Error("Die Freigabe ben\xF6tigt einen Admin-Claim.");
  if (!["approve", "reject"].includes(decision)) return;
  await callQuartinaut("quartinautEvents", { action: "decide", id, decision });
  await loadCommunityFeatures();
  toast(decision === "approve" ? "Veranstaltung freigegeben." : "Veranstaltung abgelehnt.");
}
function renderCommunityTrustPanel() {
  const stats = state.communityTrust || { count: 0, average: 0 }, eligible = state.eligibleReviews || [];
  return `<section class="card v21-trust-card"><div class="v2-section-heading"><div><span class="v2-kicker">Vertrauen im Quartier</span><h2>Mein Vertrauensprofil</h2></div>${trustBadge(state.profile, { detail: true })}</div>
    <p>Die bisherige Identit\xE4tspr\xFCfung bleibt unver\xE4ndert. Freiwillige Bewertungen sind nur nach einer tats\xE4chlich abgeschlossenen Hilfe m\xF6glich.</p>
    <div class="v21-trust-stats"><div><strong>${stats.count > 0 ? `${Number(stats.average || 0).toFixed(1)} / 5` : "\u2013"}</strong><small>${stats.count} gepr\xFCfte Bewertung(en)</small></div>
      <div><strong>${ownRequests().filter((req) => req.status === "erledigt").length}</strong><small>Eigene erledigte Anliegen</small></div></div>
    ${eligible.length ? `<h3>Abgeschlossene Hilfen bewerten</h3><div class="v21-review-list">${eligible.map((item) => `<div class="v21-review-row"><div><strong>${escapeHtml(item.title || "Nachbarschaftshilfe")}</strong><small>${escapeHtml(item.peerName || "Andere Person")}</small></div><button class="secondary-button small" data-community-action="review-help" data-id="${escapeHtml(item.chatId)}">Bewerten</button></div>`).join("")}</div>` : '<p class="v2-caption">Zurzeit keine abgeschlossene Hilfe zur Bewertung vorhanden.</p>'}
    ${!communityBackend.reviewsReady ? `<p class="form-error">${escapeHtml(communityBackend.error || "Bewertungen werden noch eingerichtet.")}</p>` : ""}
    <p class="v2-caption">Bewertungen sind keine Identit\xE4tspr\xFCfung. Pers\xF6nliche Daten werden nicht im Bewertungstext ben\xF6tigt.</p>
  </section>`;
}
function openCommunityReviewModal(chatId) {
  const target = (state.eligibleReviews || []).find((item) => item.chatId === chatId);
  if (!target) {
    toast("Diese Hilfe kann aktuell nicht bewertet werden.");
    return;
  }
  openModal("Abgeschlossene Hilfe bewerten", `<form class="form-grid" id="v21ReviewForm">
    <p><strong>${escapeHtml(target.title || "Nachbarschaftshilfe")}</strong> \xB7 ${escapeHtml(target.peerName || "Andere Person")}</p>
    <label>Wie war deine Erfahrung?<select name="rating" required><option value="">Bewertung w\xE4hlen</option><option value="5">\u2605\u2605\u2605\u2605\u2605 \u2013 Sehr gut</option><option value="4">\u2605\u2605\u2605\u2605\u2606 \u2013 Gut</option><option value="3">\u2605\u2605\u2605\u2606\u2606 \u2013 In Ordnung</option><option value="2">\u2605\u2605\u2606\u2606\u2606 \u2013 Verbesserungsw\xFCrdig</option><option value="1">\u2605\u2606\u2606\u2606\u2606 \u2013 Schlecht</option></select></label>
    <label>Kommentar (freiwillig)<textarea maxlength="240" name="comment" placeholder="Ohne Telefonnummern oder andere pers\xF6nliche Daten"></textarea></label>
    <p class="help">Pro abgeschlossenem Gespr\xE4ch ist eine Bewertung m\xF6glich. Nach dem Absenden kann sie nicht mehr ver\xE4ndert werden.</p>
    <button type="submit" class="primary-button">Bewertung abgeben</button></form>`, (modal, close) => {
    modal.querySelector("#v21ReviewForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector("button[type=submit]");
      button.disabled = true;
      const data = Object.fromEntries(new FormData(form).entries());
      runAsyncAction(async () => {
        try {
          await callQuartinaut("quartinautReviews", { action: "submit", chatId, rating: Number(data.rating), comment: String(data.comment || "") });
          close();
          await loadCommunityFeatures();
          toast("Danke! Deine Bewertung wurde gespeichert.");
        } finally {
          button.disabled = false;
        }
      });
    });
  });
}
var hubState = { items: [], joins: [], threads: [], rsvps: [], eventRows: [], settings: null, stats: null, loaded: false, loading: false, error: "", section: "all", search: "", activeThread: "", messages: [] };
var HUB_KINDS = /* @__PURE__ */ new Set(["lend", "market", "lost", "group", "issue", "calendar", "project"]);
var hubLabel = (id) => HUB_MODULES.find((x) => x.id === id)?.title || id;
function hubSettings() {
  return hubState.settings || { homeView: loadHome(authState.user?.uid), topics: ["chats", "alerts", "help"], digest: "off", quietHours: false };
}
function hubHomeSelector({ compact = false } = {}) {
  const value = loadHome(authState.user?.uid);
  return `<section class="v3-home-settings card">${compact ? "" : `<div><strong>Meine Startseite</strong><p class="v3-subtext">W\xE4hle, welchen Bereich du nach der Anmeldung zuerst sehen m\xF6chtest.</p></div>`}
   <label for="v3HomeSelect">Startansicht w\xE4hlen</label><select id="v3HomeSelect" data-v3-home>${HOME_OPTIONS.map((o) => `<option value="${o.value}" ${value === o.value ? "selected" : ""}>${escapeHtml(o.title)}</option>`).join("")}</select>
   <p class="v3-subtext">Die Auswahl wird auf diesem Ger\xE4t sofort \xFCbernommen und nach M\xF6glichkeit mit deinem Profil synchronisiert.</p></section>`;
}
function hubBottomTile() {
  return `<section class="v461-hub-cta" aria-label="Weitere Quartierfunktionen">
    <div><strong>Noch mehr in Quartier+</strong><p>Fundb\xFCro, Gemeindeangebote und weitere M\xF6glichkeiten entdecken.</p></div>
    <button class="secondary-button small" type="button" data-v3-open="all">Alle Funktionen <span aria-hidden="true">\u2192</span></button>
  </section>`;
}
async function loadHub(force = false) {
  if (!authState.user || hubState.loading) return;
  if (hubState.loaded && !force) return;
  hubState.loading = true;
  hubState.error = "";
  const expectedUid = authState.user.uid, expectedEpoch = accountEpoch;
  if (state.route === "hub") render();
  const results = await Promise.allSettled([
    callQuartinaut("quartinautHub", { action: "list" }),
    callQuartinaut("quartinautHub", { action: "members.mine" }),
    callQuartinaut("quartinautHub", { action: "messages.list" }),
    callQuartinaut("quartinautHub", { action: "settings.get" }),
    callQuartinaut("quartinautEventPlus", { action: "mine" })
  ]);
  if (!currentAccountEpoch(expectedUid, expectedEpoch)) return;
  const result = (n, fallback) => results[n].status === "fulfilled" ? results[n].value : fallback;
  hubState.items = result(0, { items: [] }).items || [];
  hubState.joins = result(1, { ids: [] }).ids || [];
  hubState.threads = result(2, { threads: [] }).threads || [];
  hubState.settings = result(3, { settings: null }).settings || hubSettings();
  hubState.rsvps = result(4, { ids: [] }).ids || [];
  if (results[3].status === "fulfilled" && results[3].value.configured === true && hubState.settings.homeView) {
    saveHome(expectedUid, hubState.settings.homeView);
  } else {
    hubState.settings = { ...hubState.settings, homeView: loadHome(expectedUid) };
  }
  hubState.error = results[0].status === "rejected" ? "Die Quartierangebote konnten nicht geladen werden. Bitte aktualisiere die Ansicht oder versuche es sp\xE4ter erneut." : "";
  hubState.loaded = results[0].status === "fulfilled";
  hubState.loading = false;
  if (["home", "hub", "profile", "settings", "search", "map", "saved", "community-pulse"].includes(state.route)) render();
}
async function hubAction(action, payload = {}, success = "Gespeichert.") {
  const result = await callQuartinaut("quartinautHub", { action, ...payload });
  hubState.loaded = false;
  await loadHub(true);
  toast(success);
  return result;
}
function hubItemCard(item) {
  const isMine = item.ownerUid === authState.user?.uid, joined = hubState.joins.includes(item.id);
  const isOwnerOrModerator = isMine || item.isModerator;
  const status = item.status === "published" ? "Aktiv" : item.status === "pending" ? "Wartet auf Freigabe" : item.status === "submitted" ? "Eingereicht" : statusLabel(item.status);
  const price = item.priceChf !== null && item.priceChf !== void 0 && ["lend", "market"].includes(item.kind) ? ` \xB7 CHF ${Number(item.priceChf).toFixed(2)}` : "";
  let actions = "";
  if (item.status === "published") {
    if (["group", "project"].includes(item.kind) && !isMine) actions += `<button class="secondary-button small" data-v3-item-action="${joined ? "leave" : "join"}" data-id="${escapeHtml(item.id)}">${joined ? "Teilnahme beenden" : "Mitmachen"}</button>`;
    if (["market", "lost", "lend"].includes(item.kind) && !isMine) {
      if (item.v50ReservationMode !== true && item.availability === "available") actions += `<button class="secondary-button small" data-v3-item-action="reserve" data-id="${escapeHtml(item.id)}">${item.kind === "lend" ? "Ausleihe anfragen" : "Reservieren"}</button>`;
      else if (item.v50ReservationMode !== true && item.reservedByMe && item.availability === "reserved") actions += `<button class="ghost-button small" data-v3-item-action="release" data-id="${escapeHtml(item.id)}">Reservation aufheben</button>`;
    }
    if (item.kind === "group" && (isMine || joined)) actions += `<button class="ghost-button small" data-v3-group="${escapeHtml(item.id)}">Gruppenbeitr\xE4ge</button>`;
    if (isMine && ["market", "lost"].includes(item.kind) && item.availability !== "completed") actions += `<button class="ghost-button small" data-v3-item-action="complete" data-id="${escapeHtml(item.id)}">Als erledigt markieren</button>`;
    if (!isMine && item.kind !== "calendar") actions += `<button class="ghost-button small" data-v3-contact="${escapeHtml(item.id)}">Nachricht</button>`;
    if (item.kind === "group") actions += `<button class="ghost-button small" type="button" data-v46-group-profile="${escapeHtml(item.id)}">Vereinsprofil</button>`;
    if (item.status === "published" && item.kind !== "issue") actions += `<button class="ghost-button small" type="button" data-v46-hide-post="hub" data-id="${escapeHtml(item.id)}">Nur bei mir ausblenden</button>`;
    if (item.kind === "lend") actions += `<button class="secondary-button small" data-v50-open="v50loans" data-id="${escapeHtml(item.id)}">Ausleihkalender</button>`;
    if (item.kind === "market") actions += `<button class="secondary-button small" data-v50-open="v50market" data-id="${escapeHtml(item.id)}">Zeitlich reservieren</button>`;
    if (["group", "project"].includes(item.kind)) actions += `<button class="secondary-button small" data-v50-open="v50associations" data-id="${escapeHtml(item.id)}">Anmeldungen</button>`;
    if (item.kind === "group" && item.status === "published") actions += `<button class="ghost-button small" type="button" data-v46-fav="groups" data-value="${escapeHtml(item.id)}">${v46Favorites().groups.includes(item.id) ? "\u2605 Verein gemerkt" : "\u2606 Verein merken"}</button>`;
    if (item.kind === "lend") actions += `<button class="ghost-button small" type="button" data-v46-loan-reminder="${escapeHtml(item.id)}">\xDCbergabe & R\xFCckgabe im Kalender</button>`;
    if (isMine && item.kind === "lend" && item.v50ReservationMode !== true && item.availability === "reserved") actions += `<button class="secondary-button small" data-v3-item-action="received" data-id="${escapeHtml(item.id)}">\xDCbergabe best\xE4tigen</button>`;
    if (isMine && item.kind === "lend" && item.v50ReservationMode !== true && item.availability === "borrowed") actions += `<button class="secondary-button small" data-v3-item-action="returned" data-id="${escapeHtml(item.id)}">R\xFCckgabe best\xE4tigen</button>`;
    if (["calendar", "project"].includes(item.kind) && item.startsAt) actions += `<button class="ghost-button small" data-v3-calendar="${escapeHtml(item.id)}">In Kalender \xFCbernehmen</button>`;
  }
  if (item.isModerator && item.status === "pending") actions += `<button class="secondary-button small" data-v3-item-action="approve" data-id="${escapeHtml(item.id)}">Freigeben</button><button class="ghost-button small" data-v3-item-action="reject" data-id="${escapeHtml(item.id)}">Ablehnen</button>`;
  if (item.kind === "issue" && item.isModerator && item.status !== "resolved") actions += `<button class="secondary-button small" data-v3-item-action="issue.status" data-id="${escapeHtml(item.id)}" data-status="${item.status === "submitted" ? "in_review" : "resolved"}">${item.status === "submitted" ? "In Bearbeitung" : "Als erledigt markieren"}</button>`;
  return `<article class="v3-listing-card v44-post" data-hub-post-id="${escapeHtml(item.id)}">
 ${v44PostHead(isMine ? profileName() : "Quartiermitglied", item.area, communityDate(item.createdAt), hubLabel(item.kind))}
 <div class="v44-post-body"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p></div>
 ${postPhotoGallery(item.photoPaths)}
 <div class="v44-post-meta"><span>${escapeHtml(item.category)}</span><span class="badge ${item.status === "published" ? "offer" : "warn"}">${escapeHtml(status)}</span>${price ? `<span>${escapeHtml(price.replace(/^ · /, ""))}</span>` : ""}</div>
 ${item.status === "published" && item.kind !== "issue" ? v44FeedActions("hub", item.id) : ""}
 <div class="v44-post-contact">${actions ? `<div class="row-actions">${actions}</div>` : ""}
 ${item.kind === "lend" || item.kind === "group" || item.adminNote ? `<details class="v44-more"><summary>Weitere Informationen</summary>
 ${item.kind === "lend" ? `<p class="v3-meta">Verf\xFCgbarkeit: ${escapeHtml({ available: "Verf\xFCgbar", reserved: "Reserviert", borrowed: "Ausgeliehen" }[item.availability] || item.availability)}</p>` : ""}
 ${["project", "group"].includes(item.kind) ? `<p class="v3-meta">${item.memberCount || 0} Teilnehmende${item.capacity ? " / " + item.capacity + " Pl\xE4tze" : ""}</p>` : ""}
 ${item.adminNote && item.isMine ? `<p class="v3-meta">Verwaltung: ${escapeHtml(item.adminNote)}</p>` : ""}
 </details>` : ""}</div></article>`;
}
function hubList(kind) {
  const items = filterFeed(hubState.items.filter((item) => !v46IsHidden("hub", item.id) && item.kind === kind && (!hubState.search || [item.title, item.description, item.category].join(" ").toLocaleLowerCase("de-CH").includes(hubState.search.toLocaleLowerCase("de-CH")))), { kind: v46FeedFilter(), area: state.profile.area, lastSeenAt: v46LastSeenAt(), savedKeys: v46SavedPostKeys() }).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const desc = { lend: "Leihen statt kaufen \u2013 Reservation und R\xFCckgabe dokumentieren.", market: "Lokaler Verkauf, Tausch oder Verschenken. Keine integrierte Bezahlung.", lost: "Nur ungef\xE4hre Fundorte angeben; offizielle Fundstellen bleiben zust\xE4ndig.", group: "\xD6ffentliche Gruppen und Vereine aus deiner Region.", project: "Nachbarschaftsaktionen organisieren und als Helfer anmelden.", issue: "Meldungen sind nur f\xFCr dich und berechtigte Gemeinde-Verantwortliche sichtbar.", calendar: "Offizielle Termine werden ausschliesslich von berechtigten Gemeindekonten eingetragen." };
  const canNew = kind !== "calendar" || state.profile.role === "admin" || state.profile.role === "area_admin" && state.profile.accountType === "municipality" && state.profile.municipalityStatus === "verified";
  return `<div class="v3-hub-content"><div class="v3-hub-content-head"><h2>${escapeHtml(hubLabel(kind))}</h2>${canNew ? `<button class="primary-button small" data-v3-create="${kind}" ${hubState.loaded ? "" : "disabled"}>+ Eintrag erstellen</button>` : ""}</div>
 <p class="v3-subtext">${desc[kind]}</p>
 <form class="v3-search-form" data-v3-search><label>Eintr\xE4ge durchsuchen<input type="search" name="q" value="${escapeHtml(hubState.search)}" placeholder="Titel, Kategorie oder Beschreibung"></label><button type="submit" class="secondary-button small">Suchen</button></form>
 ${kind === "issue" ? '<p class="v3-safety-note">Nur wenn deine Gemeinde Quartinaut offiziell nutzt, wird eine zust\xE4ndige Stelle diese Meldung bearbeiten. Ansonsten ist die Meldung lediglich im System hinterlegt.</p>' : ""}
 <div class="v3-listing-grid">${items.length ? items.map(hubItemCard).join("") : '<div class="empty">Hier gibt es noch keine Eintr\xE4ge. Starte mit dem ersten Beitrag.</div>'}</div></div>`;
}
function hubMatch() {
  const prefs = readPreferences(authState.user?.uid);
  const matches = matchingItems(hubState.items, { interests: prefs.categories, areaKey: currentAreaKey(), uid: authState.user?.uid }).slice(0, 12);
  const requests = matchHelpRequests(state.requests || [], { uid: authState.user?.uid, categories: prefs.categories, area: state.profile.area }).slice(0, 3);
  return `<div class="v3-hub-content"><h2>Passend f\xFCr dich</h2><p class="v3-subtext">Vorschl\xE4ge nach Gemeinde und Interessen, ohne automatische Standortverfolgung.</p>
 ${requests.length ? `<h3>Nachbarschaftshilfe</h3>${requests.map((req) => `<article class="v3-listing-card"><strong>${escapeHtml(req.title)}</strong><p>${escapeHtml(req.category || "")}</p><button class="secondary-button small" data-route="bulletin">Zum Schwarzen Brett</button></article>`).join("")}` : ""}
 <h3>Weitere Quartierangebote</h3><div class="v3-listing-grid">${matches.length ? matches.map(hubItemCard).join("") : '<div class="empty">Keine passenden Angebote. Lege Interessen im Profil fest oder pr\xFCfe sp\xE4ter erneut.</div>'}</div></div>`;
}
function hubDigest() {
  const p = hubSettings(), recent = hubState.items.filter((item) => item.status === "published" && Date.parse(item.createdAt) > Date.now() - 7 * 864e5);
  const selected = p.topics || [];
  const matched = recent.filter((item) => ({ lend: "lending", market: "market", calendar: "municipality", group: "groups", project: "groups", lost: "municipality" })[item.kind] === void 0 || selected.includes({ lend: "lending", market: "market", calendar: "municipality", group: "groups", project: "groups", lost: "municipality" }[item.kind])).slice(0, 12);
  return `<div class="v3-hub-content"><h2>Meine Benachrichtigungen</h2><p class="v3-subtext">Bestimme, was dich interessiert. Die Zusammenfassung ist hier in Quartinaut sichtbar; automatische E-Mail- oder Push-Zustellung muss separat eingerichtet werden.</p>
 <form class="v3-form" id="v3DigestForm"><fieldset><legend>Themen</legend><div class="v3-check-grid">${NOTIFY_TOPICS.map(([id, label]) => `<label><input name="topics" type="checkbox" value="${id}" ${selected.includes(id) ? "checked" : ""}> ${escapeHtml(label)}</label>`).join("")}</div></fieldset>
 <label>Zusammenfassung anzeigen<select name="digest"><option value="off" ${p.digest === "off" ? "selected" : ""}>Keine \xDCbersicht</option><option value="daily" ${p.digest === "daily" ? "selected" : ""}>T\xE4gliche \xDCbersicht</option><option value="weekly" ${p.digest === "weekly" ? "selected" : ""}>W\xF6chentliche \xDCbersicht</option></select></label>
 <label><input type="checkbox" name="quietHours" ${p.quietHours ? "checked" : ""}> Ruhezeit bevorzugen</label><button class="primary-button" type="submit">Einstellungen speichern</button></form>
 <h3>Neue Inhalte der letzten 7 Tage</h3>${matched.length ? `<div class="v3-listing-grid">${matched.slice(0, 5).map(hubItemCard).join("")}</div>` : '<p class="empty">Keine neuen Quartierangebote in den gew\xE4hlten Themen.</p>'}</div>`;
}
function hubRsvp() {
  const events = upcomingCommunityEvents();
  return `<div class="v3-hub-content"><h2>Veranstaltungen & Zusagen</h2><p class="v3-subtext">Veranstaltungen aus Version 2.1 bleiben bestehen. Sage hier f\xFCr einen Anlass zu oder ab.</p>
 <div class="v3-listing-grid">${events.length ? events.map((e) => `<article class="v3-listing-card"><strong>${escapeHtml(e.title)}</strong><p>${communityDate(e.startsAt)} \xB7 ${escapeHtml(e.venue)}</p><div class="row-actions"><button class="secondary-button small" data-v3-rsvp="${hubState.rsvps.includes(e.id) ? "cancel" : "rsvp"}" data-id="${escapeHtml(e.id)}">${hubState.rsvps.includes(e.id) ? "Teilnahme absagen" : "Teilnahme zusagen"}</button>${e.uid === authState.user.uid ? `<button class="ghost-button small" data-v3-capacity="${escapeHtml(e.id)}">Pl\xE4tze festlegen</button>` : ""}</div></article>`).join("") : '<div class="empty">Aktuell keine \xF6ffentlichen Anl\xE4sse.</div>'}</div><button class="ghost-button" data-route="events">Alle Veranstaltungen</button></div>`;
}
function hubDraft() {
  return `<div class="v3-hub-content"><h2>Textassistent</h2><p>Beschreibe kurz dein Anliegen. Quartinaut erstellt daraus zun\xE4chst lokal einen fertigen Textentwurf.</p>
 <form class="v3-form" id="v3DraftForm"><label>Meine Idee<textarea name="topic" rows="4" minlength="8" maxlength="500" required placeholder="Ich w\xFCrde gerne meine Bohrmaschine am Wochenende verleihen \u2026"></textarea></label>
 <label>Kategorie<select name="kind"><option value="help">Nachbarschaftshilfe</option><option value="lend">Leihb\xF6rse</option><option value="market">Marktplatz</option><option value="group">Verein / Gruppe</option><option value="project">Quartier-Projekt</option></select></label>
 <div class="row-actions"><button class="secondary-button" data-v3-draft="local" type="button">Lokale Vorlage erstellen</button></div>

 <label>Titel<input name="title" maxlength="100"></label><label>Beschreibung<textarea name="description" rows="5" maxlength="1200"></textarea></label><button class="primary-button" data-v3-draft-copy type="button">Text kopieren</button>
 <p class="v3-subtext">Die Textvorlage wird lokal erstellt; es werden keine Texte an KI-Dienste \xFCbertragen. Texte werden nie automatisch ver\xF6ffentlicht.</p></form></div>`;
}
function hubCalendar() {
  const rows = hubState.items.filter((i) => i.kind === "calendar" && i.status === "published").sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const events = upcomingCommunityEvents();
  return `<div class="v3-hub-content"><h2>Gemeindekalender</h2><p class="v3-subtext">\xD6ffentliche Termine der Gemeinde und Veranstaltungen aus Quartinaut. Erinnerung \xFCber den pers\xF6nlichen Kalender m\xF6glich.</p>
 <div class="v3-listing-grid">${rows.map(hubItemCard).join("")}${events.slice(0, 12).map((e) => `<article class="v3-listing-card"><strong>${escapeHtml(e.title)}</strong><p>${communityDate(e.startsAt)} \xB7 ${escapeHtml(e.venue)}</p><button class="ghost-button small" data-v3-calendar-event="${escapeHtml(e.id)}">In Kalender \xFCbernehmen</button></article>`).join("") || '<div class="empty">Noch keine Gemeinde-Termine vorhanden.</div>'}</div></div>`;
}
function hubStats() {
  if (!isAdminRole()) return '<div class="v3-hub-content"><h2>Verwaltungs-Dashboard</h2><p class="v3-safety-note">Nur f\xFCr freigeschaltete Verwaltungsrollen verf\xFCgbar. Die Rolle wird auf dem Server gepr\xFCft.</p></div>';
  const stat = hubState.stats?.counts;
  return `<div class="v3-hub-content"><h2>Verwaltungs-Dashboard</h2><p class="v3-subtext">Serverseitige \xDCbersicht f\xFCr deinen zugewiesenen Verwaltungsbereich.</p>
 <button class="secondary-button small" data-v3-stats="reload">Statistik laden</button>${stat ? `<div class="v3-stats-grid"><article><strong>${stat.items}</strong><small>Quartier+-Eintr\xE4ge</small></article><article><strong>${stat.users}</strong><small>Konten im Gebiet (bis 500)</small></article></div>
 <h3>Eintr\xE4ge nach Funktion</h3>${Object.entries(stat.kinds || {}).map(([k, v]) => `<p>${escapeHtml(hubLabel(k))}: <strong>${v}</strong></p>`).join("")}${hubState.stats.limited ? '<p class="v3-safety-note">Die \xDCbersicht ist bei 500 Dokumenten begrenzt und keine vollst\xE4ndige Gesamtauswertung.</p>' : ""}` : ""}</div>`;
}
function renderQuartierPlus() {
  const section = hubState.section || "all", selected = [...HUB_MODULES, ...V50_NAV].find((m) => m.id === section);
  const contents = { match: hubMatch, digest: hubDigest, rsvp: hubRsvp, draft: hubDraft, calendar: hubCalendar, stats: hubStats, v50calendar: () => renderV50("v50calendar"), v50loans: () => renderV50("v50loans"), v50associations: () => renderV50("v50associations"), v50market: () => renderV50("v50market") };
  let content = selected ? contents[section]?.() || (HUB_KINDS.has(section) ? hubList(section) : "") : renderV53HubGroups();
  return `<section class="v3-hub-page"><header class="v3-hub-hero"><span class="v3-eyebrow">Quartinaut \xB7 Gemeindeplattform</span>
 <h1>${selected ? escapeHtml(selected.title) : "Quartier+"}</h1><p>${selected ? escapeHtml(selected.description || selected.desc || "") : "Alles f\xFCr dein Quartier \u2013 \xFCbersichtlich nach Themen geordnet."}</p>
 <div class="row-actions">${selected ? '<button class="ghost-button small" data-v3-open="all">\u2190 Alle Funktionen</button>' : ""}<button class="ghost-button small" ${hubState.section.startsWith("v50") ? "data-v50-reload" : "data-v3-reload"} ${(hubState.section.startsWith("v50") ? v50.busy : hubState.loading) ? "disabled" : ""}>\u21BB Aktualisieren</button></div></header>
 ${selected ? renderV53RelatedTabs(section) : ""}
 ${hubState.loading ? '<p class="v3-safety-note">Quartierangebote werden geladen \u2026</p>' : ""}
 ${hubState.error ? `<p class="v3-safety-note" role="alert">${escapeHtml(hubState.error)}</p>` : ""}
 ${HUB_KINDS.has(section) ? v46FilterControls() : ""}
 ${content}</section>`;
}
function openHubCreate(kind) {
  if (!hubState.loaded) {
    toast("Die Quartierfunktionen m\xFCssen erst verbunden werden.");
    return;
  }
  const meta = HUB_MODULES.find((m) => m.id === kind), cats = HUB_CATEGORIES[kind] || [];
  const price = ["market", "lend"].includes(kind), place = kind === "calendar" || kind === "project", capacity = ["group", "project"].includes(kind);
  openModal("Neuer Eintrag \xB7 " + (meta?.title || "Quartier+"), `<form class="form-grid" id="v3HubCreate">
 <p class="help">Neue \xF6ffentliche Angebote werden vor der Ver\xF6ffentlichung gepr\xFCft. Kontaktaufnahme erfolgt privat.</p>
 <label>Titel<input name="title" required minlength="5" maxlength="100"></label>
 <label>Kategorie<select name="category">${cats.map((c) => `<option>${escapeHtml(c)}</option>`).join("")}</select></label>
 <label>Beschreibung<textarea name="description" required minlength="12" maxlength="1200"></textarea></label>
 ${postPhotoField()}
 ${price ? '<label>Preis in CHF (0 = kostenlos)<input name="priceChf" type="number" min="0" max="100000" step="0.01" value="0"></label>' : ""}
 ${place ? '<label>Datum / Beginn<input name="startsAt" type="datetime-local" required></label><label>\xD6ffentlicher Treffpunkt<input name="venue" maxlength="120" placeholder="z. B. Dorfplatz"></label>' : ""}
 ${capacity ? '<label>Maximale Teilnehmende (0 = offen)<input name="capacity" type="number" min="0" max="300" value="0"></label>' : ""}
 ${kind === "issue" ? '<p class="help">Keine privaten Adressen oder personenbezogenen Informationen von Dritten ver\xF6ffentlichen. Die Meldung wird nur intern sichtbar.</p>' : ""}
 <button class="primary-button" type="submit">${kind === "issue" ? "Meldung erfassen" : "Zur Pr\xFCfung einreichen"}</button></form>`, (modal, close) => {
    modal.dataset.draftContext = kind;
    const hubForm = modal.querySelector("#v3HubCreate");
    const hubPhotos = mountPostPhotoPicker(hubForm, kind);
    hubForm?.addEventListener("input", () => {
      if (hubForm.dataset.v47Sending !== "yes") delete hubForm.dataset.v47OpId;
    });
    hubForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      const f = event.currentTarget;
      if (f.dataset.v47Sending === "yes") return;
      const btn = f.querySelector("button[type=submit]");
      btn.disabled = true;
      f.dataset.v47Sending = "yes";
      f.dataset.v47OpId ||= makeOperationId("hubcreate");
      const opId = f.dataset.v47OpId;
      const item = Object.fromEntries(new FormData(f).entries());
      item.kind = kind;
      if (item.startsAt) item.startsAt = new Date(item.startsAt).toISOString();
      runAsyncAction(async () => {
        try {
          const photos = await hubPhotos;
          await photos.ready;
          item.photoPaths = await uploadPostPhotos("community", opId, photos.selected);
          await hubAction("create", { item, opId }, "Eintrag wurde gespeichert.");
          f.dataset.photoSaved = "yes";
          close(true);
        } finally {
          btn.disabled = false;
          delete f.dataset.v47Sending;
        }
      });
    });
  });
}
async function openHubGroup(id) {
  const result = await callQuartinaut("quartinautHub", { action: "group.posts", id });
  const group = hubState.items.find((i) => i.id === id);
  openModal("Gruppe \xB7 " + (group?.title || ""), `<div class="v3-thread v44-group-feed">${(result.posts || []).map((post) => `<article class="v3-thread-bubble v44-post">${v44PostHead(post.authorName || "Gruppenmitglied", group?.area || "", communityDate(post.createdAt), "Gruppenbeitrag")}<div class="v44-post-body"><p>${escapeHtml(post.message)}</p></div>${postPhotoGallery(post.photoPaths)}${v44FeedActions("group_post", post.id)}</article>`).join("") || "<p>Noch keine Beitr\xE4ge. Starte das Gespr\xE4ch.</p>"}</div>
  <form id="v3GroupPost" class="form-grid"><label>Neuer Beitrag<textarea name="message" required minlength="3" maxlength="500"></textarea></label>${postPhotoField()}<button class="primary-button" type="submit">Beitrag teilen</button></form>`, (modal, close) => {
    nativeWeb?.bind();
    queueMicrotask(() => void v44LoadSocial());
    const groupForm = modal.querySelector("#v3GroupPost");
    const groupPhotos = mountPostPhotoPicker(groupForm, id);
    groupForm?.addEventListener("input", () => {
      if (groupForm.dataset.v47Sending !== "yes") delete groupForm.dataset.v47OpId;
    });
    groupForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      const f = event.currentTarget;
      if (f.dataset.v47Sending === "yes") return;
      f.dataset.v47Sending = "yes";
      f.querySelector("button[type=submit]").disabled = true;
      f.dataset.v47OpId ||= makeOperationId("hubgroup");
      const opId = f.dataset.v47OpId;
      const message = new FormData(f).get("message");
      runAsyncAction(async () => {
        try {
          const photos = await groupPhotos;
          await photos.ready;
          const photoPaths = await uploadPostPhotos("groups", opId, photos.selected);
          await callQuartinaut("quartinautHub", { action: "group.post", id, message, photoPaths, opId });
          f.dataset.photoSaved = "yes";
          close(true);
          await openHubGroup(id);
        } finally {
          delete f.dataset.v47Sending;
          f.querySelector("button[type=submit]").disabled = false;
        }
      });
    });
  });
}
function openHubSeries() {
  openModal("Wiederkehrende Veranstaltung", `<form id="v3EventSeries" class="form-grid">
  <p class="help">F\xFCr w\xF6chentliche oder monatliche Vereinstreffen. Maximal 12 Termine, jeweils mit Freigabepr\xFCfung.</p>
  <label>Titel<input name="title" minlength="5" maxlength="100" required></label><label>Beschreibung<textarea name="description" minlength="15" maxlength="600" required></textarea></label>
  <label>Kategorie<select name="category"><option>Verein</option><option>Nachbarschaft</option><option>Kultur</option><option>Sport</option><option>Gemeinde</option><option>Familie</option></select></label>
  <label>Beginn<input type="datetime-local" name="startsAt" required></label><label>\xD6ffentlicher Treffpunkt<input name="venue" maxlength="120" required></label>
  <label>Wiederholung<select name="interval"><option value="weekly">W\xF6chentlich</option><option value="monthly">Monatlich</option></select></label>
  <label>Anzahl Termine<input type="number" name="count" min="2" max="12" value="4" required></label><button class="primary-button" type="submit">Serie zur Pr\xFCfung einreichen</button></form>`, (modal, close) => {
    modal.querySelector("#v3EventSeries")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const f = event.currentTarget;
      const values = Object.fromEntries(new FormData(f).entries());
      values.count = Number(values.count);
      values.startsAt = new Date(values.startsAt).toISOString();
      runAsyncAction(async () => {
        const result = await callQuartinaut("quartinautEventPlus", { action: "series", ...values });
        close(true);
        await loadCommunityFeatures();
        toast(result.count + " Veranstaltungen zur Pr\xFCfung eingereicht.");
      });
    });
  });
}
function hubCalendarFile(item) {
  const esc2 = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const dt = (v) => new Date(v).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = item.startsAt || dateNow(), end = item.endsAt || new Date(Date.parse(start) + 36e5).toISOString();
  const data = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Quartinaut//Quartierkalender//DE", "BEGIN:VEVENT", "UID:" + esc2(item.id) + "@quartinaut.web.app", "DTSTAMP:" + dt((/* @__PURE__ */ new Date()).toISOString()), "DTSTART:" + dt(start), "DTEND:" + dt(end), "SUMMARY:" + esc2(item.title), "DESCRIPTION:" + esc2(item.description), "LOCATION:" + esc2(item.venue), "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const blob = new Blob([data], { type: "text/calendar;charset=utf-8" }), url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url;
  a.download = "quartinaut-termin.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}
async function openHubThread(id) {
  hubState.activeThread = id;
  const res = await callQuartinaut("quartinautHub", { action: "messages.thread", id });
  hubState.messages = res.messages || [];
  const thread = hubState.threads.find((t) => t.id === id);
  openModal("Nachrichten \xB7 " + (thread?.itemTitle || "Quartier+"), `<div class="v3-thread">${hubState.messages.map((m) => `<div class="v3-thread-bubble ${m.senderUid === authState.user?.uid ? "mine" : ""}"><p>${escapeHtml(m.text)}</p><small>${communityDate(m.createdAt)}</small></div>`).join("") || "<p>Noch keine Nachrichten.</p>"}</div>
 <form id="v3ThreadReply" class="form-grid"><label>Antwort<textarea name="message" maxlength="500" minlength="2" required></textarea></label><button class="primary-button">Antwort senden</button></form>`, (modal, close) => {
    modal.querySelector("#v3ThreadReply")?.addEventListener("input", (event) => {
      if (event.currentTarget.dataset.v47Sending !== "yes") delete event.currentTarget.dataset.v47OpId;
    });
    modal.querySelector("#v3ThreadReply")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const f = event.currentTarget;
      if (f.dataset.v47Sending === "yes") return;
      f.dataset.v47OpId ||= makeOperationId("hubreply");
      const opId = f.dataset.v47OpId;
      f.dataset.v47Sending = "yes";
      f.querySelector("button").disabled = true;
      runAsyncAction(async () => {
        try {
          await callQuartinaut("quartinautHub", { action: "messages.reply", id, message: new FormData(f).get("message"), opId });
          close();
          await loadHub(true);
          await openHubThread(id);
        } finally {
          delete f.dataset.v47Sending;
          f.querySelector("button").disabled = false;
        }
      });
    });
  });
}
function bindHubControls() {
  document.querySelectorAll("[data-v3-home]").forEach((select) => select.addEventListener("change", () => {
    const value = saveHome(authState.user?.uid, select.value);
    hubState.settings = { ...hubSettings(), homeView: value };
    runAsyncAction(async () => {
      try {
        await callQuartinaut("quartinautHub", { action: "settings.save", settings: hubSettings() });
        toast("Startseite gespeichert.");
      } catch {
        toast("Startseite auf diesem Ger\xE4t gespeichert. Cloud-Synchronisierung nicht m\xF6glich.");
      }
    });
  }));
  document.querySelectorAll("[data-v3-open]").forEach((btn) => btn.addEventListener("click", () => {
    hubState.section = btn.dataset.v3Open || "all";
    hubState.search = "";
    setRoute("hub");
    if (!hubState.loaded) void loadHub();
  }));
  document.querySelectorAll("[data-v3-reload]").forEach((btn) => btn.addEventListener("click", () => void loadHub(true)));
  document.querySelectorAll("[data-v3-search]").forEach((form) => form.addEventListener("submit", (event) => {
    event.preventDefault();
    hubState.search = String(new FormData(form).get("q") || "").slice(0, 100);
    render();
  }));
  document.querySelectorAll("[data-v3-create]").forEach((btn) => btn.addEventListener("click", () => openHubCreate(btn.dataset.v3Create)));
  document.querySelectorAll("[data-v3-item-action]").forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => hubAction(btn.dataset.v3ItemAction, { id: btn.dataset.id, status: btn.dataset.status }, "Aktion erfolgreich."))));
  document.querySelectorAll("[data-v3-contact]").forEach((btn) => btn.addEventListener("click", () => {
    openModal("Private Anfrage", `<form id="v3ContactForm" class="form-grid"><label>Deine Nachricht<textarea name="message" required minlength="2" maxlength="500" placeholder="Hallo, ich h\xE4tte Interesse \u2026"></textarea></label><button class="primary-button">Nachricht senden</button></form>`, (modal, close) => {
      const contactForm = modal.querySelector("#v3ContactForm");
      contactForm.addEventListener("input", () => {
        if (contactForm.dataset.v47Sending !== "yes") delete contactForm.dataset.v47OpId;
      });
      contactForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const f = event.currentTarget;
        if (f.dataset.v47Sending === "yes") return;
        f.dataset.v47OpId ||= makeOperationId("hubsend");
        const opId = f.dataset.v47OpId;
        f.dataset.v47Sending = "yes";
        f.querySelector("button").disabled = true;
        runAsyncAction(async () => {
          try {
            await hubAction("messages.send", { id: btn.dataset.v3Contact, message: new FormData(f).get("message"), opId }, "Nachricht gesendet.");
            close();
          } finally {
            delete f.dataset.v47Sending;
            f.querySelector("button").disabled = false;
          }
        });
      });
    });
  }));
  document.querySelectorAll("[data-v3-group]").forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => openHubGroup(btn.dataset.v3Group))));
  document.querySelectorAll("[data-v3-series]").forEach((btn) => btn.addEventListener("click", openHubSeries));
  document.querySelectorAll("[data-v3-thread]").forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => openHubThread(btn.dataset.v3Thread))));
  document.querySelectorAll("[data-v3-calendar]").forEach((btn) => btn.addEventListener("click", () => {
    const item = hubState.items.find((i) => i.id === btn.dataset.v3Calendar);
    if (item) hubCalendarFile(item);
  }));
  document.querySelectorAll("[data-v3-calendar-event]").forEach((btn) => btn.addEventListener("click", () => {
    const e = upcomingCommunityEvents().find((i) => i.id === btn.dataset.v3CalendarEvent);
    if (e) hubCalendarFile(e);
  }));
  document.querySelectorAll("[data-v3-rsvp]").forEach((btn) => btn.addEventListener("click", () => runAsyncAction(async () => {
    await callQuartinaut("quartinautEventPlus", { action: btn.dataset.v3Rsvp, id: btn.dataset.id });
    await loadHub(true);
    toast("Teilnahme aktualisiert.");
  })));
  document.querySelectorAll("[data-v3-capacity]").forEach((btn) => btn.addEventListener("click", () => {
    const answer = window.prompt("Maximale Pl\xE4tze (0 = unbegrenzt):", "0");
    if (answer === null) return;
    runAsyncAction(async () => {
      await callQuartinaut("quartinautEventPlus", { action: "capacity", id: btn.dataset.v3Capacity, capacity: Number(answer) });
      toast("Kapazit\xE4t gespeichert.");
    });
  }));
  document.querySelectorAll("[data-v3-stats]").forEach((btn) => btn.addEventListener("click", () => runAsyncAction(async () => {
    hubState.stats = await callQuartinaut("quartinautHub", { action: "stats" });
    render();
  })));
  byId("v3DigestForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const f = event.currentTarget;
    const settings = { ...hubSettings(), topics: [...f.querySelectorAll("[name=topics]:checked")].map((i) => i.value), digest: f.elements.digest.value, quietHours: f.elements.quietHours.checked };
    runAsyncAction(async () => {
      const result = await callQuartinaut("quartinautHub", { action: "settings.save", settings });
      hubState.settings = result.settings;
      render();
      toast("Benachrichtigungsw\xFCnsche gespeichert.");
    });
  });
  document.querySelectorAll("[data-v3-draft]").forEach((btn) => btn.addEventListener("click", () => runAsyncAction(async () => {
    const form = byId("v3DraftForm");
    if (!form) return;
    const topic = form.elements.topic.value, kind = form.elements.kind.value;
    if (topic.trim().length < 8) {
      toast("Bitte etwas ausf\xFChrlicher beschreiben.");
      return;
    }
    let draft;
    draft = localDraft(topic, kind);
    form.elements.title.value = draft.title || "";
    form.elements.description.value = draft.description || "";
    toast("Entwurf erstellt \u2013 pr\xFCfe die Angaben vor der Ver\xF6ffentlichung.");
  })));
  document.querySelectorAll("[data-v3-draft-copy]").forEach((btn) => btn.addEventListener("click", () => {
    const form = byId("v3DraftForm");
    if (!form) return;
    const text = form.elements.title.value + "\n\n" + form.elements.description.value;
    if (navigator.clipboard?.writeText) runAsyncAction(() => navigator.clipboard.writeText(text).then(() => toast("Text kopiert.")));
  }));
}
function render() {
  stopDashboardMasonry();
  const accountGated = Boolean(authState.user) && (isAccountDisabled() || isAccountPendingApproval());
  document.body.classList.toggle("is-authenticated", Boolean(authState.user));
  document.body.classList.toggle("is-auth-gated", !authState.user || accountGated);
  document.body.classList.remove("v2-simple-mode");
  const inboxShortcut = document.querySelector(".v21-inbox-shortcut");
  if (inboxShortcut) {
    inboxShortcut.hidden = !authState.user || accountGated;
    const n = inboxShortcut.querySelector(".v21-inbox-count");
    const count = authState.user ? inboxUnreadCount() : 0;
    if (n) {
      n.hidden = count === 0;
      n.textContent = count > 99 ? "99+" : String(count);
    }
  }
  const profileLink = document.querySelector(".v2-profile-link");
  if (profileLink) profileLink.hidden = !authState.user || accountGated;
  const logoutButton = byId("logoutButton");
  const helpButton = byId("helpButton");
  const headerAuthActions = byId("headerAuthActions");
  if (logoutButton) logoutButton.hidden = !authState.user && !authState.profileError;
  if (helpButton) helpButton.hidden = false;
  if (headerAuthActions) headerAuthActions.hidden = Boolean(authState.user || authState.profileError);
  if (!authState.ready) {
    byId("main").innerHTML = renderAuthLoading();
    renderNotificationPermissionBanner();
    applyI18n(document.body);
    enhanceInterface(byId("main"), { page: "account" });
    return;
  }
  if (authState.profileError) {
    document.querySelectorAll(".nav-item").forEach((btn) => btn.classList.remove("active"));
    byId("main").innerHTML = `
      <section class="auth-layout auth-loading-layout" aria-live="polite">
        <article class="auth-copy">
          <span class="eyebrow">Anmeldung best\xE4tigt</span>
          <h1>Dein Profil konnte nicht geladen werden.</h1>
          <p>Deine Anmeldung wurde best\xE4tigt, aber Quartinaut konnte dein Benutzerprofil noch nicht laden. Versuche zun\xE4chst, das Profil erneut zu laden.</p>
          <p class="form-error critical">${escapeHtml(authState.profileError)}</p>
          <button class="primary-button" id="retryFirebaseProfileButton" type="button">Profil erneut laden</button>
          <p class="muted">Falls der Fehler bestehen bleibt, sende der Quartinaut-Verwaltung die Fehlermeldung. Deine Kontodaten werden dadurch nicht gel\xF6scht.</p>
        </article>
      </section>`;
    byId("retryFirebaseProfileButton")?.addEventListener("click", (event) => {
      event.currentTarget.disabled = true;
      if (firebaseProfileRetryHandler) void firebaseProfileRetryHandler();
    });
    renderNotificationPermissionBanner();
    applyI18n(document.body);
    enhanceInterface(byId("main"), { page: "account" });
    return;
  }
  if (authState.verifyPending) {
    document.querySelectorAll(".nav-item").forEach((btn) => btn.classList.remove("active"));
    byId("main").innerHTML = renderEmailVerificationGate();
    bindEmailVerificationGate();
    renderNotificationPermissionBanner();
    applyI18n(document.body);
    enhanceInterface(byId("main"), { page: "account" });
    return;
  }
  if (!authState.user) {
    document.querySelectorAll(".nav-item").forEach((btn) => btn.classList.remove("active"));
    byId("main").innerHTML = renderAuthGate();
    bindAuthGate();
    renderNotificationPermissionBanner();
    applyI18n(document.body);
    enhanceInterface(byId("main"), { page: "account" });
    return;
  }
  if (isAccountDisabled()) {
    document.querySelectorAll(".nav-item").forEach((btn) => btn.classList.remove("active"));
    byId("main").innerHTML = renderDisabledAccountGate();
    bindCurrentRoute();
    renderNotificationPermissionBanner();
    applyI18n(document.body);
    enhanceInterface(byId("main"), { page: "account" });
    return;
  }
  if (isAccountPendingApproval()) {
    document.querySelectorAll(".nav-item").forEach((btn) => btn.classList.remove("active"));
    byId("main").innerHTML = renderPendingAccountGate();
    bindCurrentRoute();
    renderNotificationPermissionBanner();
    applyI18n(document.body);
    enhanceInterface(byId("main"), { page: "account" });
    return;
  }
  pruneExpired();
  void pruneExpiredChatTrash();
  document.querySelectorAll(".nav-item").forEach((btn) => btn.classList.toggle("active", btn.dataset.route === state.route));
  const main = byId("main");
  persistInlineDraft();
  const routes = { home: renderHome, bulletin: renderBulletin, chats: renderChats, alarme: renderAlarme, profile: renderProfile, events: renderCommunityEvents, inbox: renderInbox, hub: renderQuartierPlus, search: renderGlobalSearch, map: renderQuartierMap, swissmap: renderSwissMapPage, saved: renderSavedCollection, drafts: renderDraftManager };
  main.innerHTML = '<div class="qn-page">' + (nativeWeb?.renderRoute(state.route) ?? (routes[state.route]?.() || renderHome())) + "</div>";
  if (v53Preferences().density) document.body.dataset.v53Density = v53Preferences().density;
  const breadcrumb = renderV53Breadcrumb();
  if (breadcrumb) main.insertAdjacentHTML("afterbegin", breadcrumb);
  restoreInlineDraft();
  enhanceInterface(main, { page: state.route === "hub" ? hubState.section : state.route });
  bindCurrentRoute();
  updateNavBadges();
  renderNotificationPermissionBanner();
  maybeShowOnboardingTour();
  applyI18n(document.body);
  nativeWeb?.bind();
  queueMicrotask(() => void v44LoadSocial());
}
var v46SearchUi = { q: "", type: "all", onlyArea: false, category: "", from: "", to: "" };
function v46Uid() {
  return authState.user?.uid || "guest";
}
function v46UserPrefs() {
  return readUserData(v46Uid(), "preferences", {});
}
function v46PrefsUpdate(patch) {
  const next = { ...v46UserPrefs(), ...patch };
  writeUserData(v46Uid(), "preferences", next);
  return next;
}
function v46FeedFilter() {
  const filter = v46UserPrefs().feedFilter;
  return V46_FILTERS.includes(filter) ? filter : "all";
}
function v46InboxFilter() {
  const filter = v46UserPrefs().inboxFilter;
  return V46_INBOX_TYPES.includes(filter) ? filter : "all";
}
function v46LastSeenAt() {
  return v46UserPrefs().bulletinLastSeenAt || "";
}
function v46HiddenKeys() {
  return cleanCollection(readUserData(v46Uid(), "hiddenPosts", []), 200);
}
function v46IsHidden(kind, id) {
  return v46HiddenKeys().includes(`${kind}:${id}`);
}
function v46SetHidden(kind, id, hidden) {
  if (!["request", "hub"].includes(kind) || !id) return;
  const key = `${kind}:${id}`;
  const keys = v46HiddenKeys().filter((k) => k !== key);
  if (hidden) keys.push(key);
  writeUserData(v46Uid(), "hiddenPosts", keys);
  toast(hidden ? "Beitrag nur f\xFCr dich ausgeblendet." : "Beitrag wieder eingeblendet.");
  render();
}
function v46DiagnosticCount() {
  return (readUserData(v46Uid(), "localDiagnostics", []) || []).length;
}
function v46RecordError(type) {
  const list = readUserData(v46Uid(), "localDiagnostics", []);
  if (!Array.isArray(list)) return;
  list.push({ type: type === "promise" ? "promise" : "script", at: nowIso() });
  writeUserData(v46Uid(), "localDiagnostics", list.slice(-20));
}
window.addEventListener("error", () => v46RecordError("script"));
window.addEventListener("unhandledrejection", () => v46RecordError("promise"));
function v46SavedPostKeys() {
  if (nativeWeb) return nativeWeb.model.favorites.map((x) => (x.kind === "request" ? "request:" : "hub:") + (x.itemId || x.id));
  if (v47Sync) return v47Sync.favoriteList().filter((x) => ["request", "hub"].includes(x.kind)).map((x) => `${x.kind}:${x.value}`);
  try {
    return cleanCollection(JSON.parse(localStorage.getItem(v44Social.bookmarkPrefix + v46Uid()) || "[]"), 250);
  } catch {
    return [];
  }
}
function v46FilterControls() {
  const current = v46FeedFilter();
  const labels = [["all", "Alle"], ["mine", "Meine Gemeinde"], ["photos", "Nur Fotos"], ["new", "Seit letztem Besuch"], ["saved", "Favoriten"]];
  return `<nav class="v46-filters" aria-label="Beitr\xE4ge filtern">${labels.map(([id, label]) => `<button type="button" class="${current === id ? "active" : ""}" data-v46-feed="${id}" aria-pressed="${current === id}">${label}</button>`).join("")}</nav>${current === "new" && !v46LastSeenAt() ? '<p class="v46-muted">Ab deinem n\xE4chsten Besuch werden neue Beitr\xE4ge hier angezeigt.</p>' : ""}`;
}
function v46Favorites() {
  if (v47Sync) return { people: v47Sync.favoriteList("people").map((x) => x.value), groups: v47Sync.favoriteList("groups").map((x) => x.value), searches: v47Sync.favoriteList("searches").map((x) => x.value) };
  const raw = readUserData(v46Uid(), "favorites", {});
  return { people: cleanCollection(raw.people), groups: cleanCollection(raw.groups), searches: cleanCollection(raw.searches, 30) };
}
function v46ToggleFavorite(kind, name) {
  if (!["people", "groups", "searches"].includes(kind)) return;
  const key = String(name || "").trim().slice(0, 100);
  if (!key) return;
  if (v47Sync) {
    const active = !v47Sync.isFavorite(kind, key);
    v47Sync.setFavorite(kind, key, active);
    toast(active ? "Zu Favoriten hinzugef\xFCgt." : "Aus Favoriten entfernt.");
    render();
    return;
  }
  const f = v46Favorites();
  f[kind] = f[kind].includes(key) ? f[kind].filter((x) => x !== key) : [...f[kind], key].slice(-100);
  writeUserData(v46Uid(), "favorites", f);
  toast(f[kind].includes(key) ? "Zu Favoriten hinzugef\xFCgt." : "Aus Favoriten entfernt.");
  render();
}
function v46SearchData() {
  return publicSearchIndex({ requests: state.requests.filter((x) => !v46IsHidden("request", x.id)), hubs: hubState.items.filter((x) => !v46IsHidden("hub", x.id)), events: localCommunityEvents(), notices: state.officialNotices });
}
async function v47LoadSearch(page = 0) {
  if (!isFirebaseMode() || !authState.user) {
    v47SearchState = { ...v47SearchState, rows: [], loading: false, error: "Die vollst\xE4ndige Suche ben\xF6tigt eine Firebase-Anmeldung." };
    render();
    return;
  }
  const generation = ++v47SearchGeneration, uidBefore = authState.user.uid, epoch = accountEpoch;
  const cursor = page === 0 ? null : v47SearchState.next;
  v47SearchState = { ...v47SearchState, loading: true, error: "", page, rows: page === 0 ? [] : v47SearchState.rows };
  render();
  try {
    const result = await callQuartinaut("quartinautSearch", {
      query: v46SearchUi.q,
      type: v46SearchUi.type === "person" ? "request" : v46SearchUi.type,
      category: v46SearchUi.category,
      area: v46SearchUi.onlyArea ? state.profile.area : "",
      from: v46SearchUi.from ? `${v46SearchUi.from}T00:00:00` : null,
      to: v46SearchUi.to ? `${v46SearchUi.to}T23:59:59` : null,
      cursor
    });
    if (generation !== v47SearchGeneration || !currentAccountEpoch(uidBefore, epoch)) return;
    const history2 = page === 0 ? [null] : [...v47SearchState.history];
    if (page > 0) history2[page] = cursor;
    v47SearchState = { rows: Array.isArray(result.results) ? result.results.slice(0, 30) : [], next: result.nextCursor || null, history: history2, loading: false, error: "", page };
  } catch (error) {
    if (generation !== v47SearchGeneration || !currentAccountEpoch(uidBefore, epoch)) return;
    v47SearchState = { ...v47SearchState, loading: false, error: actionErrorMessage(error, "Die vollst\xE4ndige Suche ist derzeit nicht erreichbar. Bitte erneut versuchen.") };
  }
  render();
}
function v47SearchReset() {
  v47SearchState = { rows: [], cursor: null, history: [null], loading: false, error: "", page: 0, next: null };
  void v47LoadSearch(0);
}
function renderGlobalSearch() {
  const availableCategories = [.../* @__PURE__ */ new Set([...CATEGORIES, ...OFFICIAL_NOTICE_CATEGORIES, ...Object.values(HUB_CATEGORIES).flat(), "Nachbarschaft", "Verein", "Kultur", "Sport", "Gemeinde", "Familie"])].sort((a, b) => a.localeCompare(b, "de-CH"));
  const st = v47SearchState, categories = [["all", "Alle"], ["request", "Beitr\xE4ge"], ["hub", "Angebote"], ["group", "Vereine"], ["event", "Anl\xE4sse"], ["notice", "Gemeinde"]];
  const visibleRows = sortCurrentPageResults(st.rows, v48SearchOrder);
  return `<section class="v46-page v47-search" aria-label="Vollst\xE4ndige Suche">
 <header class="v2-page-header"><span class="v2-kicker">Beitr\xE4ge und Angebote finden</span><h1>Suche</h1>
 <p>Finde freigegebene Beitr\xE4ge, Angebote, Veranstaltungen und Mitteilungen, die du sehen darfst. Private Nachrichten und pers\xF6nliche Kontodaten sind von der Suche ausgenommen.</p></header>
 <form id="v46SearchForm" class="v46-searchbox"><label for="v46SearchInput">Wonach suchst du?</label>
 <div class="v46-searchline"><input id="v46SearchInput" name="q" type="search" maxlength="120" autocomplete="off" value="${escapeHtml(v46SearchUi.q)}" placeholder="Zum Beispiel Velo reparieren"><button class="primary-button" type="submit">Suchen</button></div></form>
 <nav class="v46-filters" aria-label="Suchkategorie">${categories.map(([v, label]) => `<button type="button" class="${v46SearchUi.type === v ? "active" : ""}" data-v46-search-type="${v}" aria-pressed="${v46SearchUi.type === v}">${label}</button>`).join("")}</nav>
 <details class="v53-search-options" ${v53SearchOptionsOpen || v46SearchUi.category || v46SearchUi.from || v46SearchUi.to || v46SearchUi.onlyArea || v48SearchOrder !== "relevance" ? "open" : ""}><summary>Erweiterte Filter und Sortierung</summary><div class="v47-search-filters"><fieldset class="v48-area-filter"><legend>Gemeinde</legend><label class="check-row"><input type="checkbox" id="v46OnlyArea" ${v46SearchUi.onlyArea ? "checked" : ""}> Nur ${escapeHtml(state.profile.area || "meine Gemeinde")}</label></fieldset>
 <label>Kategorie<select id="v47SearchCategory"><option value="">Alle Kategorien</option>${availableCategories.map((c) => `<option value="${escapeHtml(c)}" ${v46SearchUi.category === c ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}</select></label>
 <label>Von<input id="v47SearchFrom" type="date" value="${escapeHtml(v46SearchUi.from)}"></label>
 <label>Bis<input id="v47SearchTo" type="date" value="${escapeHtml(v46SearchUi.to)}"></label></div>
 <div class="v48-search-toolbar"><label for="v48SearchOrder">Treffer dieser Seite sortieren</label><select id="v48SearchOrder"><option value="relevance" ${v48SearchOrder === "relevance" ? "selected" : ""}>Standardreihenfolge</option><option value="name" ${v48SearchOrder === "name" ? "selected" : ""}>Titel A\u2013Z</option><option value="area" ${v48SearchOrder === "area" ? "selected" : ""}>Gemeinde A\u2013Z</option></select></div></details>
 <p class="v46-muted" aria-live="polite" role="status">${st.loading ? "Suche l\xE4uft \u2026" : st.error ? `Suche nicht verf\xFCgbar: ${escapeHtml(st.error)}` : `Seite ${st.page + 1} \xB7 ${st.rows.length} Treffer (maximal 30 je Seite)`}</p>
 ${st.error ? '<button class="secondary-button" type="button" data-v47-search-retry>Erneut versuchen</button>' : ""}
 <div class="v46-results">${visibleRows.map((r) => `<article class="card v46-result"><span class="badge">${escapeHtml(r.kind === "request" ? "Beitrag" : r.kind === "hub" ? "Quartier+" : r.kind === "event" ? "Anlass" : "Mitteilung")}</span><h3>${escapeHtml(r.title || "Eintrag")}</h3><p>${escapeHtml(String(r.detail || "").slice(0, 240))}</p><small>${escapeHtml(r.area || "")}</small><div class="row-actions"><button class="secondary-button small" data-v47-open-target="${escapeHtml(r.kind)}" data-target-id="${escapeHtml(r.id)}">Beitrag \xF6ffnen</button>${["request", "hub"].includes(r.kind) ? `<button class="ghost-button small" data-v47-save-target="${escapeHtml(r.kind)}" data-target-id="${escapeHtml(r.id)}">${v47Sync?.isFavorite(r.kind, r.id) ? "\u2605 Gemerkt" : "\u2606 Merken"}</button>` : ""}</div></article>`).join("") || (!st.loading && !st.error ? '<p class="empty">Keine passenden, zug\xE4nglichen Treffer.</p>' : "")}</div>
 <nav class="v47-pagination" aria-label="Suchseiten"><button class="ghost-button" type="button" data-v47-prev ${st.page === 0 || st.loading ? "disabled" : ""}>Vorherige Seite</button><span>Seite ${st.page + 1}</span><button class="secondary-button" type="button" data-v47-next ${!st.next || st.loading ? "disabled" : ""}>N\xE4chste Seite</button></nav>
 </section>`;
}
async function v47OpenResolvedTarget(target) {
  if (!target || !["request", "hub", "event", "notice", "chat"].includes(target.kind)) throw new Error("Dieses Ziel ist nicht mehr zug\xE4nglich.");
  if (target.kind === "chat") {
    let chat = state.chats.find((c) => c.id === target.id);
    if (!chat) {
      await syncStateFromFirestore();
      chat = state.chats.find((c) => c.id === target.id);
    }
    if (!chat) throw new Error("Der Chat wurde gel\xF6scht oder du hast keinen Zugriff mehr.");
    chatModalForChat(await ensureChatDocument(chat));
    return;
  }
  openModal(
    target.kind === "event" ? "Veranstaltung" : target.kind === "notice" ? "Gemeindemitteilung" : target.kind === "request" ? "Beitrag" : "Quartier+",
    `<article class="v47-target-detail"><h2>${escapeHtml(target.title)}</h2><p>${escapeHtml(target.detail || "Keine Beschreibung")}</p><small>${escapeHtml(target.area || "")} \xB7 ${escapeHtml(target.category || "")}</small></article>`
  );
}
async function v47OpenTarget(kind, id) {
  if (!authState.user) throw new Error("Zum \xD6ffnen bitte anmelden.");
  const uidBefore = authState.user.uid, epoch = accountEpoch;
  try {
    const result = await callQuartinaut("quartinautTarget", { kind, id });
    if (!currentAccountEpoch(uidBefore, epoch)) return;
    await v47OpenResolvedTarget(result.target);
  } catch (error) {
    const text = String(error?.code || "") + " " + String(error?.message || "");
    if (/not-found|permission-denied|nicht mehr zugänglich/.test(text)) throw new Error("Dieser Inhalt wurde gel\xF6scht oder du hast keinen Zugriff mehr.");
    throw error;
  }
}
async function v47ApplyDeepLink() {
  const params = new URLSearchParams(location.search);
  const kind = params.get("targetType"), id = params.get("targetId");
  if (!kind || !id || !authState.user) return;
  const key = kind + ":" + id;
  if (v47ActiveDeepLink === key) return;
  v47ActiveDeepLink = key;
  try {
    await v47OpenTarget(kind, id);
  } catch (error) {
    toast(actionErrorMessage(error, "Inhalt gel\xF6scht oder nicht mehr zug\xE4nglich."));
  }
}
async function v47StartOwnerSync(uid2) {
  if (!isFirebaseMode() || !firebaseStoreApi?.db || authState.user?.uid !== uid2) return;
  if (v47Sync?.uid === uid2) return;
  v47Sync?.dispose();
  const { db, collection, onSnapshot } = firebaseStoreApi;
  const expectedEpoch = accountEpoch;
  try {
    const sync = createOwnerSync({
      uid: uid2,
      callable: callQuartinaut,
      subscribe: (owner, coll, handler) => onSnapshot(collection(db, "communityUserSettings", owner, coll), (snapshot) => {
        if (currentAccountEpoch(owner, expectedEpoch)) handler(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      }, (error) => console.warn("[Quartinaut] Konto-Synchronisierung nicht verf\xFCgbar", error?.code || error?.message)),
      onChange: () => {
        if (currentAccountEpoch(uid2, expectedEpoch)) scheduleRender();
      },
      onError: (error) => console.warn("[Quartinaut] Vorgang bleibt lokal zur Wiederholung gespeichert", error?.code || error?.message)
    });
    v47Sync = sync;
    sync.subscribeOwnerCollections();
    const existing = readUserData(uid2, "favorites", {});
    const items = [...["people", "groups", "searches"].flatMap((kind) => (existing[kind] || []).map((value) => ({ kind, value })))];
    try {
      for (const key of JSON.parse(localStorage.getItem(v44Social.bookmarkPrefix + uid2) || "[]")) {
        const i = String(key).indexOf(":");
        if (i > 0) items.push({ kind: key.slice(0, i), value: key.slice(i + 1) });
      }
    } catch {
    }
    await sync.importLegacy(items);
    if (currentAccountEpoch(uid2, expectedEpoch)) await sync.flush();
  } catch (error) {
    console.warn("[Quartinaut] Sync bleibt auf diesem Ger\xE4t verf\xFCgbar:", error?.message || error);
  }
}
window.addEventListener("online", () => {
  v47Sync?.flush();
  if (state.route === "search" && v47SearchState.error) void v47LoadSearch(0);
});
function renderSavedCollection() {
  const f = v46Favorites(), keys = v46SavedPostKeys();
  const records = v46SearchData();
  const postCards = keys.map((key) => {
    const record = records.find((r) => ["request", "hub", "group"].includes(r.type) && key === (r.type === "request" ? "request:" : "hub:") + r.id);
    return record ? record.type === "request" ? requestCard(record.item) : hubItemCard(record.item) : `<article class="card v46-result"><p>Gespeicherter Beitrag (${escapeHtml(key)}) ist auf diesem Ger\xE4t nicht geladen.</p><button class="secondary-button small" data-v47-open-target="${escapeHtml(key.split(":")[0])}" data-target-id="${escapeHtml(key.split(":").slice(1).join(":"))}">Beitrag \xF6ffnen</button><button class="ghost-button small" data-v46-unbookmark="${escapeHtml(key)}">Aus Merkliste entfernen</button></article>`;
  });
  return `<section class="v46-page"><header class="v2-page-header"><h1>Meine Favoriten</h1><p>${v47Sync ? "Mit deinem Konto synchronisiert \u2013 \xC4nderungen werden auch offline vorgemerkt." : "Auf diesem Ger\xE4t gespeichert."} Beitr\xE4ge siehst du nur mit g\xFCltiger Berechtigung.</p></header><nav class="v46-shortcuts"><button type="button" data-route="search">\u{1F50E} Neue Suche</button><button type="button" data-route="drafts">\u270D\uFE0F Entw\xFCrfe</button></nav><h2>Beitr\xE4ge (${keys.length})</h2><div class="v46-results">${postCards.join("") || '<p class="v46-muted">Noch keine Beitr\xE4ge gemerkt.</p>'}</div><h2>Vereine</h2><div class="v46-fav-list">${f.groups.map((id) => {
    const x = hubState.items.find((i) => i.id === id && i.kind === "group" && i.status === "published");
    return `<div class="card v46-fav-row"><strong>${escapeHtml(x?.title || "Verein derzeit nicht geladen")}</strong><div><button class="ghost-button small" data-v46-fav="groups" data-value="${escapeHtml(id)}">Entfernen</button>${x ? `<button class="secondary-button small" data-v46-group="${escapeHtml(id)}">Ansehen</button>` : ""}</div></div>`;
  }).join("") || '<p class="v46-muted">Noch keine Vereine gespeichert.</p>'}</div><h2>Personen</h2><div class="v46-fav-list">${f.people.map((name) => `<div class="card v46-fav-row"><strong>${escapeHtml(name)}</strong><div><button class="ghost-button small" data-v46-fav="people" data-value="${escapeHtml(name)}">Entfernen</button><button class="secondary-button small" data-v46-person="${escapeHtml(name)}">\xD6ffentliche Beitr\xE4ge</button></div></div>`).join("") || '<p class="v46-muted">Noch keine Personen gemerkt.</p>'}</div><h2>Suchanfragen</h2><div class="v46-fav-list">${f.searches.map((q) => `<div class="card v46-fav-row"><strong>${escapeHtml(q)}</strong><div><button class="ghost-button small" data-v46-fav="searches" data-value="${escapeHtml(q)}">Entfernen</button><button class="secondary-button small" data-v46-search="${escapeHtml(q)}">Suchen</button></div></div>`).join("") || '<p class="v46-muted">Noch keine Suchanfragen gespeichert.</p>'}</div><h2>Ausgeblendete Beitr\xE4ge</h2><p class="v46-muted">Das Ausblenden wirkt nur auf diesem Ger\xE4t und ist keine Sperrung anderer Personen.</p><div class="v46-fav-list">${v46HiddenKeys().map((k) => {
    const [kind, ...rest] = k.split(":");
    return `<div class="card v46-fav-row"><span>${escapeHtml(k)}</span><button class="ghost-button small" data-v46-unhide="${escapeHtml(kind)}" data-id="${escapeHtml(rest.join(":"))}">Wieder anzeigen</button></div>`;
  }).join("") || '<p class="v46-muted">Keine ausgeblendeten Beitr\xE4ge.</p>'}</div></section>`;
}
function renderDraftManager() {
  const drafts = safeDrafts(localStorage, v46Uid());
  return `<section class="v46-page"><header class="v2-page-header"><h1>Meine Entw\xFCrfe</h1><p>Automatisch gespeicherte Texte bleiben 72 Stunden auf diesem Ger\xE4t erhalten. Sie werden niemals ohne dein Zutun ver\xF6ffentlicht.</p></header><p class="v46-muted">Fotoentw\xFCrfe werden im lokalen Ger\xE4tespeicher verwaltet und beim \xD6ffnen des Editors wiederhergestellt.</p><div class="v46-fav-list">${drafts.map((x) => `<article class="card v46-fav-row"><div><strong>${escapeHtml(x.title)}</strong><small>${communityDate(new Date(x.saved).toISOString())} \xB7 ${escapeHtml(x.form)}</small></div><div class="row-actions"><button type="button" class="secondary-button small" data-v46-edit-draft="${escapeHtml(x.context)}">Weiterbearbeiten</button><button type="button" class="ghost-button small" data-v46-discard-draft="${escapeHtml(x.key)}">Verwerfen</button></div></article>`).join("") || '<div class="empty">Keine Textentw\xFCrfe auf diesem Ger\xE4t vorhanden.</div>'}</div><div class="row-actions"><button type="button" class="primary-button" data-action="new-request">Neues Anliegen erstellen</button><button type="button" class="secondary-button" data-route="hub">Quartier+ \xF6ffnen</button></div></section>`;
}
function renderQuartierMap() {
  const all = [...state.requests.filter((x) => x.status === "offen"), ...hubState.items.filter((x) => x.status === "published" && x.kind !== "issue"), ...localCommunityEvents().filter((x) => x.status === "published")];
  const pins = all.map(safeMapPoint).filter(Boolean).slice(0, 100);
  const selected = pins.find((p) => p.id === v46MapSelection) || pins[0];
  return `<section class="v46-page"><header class="v2-page-header"><h1>Quartierkarte</h1><p>Es werden nur ver\xF6ffentlichte Eintr\xE4ge mit ausdr\xFCcklich hinterlegten Koordinaten gezeigt. Keine privaten Wohnadressen oder Standortabfragen.</p></header>${pins.length ? `<div class="v46-map-wrap"><div class="v46-map" role="group" aria-label="Schematische Karte der Schweiz">${pins.map((p) => `<button type="button" class="v46-map-pin ${selected?.id === p.id ? "active" : ""}" style="--pin-x:${((p.lng - 5.9) / (10.6 - 5.9) * 100).toFixed(2)}%;--pin-y:${((47.9 - p.lat) / (47.9 - 45.8) * 100).toFixed(2)}%" aria-label="${escapeHtml(p.title)}" data-v46-map-pin="${escapeHtml(p.id)}">\u25CF</button>`).join("")}<span class="v46-map-credit">Schematische Darstellung, keine amtliche Karte</span></div><div class="card v46-map-detail"><h2>${escapeHtml(selected.title || "Eintrag")}</h2><p>${escapeHtml(selected.area || "Schweiz")}</p><p>Koordinaten: ${selected.lat.toFixed(4)}, ${selected.lng.toFixed(4)}</p><button class="secondary-button" type="button" data-v46-osm="${escapeHtml(selected.id)}">In OpenStreetMap \xF6ffnen</button><p class="v46-muted">Beim \xD6ffnen wird die Position an OpenStreetMap \xFCbertragen.</p></div></div>` : '<div class="card"><p>Aktuell sind keine freigegebenen Beitr\xE4ge mit geeigneten Kartenkoordinaten geladen. Die App zeigt bewusst keine aus Ortsnamen gesch\xE4tzten oder privaten Standorte.</p><button type="button" class="secondary-button" data-route="search">Eintr\xE4ge ohne Karte durchsuchen</button></div>'}</section>`;
}
var v46MapSelection = "";
function v46GroupProfile(id) {
  const g = hubState.items.find((x) => x.id === id && x.kind === "group" && x.status === "published");
  if (!g) {
    toast("Verein nicht verf\xFCgbar.");
    return;
  }
  const fav = v46Favorites().groups.includes(id);
  const isMember = hubState.joins.includes(id) || g.ownerUid === authState.user?.uid;
  openModal("Verein / Gruppe", `<section class="v46-club-profile"><h2>${escapeHtml(g.title)}</h2><p>${escapeHtml(g.description || "")}</p><p><strong>Ort:</strong> ${escapeHtml(g.area || "Deine Gemeinde")}</p><p><strong>Kategorie:</strong> ${escapeHtml(g.category || "Verein")}</p><p><strong>Mitglieder/Teilnehmende:</strong> ${escapeHtml(g.memberCount || 0)}${g.capacity ? " von " + escapeHtml(g.capacity) : ""}</p><p class="v46-muted">Dieses Profil zeigt freigegebene Vereinsinformationen. Verifizierungsstatus nur aus einer serverseitig gepr\xFCften Gemeindebest\xE4tigung ableiten.</p><div class="row-actions"><button type="button" class="secondary-button" id="v46ClubMembership" ${g.ownerUid === authState.user?.uid ? "disabled" : ""}>${g.ownerUid === authState.user?.uid ? "Eigene Gruppe" : isMember ? "Teilnahme beenden" : "Teilnehmen"}</button><button type="button" class="ghost-button" id="v46ClubFavorite">${fav ? "\u2605 Gemerkt" : "\u2606 Merken"}</button></div></section>`, (modal, close) => {
    modal.querySelector("#v46ClubFavorite")?.addEventListener("click", () => {
      v46ToggleFavorite("groups", id);
      close();
    });
    modal.querySelector("#v46ClubMembership")?.addEventListener("click", () => runAsyncAction(async () => {
      await hubAction(isMember ? "leave" : "join", { id }, "Teilnahme aktualisiert.");
      close();
    }));
  });
}
function v46LoanReminder(id) {
  const x = hubState.items.find((item) => item.id === id && item.kind === "lend" && item.status === "published");
  if (!x) return;
  openModal("Ausleih-Erinnerung", `<form id="v46LoanReminderForm" class="form-grid"><p>Abholung und R\xFCckgabe werden als Kalenderdatei auf deinem Ger\xE4t erstellt. Dies ist <strong>keine best\xE4tigte Buchung</strong>; vereinbare die Termine privat mit der anderen Person.</p><label>Abholung<input name="pickup" type="datetime-local" required></label><label>R\xFCckgabe<input name="return" type="datetime-local" required></label><label>Notiz (optional)<textarea name="note" maxlength="250" placeholder="Vereinbarter Treffpunkt ohne sensible Angaben"></textarea></label><button class="primary-button" type="submit">Kalenderdatei herunterladen</button></form>`, (modal, close) => {
    modal.querySelector("#v46LoanReminderForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const pickup = new Date(f.elements.pickup.value), returned = new Date(f.elements.return.value);
      if (!Number.isFinite(pickup.getTime()) || !Number.isFinite(returned.getTime()) || returned <= pickup) {
        toast("R\xFCckgabe muss nach Abholung liegen.");
        return;
      }
      const esc2 = (str) => String(str || "").replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
      const time = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
      const name = esc2(x.title), lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Quartinaut//Leihboerse//DE", "BEGIN:VEVENT", "UID:loan-" + encodeURIComponent(id) + "@quartinaut.web.app", "DTSTAMP:" + time(/* @__PURE__ */ new Date()), "DTSTART:" + time(pickup), "DTEND:" + time(returned), "SUMMARY:Quartinaut Ausleihe: " + name, "DESCRIPTION:" + esc2(f.elements.note.value), "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Rueckgabe der Ausleihe pruefen", "TRIGGER:-PT1H", "END:VALARM", "END:VEVENT", "END:VCALENDAR"];
      const data = lines.join("\r\n");
      const url = URL.createObjectURL(new Blob([data], { type: "text/calendar;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "quartinaut-ausleihe.ics";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      close();
      toast("Kalendereintrag erstellt.");
    });
  });
}
function bindV46Features() {
  document.querySelectorAll("[data-v46-feed]").forEach((b) => b.addEventListener("click", () => {
    v46PrefsUpdate({ feedFilter: b.dataset.v46Feed });
    render();
  }));
  document.querySelectorAll("[data-v46-inbox]").forEach((b) => b.addEventListener("click", () => {
    v46PrefsUpdate({ inboxFilter: b.dataset.v46Inbox });
    render();
  }));
  byId("v46SearchForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    v46SearchUi.q = String(new FormData(event.currentTarget).get("q") || "").trim().slice(0, 120);
    v47SearchReset();
  });
  document.querySelectorAll("[data-v46-search-type]").forEach((b) => b.addEventListener("click", () => {
    v46SearchUi.type = b.dataset.v46SearchType;
    v47SearchReset();
  }));
  byId("v46OnlyArea")?.addEventListener("change", (e) => {
    v46SearchUi.onlyArea = e.target.checked;
    v47SearchReset();
  });
  byId("v47SearchCategory")?.addEventListener("change", (e) => {
    v46SearchUi.category = e.target.value;
    v47SearchReset();
  });
  byId("v47SearchFrom")?.addEventListener("change", (e) => {
    v46SearchUi.from = e.target.value;
    v47SearchReset();
  });
  byId("v47SearchTo")?.addEventListener("change", (e) => {
    v46SearchUi.to = e.target.value;
    v47SearchReset();
  });
  document.querySelector("[data-v47-search-retry]")?.addEventListener("click", () => v47LoadSearch(0));
  document.querySelector("[data-v47-next]")?.addEventListener("click", () => v47LoadSearch(v47SearchState.page + 1));
  document.getElementById("v48SearchOrder")?.addEventListener("change", (e) => {
    v48SearchOrder = e.currentTarget.value;
    render();
  });
  document.querySelector("[data-v47-prev]")?.addEventListener("click", () => {
    v47SearchState.next = v47SearchState.history[Math.max(0, v47SearchState.page - 1)] || null;
    v47LoadSearch(Math.max(0, v47SearchState.page - 1));
  });
  document.querySelectorAll("[data-v47-open-target]")?.forEach((b) => b.addEventListener("click", () => runAsyncAction(() => v47OpenTarget(b.dataset.v47OpenTarget, b.dataset.targetId))));
  document.querySelectorAll("[data-v47-save-target]")?.forEach((b) => b.addEventListener("click", () => {
    if (v47Sync) {
      v47Sync.setFavorite(b.dataset.v47SaveTarget, b.dataset.targetId, !v47Sync.isFavorite(b.dataset.v47SaveTarget, b.dataset.targetId));
      render();
    }
  }));
  document.querySelectorAll("[data-v46-fav]").forEach((b) => b.addEventListener("click", () => v46ToggleFavorite(b.dataset.v46Fav, b.dataset.value)));
  document.querySelectorAll("[data-v46-search]").forEach((b) => b.addEventListener("click", () => {
    v46SearchUi.q = b.dataset.v46Search;
    v46SearchUi.type = "all";
    setRoute("search");
    v47SearchReset();
  }));
  document.querySelectorAll("[data-v46-person]").forEach((b) => b.addEventListener("click", () => {
    v46SearchUi.q = b.dataset.v46Person;
    v46SearchUi.type = "request";
    setRoute("search");
    v47SearchReset();
  }));
  document.querySelectorAll("[data-v46-group]").forEach((b) => b.addEventListener("click", () => {
    hubState.section = "group";
    hubState.search = hubState.items.find((x) => x.id === b.dataset.v46Group)?.title || "";
    setRoute("hub");
  }));
  document.querySelectorAll("[data-v46-unbookmark]").forEach((b) => b.addEventListener("click", () => {
    const [kind, ...parts] = b.dataset.v46Unbookmark.split(":");
    v44ToggleSaved(kind, parts.join(":"));
    render();
  }));
  document.querySelectorAll("[data-v46-hide-post]").forEach((b) => b.addEventListener("click", () => v46SetHidden(b.dataset.v46HidePost, b.dataset.id, true)));
  document.querySelectorAll("[data-v46-unhide]").forEach((b) => b.addEventListener("click", () => v46SetHidden(b.dataset.v46Unhide, b.dataset.id, false)));
  document.querySelectorAll("[data-v46-clear-errors]").forEach((b) => b.addEventListener("click", () => {
    writeUserData(v46Uid(), "localDiagnostics", []);
    render();
    toast("Ger\xE4tefehler zur\xFCckgesetzt.");
  }));
  document.querySelectorAll("[data-v46-discard-draft]").forEach((b) => b.addEventListener("click", () => {
    if (!b.dataset.v46DiscardDraft.startsWith("quartinaut-draft-v42:" + v46Uid() + ":")) return;
    if (!confirm("Diesen Textentwurf auf diesem Ger\xE4t verwerfen?")) return;
    localStorage.removeItem(b.dataset.v46DiscardDraft);
    render();
  }));
  document.querySelectorAll("[data-v46-edit-draft]").forEach((b) => b.addEventListener("click", () => {
    const [form, context] = String(b.dataset.v46EditDraft).split(":");
    if (form === "requestForm") newRequestModal();
    else if (form === "v3HubCreate" && HUB_KINDS.has(context)) {
      hubState.section = context;
      openHubCreate(context);
    } else if (form === "v3DraftForm") {
      hubState.section = "draft";
      setRoute("hub");
    } else toast("\xD6ffne den urspr\xFCnglichen Bereich, um diesen Entwurf fortzusetzen.");
  }));
  document.querySelectorAll("[data-v46-loan-reminder]").forEach((b) => b.addEventListener("click", () => v46LoanReminder(b.dataset.v46LoanReminder)));
  document.querySelectorAll("[data-v46-group-profile]").forEach((b) => b.addEventListener("click", () => v46GroupProfile(b.dataset.v46GroupProfile)));
  document.querySelectorAll("[data-v46-map-pin]").forEach((b) => b.addEventListener("click", () => {
    v46MapSelection = b.dataset.v46MapPin;
    render();
  }));
  document.querySelectorAll("[data-v46-osm]").forEach((b) => b.addEventListener("click", () => {
    const all = [...state.requests.filter((x) => x.status === "offen"), ...hubState.items.filter((x) => x.status === "published" && x.kind !== "issue"), ...localCommunityEvents().filter((x) => x.status === "published")];
    const point = all.map(safeMapPoint).find((p) => p?.id === b.dataset.v46Osm);
    if (!point) return;
    window.open(`https://www.openstreetmap.org/?mlat=${encodeURIComponent(point.lat)}&mlon=${encodeURIComponent(point.lng)}#map=15/${encodeURIComponent(point.lat)}/${encodeURIComponent(point.lng)}`, "_blank", "noopener,noreferrer");
  }));
}
function renderAuthLoading() {
  return `
    <section class="auth-layout auth-loading-layout">
      <article class="auth-copy auth-loading-copy">
        <span class="eyebrow">Quartinaut</span>
        <h1>Quartierzugang wird gepr\xFCft.</h1>
        <p>Wir laden Anmeldung, Standortauswahl und Sicherheitsstatus. Bei langsamer Verbindung bleibt die App ruhig bedienbar.</p>
        <div class="auth-principles">
          <span>Datensparsam</span>
          <span>Gemeindebezogen</span>
          <span>Gesch\xFCtzt</span>
        </div>
      </article>
      <article class="card auth-card auth-loading-card" aria-live="polite">
        <div class="loading-orbit" aria-hidden="true"></div>
        <div>
          <span class="eyebrow">Anmeldung</span>
          <h1>Wird vorbereitet</h1>
          <p>Bitte kurz warten.</p>
        </div>
        <div class="loading-lines" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </article>
    </section>
  `;
}
function renderDisabledAccountGate() {
  return `
    <section class="auth-layout">
      <article class="card auth-card">
        <span class="eyebrow">Quartinaut \xB7 Konto deaktiviert</span>
        <h1>Dieses Konto ist aktuell deaktiviert.</h1>
        <p>Ein Admin hat den Zugang eingeschr\xE4nkt. Du kannst dich abmelden oder den Support kontaktieren, falls du eine Pr\xFCfung m\xF6chtest.</p>
        <div class="row-actions" style="margin-top:16px;">
          <button class="primary-button" data-action="logout">Abmelden</button>
          <button class="ghost-button" data-action="open-legal" data-legal="imprint">Kontakt</button>
        </div>
      </article>
    </section>
  `;
}
function renderPendingAccountGate() {
  const rejected = state.profile.municipalityStatus === "rejected";
  return `
    <section class="auth-layout">
      <article class="card auth-card pending-account-card">
        <span class="eyebrow">Quartinaut \xB7 Gemeindekonto</span>
        <h1>${rejected ? "Die Freigabe wurde abgelehnt." : "Dein Gemeindekonto wird gepr\xFCft."}</h1>
        <p>${rejected ? "Bitte kontaktiere den Support, falls Angaben korrigiert oder erneut gepr\xFCft werden sollen." : "Gemeindekonten werden vor der Nutzung manuell gepr\xFCft. Nach der Freigabe ist der Zugang auf die gew\xE4hlte Gemeinde beschr\xE4nkt."}</p>
        <div class="card compact soft" style="margin-top:16px;">
          <strong>${escapeHtml(state.profile.municipalityName || state.profile.area || "Gew\xE4hlte Gemeinde")}</strong>
          <p>${escapeHtml(state.profile.municipalityDepartment || "Abteilung/Funktion nicht angegeben")}${state.profile.municipalityWebsite ? ` \xB7 ${escapeHtml(state.profile.municipalityWebsite)}` : ""}</p>
          <div class="badges" style="margin-top:10px;">
            ${accountStatusBadge(state.profile.accountStatus)}
            ${trustBadge(state.profile, { detail: true })}
          </div>
        </div>
        <div class="row-actions" style="margin-top:16px;">
          <button class="primary-button" data-action="logout">Abmelden</button>
          <button class="ghost-button" data-action="open-legal" data-legal="imprint">Support kontaktieren</button>
        </div>
      </article>
    </section>
  `;
}
function renderEmailVerificationGate() {
  return `<section class="auth-layout"><article class="card auth-card v452-verify" aria-live="polite">
    <span class="v452-mail-mark" aria-hidden="true">\u2709</span>
    <h1>Bitte E-Mail-Adresse best\xE4tigen</h1>
    <p>F\xFCr <strong>${escapeHtml(authState.verifyPending?.email || "")}</strong> ist die E-Mail-Best\xE4tigung noch offen.</p>
    <p>Wenn die E-Mail eingetroffen ist, \xF6ffne den Link und tippe auf \xABE-Mail gepr\xFCft\xBB. Falls nichts angekommen ist, \xFCberpr\xFCfe die Adresse sowie Spam/Junk und versuche \xABErneut senden\xBB.</p>
    ${emailAuthNotice ? `<p class="help" role="status">${escapeHtml(emailAuthNotice)}</p>` : ""}
    <div class="form-grid"><button type="button" class="primary-button" id="checkEmailVerification">E-Mail gepr\xFCft</button>
    <button type="button" class="ghost-button" id="resendEmailVerification">Best\xE4tigungs-E-Mail erneut senden</button>
    <button type="button" class="ghost-button" id="switchEmailAccount">Anderes Konto verwenden</button></div>
  </article></section>`;
}
function bindEmailVerificationGate() {
  byId("checkEmailVerification")?.addEventListener("click", () => runAsyncAction(checkFirebaseEmailVerification));
  byId("resendEmailVerification")?.addEventListener("click", () => runAsyncAction(resendFirebaseEmailVerification));
  byId("switchEmailAccount")?.addEventListener("click", () => runAsyncAction(signOutCurrentUser));
}
function renderAuthGate() {
  const isRegister = authMode === "register";
  const picker = locationOptions(state.profile.location);
  const firebaseGate = authState.mode === "firebase";
  const accountTypeFields = `
            <label>Kontotyp
              <select name="accountType" id="accountTypeSelect">
                <option value="resident">Privatperson</option>
                <option value="company">Firma</option>
                <option value="municipality">Gemeinde</option>
              </select>
            </label>
            <div class="form-grid two account-type-details" id="companyRegistrationFields" hidden>
              <label>Firmenname
                <input name="companyName" maxlength="80" placeholder="z. B. Muster AG" />
              </label>
              <label>T\xE4tigkeit / Suche
                <input name="companyPurpose" maxlength="120" placeholder="z. B. Mitarbeitende, Lehrstellen, lokale Dienste" />
              </label>
            </div>
            <div class="form-grid account-type-details" id="municipalityRegistrationFields" hidden>
              <p class="help">Die unten gew\xE4hlte Gemeinde wird fest mit dem Konto verbunden. Das Konto bleibt bis zur manuellen Admin-Freigabe gesperrt.</p>
              <div class="form-grid two">
                <label>Abteilung / Funktion
                  <input name="municipalityDepartment" maxlength="100" placeholder="z. B. Einwohnerdienste" />
                </label>
                <label>Offizielle Webseite (optional)
                  <input name="municipalityWebsite" type="url" maxlength="180" placeholder="https://www.gemeinde.ch" />
                </label>
              </div>
            </div>
  `;
  const firebaseBody = `
        <form id="authForm" class="form-grid v452-auth-form" style="margin-top:16px;">
          ${isRegister ? `
            <label>Name <input name="displayName" autocomplete="name" required maxlength="60" placeholder="Vorname Nachname"></label>
            ${accountTypeFields}
            <div class="form-grid two">
              <label>Kanton ${picker.cantonSelect}</label>
              <label>Gemeinde / Ort ${picker.municipalitySelect}</label>
            </div>
            <label>Einladungscode <input name="inviteCode" autocomplete="off" placeholder="${DEFAULT_INVITE_CODE}"></label>
            <p class="help">Dein Profil wird sofort als \xABE-Mail-Best\xE4tigung ausstehend\xBB f\xFCr die Administration erfasst. Die App bleibt bis zur Best\xE4tigung gesperrt.</p>
          ` : '<p class="help">Du kannst dich mit Google oder mit E-Mail und Passwort anmelden.</p>'}
          <div class="v452-email-fields">
            <label>E-Mail-Adresse
              <input id="firebaseEmailInput" name="email" type="email" inputmode="email" autocomplete="email" placeholder="name@beispiel.ch" ${isRegister && !authState.needsProfileCompletion ? "required" : ""}>
            </label>
            ${authState.needsProfileCompletion ? `<p class="help">Deine E-Mail ist bereits best\xE4tigt. Bitte Name und Gemeinde vervollst\xE4ndigen, um dein Profil zu aktivieren.</p>` : `
              <label>Passwort
                <input name="password" type="password" minlength="${isRegister ? 10 : 1}" autocomplete="${isRegister ? "new-password" : "current-password"}" placeholder="${isRegister ? "Mindestens 10 Zeichen" : "Passwort"}">
              </label>
              ${isRegister ? `<label>Passwort wiederholen
                <input name="passwordConfirm" type="password" minlength="10" autocomplete="new-password" placeholder="Passwort best\xE4tigen">
              </label>` : ""}
            `}
            <button class="primary-button" type="submit" name="authProvider" value="email" data-auth-provider="email">${authState.needsProfileCompletion ? "Profil fertigstellen" : isRegister ? "Mit E-Mail registrieren" : "Mit E-Mail anmelden"}</button>
            ${!isRegister ? '<button type="button" class="ghost-button small" id="resetEmailPassword">Passwort vergessen?</button>' : ""}
          </div>
          <div class="v452-auth-divider" aria-hidden="true"><span>oder</span></div>
          <button type="submit" name="authProvider" value="google" data-auth-provider="google" class="ghost-button v452-google-button" formnovalidate>${isRegister ? "Mit Google registrieren" : "Mit Google anmelden"}</button>
          ${emailAuthNotice ? `<p class="help" role="status">${escapeHtml(emailAuthNotice)}</p>` : ""}
          ${authState.error ? `<p class="form-error">${escapeHtml(authState.error)}</p>` : ""}
          <p id="authError" class="form-error" role="alert"></p>
        </form>
  `;
  const localBody = `
        <form id="authForm" class="form-grid" style="margin-top:16px;">
          ${isRegister ? `
            <label>Name
              <input name="displayName" autocomplete="name" required maxlength="60" placeholder="Vorname Nachname" />
            </label>
            ${accountTypeFields}
          ` : ""}
          <label>E-Mail
            <input name="email" type="text" inputmode="email" autocomplete="email" required placeholder="name@example.ch" />
          </label>
          <label>Passwort
            <input name="password" type="password" autocomplete="${isRegister ? "new-password" : "current-password"}" required minlength="8" placeholder="Mindestens 8 Zeichen" />
          </label>
          ${isRegister ? `
            <div class="form-grid two">
              <label>Kanton
                ${picker.cantonSelect}
              </label>
              <label>Gemeinde / Ort
                ${picker.municipalitySelect}
              </label>
            </div>
            <label>Einladungscode
              <input name="inviteCode" autocomplete="off" placeholder="${DEFAULT_INVITE_CODE}" />
            </label>
            <p class="help">Name und Standort werden nach der Registrierung fixiert. \xC4nderungen laufen sp\xE4ter nur \xFCber begr\xFCndete Antr\xE4ge an die Administration.</p>
          ` : `
            <div class="card compact soft">
              <strong>Noch kein Konto?</strong>
              <p>Bitte zuerst "Konto erstellen" w\xE4hlen und danach mit denselben Zugangsdaten anmelden.</p>
              <button class="ghost-button small" type="button" data-auth-mode="register" style="margin-top:10px;">Zur Registrierung</button>
            </div>
          `}
          <p class="help">Lokaler Entwicklungsmodus ohne Firebase-Verbindung. Diese Konten sind nicht mit der Cloud verbunden.</p>
          ${authState.error ? `<p class="form-error">${escapeHtml(authState.error)}</p>` : ""}
          <p id="authError" class="form-error" role="alert"></p>
          <button class="primary-button" type="submit">${isRegister ? "Konto erstellen" : "Anmelden"}</button>
        </form>
  `;
  return `
    <section class="auth-layout">
      <article class="auth-copy">
        <span class="eyebrow">Quartinaut \xB7 Deine Nachbarschaft</span>
        <h1>Gr\xFCezi bei Quartinaut!</h1>
        <p>Hilfe finden, Angebote entdecken und privat mit deinem Quartier in Kontakt bleiben. Melde dich mit demselben Konto wie in der Android-App an.</p>
        <div class="auth-principles">
          <span>Deine Gemeinde</span>
          <span>Private Nachrichten</span>
          <span>Verifizierte Alarme</span>
          <span>Hilfe im Quartier</span>
        </div>
      </article>

      <article class="card auth-card">
        <div class="segmented auth-mode-switch" role="group" aria-label="Anmeldung oder Registrierung">
          <button data-auth-mode="login" class="${!isRegister ? "active" : ""}" type="button">Anmelden</button>
          <button data-auth-mode="register" class="${isRegister ? "active" : ""}" type="button">Konto erstellen</button>
        </div>
        ${firebaseGate ? firebaseBody : localBody}
      </article>
    </section>
  `;
}
function hasSeenAlert(alertId) {
  return state.alertReads.some((read) => read.alertId === alertId && read.uid === authState.user?.uid);
}
function alertReadCount(alertId) {
  return state.alertReads.filter((read) => read.alertId === alertId).length;
}
function requestById(id) {
  return state.requests.find((req) => req.id === id);
}
function isChatForOpenRequest(chat) {
  const req = requestById(chat.requestId);
  return !req || req.status === "offen";
}
function activePrivateChats() {
  return state.chats.filter((chat) => isChatVisibleForUser(chat)).filter(isChatForOpenRequest).sort((a, b) => new Date(b.lastMessageAt || b.createdAt || 0) - new Date(a.lastMessageAt || a.createdAt || 0));
}
function chatResponseMinutes(chat) {
  const req = requestById(chat.requestId);
  if (!req) return null;
  const firstReplyAt = new Date(chat.createdAt || chat.lastMessageAt || 0).getTime();
  const created = new Date(req.createdAt).getTime();
  if (!firstReplyAt || !created) return null;
  return (firstReplyAt - created) / 6e4;
}
function adminAnalytics() {
  const all = state.requests;
  const closed = all.filter((req) => req.status === "erledigt");
  const responseTimes = state.chats.map(chatResponseMinutes).filter((v) => Number.isFinite(v) && v >= 0);
  const alerts = state.alerts;
  const reach = alerts.map((alert) => alertReadCount(alert.id));
  const avgReach = reach.length ? reach.reduce((sum, value) => sum + value, 0) / reach.length : 0;
  const deliveries = state.pushDeliveries;
  const requested = deliveries.reduce((sum, item) => sum + Number(item.requested || 0), 0);
  const successful = deliveries.reduce((sum, item) => sum + Number(item.successCount || 0), 0);
  return {
    totalRequests: all.length,
    closedRequests: closed.length,
    completionRate: percentage(closed.length, all.length),
    medianResponseMinutes: median(responseTimes),
    activeEscalations: all.filter((req) => req.status === "offen" && ["P0", "P1"].includes(req.escalationLevel)).length,
    alertCount: alerts.length,
    alertReachAvg: Math.round(avgReach * 10) / 10,
    pushSuccessRate: percentage(successful, requested),
    pushRequested: requested
  };
}
function communityDashboardStats() {
  const area = state.profile.area;
  const areaRequests = state.requests.filter((req) => req.area === area);
  const openAreaRequests = areaRequests.filter((req) => req.status === "offen");
  const activeAreaChats = state.chats.filter((chat) => isChatVisibleForUser(chat)).filter((chat) => {
    const req = requestById(chat.requestId);
    return !req || req.area === area;
  });
  const users = state.registeredUsers || [];
  const localUsers = users.filter((user) => adminUserLocationLabel(user) === area);
  const companies = users.filter((user) => user.accountType === "company");
  const verifiedCompanies = companies.filter((user) => user.companyStatus === "verified");
  const verifiedUsers = users.filter((user) => user.verified || user.companyStatus === "verified" || ["admin", "area_admin"].includes(user.role));
  const categoryCounts = CATEGORIES.map((category) => ({
    category,
    count: openAreaRequests.filter((req) => req.category === category).length
  })).filter((item) => item.count > 0).sort((a, b) => b.count - a.count).slice(0, 5);
  return {
    area,
    localUsers: localUsers.length,
    totalUsers: users.length,
    verifiedUsers: verifiedUsers.length,
    companies: companies.length,
    verifiedCompanies: verifiedCompanies.length,
    openAreaRequests: openAreaRequests.length,
    activeAreaChats: activeAreaChats.length,
    categoryCounts
  };
}
function renderCommunityDashboardCard() {
  const stats = communityDashboardStats();
  const categories = stats.categoryCounts.length ? stats.categoryCounts.map((item) => `<span class="status-pill"><strong>${escapeHtml(formatNumber(item.count))}</strong> ${escapeHtml(item.category)}</span>`).join("") : '<span class="status-pill">Keine offenen Kategorien</span>';
  return `
    <article class="card">
      <h2>Gemeinde-Dashboard</h2>
      <p class="section-description">${escapeHtml(stats.area || "Aktuelles Gebiet")} \xB7 operative \xDCbersicht f\xFCr Registrierung, Firmen, Vermittlung und Vertrauen.</p>
      <div class="grid two" style="margin-top:12px;">
        <div class="card compact soft"><strong>Nutzer im Gebiet</strong><p>${escapeHtml(formatNumber(stats.localUsers))}</p></div>
        <div class="card compact soft"><strong>Vertrauensprofile</strong><p>${escapeHtml(formatNumber(stats.verifiedUsers))}/${escapeHtml(formatNumber(stats.totalUsers))}</p></div>
        <div class="card compact soft"><strong>Firmen gepr\xFCft</strong><p>${escapeHtml(formatNumber(stats.verifiedCompanies))}/${escapeHtml(formatNumber(stats.companies))}</p></div>
        <div class="card compact soft"><strong>Aktive Chats</strong><p>${escapeHtml(formatNumber(stats.activeAreaChats))}</p></div>
        <div class="card compact soft"><strong>Offene Anliegen</strong><p>${escapeHtml(formatNumber(stats.openAreaRequests))}</p></div>
        <div class="card compact soft"><strong>Push-Status</strong><p>${escapeHtml(formatNumber(state.deviceTokens.filter((token) => token.active !== false).length))} Ger\xE4te</p></div>
      </div>
      <div class="admin-user-stats" style="margin-top:12px;">${categories}</div>
    </article>
  `;
}
function renderCompanyAreaCard() {
  const companyRequests = state.requests.filter((req) => req.status === "offen" && (req.category === "Firmen / Arbeit" || req.authorAccountType === "company")).sort(sortByLocalRelevance).slice(0, 4);
  const companies = state.registeredUsers.filter((user) => user.accountType === "company");
  const verifiedCompanies = companies.filter((user) => user.companyStatus === "verified");
  return `
    <article class="card">
      <h2>Firmenbereich</h2>
      <p class="section-description">Lokale Firmen, Arbeit, Lehrstellen, kurzfristige Eins\xE4tze und Dienstleistungen klar getrennt vom privaten Hilfebereich.</p>
      <div class="badges" style="margin-bottom:12px;">
        ${isAdminRole() ? `<span class="badge info">${escapeHtml(formatNumber(companies.length))} Firmenkonten</span><span class="badge official">${escapeHtml(formatNumber(verifiedCompanies.length))} gepr\xFCft</span>` : '<span class="badge info">Kategorie Firmen / Arbeit</span>'}
      </div>
      <div class="list">
        ${companyRequests.length ? companyRequests.map((req) => `
          <section class="card compact soft">
            <strong>${escapeHtml(req.title)}</strong>
            <p>${escapeHtml(requestAuthorLabel(req))} \xB7 ${escapeHtml(req.area)}</p>
            <div class="badges" style="margin-top:8px;">
              ${trustBadge(profileFromRequest(req), { detail: true })}
            ${Number(state.publicTrust?.[requestOwnerUid(req)]?.count || 0) > 0 ? `<span class="badge v21-rating-badge" title="Bewertungen abgeschlossener Hilfen">\u2605 ${escapeHtml(Number(state.publicTrust[requestOwnerUid(req)].average).toFixed(1))} (${Number(state.publicTrust[requestOwnerUid(req)].count)})</span>` : ""}
              <span class="badge">${escapeHtml(req.type)}</span>
            </div>
            <button class="ghost-button small" data-action="open-chat" data-id="${escapeHtml(req.id)}" style="margin-top:10px;">Kontakt</button>
          </section>
        `).join("") : '<div class="empty">Noch keine Firmen-/Arbeits-Eintr\xE4ge.</div>'}
      </div>
    </article>
  `;
}
function legacyPublicReplyRequests() {
  return state.requests.filter((req) => Array.isArray(req.replies) && req.replies.length > 0);
}
function renderAdminMaintenanceCard() {
  const legacyCount = legacyPublicReplyRequests().length;
  return `
    <article class="card">
      <h2>Systempflege</h2>
      <p class="section-description">Bereinigt Altlasten aus der fr\xFCheren \xF6ffentlichen Chat-Struktur. Neue Chats laufen bereits privat \xFCber 1:1-Threads.</p>
      <div class="metric"><strong>${legacyCount}</strong><span>Anliegen mit alten \xF6ffentlichen Antworten</span></div>
      <div class="row-actions" style="margin-top:12px;">
        <button class="secondary-button" data-action="cleanup-legacy-replies" ${legacyCount ? "" : "disabled"}>Alt-Chats bereinigen</button>
        <button class="ghost-button" data-action="sync-now">Status aktualisieren</button>
      </div>
    </article>
  `;
}
function renderCantonLiveMap(fullPage = false) {
  const counts = cantonRegistrationCounts();
  const fromPublicStats = isFirebaseMode() && !isAdminRole();
  const activeCantons = Object.values(counts).filter((value) => Number(value || 0) > 0).length;
  const totalUsers = totalRegisteredUsersFromCounts(counts);
  const updatedAt = state.publicStats?.updatedAt ? fmtTime(state.publicStats.updatedAt) : "";
  const sourceHint = fromPublicStats ? `\xD6ffentliche Aggregation${updatedAt ? ` \xB7 Stand ${updatedAt}` : ""}` : isFirebaseMode() ? isAdminRole() ? "Admin-Detailansicht" : "Lokale Ansicht" : "Lokale Daten";
  return `
    <article class="card v54-card ${fullPage ? "v54-card-full" : ""}" data-v54-explorer>
      <header class="v54-card-head"><div><span class="v53-kicker">Entdecke deine Region</span><h2>Interaktive Schweizkarte</h2><p class="help">26 Kantone mit Wappen und K\xFCrzeln entdecken. Gemeinden mit Namen, Wappen und Steckbriefen ausw\xE4hlen. Die Registrierungsfarben bleiben erhalten.</p></div>
        ${fullPage ? "" : `<button class="secondary-button small" type="button" data-route="swissmap">Grosse Karte \xF6ffnen \u2197</button>`}
      </header>
      <div class="v54-stats"><span><strong>${escapeHtml(formatNumber(totalUsers))}</strong> Registrierungen</span><span><strong>${escapeHtml(formatNumber(activeCantons))}</strong> aktive Kantone</span><small>${escapeHtml(sourceHint)}</small></div>
      <nav class="v54-crumb" data-v54-breadcrumb aria-label="Karten-Navigation"></nav>
      <div class="v54-grid">
        <section class="v54-map-pane" aria-label="Interaktive Karte">
          <div class="v54-map-actions"><button type="button" class="ghost-button small" data-v54-back hidden>\u2190 Zur\xFCck</button><span class="v54-map-hint">Tippe auf eine Region</span><button type="button" class="ghost-button small" data-v54-reset>Ganze Schweiz</button></div>
          <div class="v541-caption" data-v541-map-current aria-live="polite"><strong>CH</strong><span>Schweiz \xB7 26 Kantone</span></div>
          <div class="swiss-map-canvas v54-canvas" data-swiss-map role="group" aria-label="Karte mit Kantonsk\xFCrzeln und Gemeindenamen"></div>
          <div class="v541-map-controls"><button type="button" class="ghost-button small" data-v541-label-toggle hidden aria-pressed="false">Karte: Gemeindenamen</button><span>Gemeindenamen oder Wappen auf geeigneten Fl\xE4chen \xB7 Alle Gemeinden sind \xFCber die Liste ausw\xE4hlbar</span></div>
          <div class="v54-map-legend" data-v54-legend><span class="v54-legend-zero"></span> Keine Registrierung <span class="v54-legend-active"></span> Registrierungen</div>
          <p class="v54-status" role="status" aria-live="polite" data-v54-status>Karte wird geladen \u2026</p>
        </section>
        <aside class="v54-side" aria-label="Steckbrief und Auswahl">
          <div class="v54-profile" data-v54-profile aria-live="polite"><p>Kanton ausw\xE4hlen \u2026</p></div>
          <label class="v54-search-label" for="v54MapSearch">Kanton oder Gemeinde suchen</label>
          <input type="search" id="v54MapSearch" data-v54-search autocomplete="off" maxlength="120" placeholder="Kanton oder Gemeinde suchen \u2026">
          <div class="v54-item-list" data-v54-list role="group" aria-label="Kantone und Gemeinden"></div>
        </aside>
      </div>
      <p class="v54-source">Kantonsk\xFCrzel: ISO 3166-2:CH. Kantonswappen: Wikimedia Commons; Gemeindewappen: Wikidata/Wikimedia Commons (soweit verf\xFCgbar). Nichtamtliche Informationsdarstellung, keine Zugeh\xF6rigkeit zu Beh\xF6rden. Gemeindeverzeichnis: BFS, Stand 05.11.2026. Karten-Grenzen (sofern geladen): BFS, Stand 01.01.2025 \u2013 bei Fusionen k\xF6nnen Abweichungen bestehen. <a href="https://www.agvchapp.bfs.admin.ch/de/boundaries" target="_blank" rel="noopener noreferrer">Amtliche Geodaten \u2197</a> \xB7 <a href="https://www.droit-bilingue.ch/de-en/2/23/232.21-8-11.html" target="_blank" rel="noopener noreferrer">Wappenschutz \u2197</a></p>
    </article>`;
}
function renderSwissMapPage() {
  return `<section class="v54-page"><header class="v2-page-header"><span class="v2-kicker">Quartinaut \xB7 Schweizkarte</span><h1>Schweiz entdecken</h1><p>Alle 26 Kantone und ihre Gemeinden. Ohne \xC4nderung deines Profilstandorts.</p></header>${renderCantonLiveMap(true)}</section>`;
}
function renderAdminMetricsCard() {
  const analytics = adminAnalytics();
  const vapidStatus = FIREBASE_VAPID_KEY ? "gesetzt" : "fehlt";
  return `
    <article class="card">
      <h2>Admin-Auswertungen</h2>
      <div class="grid two" style="margin-top:12px;">
        <div class="card compact soft"><strong>Antwortzeit (Median)</strong><p>${formatDurationMinutes(analytics.medianResponseMinutes)}</p></div>
        <div class="card compact soft"><strong>Abschlussquote</strong><p>${analytics.completionRate}% (${analytics.closedRequests}/${analytics.totalRequests})</p></div>
        <div class="card compact soft"><strong>Alarm-Reichweite \xD8</strong><p>${analytics.alertReachAvg} gelesen pro Alarm</p></div>
        <div class="card compact soft"><strong>Eskalationen offen</strong><p>${analytics.activeEscalations}</p></div>
        <div class="card compact soft"><strong>FCM Zustellung</strong><p>${analytics.pushSuccessRate}% bei ${analytics.pushRequested} Tokens</p></div>
        <div class="card compact soft"><strong>FCM VAPID</strong><p>${vapidStatus}</p></div>
      </div>
    </article>
  `;
}
function renderAreaPriorityCard() {
  const currentArea = baseMunicipalityName(state.profile.area);
  const currentPriority = categoryPriority(state.profile.area);
  return `
    <article class="card">
      <h2>Kategorie-Priorit\xE4t</h2>
      <p class="help">Steuert die Reihenfolge der Kategorien f\xFCr ${escapeHtml(currentArea || "deine Gemeinde")}.</p>
      <form id="areaPriorityForm" class="form-grid" style="margin-top:12px;">
        <label>Priorit\xE4ten (Komma-getrennt)
          <input name="priorityRaw" value="${escapeHtml(currentPriority.join(", "))}" placeholder="z. B. Notfall, Gesundheit, Seniorenhilfe" />
        </label>
        <button class="secondary-button" type="submit">Priorit\xE4t speichern</button>
      </form>
    </article>
  `;
}
function dashboardDefaults(isAdmin = isAdminRole()) {
  const base = ["kennzahlen", "kantonskarte", "firmen"];
  const resident = ["erststart", "so-funktionierts"];
  const admin = ["einladungscodes", "community-dashboard", "admin-metriken", "wartung", "prioritaeten"];
  return isAdmin ? [...base, ...admin] : [...base, ...resident];
}
function sanitizeDashboardLayout(layout = {}) {
  return {
    version: Number(layout.version || 0),
    order: Array.isArray(layout.order) ? layout.order.filter(Boolean).map(String) : [],
    hidden: Array.isArray(layout.hidden) ? layout.hidden.filter(Boolean).map(String) : [],
    collapsed: Array.isArray(layout.collapsed) ? layout.collapsed.filter(Boolean).map(String) : [],
    quickLinks: cleanQuickLinks(layout.quickLinks),
    priorityOrder: cleanPriorityOrder(layout.priorityOrder),
    density: cleanDensity(layout.density)
  };
}
function normalizeOnboardingState(value = {}) {
  const checklist = value?.checklist && typeof value.checklist === "object" ? value.checklist : {};
  return {
    version: Number(value?.version || 0),
    completed: Boolean(value?.completed),
    completedAt: normalizeStoredDate(value?.completedAt) || "",
    skipped: Boolean(value?.skipped),
    checklist: {
      profileChecked: Boolean(checklist.profileChecked),
      locationChecked: Boolean(checklist.locationChecked),
      notificationsChecked: Boolean(checklist.notificationsChecked),
      installHintSeen: Boolean(checklist.installHintSeen),
      firstRequestHintSeen: Boolean(checklist.firstRequestHintSeen),
      verificationHintSeen: Boolean(checklist.verificationHintSeen)
    }
  };
}
function dashboardEditMode() {
  return state.route === "profile" && dashboardEditing;
}
function setDashboardEditMode(editing) {
  dashboardEditing = Boolean(editing);
  render();
}
function dashboardLayoutPayload() {
  return sanitizeDashboardLayout(state.dashboard || {});
}
function dashboardStateFor(tileIds = [], isAdmin = isAdminRole()) {
  const defaults = dashboardDefaults(isAdmin).filter((id) => tileIds.includes(id));
  const current = state.dashboard || {};
  const migrated = Number(current.version || 0) < 2;
  const order = migrated ? [] : Array.isArray(current.order) ? current.order.filter((id) => tileIds.includes(id)) : [];
  const hidden = Array.isArray(current.hidden) ? current.hidden.filter((id) => tileIds.includes(id)) : [];
  const collapsed = migrated ? seed.dashboard.collapsed.filter((id) => tileIds.includes(id)) : Array.isArray(current.collapsed) ? current.collapsed.filter((id) => tileIds.includes(id)) : [];
  const mergedOrder = [...order, ...defaults.filter((id) => !order.includes(id)), ...tileIds.filter((id) => !order.includes(id) && !defaults.includes(id))];
  state.dashboard = { ...current, version: 2, order: mergedOrder, hidden, collapsed };
  delete state.dashboard.editing;
  return state.dashboard;
}
function dashboardTileShell(tile, index, total, collapsedSet = /* @__PURE__ */ new Set()) {
  const editing = dashboardEditMode();
  const collapsed = collapsedSet.has(tile.id);
  return `
    <div class="dashboard-tile ${tile.span === "full" ? "span-full" : tile.span === "wide" ? "span-wide" : ""} ${editing ? "is-editable" : ""} ${collapsed ? "is-collapsed" : ""}" data-dashboard-tile="${escapeHtml(tile.id)}" draggable="${editing ? "true" : "false"}">
      ${collapsed ? `
        <button class="dashboard-collapsed-summary" type="button" data-action="dashboard-toggle-collapse" data-tile="${escapeHtml(tile.id)}" aria-expanded="false">
          <span>${escapeHtml(tile.label)}</span>
          <span>${iconSvg("chevronDown")} Aufklappen</span>
        </button>
      ` : `<div class="dashboard-tile-content">${tile.html}</div>`}
    </div>
  `;
}
function renderDashboardLayoutSettings() {
  const admin = isAdminRole();
  const labels = { kennzahlen: "Kennzahlen", kantonskarte: "Live-Kantonskarte", firmen: "Firmen / Arbeit", erststart: "Erste Schritte", "so-funktionierts": "So funktioniert Quartinaut", einladungscodes: "Einladungscodes", "community-dashboard": "Gemeinde-Auswertung", "admin-metriken": "Admin-Auswertungen", wartung: "Wartung", prioritaeten: "Priorit\xE4ten" };
  const ids = dashboardDefaults(admin);
  const ui = dashboardStateFor(ids, admin);
  const hidden = new Set(ui.hidden), collapsed = new Set(ui.collapsed);
  const visible = ui.order.filter((id) => !hidden.has(id));
  return `<section class="dashboard-settings-layout" aria-label="Startseite anpassen">
    <h3>Startseiten-Kacheln</h3><p class="help">Reihenfolge und Sichtbarkeit hier anpassen und anschliessend speichern.</p>
    <div class="form-grid">${ui.order.map((id) => {
    const index = visible.indexOf(id), isHidden = hidden.has(id);
    return `<div class="card compact soft" data-dashboard-setting="${escapeHtml(id)}"><strong>${escapeHtml(labels[id] || id)}</strong>
        <p class="help">${isHidden ? "Ausgeblendet" : collapsed.has(id) ? "Eingeklappt" : "Sichtbar"}</p>
        <div class="row-actions">
          <button class="icon-button small" type="button" data-action="dashboard-move" data-tile="${escapeHtml(id)}" data-dir="-1" aria-label="${escapeHtml(labels[id])} nach oben" ${isHidden || index === 0 ? "disabled" : ""}>\u2191</button>
          <button class="icon-button small" type="button" data-action="dashboard-move" data-tile="${escapeHtml(id)}" data-dir="1" aria-label="${escapeHtml(labels[id])} nach unten" ${isHidden || index === visible.length - 1 ? "disabled" : ""}>\u2193</button>
          <button class="ghost-button small" type="button" data-action="${isHidden ? "dashboard-show" : "dashboard-hide"}" data-tile="${escapeHtml(id)}">${isHidden ? "Einblenden" : "Ausblenden"}</button>
          <button class="ghost-button small" type="button" data-action="dashboard-toggle-collapse" data-tile="${escapeHtml(id)}" aria-pressed="${collapsed.has(id)}">${collapsed.has(id) ? "Aufgeklappt anzeigen" : "Eingeklappt anzeigen"}</button>
        </div></div>`;
  }).join("")}</div><div class="row-actions" style="margin-top:12px;">
      <button class="primary-button small" type="button" data-action="dashboard-save">Speichern</button>
      <button class="ghost-button small" type="button" data-action="dashboard-reset">Zur\xFCcksetzen</button>
    </div></section>`;
}
function renderDashboard(allTiles = [], isAdmin = isAdminRole()) {
  const allowedTiles = allTiles.filter((tile) => {
    if (tile.adminOnly && !isAdmin) return false;
    if (tile.residentOnly && isAdmin) return false;
    return Boolean(tile.html);
  });
  const tileIds = allowedTiles.map((tile) => tile.id);
  const ui = dashboardStateFor(tileIds, isAdmin);
  const tilesById = new Map(allowedTiles.map((tile) => [tile.id, tile]));
  const hiddenSet = new Set(ui.hidden);
  const collapsedSet = new Set(ui.collapsed);
  const orderedTiles = ui.order.map((id) => tilesById.get(id)).filter(Boolean);
  const visibleTiles = orderedTiles.filter((tile) => !hiddenSet.has(tile.id));
  const hiddenTiles = orderedTiles.filter((tile) => hiddenSet.has(tile.id));
  const editing = dashboardEditMode();
  return `
    <section class="dashboard-grid" aria-label="Startseiten-Kacheln">
      ${visibleTiles.map((tile, index) => dashboardTileShell(tile, index, visibleTiles.length, collapsedSet)).join("")}
    </section>

  `;
}
function moveDashboardTile(tileId, direction) {
  const ui = state.dashboard || { order: [], hidden: [] };
  const visible = ui.order.filter((id) => !(ui.hidden || []).includes(id));
  const index = visible.indexOf(tileId);
  if (index < 0) return;
  const target = Math.max(0, Math.min(visible.length - 1, index + direction));
  if (target === index) return;
  visible.splice(index, 1);
  visible.splice(target, 0, tileId);
  const hidden = ui.order.filter((id) => (ui.hidden || []).includes(id));
  state.dashboard.order = [...visible, ...hidden];
  saveState();
  render();
}
function dropDashboardTile(sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) return;
  const ui = state.dashboard || { order: [], hidden: [] };
  const order = ui.order.slice();
  const from = order.indexOf(sourceId);
  const to = order.indexOf(targetId);
  if (from < 0 || to < 0) return;
  order.splice(from, 1);
  order.splice(to, 0, sourceId);
  state.dashboard.order = order;
  saveState();
  render();
}
function setDashboardTileHidden(tileId, hidden) {
  const ui = state.dashboard || { order: [], hidden: [] };
  const hiddenSet = new Set(ui.hidden || []);
  if (hidden) hiddenSet.add(tileId);
  else hiddenSet.delete(tileId);
  state.dashboard.hidden = [...hiddenSet];
  saveState();
  render();
}
async function setDashboardTileCollapsed(tileId, collapsed) {
  const ui = state.dashboard || { order: [], hidden: [], collapsed: [] };
  const collapsedSet = new Set(ui.collapsed || []);
  if (collapsed) collapsedSet.add(tileId);
  else collapsedSet.delete(tileId);
  state.dashboard.collapsed = [...collapsedSet];
  const dashboard = dashboardLayoutPayload();
  saveState();
  if (authState.user) syncCurrentUser({ dashboard });
  render();
  if (isFirebaseMode()) {
    await updateFirebaseProfile({ dashboard });
  }
  toast(collapsed ? "Kachel eingeklappt und gespeichert." : "Kachel aufgeklappt und gespeichert.");
}
function stopDashboardMasonry() {
}
function startDashboardMasonry() {
  stopDashboardMasonry();
}
function resetDashboardLayout() {
  const personalization = v53Preferences();
  state.dashboard = { ...structuredClone(seed.dashboard), ...personalization };
  dashboardEditing = true;
  saveState();
  render();
  toast("Startseite zur\xFCckgesetzt.");
}
async function saveDashboardLayout() {
  const dashboard = dashboardLayoutPayload();
  dashboardEditing = false;
  document.querySelectorAll(".dashboard-controls, .dashboard-hidden, .dashboard-tile-toolbar").forEach((node) => {
    node.hidden = true;
  });
  document.querySelectorAll(".dashboard-tile").forEach((node) => {
    node.classList.remove("is-editable", "is-dragging", "drop-target");
    node.setAttribute("draggable", "false");
  });
  saveState();
  render();
  if (authState.user) syncCurrentUser({ dashboard });
  if (isFirebaseMode()) {
    await updateFirebaseProfile({ dashboard });
  }
  toast("Startseite gespeichert.");
}
function renderMyProceduresCard({ detailed = false } = {}) {
  const pending = ownPendingRequests();
  const rejected = ownRejectedRequests();
  const openOwn = ownOpenRequests();
  const processes = ownOpenProcessRequests();
  const unread = unreadChatCount();
  const compactItems = [
    ["In Pr\xFCfung", pending.length, "Beitr\xE4ge warten auf Admin-Freigabe"],
    ["Abgelehnt", rejected.length, "Beitr\xE4ge k\xF6nnen \xFCberarbeitet werden"],
    ["Online", openOwn.length, "freigegebene eigene Beitr\xE4ge"],
    ["Chats", activePrivateChats().length, `${unread} ungelesen`],
    ["Antr\xE4ge", processes.length, "Verifizierung, Name oder Standort"]
  ];
  const pendingList = [...pending, ...rejected].slice(0, detailed ? 8 : 3);
  return `
    <article class="card my-process-card">
      <div class="request-head">
        <div>
          <h2>Meine Vorg\xE4nge</h2>
          <p>Deine Beitr\xE4ge, Chats und offenen Antr\xE4ge an einem Ort.</p>
        </div>
        <button class="ghost-button small" data-route="profile">Details</button>
      </div>
      <div class="process-grid" style="margin-top:14px;">
        ${compactItems.map(([label, value, help]) => `
          <div class="readonly-field">
            <strong>${escapeHtml(value)}</strong>
            <span>${escapeHtml(label)}</span>
            <small>${escapeHtml(help)}</small>
          </div>
        `).join("")}
      </div>
      ${detailed && pendingList.length ? `
        <div class="list" style="margin-top:14px;">
          ${pendingList.map((req) => `
            <section class="card compact soft request-card request-kind-${requestToneClass(req)}">
              <div class="badges">${requestStatusBadge(req)}<span class="badge">${escapeHtml(req.category || "Anliegen")}</span></div>
              <strong>${escapeHtml(req.title || "Ohne Titel")}</strong>
              ${req.rejectionReason ? `<p class="help">${escapeHtml(req.rejectionReason)}</p>` : '<p class="help">Dieser Beitrag ist noch nicht \xF6ffentlich sichtbar.</p>'}
              <div class="row-actions" style="margin-top:10px;">
                <button class="ghost-button small" data-action="edit-request" data-id="${escapeHtml(req.id)}">\xDCberarbeiten</button>
              </div>
            </section>
          `).join("")}
        </div>
      ` : `
        <p class="help" style="margin-top:12px;">
          ${pending.length || rejected.length ? `${pending.length} in Pr\xFCfung${rejected.length ? `, ${rejected.length} abgelehnt` : ""}.` : "Keine Beitr\xE4ge in Pr\xFCfung oder \xDCberarbeitung."}
          ${detailed ? "" : " Details im Profil."}
        </p>
      `}
    </article>
  `;
}
function renderOnboardingChecklistCard() {
  const onboarding = normalizeOnboardingState(state.onboarding);
  const checklist = onboarding.checklist || {};
  const steps = [
    { key: "profileChecked", label: "Profil gepr\xFCft", done: checklist.profileChecked, action: "mark" },
    { key: "locationChecked", label: "Gemeinde/Standort verstanden", done: checklist.locationChecked, action: "mark" },
    { key: "notificationsChecked", label: "Benachrichtigungen gepr\xFCft", done: checklist.notificationsChecked || notificationPermissionState() === "granted", action: "notifications" },
    { key: "installHintSeen", label: "Installation angeschaut", done: checklist.installHintSeen || isInstalledPwa(), action: "install" },
    { key: "firstRequestHintSeen", label: "Schwarzes Brett verstanden", done: checklist.firstRequestHintSeen || ownRequests().length > 0, action: "bulletin" },
    { key: "verificationHintSeen", label: "Verifizierung gepr\xFCft", done: checklist.verificationHintSeen || state.profile.verified || state.profile.verificationStatus === "pending", action: "verification" }
  ];
  const done = steps.filter((step) => step.done).length;
  return `
    <article class="card onboarding-checklist-card">
      <div class="request-head">
        <div>
          <h2>Erste Schritte</h2>
          <p>Kurze Wegleitung f\xFCr die App: Schwarzes Brett, Installation und Vertrauen.</p>
        </div>
        <span class="status-pill">${done}/${steps.length}</span>
      </div>
      <div class="list" style="margin-top:14px;">
        ${steps.map((step) => `
          <section class="check-row compact-check">
            <span class="check-dot ${step.done ? "done" : ""}">${step.done ? "\u2713" : ""}</span>
            <span><strong>${escapeHtml(step.label)}</strong><small>${step.key === "firstRequestHintSeen" ? "\u201EBrett\u201C bedeutet lokales Schwarzes Brett f\xFCr Hilfe, Suche, Angebote und Hinweise." : ""}</small></span>
            <button class="ghost-button small" data-action="onboarding-checklist" data-step="${escapeHtml(step.key)}" data-step-action="${escapeHtml(step.action)}">${step.done ? "Erledigt" : "\xD6ffnen"}</button>
          </section>
        `).join("")}
      </div>
      <button class="secondary-button small" data-action="reopen-onboarding" style="margin-top:14px;">${iconSvg("help")} Wegleitung anzeigen</button>
    </article>
  `;
}
function renderOfficialNoticeCard(notice, { compact = false } = {}) {
  const priorityBadge = notice.priority === "wichtig" ? '<span class="badge warn">Wichtig</span>' : '<span class="badge info">Info</span>';
  const statusBadge = canManageOfficialNotices() && notice.status !== "online" ? `<span class="badge">${escapeHtml(notice.status)}</span>` : "";
  const validUntil = notice.validUntil ? `<small>G\xFCltig bis ${escapeHtml(formatDate(notice.validUntil))}</small>` : "";
  return `
    <section class="card compact official-notice-card">
      <div class="badges">${priorityBadge}<span class="badge official">Gemeinde-Hinweis</span><span class="badge">${escapeHtml(notice.category || "Allgemein")}</span>${statusBadge}</div>
      <h3 style="margin-top:8px;">${escapeHtml(notice.title)}</h3>
      <p>${escapeHtml(notice.text)}</p>
      <div class="alert-meta"><span>${escapeHtml(notice.createdByLabel || "Gemeinde")}</span><span>\xB7</span><span>${escapeHtml(fmtTime(notice.createdAt))}</span>${validUntil ? `<span>\xB7</span>${validUntil}` : ""}</div>
      ${canManageOfficialNotices() && !compact ? `
        <div class="row-actions" style="margin-top:12px;">
          <button class="success-button small" data-action="publish-notice" data-id="${escapeHtml(notice.id)}" ${notice.status === "online" ? "disabled" : ""}>Online stellen</button>
          <button class="ghost-button small" data-action="archive-notice" data-id="${escapeHtml(notice.id)}">Archivieren</button>
        </div>
      ` : ""}
    </section>
  `;
}
function renderOfficialNoticesCard() {
  const notices = visibleOfficialNotices();
  const manage = canManageOfficialNotices();
  return `
    <article class="card official-notices-card" id="officialNoticesCard" tabindex="-1">
      <div class="request-head">
        <div>
          <h2>Offizielle Gemeinde-Hinweise</h2>
          <p>Normale amtliche oder organisatorische Informationen, getrennt von dringenden Alarmen.</p>
        </div>
        ${manage ? `<button class="secondary-button small" data-action="new-official-notice">${iconSvg("edit")} Hinweis erstellen</button>` : ""}
      </div>
      <div class="list" style="margin-top:14px;">
        ${notices.length ? notices.slice(0, 4).map((notice) => renderOfficialNoticeCard(notice, { compact: !manage })).join("") : '<div class="empty">Keine aktuellen Gemeinde-Hinweise.</div>'}
      </div>
    </article>
  `;
}
function homePrioritySignal() {
  const now = Date.now();
  const alerts = visibleAlerts().filter((alert) => !alert.validUntil || new Date(alert.validUntil).getTime() >= now).sort((a, b) => {
    const rank = { critical: 3, warn: 2, info: 1 };
    return (rank[b.severity] || 0) - (rank[a.severity] || 0) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
  const critical = alerts.find((alert) => alert.severity === "critical");
  if (critical) return { kind: "critical", label: "Kritischer Alarm", title: critical.title, text: critical.text, route: "alarme" };
  const importantNotice = visibleOfficialNotices().find((notice) => notice.priority === "wichtig" && notice.status === "online");
  if (importantNotice) return { kind: "important", label: "Wichtiger Gemeinde-Hinweis", title: importantNotice.title, text: importantNotice.text, action: "focus-official-notices" };
  const warning = alerts.find((alert) => alert.severity === "warn");
  if (warning) return { kind: "warning", label: "Aktuelle Gemeindemeldung", title: warning.title, text: warning.text, route: "alarme" };
  return null;
}
function renderHomePriorityStrip() {
  const signal = homePrioritySignal();
  if (!signal) return "";
  const action = signal.route ? `<button class="ghost-button small" data-route="${escapeHtml(signal.route)}">\xD6ffnen</button>` : `<button class="ghost-button small" data-action="${escapeHtml(signal.action)}">\xD6ffnen</button>`;
  return `
    <section class="home-priority-strip ${escapeHtml(signal.kind)}" aria-label="${escapeHtml(signal.label)}">
      <span class="home-priority-icon">${iconSvg("alert")}</span>
      <div><small>${escapeHtml(signal.label)}</small><strong>${escapeHtml(signal.title)}</strong><p>${escapeHtml(signal.text)}</p></div>
      ${action}
    </section>
  `;
}
function renderRelevantHomeCard(requests = []) {
  return `
    <article class="card home-relevant-card">
      <div class="request-head">
        <div><h2>Relevante Anliegen</h2><p>Passende Gesuche und Angebote aus deinem Gebiet.</p></div>
        <button class="ghost-button small" data-route="bulletin">Alle anzeigen</button>
      </div>
      <div class="home-request-list">
        ${requests.length ? requests.map((req) => `
          <section class="home-request-row request-kind-${requestToneClass(req)}">
            <div class="badges"><span class="badge ${req.type === "Biete" ? "offer" : ""}">${escapeHtml(req.type || "Anliegen")}</span><span class="badge">${escapeHtml(req.category || "Allgemein")}</span>${trustBadge(profileFromRequest(req), { detail: true })}</div>
            <h3>${escapeHtml(req.title || "Ohne Titel")}</h3>
            <p>${escapeHtml(req.text || "")}</p>
            ${postPhotoGallery(req.photoPaths)}
            <small>${escapeHtml(req.area || "")} \xB7 ${escapeHtml(fmtTime(req.createdAt))}</small>
          </section>
        `).join("") : '<div class="empty compact-empty">Noch keine offenen Anliegen. Erfasse das erste Gesuch oder Angebot.</div>'}
      </div>
    </article>
  `;
}
function renderAdminWorkQueueCard(publicationQueue, openModeration, pendingApprovals) {
  return `
    <article class="card admin-work-queue">
      <div class="request-head">
        <div><h2>Admin-Aufgaben</h2><p>Freigaben und Pr\xFCfungen an einem Ort.</p></div>
        <div class="row-actions compact-actions">
          <button class="primary-button small" data-action="new-alert">Alarm</button>
          <button class="secondary-button small" data-action="new-official-notice">Gemeinde-Hinweis</button>
        </div>
      </div>
      <div class="admin-task-stats">
        <div><strong>${formatNumber(publicationQueue.length)}</strong><span>Beitragsfreigaben</span></div>
        <div><strong>${formatNumber(openModeration.length)}</strong><span>Moderationsf\xE4lle</span></div>
        <div><strong>${formatNumber(pendingApprovals)}</strong><span>offene Antr\xE4ge</span></div>
        <div><strong>${formatNumber(unreadChatCount())}</strong><span>ungelesene Chats</span></div>
      </div>
      ${publicationQueue.length ? `<div class="admin-approval-preview">${publicationQueue.slice(0, 3).map((req) => `
        <section class="admin-approval-row">
          <div><div class="badges">${requestStatusBadge(req)}<span class="badge">${escapeHtml(req.type || "Anliegen")}</span></div><strong>${escapeHtml(req.title || "Ohne Titel")}</strong><small>${escapeHtml(requestAuthorLabel(req))} \xB7 ${escapeHtml(req.area || "")}</small></div>
          <div class="row-actions compact-actions"><button class="success-button small" data-action="approve-request-publication" data-id="${escapeHtml(req.id)}">Freigeben</button><button class="ghost-button small" data-action="edit-request" data-id="${escapeHtml(req.id)}">Pr\xFCfen</button></div>
        </section>
      `).join("")}</div>` : '<p class="help admin-queue-empty">Aktuell wartet kein Beitrag auf Freigabe.</p>'}
      <div class="row-actions compact-actions admin-queue-links">
        <button class="ghost-button small" data-route="profile">Antr\xE4ge und Nutzer</button>
        <button class="ghost-button small" data-route="alarme">Alarme verwalten</button>
      </div>
    </article>
  `;
}
function renderV2Journey() {
  const own = state.requests.filter((req) => requestOwnerUid(req) === authState.user?.uid).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 3);
  if (!own.length) return "";
  return `<article class="card v2-journey" aria-label="Deine Anliegen">
    <div class="v2-section-heading"><div><span class="v2-kicker">Dein \xDCberblick</span><h2>Meine Anliegen</h2></div><button class="ghost-button small" data-route="bulletin">Zum Brett</button></div>
    <div class="v2-journey-items">${own.map((req) => {
    const progress = requestJourney(req, state.chats);
    return `<div class="v2-journey-item"><div><strong>${escapeHtml(req.title || "Ohne Titel")}</strong><small>${escapeHtml(progress.detail)}</small></div><span class="v2-status-tag">${escapeHtml(progress.label)}</span></div>`;
  }).join("")}</div>
  </article>`;
}
function renderV2Matches() {
  const prefs = readPreferences(authState.user?.uid);
  const matches = matchHelpRequests(state.requests, {
    uid: authState.user?.uid,
    categories: prefs.categories,
    area: state.profile.area,
    score: relevantScore
  }).filter((req) => requestIsReachable(req, parseDistanceFilterKm(state.filter.distanceKm)));
  const filtered = prefs.categories.length ? matches.filter((req) => prefs.categories.includes(req.category)) : matches;
  const shown = filtered.slice(0, 3);
  return `<article class="card v2-matching" aria-label="Passende Hilfegesuche">
    <div class="v2-section-heading"><div><span class="v2-kicker">F\xFCr dich ausgew\xE4hlt</span><h2>Hier kannst du helfen</h2></div><button class="ghost-button small" data-route="bulletin">Alle ansehen</button></div>
    ${prefs.categories.length ? `<p class="v2-caption">Interessen: ${prefs.categories.map(escapeHtml).join(" \xB7 ")}</p>` : '<p class="v2-caption">Aktuelle Hilfegesuche aus deiner Umgebung. W\xE4hle im Profil Interessen f\xFCr passendere Vorschl\xE4ge.</p>'}
    <div class="v2-match-list">${shown.length ? shown.map((req) => `<div class="v2-match-item"><span class="v2-mini-icon" aria-hidden="true">\u2661</span><div><strong>${escapeHtml(req.title)}</strong><small>${escapeHtml(req.category)} \xB7 ${escapeHtml(req.area || "")}</small></div><button class="secondary-button small" data-action="open-chat" data-id="${escapeHtml(req.id)}">Helfen</button></div>`).join("") : '<p class="empty">Noch keine passenden Hilfegesuche. Schaue sp\xE4ter wieder vorbei oder \xE4ndere deine Interessen.</p>'}</div>
  </article>`;
}
function v462DashboardUid() {
  return authState.user?.uid || "guest";
}
function v462HasDashboardPhoto() {
  return Boolean(readDashboardPhoto(v462DashboardUid()));
}
function v462ApplyDashboardPhoto() {
  const hero = document.querySelector("#main .v2-hero");
  if (!hero) return;
  const photo = readDashboardPhoto(v462DashboardUid());
  hero.classList.toggle("v462-has-photo", Boolean(photo));
  if (photo) hero.style.setProperty("--v462-dashboard-photo", `url("${photo}")`);
  else hero.style.removeProperty("--v462-dashboard-photo");
}
function v462BindDashboardBackground() {
  v462ApplyDashboardPhoto();
  const settings = document.querySelector(".v462-background-setting");
  if (!settings) return;
  settings.querySelectorAll("[data-v462-choose-background]").forEach((button) => button.addEventListener("click", () => {
    settings.querySelector("[data-v462-background-file]")?.click();
  }));
  settings.querySelectorAll("[data-v462-background-file]").forEach((input) => input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    runAsyncAction(async () => {
      const uidBefore = v462DashboardUid();
      await openDashboardPhotoEditor(file, {
        expectedUid: uidBefore,
        currentUid: v462DashboardUid,
        onSave: async (jpeg) => {
          if (v462DashboardUid() !== uidBefore) throw new Error("Das Konto wurde gewechselt.");
          try {
            await saveDashboardPhoto(uidBefore, jpeg);
          } catch (error) {
            throw new Error(error?.name === "QuotaExceededError" ? "Ger\xE4tespeicher voll. Bitte Speicherplatz freigeben." : error.message);
          }
          toast("Dein Dashboard-Hintergrund wurde gespeichert.");
          render();
        }
      });
    });
    input.value = "";
  }));
  settings.querySelectorAll("[data-v462-reset-background]").forEach((button) => button.addEventListener("click", () => runAsyncAction(async () => {
    await clearDashboardPhoto(v462DashboardUid());
    toast("Standardhintergrund wiederhergestellt.");
    render();
  })));
}
var v53Draft = null;
var v53DraftUid = "";
var v53SettingsQuery = "";
var v53SearchOptionsOpen = false;
var V53_DEFAULTS = Object.freeze({
  quickLinks: ["need", "market", "calendar"],
  priorityOrder: ["inbox", "events", "loans", "bulletin", "saved", "map"],
  density: "comfortable"
});
function v53Preferences() {
  const d = state.dashboard || {};
  return { quickLinks: cleanQuickLinks(d.quickLinks), priorityOrder: cleanPriorityOrder(d.priorityOrder), density: cleanDensity(d.density) };
}
function v53Working() {
  const u = authState.user?.uid || "guest";
  if (v53DraftUid !== u) {
    v53Draft = null;
    v53DraftUid = u;
  }
  return v53Draft || v53Preferences();
}
function v53QuickButton(id, customClass = "v53-shortcut") {
  const m = V53_SHORTCUTS.find((x) => x.id === id);
  if (!m) return "";
  const attrib = m.route ? `data-route="${m.route}"` : m.hub ? `data-v3-open="${m.hub}"` : m.v50 ? `data-v50-open="${m.v50}"` : `data-action="${m.action}"`;
  return `<button type="button" class="${customClass}" ${attrib} aria-label="${escapeHtml(m.label)}"><span class="v53-shortcut-icon" aria-hidden="true">${icon(m.id)}</span><span class="v53-shortcut-text"><strong>${escapeHtml(m.label)}</strong><small>${escapeHtml(m.hint)}</small></span></button>`;
}
function renderV53QuickActions() {
  const p = v53Preferences();
  return `<section class="v53-section v53-shortcuts" aria-labelledby="v53QuickTitle"><header class="v53-section-head"><div><span class="v53-kicker">Schnellzugriffe</span><h2 id="v53QuickTitle">Direkt loslegen</h2></div><button type="button" class="ghost-button small" data-v53-edit="shortcuts" aria-label="Schnellzugriffe bearbeiten">Anpassen</button></header>
 <div class="v53-shortcut-grid">${p.quickLinks.map((id) => v53QuickButton(id)).join("")}</div></section>`;
}
function v53PriorityMeta(id) {
  const mine = ownRequests().filter((r) => ["offen", "wartet_freigabe"].includes(r.status)).length;
  const rows = {
    inbox: { count: inboxUnreadCount(), hint: "Neue Mitteilungen und Anfragen", icon: "\u{1F514}", route: "inbox" },
    events: { count: upcomingCommunityEvents().length, hint: "Termine und Veranstaltungen", icon: "\u{1F4C5}", route: "events" },
    loans: { count: hubState.loaded ? hubState.items.filter((e) => e.kind === "lend" && e.ownerUid === authState.user?.uid && ["borrowed", "reserved"].includes(e.availability)).length : null, hint: "Ausleihen und R\xFCckgaben", icon: "\u{1F9F0}", v50: "v50loans" },
    bulletin: { count: mine, hint: "Deine offenen Anliegen", icon: "\u{1F91D}", route: "bulletin" },
    saved: { count: null, hint: "Gespeicherte Beitr\xE4ge", icon: "\u2661", route: "saved" },
    map: { count: null, hint: "Karte deiner Gemeinde", icon: "\u{1F4CD}", route: "map" }
  };
  return rows[id];
}
function v53PriorityButton(id) {
  const m = V53_PRIORITY.find((x) => x.id === id), d = v53PriorityMeta(id);
  if (!m || !d) return "";
  const attr = d.route ? `data-route="${d.route}"` : `data-v50-open="${d.v50}"`;
  return `<button type="button" class="v53-priority-item" ${attr}><span aria-hidden="true" class="v53-priority-icon">${icon(id)}</span><span class="v53-priority-copy"><strong>${escapeHtml(m.label)}</strong><small>${escapeHtml(d.hint)}</small></span>${d.count !== null ? `<span class="v53-priority-count" aria-label="${d.count} Eintr\xE4ge">${d.count}</span>` : ""}<span aria-hidden="true" class="v53-priority-chevron">\u203A</span></button>`;
}
function renderV53Priorities() {
  const ids = v53Preferences().priorityOrder;
  return `<section class="v53-section v53-priorities" aria-labelledby="v53PriorityTitle"><header class="v53-section-head"><div><span class="v53-kicker">Pers\xF6nlicher \xDCberblick</span><h2 id="v53PriorityTitle">F\xFCr dich wichtig</h2></div><button type="button" class="ghost-button small" data-v53-edit="priorities">Sortieren</button></header>
 <div class="v53-priority-grid">${ids.slice(0, 3).map(v53PriorityButton).join("")}</div>
 <details class="v53-more-priorities"><summary>Weitere pers\xF6nliche Bereiche (${ids.length - 3})</summary><div class="v53-priority-grid">${ids.slice(3).map(v53PriorityButton).join("")}</div></details></section>`;
}
function renderV53Personalization() {
  const p = v53Working();
  return `<section class="v53-personalization" aria-labelledby="v53PersonalTitle"><h3 id="v53PersonalTitle">Schnellzugriffe & Ansicht</h3><p class="help">W\xE4hle mindestens zwei und h\xF6chstens acht Schnellzugriffe. Alle Funktionen bleiben weiterhin unter Quartier+ und in der Navigation erreichbar.</p>
 <fieldset class="v53-shortcut-options"><legend>Meine Schnellzugriffe</legend><div class="v53-settings-choice-grid">${V53_SHORTCUTS.map((m) => `<label class="v53-choice"><input type="checkbox" data-v53-quick="${m.id}" ${p.quickLinks.includes(m.id) ? "checked" : ""}><span aria-hidden="true">${m.icon}</span><span>${escapeHtml(m.label)}</span></label>`).join("")}</div></fieldset>
 <div class="v53-reorder" aria-label="Reihenfolge der Schnellzugriffe"><strong>Reihenfolge</strong>${p.quickLinks.map((id, i) => {
    const m = V53_SHORTCUTS.find((x) => x.id === id);
    return `<div class="v53-reorder-row"><span>${escapeHtml(m?.label || id)}</span><div><button type="button" class="ghost-button small" data-v53-move-quick="${id}" data-v53-dir="-1" aria-label="${escapeHtml(m?.label || id)} nach oben" ${i === 0 ? "disabled" : ""}>\u2191</button><button type="button" class="ghost-button small" data-v53-move-quick="${id}" data-v53-dir="1" aria-label="${escapeHtml(m?.label || id)} nach unten" ${i === p.quickLinks.length - 1 ? "disabled" : ""}>\u2193</button></div></div>`;
  }).join("")}</div>
 <fieldset class="v53-density-settings"><legend>Darstellung</legend><label><input type="radio" name="v53-density" value="comfortable" ${p.density === "comfortable" ? "checked" : ""}> Komfortabel \u2013 mehr Abstand</label><label><input type="radio" name="v53-density" value="compact" ${p.density === "compact" ? "checked" : ""}> Kompakt \u2013 mehr auf einen Blick</label></fieldset>
 <div class="v53-reorder" aria-label="Priorit\xE4ten sortieren"><strong>Reihenfolge der pers\xF6nlichen \xDCbersicht</strong>${p.priorityOrder.map((id, i) => {
    const m = V53_PRIORITY.find((x) => x.id === id);
    return `<div class="v53-reorder-row"><span>${escapeHtml(m?.label || id)}</span><div><button type="button" class="ghost-button small" data-v53-move-priority="${id}" data-v53-dir="-1" aria-label="${escapeHtml(m?.label || id)} nach oben" ${i === 0 ? "disabled" : ""}>\u2191</button><button type="button" class="ghost-button small" data-v53-move-priority="${id}" data-v53-dir="1" aria-label="${escapeHtml(m?.label || id)} nach unten" ${i === p.priorityOrder.length - 1 ? "disabled" : ""}>\u2193</button></div></div>`;
  }).join("")}</div>
 <div class="row-actions"><button class="primary-button" type="button" data-v53-save>Personalisierung speichern</button><button class="ghost-button" type="button" data-v53-reset>Nur diese Auswahl zur\xFCcksetzen</button></div><p class="help">Bei bestehender Firebase-Anmeldung wird diese Einstellung im vorhandenen Benutzer-Dashboard gespeichert; ansonsten lokal.</p></section>`;
}
function v53Move(array, id, dir) {
  const res = array.slice(), i = res.indexOf(id);
  if (i < 0) return res;
  const j = Math.max(0, Math.min(res.length - 1, i + dir));
  res.splice(i, 1);
  res.splice(j, 0, id);
  return res;
}
async function v53Save() {
  const data = v53Working();
  const dashboard = sanitizeDashboardLayout({ ...state.dashboard, ...data });
  state.dashboard = dashboard;
  saveState();
  syncCurrentUser({ dashboard });
  v53Draft = null;
  render();
  if (isFirebaseMode()) {
    try {
      await updateFirebaseProfile({ dashboard });
      toast("Pers\xF6nliche Ansicht gespeichert und synchronisiert.");
    } catch (e) {
      toast("Auf diesem Ger\xE4t gespeichert. Cloud-Synchronisierung fehlgeschlagen.");
    }
  } else toast("Pers\xF6nliche Ansicht auf diesem Ger\xE4t gespeichert.");
}
function bindV53Controls() {
  document.body.dataset.v53Density = v53Preferences().density;
  document.querySelectorAll("[data-v53-edit]").forEach((b) => b.addEventListener("click", () => {
    v41ProfileOpenDetails.add("v41-start");
    setRoute("profile");
    document.getElementById("v53PersonalTitle")?.scrollIntoView({ block: "start", behavior: "smooth" });
  }));
  document.querySelectorAll("[data-v53-back]").forEach((b) => b.addEventListener("click", () => setRoute(b.dataset.v53Back || "home")));
  document.querySelectorAll("[data-v53-quick]").forEach((b) => b.addEventListener("change", () => {
    const p = v53Working(), active = p.quickLinks.slice(), id = b.dataset.v53Quick;
    const next = b.checked ? [...active, id] : active.filter((x) => x !== id);
    if (next.length < 2 || next.length > 8) {
      b.checked = !b.checked;
      toast("Bitte zwischen 2 und 8 Schnellzugriffen ausw\xE4hlen.");
      return;
    }
    v53Draft = { ...p, quickLinks: cleanQuickLinks(next) };
    render();
  }));
  document.querySelectorAll("[data-v53-move-quick],[data-v53-move-priority]").forEach((b) => b.addEventListener("click", () => {
    const p = v53Working(), isQuick = b.hasAttribute("data-v53-move-quick"), key = isQuick ? "quickLinks" : "priorityOrder";
    v53Draft = { ...p, [key]: v53Move(p[key], b.dataset.v53MoveQuick || b.dataset.v53MovePriority, Number(b.dataset.v53Dir) || 0) };
    render();
  }));
  document.querySelectorAll('[name="v53-density"]').forEach((b) => b.addEventListener("change", () => {
    v53Draft = { ...v53Working(), density: cleanDensity(b.value) };
    render();
  }));
  document.querySelector("[data-v53-save]")?.addEventListener("click", () => void v53Save());
  document.querySelector("[data-v53-reset]")?.addEventListener("click", () => {
    v53Draft = { ...V53_DEFAULTS, quickLinks: [...V53_DEFAULTS.quickLinks], priorityOrder: [...V53_DEFAULTS.priorityOrder] };
    render();
    toast("Standardauswahl vorbereitet. Bitte speichern.");
  });
  const search = document.getElementById("v53SettingsSearch");
  if (search) {
    search.addEventListener("input", () => {
      v53SettingsQuery = search.value;
      v53FilterSettings(search.value);
    });
    v53FilterSettings(v53SettingsQuery);
  }
  const hubSearch = document.querySelector("[data-v53-hub-search]");
  if (hubSearch) hubSearch.addEventListener("input", () => {
    const value = hubSearch.value.trim().toLocaleLowerCase("de-CH");
    let shown = 0;
    document.querySelectorAll(".v53-hub-group").forEach((group) => {
      let count = 0;
      group.querySelectorAll(".v53-hub-module").forEach((el) => {
        const match = el.textContent.toLocaleLowerCase("de-CH").includes(value);
        el.hidden = !match;
        if (match) count++;
      });
      group.hidden = count === 0;
      if (value && count) group.open = true;
      shown += count;
    });
    const result = document.getElementById("v53HubResult");
    if (result) result.textContent = value ? shown ? `${shown} Funktionen gefunden` : "Keine Funktion gefunden" : "Alle Funktionen sichtbar";
  });
  document.querySelector(".v53-search-options")?.addEventListener("toggle", (e) => {
    v53SearchOptionsOpen = e.target.open;
  });
}
function v53FilterSettings(term) {
  const q = String(term || "").trim().toLocaleLowerCase("de-CH");
  let count = 0;
  document.querySelectorAll(".v41-settings-page .v41-setting").forEach((item) => {
    const heading = item.querySelector("summary")?.textContent || "";
    const match = !q || heading.toLocaleLowerCase("de-CH").includes(q);
    item.hidden = !match;
    if (match) count++;
  });
  document.querySelectorAll(".v41-settings-page .v41-setting-group").forEach((g) => {
    g.hidden = !!q && !g.querySelector(".v41-setting:not([hidden])");
  });
  const msg = document.getElementById("v53SettingsResult");
  if (msg) msg.textContent = q ? count ? `${count} Einstellungsbereiche gefunden` : "Keine passende Einstellung gefunden" : "Alle Einstellungen sichtbar";
}
function renderV53Breadcrumb() {
  const labels = { search: "Suche", bulletin: "Schwarzes Brett", events: "Veranstaltungen", inbox: "Mitteilungen", map: "Quartierkarte", swissmap: "Schweizkarte", saved: "Favoriten", drafts: "Entw\xFCrfe", alarme: "Alarme" };
  if (!labels[state.route]) return "";
  return `<nav class="v53-breadcrumb" aria-label="Zur\xFCck zur Startseite"><button type="button" class="ghost-button small" data-v53-back="home">\u2190 Startseite</button><span aria-hidden="true">/</span><span>${labels[state.route]}</span></nav>`;
}
function renderV53RelatedTabs(section) {
  const sets = {
    lend: [["lend", "Angebote"], ["v50loans", "Ausleihkalender"]],
    v50loans: [["lend", "Angebote"], ["v50loans", "Ausleihkalender"]],
    market: [["market", "Artikel"], ["v50market", "Reservationen"]],
    v50market: [["market", "Artikel"], ["v50market", "Reservationen"]],
    group: [["group", "Vereine"], ["project", "Projekte"], ["v50associations", "Anmeldungen"]],
    project: [["group", "Vereine"], ["project", "Projekte"], ["v50associations", "Anmeldungen"]],
    v50associations: [["group", "Vereine"], ["project", "Projekte"], ["v50associations", "Anmeldungen"]],
    calendar: [["calendar", "Termine"], ["v50calendar", "Entsorgung & Kalender"]],
    v50calendar: [["calendar", "Termine"], ["v50calendar", "Entsorgung & Kalender"]]
  };
  const tabs = sets[section];
  if (!tabs) return "";
  return `<nav class="v53-related-tabs" aria-label="Zusammengeh\xF6rige Funktionen">${tabs.map(([id, label]) => `<button type="button" class="${id === section ? "active" : ""}" ${id.startsWith("v50") ? `data-v50-open="${id}"` : `data-v3-open="${id}"`} aria-current="${id === section ? "page" : "false"}">${escapeHtml(label)}</button>`).join("")}</nav>`;
}
function renderV53CommunicationNav(active) {
  return `<nav class="v53-related-tabs v53-communication-nav" aria-label="Nachrichten und Mitteilungen"><button type="button" data-route="inbox" class="${active === "inbox" ? "active" : ""}" aria-current="${active === "inbox" ? "page" : "false"}">Mitteilungen & Anfragen</button><button type="button" data-route="chats" class="${active === "chats" ? "active" : ""}" aria-current="${active === "chats" ? "page" : "false"}">Private Chats</button></nav>`;
}
function renderV53HubGroups() {
  const modules = [...HUB_MODULES, ...V50_NAV];
  const extras = {
    "help-request": { title: "Hilfe suchen", icon: "\u270B", description: "Ein Anliegen erfassen", html: 'data-action="new-need"' },
    "help-offer": { title: "Hilfe anbieten", icon: "\u2661", description: "Nachbarn unterst\xFCtzen", html: 'data-action="new-offer"' },
    "bulletin-link": { title: "Schwarzes Brett", icon: "\u{1F4CB}", description: "Lokale Gesuche und Angebote", html: 'data-route="bulletin"' },
    "event-link": { title: "Veranstaltungen", icon: "\u{1F4C5}", description: "Anl\xE4sse aus deiner Gemeinde", html: 'data-route="events"' },
    "inbox-link": { title: "Meine Mitteilungen", icon: "\u{1F514}", description: "Anfragen und Neuigkeiten", html: 'data-route="inbox"' },
    "saved-link": { title: "Gespeicherte Beitr\xE4ge", icon: "\u2661", description: "Deine Favoriten", html: 'data-route="saved"' },
    "swiss-map-link": { title: "Schweizkarte", icon: "\u{1F1E8}\u{1F1ED}", description: "Kantone, Gemeinden und Steckbriefe", html: 'data-route="swissmap"' }
  };
  const groups = hubGroups();
  const card = (id) => {
    const m = modules.find((m2) => m2.id === id), e = extras[id];
    if (m) {
      const attr = id.startsWith("v50") ? `data-v50-open="${id}"` : `data-v3-open="${id}"`;
      return `<button class="v3-hub-module v53-hub-module" type="button" ${attr}><span class="v3-hub-symbol" aria-hidden="true">${m.icon}</span><strong>${escapeHtml(m.title)}</strong><small>${escapeHtml(m.description || m.desc)}</small></button>`;
    }
    return e ? `<button class="v3-hub-module v53-hub-module" type="button" ${e.html}><span class="v3-hub-symbol" aria-hidden="true">${e.icon}</span><strong>${escapeHtml(e.title)}</strong><small>${escapeHtml(e.description)}</small></button>` : "";
  };
  return `<div class="v53-hub-catalog"><label class="v53-hub-search-label" for="v53HubSearch">Funktionen finden</label><input id="v53HubSearch" data-v53-hub-search type="search" placeholder="Zum Beispiel Ausleihen, Vereine, Entsorgung" maxlength="80" autocomplete="off"><span class="v53-hub-result" id="v53HubResult" aria-live="polite">Alle Funktionen sichtbar</span>
 ${groups.map((group, i) => `<details class="v53-hub-group" ${i < 2 ? "open" : ""}><summary><span aria-hidden="true">${group.icon}</span><span><strong>${escapeHtml(group.label)}</strong><small>${escapeHtml(group.description)}</small></span><span class="v53-chevron" aria-hidden="true">\u2304</span></summary><div class="v3-hub-grid">${group.ids.map(card).join("")}</div></details>`).join("")}</div>`;
}
function renderV48QuickOverview() {
  const mine = ownRequests().filter((r) => ["offen", "wartet_freigabe"].includes(r.status)).length;
  const unread = inboxUnreadCount();
  const lending = hubState.items.filter((i) => i.kind === "lend" && i.ownerUid === authState.user?.uid && ["borrowed", "reserved"].includes(i.availability)).length;
  return `<section class="v48-overview"><h2>Meine \xDCbersicht</h2><div class="v48-overview-grid"><button data-route="bulletin"><strong>${mine}</strong><small>Meine Anliegen</small></button><button data-route="inbox"><strong>${unread}</strong><small>Mitteilungen</small></button><button data-v50-open="v50loans"><strong>${lending}</strong><small>Aktive Ausleihen</small></button><button data-route="events"><strong>${upcomingCommunityEvents().length}</strong><small>Veranstaltungen</small></button></div></section>`;
}
function renderHome() {
  const isAdmin = isAdminRole();
  const open = state.requests.filter((r) => r.status === "offen" && !v46IsHidden("request", r.id));
  const latest = open.slice().sort(sortByLocalRelevance).slice(0, 3);
  const publicationQueue = pendingPublicationRequests();
  const openModeration = state.moderation.filter((item) => (item.status || "offen") === "offen");
  const pendingApprovals = state.locationChangeRequests.filter((r) => r.status === "offen").length + state.verificationRequests.filter((r) => ["offen", "zur\xFCckgestellt"].includes(r.status)).length + state.changeRequests.filter((r) => ["offen", "in_pruefung"].includes(r.status)).length;
  const extraHelp = renderV2Journey() + (open.length ? renderV2Matches() : "");
  const dashboardTiles = [
    { id: "kennzahlen", label: "Kennzahlen", span: "full", html: `<section class="grid four">${metricCard(open.length, "offene Anliegen")}${metricCard(activePrivateChats().length, "aktive Vermittlungen")}${metricCard(visibleAlerts().length, "aktive Alarme")}${metricCard(state.archive.length, "archiviert")}</section>` },
    { id: "erststart", label: "Erste Schritte", residentOnly: true, html: renderOnboardingChecklistCard() },
    { id: "kantonskarte", label: "Live-Kantonskarte", html: renderCantonLiveMap() },
    { id: "firmen", label: "Firmen / Arbeit", html: renderCompanyAreaCard() },
    { id: "so-funktionierts", label: "So funktioniert Quartinaut", residentOnly: true, html: `<article class="card"><h2>So funktioniert Quartinaut</h2><p>Hilfe suchen, anbieten und \xFCber private Chats organisieren. Offizielle Alarme stammen von gepr\xFCften Verantwortlichen.</p><button class="secondary-button" data-action="reopen-onboarding">Kurze Einf\xFChrung \xF6ffnen</button></article>` },
    { id: "einladungscodes", label: "Einladungscodes", adminOnly: true, html: `<article class="card"><h2>Einladungscodes</h2><div class="table-wrap">${inviteTable()}</div></article>` },
    { id: "community-dashboard", label: "Gemeinde-Auswertung", adminOnly: true, html: renderCommunityDashboardCard() },
    { id: "admin-metriken", label: "Admin-Auswertungen", adminOnly: true, html: renderAdminMetricsCard() },
    { id: "wartung", label: "Wartung", adminOnly: true, html: renderAdminMaintenanceCard() },
    { id: "prioritaeten", label: "Priorit\xE4ten", adminOnly: true, html: renderAreaPriorityCard() }
  ];
  return `
    <section class="v2-hero v53-hero" aria-label="Nachbarschaft">
      <div class="v2-hero-top"><span class="v2-location-chip">${iconSvg("location")} ${escapeHtml(state.profile.area || "Deine Gemeinde")}</span><button class="v53-hero-bell" type="button" data-route="inbox" aria-label="Mitteilungen \xF6ffnen${inboxUnreadCount() ? ` (${inboxUnreadCount()} ungelesen)` : ""}">\u{1F514}${inboxUnreadCount() ? `<span>${inboxUnreadCount()}</span>` : ""}</button></div>
      <span class="v4-welcome">QUARTINAUT \xB7 DEINE GEMEINDE</span>
      <h1>Gr\xFCezi${state.profile.name ? `, ${escapeHtml(state.profile.name.trim().split(/\s+/)[0])}` : ""}!</h1>
      <p>Was m\xF6chtest du heute machen?</p>
      <button type="button" class="v4-hero-search" data-route="search" aria-label="Suche \xF6ffnen">\u2315 &nbsp; Beitr\xE4ge, Vereine, Angebote suchen <span aria-hidden="true">\u2192</span></button>
    </section>
    ${renderV53QuickActions()}
    ${renderHomePriorityStrip()}
    ${renderV53Priorities()}
    <section class="v4-section-title"><h2>Aktuelles aus deiner N\xE4he</h2><button data-route="bulletin" class="ghost-button small">Alle Beitr\xE4ge ansehen</button></section>
    <section class="v2-home-grid">${renderRelevantHomeCard(latest)}${renderOfficialNoticesCard()}</section>
    ${isAdmin ? `<section class="v2-admin-important">${renderAdminWorkQueueCard(publicationQueue, openModeration, pendingApprovals)}</section>` : ""}
    <details class="v53-optional-section"><summary>Mein Quartier und weitere \xDCbersichten</summary><div class="v53-optional-content">${renderMyQuartierPanel()}${renderV48QuickOverview()}</div></details>
    ${extraHelp ? `<details class="v4-home-options v461-help-details"><summary>Weitere Hilfe & eigene Anliegen</summary>${extraHelp}</details>` : ""}
    <details class="v2-extras" ${dashboardEditMode() ? "open" : ""}>
      <summary>Weitere Bereiche und ${isAdmin ? "Verwaltung" : "Auswertungen"} <span aria-hidden="true">\u25BE</span></summary>
      ${renderDashboard(dashboardTiles, isAdmin)}
    </details>
    ${hubBottomTile()}`;
}
function metricCard(value, label, sub = "") {
  return `<article class="card metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span>${sub ? `<small>${sub}</small>` : ""}</article>`;
}
function renderBulletin() {
  const requests = filterFeed(state.requests.filter((r) => requestMatches(r) && !v46IsHidden("request", r.id)), { kind: v46FeedFilter(), area: state.profile.area, lastSeenAt: v46LastSeenAt(), savedKeys: v46SavedPostKeys() }).sort(sortByLocalRelevance);
  const savedFilter = ownSavedBulletinFilter();
  const selectedDistance = String(state.filter.distanceKm || "Alle");
  const activeFilters = state.filter.category !== "Alle" || selectedDistance !== "Alle";
  const types = ["Alle", "Suche", "Biete"];
  const cats = ["Alle", ...orderedCategories()];
  return `<section class="v2-page-header">
     <span class="v2-kicker">Dein Quartier entdecken</span><h1>Schwarzes Brett</h1>
     <p>Hilfe suchen, Unterst\xFCtzung anbieten und direkt miteinander sprechen.</p>
     <div class="v2-inline-actions"><button class="primary-button" data-action="new-need">${iconSvg("need")} Hilfe suchen</button><button class="secondary-button" data-action="new-offer">${iconSvg("offer")} Hilfe anbieten</button></div>
   </section>
   <section class="v21-board-shortcuts"><button class="secondary-button small" data-community-route="events">\u{1F4C5} Veranstaltungen</button><button class="ghost-button small" data-community-route="inbox">\u{1F514} Mitteilungen</button></section>
   ${v46FilterControls()}
   <section class="v2-board-panel">
    <label class="v2-search-label" for="filterQ">Suche nach Stichworten</label>
    <div class="v2-search-row"><span aria-hidden="true">\u2315</span><input id="filterQ" type="search" value="${escapeHtml(state.filter.q)}" placeholder="Was suchst du?" autocomplete="off" /></div>
    <div class="v2-type-pills" aria-label="Angebote oder Gesuche filtern">${types.map((type) => `<button class="v2-pill ${type === state.filter.type ? "active" : ""}" data-action="v2-type" data-value="${escapeHtml(type)}" aria-pressed="${type === state.filter.type}">${escapeHtml(type === "Alle" ? "Alles" : type === "Suche" ? "Gesuche" : "Angebote")}</button>`).join("")}</div>
    <div class="v2-category-chips" aria-label="Kategorie w\xE4hlen">${cats.map((cat) => `<button class="v2-chip ${cat === state.filter.category ? "active" : ""}" data-action="v2-category" data-value="${escapeHtml(cat)}" aria-pressed="${cat === state.filter.category}">${escapeHtml(cat)}</button>`).join("")}</div>
    <details class="v2-filter-drawer" ${activeFilters ? "open" : ""}><summary>Weitere Filter und Benachrichtigungen</summary>
      <div class="v2-filter-content"><div class="filters">
        <label>Kategorie <select id="filterCategory">${cats.map((cat) => `<option ${cat === state.filter.category ? "selected" : ""}>${escapeHtml(cat)}</option>`).join("")}</select></label>
        <label>Typ <select id="filterType">${types.map((type) => `<option ${type === state.filter.type ? "selected" : ""}>${escapeHtml(type)}</option>`).join("")}</select></label>
        <label>Distanz <select id="filterDistance">${DISTANCE_FILTER_VALUES.map((value) => `<option value="${value}" ${value === selectedDistance ? "selected" : ""}>${value === "Alle" ? "Alle" : `bis ${value} km`}</option>`).join("")}</select></label>
      </div><div class="row-actions compact-actions"><button class="secondary-button small" data-action="save-bulletin-filter">${iconSvg("bell")} Filter speichern</button>
        <button class="ghost-button small" data-action="load-bulletin-filter" ${savedFilter ? "" : "disabled"}>Gespeicherten Filter laden</button>
        ${savedFilter ? '<button class="ghost-button small" data-action="delete-bulletin-filter">Filter l\xF6schen</button>' : ""}</div>
      <p class="help">Gespeicherte Filter k\xF6nnen \u2013 bei aktiviertem Push \u2013 passende neue Anliegen melden. Distanzfilter ben\xF6tigen eine Standortfreigabe.</p></div>
    </details>
   </section>
   <section class="v2-board-results"><div class="v2-section-heading"><div><h2>Aktuelle Beitr\xE4ge</h2><p>${requests.length} passende Anliegen</p></div><button class="ghost-button small" data-action="new-request">+ Neu</button></div>
     <div class="v2-request-grid">${requests.length ? requests.map(requestCard).join("") : '<div class="empty">Noch keine passenden Eintr\xE4ge. Passe den Filter an oder erstelle ein neues Anliegen.</div>'}</div>
   </section>`;
}
function renderAlarme() {
  const isAdmin = isAdminRole();
  const alerts = visibleAlerts().slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const unread = alerts.filter((alert) => !hasSeenAlert(alert.id)).length;
  const pushTokensInArea = state.deviceTokens.filter((token) => token.area === state.profile.area && token.active !== false).length;
  return `
    <section class="page-title">
      <h1>Lokale Alarme</h1>
      <p>Nur verifizierte Gemeinde-Meldungen: Strassensperrung, Wasserunterbruch, wichtige Hinweise. Keine Diskussion, keine Werbung.</p>
      <div class="badges">
        <span class="badge">${unread} ungelesen</span>
        ${isAdmin ? `<span class="badge info">Push-Targets im Gebiet: ${pushTokensInArea}</span>` : ""}
      </div>
      <div class="row-actions">
        ${isAdmin ? '<button class="primary-button" data-action="new-alert">Alarm erstellen</button>' : ""}
        <button class="${isAdmin ? "secondary-button" : "primary-button"}" data-action="enable-notifications">${iconSvg("bell")} Benachrichtigungen aktivieren</button>
        <button class="ghost-button" data-action="test-notification">${iconSvg("check")} Test senden</button>
        <button class="ghost-button" data-action="push-diagnostics">${iconSvg("help")} Push pr\xFCfen</button>
      </div>
    </section>

    <section class="list" style="margin-top:4px;">
      ${alerts.length ? alerts.map(alertCard).join("") : '<div class="empty">Aktuell keine aktiven Alarme.</div>'}
    </section>
  `;
}
function chatInboxCard(chat, options = {}) {
  const trashView = options.view === "trash";
  const unread = chatHasUnread(chat);
  const muted = isChatMuted(chat);
  const preview = chat.lastMessagePreview || "Noch keine Nachricht.";
  const trashBadge = trashView ? `<span class="badge warn">${escapeHtml(chatTrashLabel(chat))}</span>` : "";
  const actions = trashView ? `
          <button class="secondary-button small" data-action="restore-chat" data-chat-id="${escapeHtml(chat.id)}">${iconSvg("restore")} Wiederherstellen</button>
          <button class="ghost-button small" data-action="purge-chat" data-chat-id="${escapeHtml(chat.id)}">${iconSvg("trash")} Endg\xFCltig l\xF6schen</button>
        ` : `
          <button class="secondary-button small" data-action="open-private-chat" data-chat-id="${escapeHtml(chat.id)}">${iconSvg("chat")} \xD6ffnen</button>
          <button class="ghost-button small" data-action="toggle-chat-mute" data-chat-id="${escapeHtml(chat.id)}">${iconSvg(muted ? "bell" : "bellOff")} ${muted ? "Aktivieren" : "Stumm"}</button>
          <button class="ghost-button small" data-action="trash-chat" data-chat-id="${escapeHtml(chat.id)}">${iconSvg("trash")} Papierkorb</button>
        `;
  return `
    <article class="card chat-inbox-card ${unread ? "unread" : ""}">
      <div class="chat-inbox-main">
        <div>
          <div class="badges">
            ${unread ? '<span class="badge warn">neu</span>' : ""}
            ${trashBadge}
            ${!trashView ? muted ? '<span class="badge">stumm</span>' : '<span class="badge info">Push aktiv</span>' : ""}
            <span class="badge">privat</span>
          </div>
          <h3>${escapeHtml(chatPeerLabel(chat))}</h3>
          <p>${escapeHtml(chat.requestTitle || "Direktvermittlung")}</p>
          <small>${escapeHtml(preview)}${chat.lastMessageAt ? ` \xB7 ${escapeHtml(fmtTime(chat.lastMessageAt))}` : ""}</small>
        </div>
        <div class="row-actions chat-inbox-actions">
          ${actions}
        </div>
      </div>
    </article>
  `;
}
function renderChats() {
  const activeChats = state.chats.filter((chat) => isChatVisibleForUser(chat)).sort((a, b) => Number(chatHasUnread(b)) - Number(chatHasUnread(a)) || new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
  const trashChats = state.chats.filter((chat) => isChatInTrashForUser(chat)).sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
  const view = state.chatView === "trash" ? "trash" : "active";
  const chats = view === "trash" ? trashChats : activeChats;
  const unread = unreadChatCount();
  const emptyText = view === "trash" ? "Der Papierkorb ist leer. Gel\xF6schte Chats bleiben hier 30 Tage sichtbar." : "Noch keine privaten Chats. \xD6ffne am Schwarzen Brett ein Anliegen und schreibe die erstellende Person an.";
  return `
    ${renderV53CommunicationNav("chats")}
    <section class="page-section">
      <div class="section-header">
        <div>
          <span class="eyebrow">Private Direktvermittlung</span>
          <h1>Chats</h1>
          <p class="section-description">Private 1:1-Unterhaltungen zu Hilfe-Angeboten und Gesuchen. Nur die zwei Teilnehmer k\xF6nnen den Verlauf lesen.</p>
        </div>
        <div class="row-actions">
          <span class="status-pill"><strong>${formatNumber(unread)}</strong> ungelesen</span>
          <button class="ghost-button" data-action="enable-notifications">${iconSvg("bell")} Push aktivieren</button>
        </div>
      </div>
      <div class="segmented chat-view-tabs" role="group" aria-label="Chat-Ansicht">
        <button class="${view === "active" ? "active" : ""}" type="button" data-action="set-chat-view" data-chat-view="active">${iconSvg("chat")} Aktiv (${formatNumber(activeChats.length)})</button>
        <button class="${view === "trash" ? "active" : ""}" type="button" data-action="set-chat-view" data-chat-view="trash">${iconSvg("trash")} Papierkorb (${formatNumber(trashChats.length)})</button>
      </div>
      ${view === "trash" ? `<p class="help">Chats im Papierkorb werden nach ${CHAT_TRASH_RETENTION_DAYS} Tagen automatisch aus deiner Ansicht entfernt. Beim Gegen\xFCber bleiben sie erhalten, bis diese Person ebenfalls l\xF6scht.</p>` : ""}
      <div class="list chat-inbox-list">
        ${chats.length ? chats.map((chat) => chatInboxCard(chat, { view })).join("") : `<div class="empty">${emptyText}</div>`}
      </div>
    </section>
  `;
}
function optionsForMultiSelect(values = [], selected = []) {
  const selectedSet = new Set(selected);
  return values.map((value) => `<option value="${escapeHtml(value)}" ${selectedSet.has(value) ? "selected" : ""}>${escapeHtml(value)}</option>`).join("");
}
function notificationKeywordRuleCard(rule) {
  const sourceLabels = {
    alerts: "Alarme",
    officialNotices: "Gemeinde-Hinweise",
    requests: "Schwarzes Brett"
  };
  const sourceText = rule.sources.map((source) => sourceLabels[source] || source).join(", ");
  const categoryText = rule.categories.length ? rule.categories.join(", ") : "alle Kategorien";
  const scopeText = rule.scope === "canton" ? "ganzer Kanton" : "eigene Gemeinde";
  return `
    <section class="notification-keyword-rule ${rule.enabled ? "" : "is-disabled"}">
      <div>
        <strong>${escapeHtml(rule.term)}</strong>
        <p>${escapeHtml(sourceText)} \xB7 ${escapeHtml(categoryText)} \xB7 ${escapeHtml(scopeText)}</p>
      </div>
      <div class="row-actions compact-actions">
        <button class="ghost-button small" type="button" data-action="toggle-notification-keyword" data-id="${escapeHtml(rule.id)}">${rule.enabled ? "Pausieren" : "Aktivieren"}</button>
        <button class="ghost-button small" type="button" data-action="edit-notification-keyword" data-id="${escapeHtml(rule.id)}">Bearbeiten</button>
        <button class="danger-button small" type="button" data-action="delete-notification-keyword" data-id="${escapeHtml(rule.id)}">L\xF6schen</button>
      </div>
    </section>
  `;
}
function renderNotificationPreferencesCard({ inline = false } = {}) {
  const prefs = currentNotificationPreferences();
  const permission = notificationPermissionState();
  const statusLabel2 = permission === "granted" ? prefs.enabled ? "Push aktiv" : "Push pausiert" : permission === "denied" ? "Im Browser blockiert" : "Noch nicht freigegeben";
  const editing = inline || isEditCardOpen("profile-notifications");
  const activeKeywords = prefs.keywordRules.filter((rule) => rule.enabled).length;
  return `
    <article class="card notification-preferences-card ${inline ? "v453-notifications-inline" : ""}" data-edit-card="profile-notifications">
      ${inline ? `<p class="v453-status-help">Push-Status: <strong>${escapeHtml(statusLabel2)}</strong></p>` : `<div class="request-head edit-card-head">
        <div><h2>Benachrichtigungen</h2><p>Bestimme selbst, welche lokalen Inhalte auf deinem Ger\xE4t erscheinen.</p></div>
        <div class="row-actions compact-actions">
          <span class="status-pill ${prefs.enabled && permission === "granted" ? "is-positive" : ""}">${escapeHtml(statusLabel2)}</span>
          <button class="icon-button small" type="button" data-action="toggle-edit-card" data-edit-card-id="profile-notifications" aria-label="Benachrichtigungen bearbeiten" aria-expanded="${editing ? "true" : "false"}" title="${editing ? "Bearbeitung schliessen" : "Bearbeiten"}">${iconSvg("edit")}</button>
        </div></div>`}
      ${editing ? `<form id="notificationPreferencesForm" class="notification-preferences-form">
        <section class="notification-setting-group notification-master-setting">
          <label class="check-row">
            <input type="checkbox" name="enabled" ${prefs.enabled ? "checked" : ""} />
            <span><strong>Push-Benachrichtigungen</strong><small>Hauptschalter f\xFCr dieses Konto. Die Browserfreigabe bleibt zus\xE4tzlich erforderlich.</small></span>
          </label>
          <div class="notification-lock-note">${iconSvg("alert")} <span><strong>Kritische P0-Alarme</strong> werden bei aktivem Push immer zugestellt.</span></div>
        </section>

        <div class="notification-settings-grid">
          <section class="notification-setting-group">
            <h3>Gemeinde-Alarme</h3>
            <label class="check-row"><input type="checkbox" name="alertsEnabled" ${prefs.alerts.enabled ? "checked" : ""} /><span><strong>Normale Alarme</strong><small>P1/P2-Meldungen der Gemeinde.</small></span></label>
            <label class="check-row"><input type="checkbox" name="alertSeverity" value="warn" ${prefs.alerts.severities.includes("warn") ? "checked" : ""} /><span><strong>Wichtige Meldungen</strong><small>P1, aber kein akuter Notfall.</small></span></label>
            <label class="check-row"><input type="checkbox" name="alertSeverity" value="info" ${prefs.alerts.severities.includes("info") ? "checked" : ""} /><span><strong>Informationen</strong><small>P2, allgemeine Alarmkanal-Hinweise.</small></span></label>
          </section>

          <section class="notification-setting-group">
            <h3>Gemeinde-Hinweise</h3>
            <label class="check-row"><input type="checkbox" name="noticesEnabled" ${prefs.officialNotices.enabled ? "checked" : ""} /><span><strong>Offizielle Hinweise</strong><small>Amtliche und organisatorische Mitteilungen.</small></span></label>
            <label class="check-row"><input type="checkbox" name="noticePriority" value="wichtig" ${prefs.officialNotices.priorities.includes("wichtig") ? "checked" : ""} /><span><strong>Wichtig</strong><small>Hinweise mit erh\xF6hter Relevanz.</small></span></label>
            <label class="check-row"><input type="checkbox" name="noticePriority" value="info" ${prefs.officialNotices.priorities.includes("info") ? "checked" : ""} /><span><strong>Information</strong><small>Normale Gemeindeinformationen.</small></span></label>
            <label>Kategorien
              <select name="noticeCategories" multiple size="5" aria-describedby="noticeCategoryHelp">${optionsForMultiSelect(OFFICIAL_NOTICE_CATEGORIES, prefs.officialNotices.categories)}</select>
            </label>
            <small id="noticeCategoryHelp" class="help">Keine Auswahl bedeutet: alle Kategorien der gew\xE4hlten Priorit\xE4t.</small>
          </section>

          <section class="notification-setting-group">
            <h3>Schwarzes Brett</h3>
            <label class="check-row"><input type="checkbox" name="bulletinEnabled" ${prefs.bulletin.enabled ? "checked" : ""} /><span><strong>Bewohner- und Firmenbeitr\xE4ge</strong><small>Benachrichtigung nach Typ und Kategorie.</small></span></label>
            <label class="check-row"><input type="checkbox" name="bulletinType" value="Suche" ${prefs.bulletin.types.includes("Suche") ? "checked" : ""} /><span><strong>Gesuche</strong><small>Beitr\xE4ge vom Typ \u201EIch brauche Hilfe\u201C.</small></span></label>
            <label class="check-row"><input type="checkbox" name="bulletinType" value="Biete" ${prefs.bulletin.types.includes("Biete") ? "checked" : ""} /><span><strong>Angebote</strong><small>Beitr\xE4ge vom Typ \u201EIch biete Hilfe\u201C.</small></span></label>
            <label>Kategorien
              <select name="bulletinCategories" multiple size="5" aria-describedby="bulletinCategoryHelp">${optionsForMultiSelect(CATEGORIES, prefs.bulletin.categories)}</select>
            </label>
            <small id="bulletinCategoryHelp" class="help">Ohne Kategorieauswahl gelten alle Kategorien des gew\xE4hlten Typs.</small>
          </section>

          <section class="notification-setting-group">
            <h3>Chats und Ruhezeit</h3>
            <label class="check-row"><input type="checkbox" name="chatsEnabled" ${prefs.chats.enabled ? "checked" : ""} /><span><strong>Private Nachrichten</strong><small>Einzelne Chats k\xF6nnen weiterhin separat stummgeschaltet werden.</small></span></label>
            <label class="check-row"><input type="checkbox" name="quietEnabled" ${prefs.quietHours.enabled ? "checked" : ""} /><span><strong>Ruhezeit verwenden</strong><small>Normale Pushmeldungen werden in dieser Zeit zur\xFCckgehalten.</small></span></label>
            <div class="form-grid two">
              <label>Von<input type="time" name="quietStart" value="${escapeHtml(prefs.quietHours.start)}" /></label>
              <label>Bis<input type="time" name="quietEnd" value="${escapeHtml(prefs.quietHours.end)}" /></label>
            </div>
          </section>
        </div>

        <section class="notification-keywords-section">
          <div class="request-head">
            <div><h3>Pers\xF6nliche Stichw\xF6rter</h3><p>Wort oder Wortgruppe mit Quelle, Kategorie und Gebiet kombinieren.</p></div>
            <button class="secondary-button small" type="button" data-action="add-notification-keyword" ${prefs.keywordRules.length >= MAX_NOTIFICATION_KEYWORD_RULES ? "disabled" : ""}>${iconSvg("edit")} Stichwort hinzuf\xFCgen</button>
          </div>
          <div class="notification-keyword-list">
            ${prefs.keywordRules.length ? prefs.keywordRules.map(notificationKeywordRuleCard).join("") : '<div class="empty compact-empty">Noch keine pers\xF6nlichen Stichw\xF6rter.</div>'}
          </div>
          <p class="help">${prefs.keywordRules.length}/${MAX_NOTIFICATION_KEYWORD_RULES} Regeln. Stichwortregeln k\xF6nnen auch dann ausl\xF6sen, wenn die allgemeine Kategorie nicht gew\xE4hlt ist.</p>
        </section>

        <div class="row-actions notification-save-actions">
          <button class="primary-button" type="submit">Einstellungen speichern</button>
          <button class="ghost-button" type="button" data-action="test-notification">Push testen</button>
          <button class="ghost-button" type="button" data-action="push-diagnostics">Diagnose</button>
        </div>
      </form>` : `
        <div class="notification-summary-grid">
          <div><strong>${prefs.criticalAlerts ? "Aktiv" : "Aus"}</strong><span>Kritische Alarme</span></div>
          <div><strong>${prefs.officialNotices.priorities.includes("info") ? "Wichtig + Info" : prefs.officialNotices.priorities.includes("wichtig") ? "Wichtig" : "Aus"}</strong><span>Gemeinde-Hinweise</span></div>
          <div><strong>${prefs.bulletin.enabled || activeKeywords ? "Aktiv" : "Aus"}</strong><span>Schwarzes Brett</span></div>
          <div><strong>${activeKeywords}</strong><span>Stichwortregeln</span></div>
        </div>
        <p class="help notification-summary-help">Mit dem Stift \xF6ffnest du Quellen, Kategorien, Stichw\xF6rter und Ruhezeiten.</p>
      `}
    </article>
  `;
}
async function persistNotificationPreferences(value, { notify = true } = {}) {
  const previous = currentNotificationPreferences();
  const prefs = normalizeNotificationPreferences({
    ...previous,
    ...value,
    uid: authState.user?.uid || previous.uid,
    area: state.profile.area,
    areaKey: currentAreaKey(),
    cantonCode: currentCantonCode(),
    createdAt: previous.createdAt || nowIso(),
    updatedAt: nowIso()
  });
  state.notificationPreferences = prefs;
  state.profile.notifications = prefs.enabled;
  syncCurrentUser({ notifications: prefs.enabled });
  saveState();
  if (isFirebaseMode() && authState.user) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.notificationPreferences, authState.user.uid, prefs, true);
    await updateFirebaseProfile({ notifications: prefs.enabled });
  }
  if (notify) toast("Benachrichtigungseinstellungen gespeichert.");
  return prefs;
}
async function saveNotificationPreferencesForm(form) {
  if (!form) return;
  const data = new FormData(form);
  const enabled = data.has("enabled");
  if (enabled && notificationPermissionState() !== "granted") {
    await enableNotifications();
    if (notificationPermissionState() !== "granted") throw new Error("Push kann erst nach der Browserfreigabe aktiviert werden.");
  }
  const current = currentNotificationPreferences();
  await persistNotificationPreferences({
    ...current,
    enabled,
    alerts: {
      enabled: data.has("alertsEnabled"),
      severities: data.getAll("alertSeverity").map(String)
    },
    officialNotices: {
      enabled: data.has("noticesEnabled"),
      priorities: data.getAll("noticePriority").map(String),
      categories: data.getAll("noticeCategories").map(String)
    },
    bulletin: {
      enabled: data.has("bulletinEnabled"),
      types: data.getAll("bulletinType").map(String),
      categories: data.getAll("bulletinCategories").map(String)
    },
    chats: { enabled: data.has("chatsEnabled") },
    quietHours: {
      enabled: data.has("quietEnabled"),
      start: String(data.get("quietStart") || "22:00"),
      end: String(data.get("quietEnd") || "07:00"),
      timezone: "Europe/Zurich"
    }
  });
  if (enabled && isFirebaseMode()) await registerPushToken();
  editCards.delete("profile-notifications");
  render();
}
function openNotificationKeywordModal(ruleId = "") {
  const prefs = currentNotificationPreferences();
  const existing = prefs.keywordRules.find((rule2) => rule2.id === ruleId) || null;
  if (!existing && prefs.keywordRules.length >= MAX_NOTIFICATION_KEYWORD_RULES) {
    toast(`Maximal ${MAX_NOTIFICATION_KEYWORD_RULES} Stichwortregeln m\xF6glich.`);
    return;
  }
  const rule = existing || normalizeNotificationKeywordRule({
    id: uid("keyword"),
    sources: ["requests"],
    scope: "municipality",
    enabled: true
  });
  const allCategories = [.../* @__PURE__ */ new Set([...CATEGORIES, ...OFFICIAL_NOTICE_CATEGORIES])];
  openModal(existing ? "Stichwort bearbeiten" : "Stichwort hinzuf\xFCgen", `
    <form id="notificationKeywordForm" class="form-grid">
      <label>Wort oder Wortgruppe
        <input name="term" required minlength="2" maxlength="60" value="${escapeHtml(rule.term)}" placeholder="z. B. Lehrstelle oder Stromunterbruch" />
      </label>
      <fieldset class="choice-fieldset">
        <legend>Quellen</legend>
        <label class="check-row"><input type="checkbox" name="source" value="requests" ${rule.sources.includes("requests") ? "checked" : ""} /><span><strong>Schwarzes Brett</strong><small>Beitr\xE4ge von Bewohnern und Firmen.</small></span></label>
        <label class="check-row"><input type="checkbox" name="source" value="officialNotices" ${rule.sources.includes("officialNotices") ? "checked" : ""} /><span><strong>Gemeinde-Hinweise</strong><small>Offizielle organisatorische Informationen.</small></span></label>
        <label class="check-row"><input type="checkbox" name="source" value="alerts" ${rule.sources.includes("alerts") ? "checked" : ""} /><span><strong>Alarme</strong><small>Gemeinde-Alarme und Sicherheitsmeldungen.</small></span></label>
      </fieldset>
      <div class="form-grid two">
        <label>Kategorie
          <select name="category">
            <option value="">Alle Kategorien</option>
            ${allCategories.map((category) => `<option value="${escapeHtml(category)}" ${rule.categories.includes(category) ? "selected" : ""}>${escapeHtml(category)}</option>`).join("")}
          </select>
        </label>
        <label>Gebiet
          <select name="scope">
            <option value="municipality" ${rule.scope === "municipality" ? "selected" : ""}>Eigene Gemeinde</option>
            <option value="canton" ${rule.scope === "canton" ? "selected" : ""}>Ganzer Kanton</option>
          </select>
        </label>
      </div>
      <label class="check-row"><input type="checkbox" name="enabled" ${rule.enabled ? "checked" : ""} /><span><strong>Regel aktiv</strong><small>Kann sp\xE4ter jederzeit pausiert werden.</small></span></label>
      <p class="form-error" id="notificationKeywordError" role="alert"></p>
      <button class="primary-button" type="submit">Stichwort speichern</button>
    </form>
  `, (modal, close) => {
    modal.querySelector("#notificationKeywordForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      runAsyncAction(async () => {
        const data = new FormData(form);
        const sources = data.getAll("source").map(String);
        const term = String(data.get("term") || "").trim().replace(/\s+/g, " ");
        const errorNode = modal.querySelector("#notificationKeywordError");
        if (term.length < 2) {
          if (errorNode) errorNode.textContent = "Bitte mindestens zwei Zeichen eingeben.";
          return;
        }
        if (!sources.length) {
          if (errorNode) errorNode.textContent = "Bitte mindestens eine Quelle ausw\xE4hlen.";
          return;
        }
        const category = String(data.get("category") || "");
        const nextRule = normalizeNotificationKeywordRule({
          ...rule,
          term,
          sources,
          categories: category ? [category] : [],
          scope: String(data.get("scope") || "municipality"),
          enabled: data.has("enabled")
        });
        const duplicate = prefs.keywordRules.some((item) => item.id !== nextRule.id && item.term.toLocaleLowerCase("de-CH") === nextRule.term.toLocaleLowerCase("de-CH"));
        if (duplicate) {
          if (errorNode) errorNode.textContent = "Dieses Stichwort existiert bereits.";
          return;
        }
        const keywordRules = existing ? prefs.keywordRules.map((item) => item.id === nextRule.id ? nextRule : item) : [...prefs.keywordRules, nextRule];
        await persistNotificationPreferences({ ...prefs, keywordRules });
        close();
        render();
      });
    });
  });
}
async function toggleNotificationKeyword(ruleId) {
  const prefs = currentNotificationPreferences();
  const keywordRules = prefs.keywordRules.map((rule) => rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule);
  await persistNotificationPreferences({ ...prefs, keywordRules });
  render();
}
async function deleteNotificationKeyword(ruleId) {
  const prefs = currentNotificationPreferences();
  const rule = prefs.keywordRules.find((item) => item.id === ruleId);
  if (!rule) return;
  if (!window.confirm(`Stichwort \u201E${rule.term}\u201C l\xF6schen?`)) return;
  await persistNotificationPreferences({ ...prefs, keywordRules: prefs.keywordRules.filter((item) => item.id !== ruleId) });
  render();
}
function inviteTable() {
  return `<table><thead><tr><th>Code</th><th>Gebiet</th><th>Rolle</th><th>Status</th></tr></thead><tbody>${state.inviteCodes.map((inv) => `<tr><td><strong>${escapeHtml(inv.code)}</strong></td><td>${escapeHtml(inv.area)}</td><td>${escapeHtml(inv.role)}</td><td>${escapeHtml(inv.status)}</td></tr>`).join("")}</tbody></table>`;
}
function renderV2Preferences({ compact = false } = {}) {
  const prefs = readPreferences(authState.user?.uid);
  const categories = orderedCategories();
  return `<section class="card v2-preferences" aria-label="Meine Quartinaut-Einstellungen">
    ${compact ? "" : `<div class="v2-section-heading"><div><span class="v2-kicker">Dein Quartinaut</span><h2>Meine Interessen</h2></div><span class="v2-status-tag">Nur auf diesem Ger\xE4t</span></div>`}
    <p>W\xE4hle, wobei du gerne helfen m\xF6chtest. Passende Hilfegesuche erscheinen auf deiner Startseite.</p>
    <div class="v2-category-chips">${categories.map((cat) => `<button class="v2-chip ${prefs.categories.includes(cat) ? "active" : ""}" data-action="v2-interest" data-value="${escapeHtml(cat)}" aria-pressed="${prefs.categories.includes(cat)}">${escapeHtml(cat)}</button>`).join("")}</div>

    <p class="help">Deine Interessen werden derzeit nur auf diesem Ger\xE4t gespeichert.</p>
  </section>`;
}
var v41ProfileOpenDetails = /* @__PURE__ */ new Set();
function openSingleSettingsPanel(panel) {
  if (!panel?.classList.contains("v41-setting")) return;
  v41ProfileOpenDetails.clear();
  document.querySelectorAll(".v41-setting").forEach((item) => {
    if (item !== panel && item.open) item.open = false;
  });
  if (panel.open) v41ProfileOpenDetails.add(panel.id);
}
function bindV41Settings() {
  document.querySelectorAll(".v41-setting").forEach((el) => el.addEventListener("toggle", () => {
    if (el.open) openSingleSettingsPanel(el);
    else v41ProfileOpenDetails.delete(el.id);
  }));
  const opened = [...document.querySelectorAll(".v41-setting[open]")];
  if (opened.length > 1) openSingleSettingsPanel(opened[opened.length - 1]);
  document.querySelectorAll("[data-v41-open]").forEach((btn) => btn.addEventListener("click", () => {
    const target = document.getElementById(btn.dataset.v41Open);
    if (target) {
      target.open = true;
      openSingleSettingsPanel(target);
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }));
  document.querySelector("[data-v41-theme]")?.addEventListener("change", (e) => setThemeChoice(e.target.value, { notify: true }));
  document.querySelectorAll("[data-v41-hub-kind]").forEach((btn) => btn.addEventListener("click", () => {
    hubState.section = btn.dataset.v41HubKind;
    hubState.search = "";
    setRoute("hub");
    if (!hubState.loaded && !hubState.loading) void loadHub();
  }));
}
function renderProfile({ pageTitle = "Profil & Einstellungen", webSettings = "" } = {}) {
  const isAdmin = isAdminRole();
  const activeTitle = profileTitle();
  const titleSuffix = activeTitle ? ` \xB7 ${activeTitle}` : "";
  const verificationText = state.profile.verified ? "Verifiziert" : state.profile.verificationStatus === "pending" ? "Verifizierung beantragt" : "Nicht verifiziert";
  const ownLocationRequest = state.locationChangeRequests.find((req) => req.uid === authState.user?.uid && req.status === "offen");
  const ownVerificationRequest = state.verificationRequests.find((req) => req.uid === authState.user?.uid && ["offen", "zur\xFCckgestellt"].includes(req.status));
  const ownNameChangeRequest = state.changeRequests.find((req) => req.uid === authState.user?.uid && req.type === "name_change" && ["offen", "in_pruefung"].includes(req.status));
  const ownChangeRequest = state.changeRequests.find((req) => req.uid === authState.user?.uid && req.type !== "name_change" && ["offen", "in_pruefung"].includes(req.status));
  const ownTokenCount = state.deviceTokens.filter((token) => token.uid === authState.user?.uid && token.active !== false).length;
  const openLocationRequests = state.locationChangeRequests.filter((req) => req.status === "offen");
  const openVerificationRequests = state.verificationRequests.filter((req) => ["offen", "zur\xFCckgestellt"].includes(req.status));
  const archivedVerificationRequests = state.verificationRequests.filter((req) => ["best\xE4tigt", "bestaetigt", "abgelehnt"].includes(req.status)).sort((a, b) => new Date(normalizeStoredDate(b.decidedAt) || 0) - new Date(normalizeStoredDate(a.decidedAt) || 0));
  const openChangeRequests = state.changeRequests.filter((req) => ["offen", "in_pruefung"].includes(req.status));
  const identityEditing = isEditCardOpen("profile-identity");
  const accountEditing = isEditCardOpen("profile-account");
  return `
    <section class="v41-profile-hero" aria-label="Profil\xFCbersicht">
      <span class="v41-eyebrow">DEIN QUARTINAUT</span>
      <h1>${escapeHtml(pageTitle)}</h1>
      <p>Pers\xF6nlich, \xFCbersichtlich und sicher.</p>
      <div class="v41-user-card">
        <span class="v41-avatar" aria-hidden="true">${escapeHtml(state.profile.initials || initialsFromName(profileName()))}</span>
        <span class="v41-user-information"><strong>${escapeHtml(profileName())} ${verifiedMark()}</strong><small>${escapeHtml(locationLabel())} \xB7 ${escapeHtml(roleLabel())}</small><span>${trustBadge(state.profile)}</span></span>
        <button class="v41-profile-edit" type="button" data-v41-open="v41-identity" aria-label="Profildaten und Sicherheit \xF6ffnen">${iconSvg("edit")}<span>Bearbeiten</span></button>
      </div>
    </section>

    ${webSettings}
    <div class="v41-settings-page v453-settings-page">
      <p class="v453-settings-lead">Alles Wichtige an einem Ort. \xD6ffne einen Bereich, um deine Einstellungen zu \xE4ndern.</p>
      <label class="v53-settings-search" for="v53SettingsSearch">Einstellungen suchen<input id="v53SettingsSearch" type="search" placeholder="z. B. Datenschutz, Startseite, Benachrichtigungen" maxlength="80" value="${escapeHtml(v53SettingsQuery)}"></label><p id="v53SettingsResult" class="help" aria-live="polite">Alle Einstellungen sichtbar</p>
      <h2 class="v41-group-label">Personalisierung</h2>
      <div class="v41-setting-group">
        <details class="v41-setting" id="v41-start" ${v41ProfileOpenDetails.has("v41-start") ? "open" : ""}><summary><span class="v41-setting-icon v41-green">${iconSvg("home")}</span><span class="v41-setting-text"><strong>Meine Startseite</strong><small>Startansicht und Kacheln anpassen</small></span><span class="v41-chevron" aria-hidden="true">\u203A</span></summary><div class="v41-setting-content">
    ${hubHomeSelector({ compact: true })}
    ${renderV53Personalization()}
    ${renderDashboardLayoutSettings()}
</div></details>
        <details class="v41-setting" id="v41-appearance" ${v41ProfileOpenDetails.has("v41-appearance") ? "open" : ""}><summary><span class="v41-setting-icon v41-purple">${iconSvg("sun")}</span><span class="v41-setting-text"><strong>Darstellung & Bedienung</strong><small>Design, Sprache und Hintergrundbild</small></span><span class="v41-chevron" aria-hidden="true">\u203A</span></summary><div class="v41-setting-content">
      <div class="v41-design-picker">
        <label for="v41ThemeSelect">Darstellung</label>
        <select id="v41ThemeSelect" data-v41-theme>${themeOptionsHtml()}</select>
        <label for="localeChoiceSelect">Sprache</label>
        <select name="localeChoice" id="localeChoiceSelect">${localeOptionsHtml()}</select>

        <div class="v462-background-setting">
          <strong>Dashboard-Hintergrund</strong>
          <small>W\xE4hle dein eigenes Foto f\xFCr den oberen Bereich der Startseite. Neue Bilder werden privat mit deinem Konto synchronisiert und sind auch in der Android-App verf\xFCgbar. Vorhandene lokale Bilder werden nicht automatisch hochgeladen.</small>
          <div class="v462-background-actions">
            <button class="secondary-button" type="button" data-v462-choose-background>\u{1F5BC}\uFE0F Foto ausw\xE4hlen</button>
            <button class="ghost-button" type="button" data-v462-reset-background ${v462HasDashboardPhoto() ? "" : "disabled"}>Standard wiederherstellen</button>
          </div>
          <input type="file" class="v462-file-input" accept="image/jpeg,image/png,image/webp" data-v462-background-file aria-label="Eigenes Dashboard-Hintergrundbild hochladen" hidden>
        </div>
      </div>
</div></details>
        <details class="v41-setting" id="v41-interests" ${v41ProfileOpenDetails.has("v41-interests") ? "open" : ""}><summary><span class="v41-setting-icon v41-purple">${iconSvg("offer")}</span><span class="v41-setting-text"><strong>Interessen & Kategorien</strong><small>Hilfethemen und passende Angebote</small></span><span class="v41-chevron" aria-hidden="true">\u203A</span></summary><div class="v41-setting-content">
    ${renderV2Preferences({ compact: true })}
</div></details>
      </div>

      <h2 class="v41-group-label">Mitteilungen</h2>
      <div class="v41-setting-group">
        <details class="v41-setting" id="v41-notifications" ${v41ProfileOpenDetails.has("v41-notifications") ? "open" : ""}><summary><span class="v41-setting-icon v41-orange">${iconSvg("bell")}</span><span class="v41-setting-text"><strong>Benachrichtigungen</strong><small>Push, Stichw\xF6rter und wichtige Meldungen</small></span><span class="v41-chevron" aria-hidden="true">\u203A</span></summary><div class="v41-setting-content">
    <section>
      <p class="v453-status-help">Aktive Push-Ger\xE4te: <strong>${ownTokenCount}</strong></p>
      ${renderNotificationPreferencesCard({ inline: true })}
    </section>
</div></details>
      </div>

      <h2 class="v41-group-label">Mein Konto</h2>
      <div class="v41-setting-group">
        <details class="v41-setting" id="v41-identity" ${v41ProfileOpenDetails.has("v41-identity") ? "open" : ""}><summary><span class="v41-setting-icon v41-blue">${iconSvg("profile")}</span><span class="v41-setting-text"><strong>Profil & Kontodaten</strong><small>Name, Titel und Standort</small></span><span class="v41-chevron" aria-hidden="true">\u203A</span></summary><div class="v41-setting-content">
    <section class="grid two">
      <article class="card" data-edit-card="profile-identity">
        ${editCardHeader("Lokale Identit\xE4t", "profile-identity", identityEditing)}
        ${identityEditing ? `
          <form id="profileForm" class="form-grid" style="margin-top:14px;">
            <div class="readonly-field"><strong>Registrierter Name</strong><span>${escapeHtml(state.profile.name)}</span></div>
            <div class="readonly-field"><strong>K\xFCrzel</strong><span>${escapeHtml(state.profile.initials)}</span></div>
            <p class="help">Der Name kann nicht direkt ge\xE4ndert werden. Bitte stelle bei Bedarf einen Antrag mit Begr\xFCndung.</p>
            <button class="ghost-button" type="button" data-action="request-name-change" ${ownNameChangeRequest ? "disabled" : ""}>Namens\xE4nderung beantragen</button>
            <label class="check-row" style="grid-template-columns:auto 1fr;">
              <input type="checkbox" name="titleVisible" ${state.profile.titleVisible !== false ? "checked" : ""} />
              <span><strong>Titel beim Namen anzeigen</strong><small>Schaltet Rollen-/Verifizierungslabel im Profilnamen ein oder aus.</small></span>
            </label>
            <label>Titeltyp
              <select name="titlePreset">
                ${titlePresetOptions()}
              </select>
            </label>
            <div class="row-actions">
              <button class="secondary-button" type="submit">Speichern</button>
              <button class="ghost-button" type="button" data-action="cancel-edit-card" data-edit-card-id="profile-identity">Abbrechen</button>
            </div>
          </form>
        ` : `
          <div class="list" style="margin-top:14px;">
            <div class="readonly-field"><strong>Registrierter Name</strong><span>${escapeHtml(state.profile.name)}</span></div>
            <div class="readonly-field"><strong>K\xFCrzel</strong><span>${escapeHtml(state.profile.initials)}</span></div>
            <div class="readonly-field"><strong>Standort</strong><span>${escapeHtml(locationLabel())}</span></div>
            <div class="readonly-field"><strong>Rolle</strong><span>${escapeHtml(roleLabel())}</span></div>
            <div class="readonly-field"><strong>Sichtbarer Titel</strong><span>${escapeHtml(activeTitle || "ausgeblendet")}</span></div>
            ${state.profile.accountType === "company" ? `
              <div class="readonly-field"><strong>Firma</strong><span>${escapeHtml(companyNameForProfile() || "Firma ohne Namen")}</span></div>
              <div class="readonly-field"><strong>Firmenstatus</strong><span>${escapeHtml(companyStatusLabel(state.profile.companyStatus) || "Firma")}</span></div>
            ` : ""}
            ${state.profile.accountType === "municipality" ? `
              <div class="readonly-field"><strong>Gemeinde</strong><span>${escapeHtml(state.profile.municipalityName || state.profile.area)}</span></div>
              <div class="readonly-field"><strong>Abteilung / Funktion</strong><span>${escapeHtml(state.profile.municipalityDepartment || "-")}</span></div>
              <div class="readonly-field"><strong>Gemeindestatus</strong><span>${escapeHtml(state.profile.municipalityStatus === "verified" ? "gepr\xFCft" : state.profile.municipalityStatus === "rejected" ? "abgelehnt" : "in Pr\xFCfung")}</span></div>
            ` : ""}
          </div>
        `}
      </article>

      <article class="card">
        <h2>Standort & Zugang</h2>
        <p>Standortwechsel werden erst nach administrativer Best\xE4tigung aktiv.</p>
        <div class="row-actions" style="margin-top:14px;">
          <button class="secondary-button" data-action="request-location-change" ${ownLocationRequest ? "disabled" : ""}>Standortwechsel beantragen</button>
          <button class="ghost-button" data-action="passkey-check">${state.profile.passkeyReady ? "Passkey aktiv \u2713" : "Passkey einrichten"}</button>
        </div>
        <div class="list" style="margin-top:14px;">
          <div class="card compact soft"><strong>Konto</strong><p>${escapeHtml(accountTypeLabel())} \xB7 ${escapeHtml(accountStatusLabel())}</p></div>
          ${ownLocationRequest ? `<div class="card compact soft"><strong>Offener Standortantrag</strong><p>${escapeHtml(ownLocationRequest.targetLabel)}</p></div>` : ""}
          ${ownNameChangeRequest ? `<div class="card compact soft"><strong>Offener Namensantrag</strong><p>${escapeHtml(ownNameChangeRequest.requestedName || ownNameChangeRequest.title)} \xB7 ${escapeHtml(ownNameChangeRequest.status)}</p></div>` : ""}
          ${ownChangeRequest ? `<div class="card compact soft"><strong>\xC4nderungsanfrage</strong><p>${escapeHtml(ownChangeRequest.title)} \xB7 ${escapeHtml(ownChangeRequest.status)}</p></div>` : ""}
        </div>

      </article>
    </section>

</div></details>
        <details class="v41-setting" id="v41-trust" ${v41ProfileOpenDetails.has("v41-trust") ? "open" : ""}><summary><span class="v41-setting-icon v41-amber">${iconSvg("check")}</span><span class="v41-setting-text"><strong>Verifizierung & Vertrauen</strong><small>Sicherer Austausch mit deinen Nachbarn</small></span><span class="v41-chevron" aria-hidden="true">\u203A</span></summary><div class="v41-setting-content">
    <div class="v453-verify-row">
      <div><strong>Identit\xE4tspr\xFCfung</strong><p class="help">Status: ${escapeHtml(verificationText)}${ownVerificationRequest ? ` \xB7 Antrag ${escapeHtml(ownVerificationRequest.status)}` : ""}</p></div>
      <button class="secondary-button" type="button" data-action="request-verification" ${state.profile.verified || ownVerificationRequest ? "disabled" : ""}>${state.profile.verified ? "Bereits verifiziert" : ownVerificationRequest ? "Antrag in Pr\xFCfung" : "Verifizierung beantragen"}</button>
    </div>
    ${renderCommunityTrustPanel()}
</div></details>
        <details class="v41-setting" id="v453-privacy" ${v41ProfileOpenDetails.has("v453-privacy") ? "open" : ""}><summary><span class="v41-setting-icon v41-coral">${iconSvg("alert")}</span><span class="v41-setting-text"><strong>Datenschutz & Konto</strong><small>Datenauskunft, Abmelden und Konto l\xF6schen</small></span><span class="v41-chevron" aria-hidden="true">\u203A</span></summary><div class="v41-setting-content">
    <p class="v453-intro">Du kannst dich abmelden, eigene Daten exportieren oder dein Konto verwalten. L\xF6schfunktionen sind zus\xE4tzlich gesch\xFCtzt.</p>
    <div class="card compact soft"><strong>Fehlerdiagnose auf diesem Ger\xE4t</strong><p class="help">${v46DiagnosticCount()} anonyme Fehlertypen lokal gez\xE4hlt. Keine Fehlermeldungen oder Formularinhalte gespeichert oder an einen Server gesendet.</p><button class="ghost-button small" type="button" data-v46-clear-errors>Lokale Diagnose l\xF6schen</button></div>
    <button class="ghost-button" type="button" data-action="logout">Abmelden</button>
            <div class="card compact soft" data-edit-card="profile-account" style="margin-top:14px;">
          ${editCardHeader("Kontoverwaltung", "profile-account", accountEditing)}
          ${accountEditing ? `
            <div class="danger-zone" style="margin-top:12px;">
              <strong>Kontoverwaltung aktiv</strong>
              <p class="help">Exportiert deine personenbezogenen Daten als JSON oder l\xF6scht/anonymisiert dein Konto und deine eigenen Inhalte.</p>
              <div class="row-actions" style="margin-top:10px;">
                <button class="ghost-button small" data-action="export-own-data">Daten exportieren</button>
                <button class="danger-button small" data-action="delete-own-account">Konto l\xF6schen</button>
                <button class="ghost-button small" type="button" data-action="cancel-edit-card" data-edit-card-id="profile-account">Abbrechen</button>
              </div>
              <p class="help" style="margin-top:10px;">\u201ELokale Daten zur\xFCcksetzen\u201C leert nur diesen Browser. Dein Konto bleibt bestehen.</p>
              <button class="danger-button small" data-action="reset-local-data" style="margin-top:10px;">Lokale Daten zur\xFCcksetzen</button>
            </div>
          ` : '<p class="help" style="margin-top:10px;">Export, Kontol\xF6schung und lokales Zur\xFCcksetzen sind gesch\xFCtzt eingeklappt.</p>'}
        </div>
</div></details>
      </div>

      <h2 class="v41-group-label">Meine Inhalte</h2>
      <div class="v41-setting-group">
        <details class="v41-setting" id="v41-activity" ${v41ProfileOpenDetails.has("v41-activity") ? "open" : ""}><summary><span class="v41-setting-icon v41-blue">${iconSvg("bulletin")}</span><span class="v41-setting-text"><strong>Meine Beitr\xE4ge</strong><small>Eigene Anliegen, Status und offene Schritte</small></span><span class="v41-chevron" aria-hidden="true">\u203A</span></summary><div class="v41-setting-content">
    <section class="grid two">
      ${renderMyProceduresCard({ detailed: true })}
    </section>
</div></details>
        <details class="v41-setting" id="v44-saved" ${v41ProfileOpenDetails.has("v44-saved") ? "open" : ""}><summary><span class="v41-setting-icon v41-coral">${iconSvg("bookmark")}</span><span class="v41-setting-text"><strong>Gespeichert</strong><small>Deine Merkliste</small></span><span class="v41-chevron" aria-hidden="true">\u203A</span></summary><div class="v41-setting-content">${v44SavedPanel()}<div class="row-actions"><button class="secondary-button small" type="button" data-route="saved">Alle Favoriten \xF6ffnen</button></div></div></details>
        <details class="v41-setting" id="v46-drafts"><summary><span class="v41-setting-icon v41-purple">\u270D\uFE0F</span><span class="v41-setting-text"><strong>Entw\xFCrfe verwalten</strong><small>Offline gespeicherte Texte auf diesem Ger\xE4t</small></span><span class="v41-chevron" aria-hidden="true">\u203A</span></summary><div class="v41-setting-content"><button class="secondary-button" type="button" data-route="drafts">Entw\xFCrfe \xF6ffnen</button></div></details>
      </div>
    </div>
    <p class="v41-profile-footer">Quartinaut Web ${UI_VERSION} \xB7 Deine Gemeinde. Deine Nachbarn.</p>

    ${isAdmin ? `
      <div class="v41-settings-page v453-admin-settings"><h2 class="v41-group-label">Administration</h2><div class="v41-setting-group">
      <details class="v41-setting v2-admin-panel" id="v453-admin" ${v41ProfileOpenDetails.has("v453-admin") ? "open" : ""}><summary>Administration und Pr\xFCfungen <span class="v41-chevron" aria-hidden="true">\u203A</span></summary><div class="v41-setting-content">
      <section class="grid two">
        <article class="card">
          <h2>Standortantr\xE4ge</h2>
          <div class="list" style="margin-top:14px;">${openLocationRequests.length ? openLocationRequests.map(locationRequestCard).join("") : '<div class="empty">Keine offenen Standortantr\xE4ge.</div>'}</div>
        </article>
        <article class="card">
          <h2>Verifizierungsantr\xE4ge</h2>
          <div class="list" style="margin-top:14px;">${openVerificationRequests.length ? openVerificationRequests.map(verificationRequestCard).join("") : '<div class="empty">Keine offenen Verifizierungsantr\xE4ge.</div>'}</div>
        </article>
      </section>
      <section class="card">
        <h2>Verifizierungsverlauf</h2>
        <div class="list" style="margin-top:14px;">${archivedVerificationRequests.length ? archivedVerificationRequests.slice(0, 12).map(verificationArchiveCard).join("") : '<div class="empty">Noch keine erledigten Verifizierungsantr\xE4ge.</div>'}</div>
      </section>
      <section class="card">
        <h2>\xC4nderungsanfragen</h2>
        <div class="list" style="margin-top:14px;">${openChangeRequests.length ? openChangeRequests.map(changeRequestCard).join("") : '<div class="empty">Keine offenen \xC4nderungsanfragen.</div>'}</div>
      </section>
      ${renderAdminUsersOverview()}
      ${renderAdminRoleCard()}
      ${renderAdminAuditLog()}
      </div></details></div></div>
    ` : ""}
  `;
}
function locationRequestCard(req) {
  return `
    <section class="card compact">
      <strong>${escapeHtml(req.displayName)}</strong>
      <p>${escapeHtml(req.currentLabel)} \u2192 ${escapeHtml(req.targetLabel)}</p>
      <p class="help">${escapeHtml(req.reason || "Kein Grund angegeben.")}</p>
      <div class="row-actions" style="margin-top:12px;">
        <button class="success-button" data-action="approve-location" data-id="${req.id}">Best\xE4tigen</button>
        <button class="danger-button" data-action="reject-location" data-id="${req.id}">Ablehnen</button>
      </div>
    </section>
  `;
}
function verificationRequestCard(req) {
  const statusBadge = req.status === "zur\xFCckgestellt" ? '<span class="badge warn">zur\xFCckgestellt</span>' : '<span class="badge">offen</span>';
  const hasPhoto = verificationPhotoAvailable(req);
  const localPhotoUrl = !isFirebaseMode() && req.idPhoto?.dataUrl ? req.idPhoto.dataUrl : "";
  const isCompanyRequest = req.accountType === "company";
  const proofLabel = isCompanyRequest ? "Personen-/Firmennachweis" : "Ausweisfoto zur Namenspr\xFCfung";
  return `
    <section class="card compact">
      <strong>${escapeHtml(req.displayName)}</strong>
      <div class="badges" style="margin-top:6px;">${statusBadge}<span class="badge ${isCompanyRequest ? "info" : ""}">${escapeHtml(isCompanyRequest ? "Firma + verantwortliche Person" : "Privatperson")}</span></div>
      <p>${escapeHtml(req.method)}</p>
      ${isCompanyRequest ? `<p class="help"><strong>Firma:</strong> ${escapeHtml(req.companyName || "ohne Firmenname")} \xB7 Pr\xFCfung best\xE4tigt prim\xE4r die verantwortliche Person; Firmenfreigabe wird separat als Firmenstatus gef\xFChrt.</p>` : ""}
      <p class="help">${escapeHtml(req.note || "Keine Notiz angegeben.")}</p>
      <div class="readonly-field"><strong>Registrierter Name</strong><span>${escapeHtml(req.registeredName || req.displayName || "-")}</span></div>
      ${localPhotoUrl ? `
        <figure class="id-photo-preview">
          <img src="${escapeHtml(localPhotoUrl)}" alt="Ausweisfoto von ${escapeHtml(req.displayName)}" />
          <figcaption>${escapeHtml(proofLabel)}</figcaption>
        </figure>
      ` : hasPhoto ? `
        <div class="readonly-field">
          <strong>${escapeHtml(proofLabel)}</strong>
          <span>${escapeHtml(verificationPhotoMetaText(req))}</span>
        </div>
        <button class="ghost-button small" type="button" data-action="view-verification-photo" data-id="${escapeHtml(req.id)}">Foto gesch\xFCtzt laden</button>
        <p class="help">Das Foto liegt in Firebase Storage und wird erst beim Pr\xFCfen durch Admins geladen.</p>
      ` : '<p class="form-error">Nachweisfoto fehlt. Bitte Antrag zur\xFCckstellen und Nutzer/in erneut einreichen lassen.</p>'}
      <label>Freizugebender Titeltyp
        <select data-verification-title data-id="${escapeHtml(req.id)}">
          ${verificationTitleOptions(req.approvedTitlePreset || "verified")}
        </select>
      </label>
      <p class="form-error" data-verification-error="${escapeHtml(req.id)}" role="alert"></p>
      <div class="row-actions" style="margin-top:12px;">
        <button class="success-button" data-action="approve-verification" data-id="${req.id}" ${hasPhoto ? "" : "disabled"}>${isCompanyRequest ? "Person/Firma freigeben" : "Verifizieren"}</button>
        <button class="danger-button" data-action="reject-verification" data-id="${req.id}">Ablehnen</button>
        <button class="ghost-button" data-action="${req.status === "zur\xFCckgestellt" ? "resume-verification" : "pause-verification"}" data-id="${req.id}">${req.status === "zur\xFCckgestellt" ? "Wieder \xF6ffnen" : "Zur\xFCckstellen"}</button>
        <button class="ghost-button" data-action="edit-verification" data-id="${req.id}">Anpassen</button>
      </div>
    </section>
  `;
}
function verificationArchiveCard(req) {
  const approved = ["best\xE4tigt", "bestaetigt"].includes(req.status);
  return `
    <section class="card compact soft">
      <div class="badges">
        <span class="badge ${approved ? "offer" : "warn"}">${escapeHtml(approved ? "best\xE4tigt" : "abgelehnt")}</span>
        <span class="badge">${escapeHtml(req.accountType === "company" ? "Firma" : "Privatperson")}</span>
      </div>
      <strong>${escapeHtml(req.displayName || req.email || "Antrag")}</strong>
      <p class="help">${escapeHtml(req.method || "-")} \xB7 Entscheid: ${escapeHtml(formatDate(req.decidedAt || req.updatedAt || req.createdAt))}</p>
      <p class="help">${approved ? "Nachweisfoto wurde nach dem Entscheid aus dem Antrag entfernt." : "Abgelehnter Antrag bleibt als Verlauf sichtbar; Nachweisfoto wird nach dem Entscheid entfernt."}</p>
    </section>
  `;
}
var LEGAL_CONTENT = {
  privacy: {
    title: "Datenschutz",
    body: `
      <section class="form-grid legal-copy">
        <p>Quartinaut verarbeitet personenbezogene Daten zweckgebunden f\xFCr Registrierung, Vermittlung von Hilfeanliegen, Alarmierung und Sicherheitsfunktionen.</p>
        <p><strong>Verarbeitete Daten:</strong> Google-Konto-ID, Anzeigename, Gemeinde/Kanton, Kontotyp (Privat/Firma), Firmenangaben, Rollen- und Verifizierungsstatus, Suche-/Biete-Verlauf, freiwillige Chatinhalte, optionale Push-Tokens und pers\xF6nliche Benachrichtigungsfilter/Stichw\xF6rter, optionale ungef\xE4hre Distanzdaten, Audit-Log f\xFCr Admin-Aktionen und Ausweisfoto bei Verifizierungsantr\xE4gen.</p>
        <p><strong>Zweck und Rechtsgrundlage:</strong> Betrieb der Plattform, Missbrauchsschutz, Zustellung verifizierter Alarme, administrative Freigaben. Daten werden nicht f\xFCr Werbung genutzt.</p>
        <p><strong>Ausweisfotos:</strong> Verifizierungsfotos werden gesch\xFCtzt in Firebase Storage gespeichert; Firestore speichert nur technische Metadaten wie Pfad, Typ und Gr\xF6sse. Zugriff erhalten nur berechtigte Admin-Rollen zur Pr\xFCfung.</p>
        <p><strong>Speicherfristen:</strong> Anliegen und Vermittlungen laufen nach TTL aus; administrative Antr\xE4ge bleiben bis zur Bearbeitung gespeichert; Ausweisfotos werden nach dem Entscheid aus offenen Verifizierungsantr\xE4gen entfernt; technische Logs werden auf das notwendige Mass begrenzt.</p>
        <p><strong>Weitergabe:</strong> Keine kommerzielle Weitergabe. Zugriff erhalten nur berechtigte Rollen (z. B. Admin) im Rahmen des Betriebs.</p>
        <p><strong>Betroffenenrechte:</strong> Auskunft, Berichtigung, L\xF6schung und Einschr\xE4nkung k\xF6nnen \xFCber den Betreiber angefordert werden.</p>
      </section>
    `
  },
  terms: {
    title: "Nutzungsbedingungen",
    body: `
      <section class="form-grid legal-copy">
        <p>Quartinaut ist eine lokale Community-Plattform f\xFCr nachbarschaftliche Hilfe und verifizierte Gemeindeinformationen.</p>
        <p><strong>Pflichtanmeldung:</strong> Die Nutzung setzt ein registriertes Konto mit g\xFCltigem Namen und Standort voraus. Namens- und Standort\xE4nderungen erfolgen nur per Antrag, Begr\xFCndung und Admin-Freigabe. Firmenkonten m\xFCssen als solche registriert werden.</p>
        <p><strong>Firmen:</strong> Firmen d\xFCrfen lokale Arbeits-, Dienstleistungs- oder Mitarbeitersuchen nur klar erkennbar als Firmenkonto ver\xF6ffentlichen. Missbrauch, Spam oder irref\xFChrende Angebote k\xF6nnen eingeschr\xE4nkt werden.</p>
        <p><strong>Verhaltensregeln:</strong> Keine Beleidigungen, keine Irref\xFChrung, keine unzul\xE4ssigen Inhalte, keine gewerblichen Spamangebote. Verst\xF6sse k\xF6nnen moderiert oder gesperrt werden.</p>
        <p><strong>Verantwortung f\xFCr Beitr\xE4ge:</strong> Jede Nutzerin und jeder Nutzer ist f\xFCr eigene Inhalte, Angaben und Hilfsangebote selbst verantwortlich.</p>
        <p><strong>Haftung:</strong> Hilfeleistungen erfolgen eigenverantwortlich zwischen Nutzern. Der Betreiber \xFCbernimmt keine Gew\xE4hr f\xFCr Richtigkeit, Vollst\xE4ndigkeit oder Rechtm\xE4ssigkeit von nutzergenerierten Inhalten.</p>
        <p><strong>Beitragsfreigabe und Moderation:</strong> \xD6ffentliche Gesuche und Angebote werden vor der Ver\xF6ffentlichung administrativ freigegeben. Die Freigabe ist keine Gew\xE4hr f\xFCr Richtigkeit oder Sicherheit; gemeldete oder auff\xE4llige Inhalte k\xF6nnen zus\xE4tzlich gepr\xFCft, zur\xFCckgestellt oder entfernt werden.</p>
        <p><strong>Verf\xFCgbarkeit:</strong> Die Plattform wird mit angemessener Sorgfalt betrieben, es besteht jedoch kein Anspruch auf unterbruchsfreien Betrieb.</p>
        <p><strong>\xC4nderungen:</strong> Funktionen und Regeln d\xFCrfen zur Sicherheit und Weiterentwicklung angepasst werden.</p>
      </section>
    `
  },
  imprint: {
    title: "Impressum",
    body: `
      <section class="form-grid legal-copy">
        <p><strong>Betreiber:</strong> Irajet Ramadani</p>
        <p><strong>Adresse:</strong> Sandackerstrasse 7, 9245 Oberb\xFCren SG, Schweiz</p>
        <p><strong>Telefon:</strong> +41 76 484 34 86</p>
        <p><strong>Verantwortlich f\xFCr Inhalte:</strong> Irajet Ramadani (Betreiber)</p>
        <p><strong>Nutzerinhalte:</strong> F\xFCr Beitr\xE4ge und Angaben in Hilfeanliegen/Chats sind die jeweiligen Nutzerinnen und Nutzer selbst verantwortlich.</p>
        <p><strong>Support / Datenschutz:</strong> irajet.ramadani@gmail.com</p>
        <p><strong>Hosting:</strong> Firebase Hosting (Google Cloud)</p>
        <p><strong>Hinweis:</strong> Kontaktanfragen zu Support und Datenschutz bitte per E-Mail senden.</p>
      </section>
    `
  }
};
function openLegalModal(section = "privacy") {
  const legalSection = LEGAL_CONTENT[section] || LEGAL_CONTENT.privacy;
  openModal(legalSection.title, legalSection.body);
}
function changeRequestCard(req) {
  const isNameChange = req.type === "name_change";
  return `
    <section class="card compact">
      <strong>${escapeHtml(req.displayName)}</strong>
      <p>${escapeHtml(req.title)}</p>
      ${isNameChange ? `<div class="readonly-field"><strong>Name</strong><span>${escapeHtml(req.currentName || "-")} \u2192 ${escapeHtml(req.requestedName || "-")}</span></div>` : ""}
      <p class="help">${escapeHtml(isNameChange ? req.reason || req.description || "Keine Begr\xFCndung." : req.description || "Keine Beschreibung.")}</p>
      <div class="badges"><span class="badge">${escapeHtml(req.status || "offen")}</span><span class="badge">${escapeHtml(req.scope || "App")}</span></div>
      <div class="row-actions" style="margin-top:12px;">
        <button class="success-button" data-action="approve-change-request" data-id="${req.id}">Freigeben</button>
        <button class="ghost-button" data-action="review-change-request" data-id="${req.id}">In Pr\xFCfung</button>
        <button class="danger-button" data-action="reject-change-request" data-id="${req.id}">Ablehnen</button>
      </div>
    </section>
  `;
}
function adminUserLocationLabel(user = {}) {
  if (user.location) return locationLabel(user.location);
  return user.area || "Kein Standort";
}
function adminUserVerificationLabel(user = {}) {
  if (user.emailVerificationStatus === "pending" || user.accountStatus === "pending_email") return "E-Mail offen";
  if (user.verified) return user.verificationLabel || "Verifiziert";
  if (user.verificationStatus === "pending") return "beantragt";
  if (user.verificationStatus === "rejected") return "abgelehnt";
  return "nicht verifiziert";
}
function pushTokenCountForUser(uid2 = "") {
  if (!uid2) return 0;
  return state.deviceTokens.filter((token) => token.uid === uid2 && token.active !== false).length;
}
function requestStatsForUser(uid2 = "") {
  const items = state.requests.filter((req) => req.uid === uid2 || req.authorId === uid2);
  return {
    total: items.length,
    suche: items.filter((req) => req.type === "Suche").length,
    biete: items.filter((req) => req.type === "Biete").length,
    offen: items.filter((req) => req.status === "offen").length
  };
}
function appointmentStatsForUser(uid2 = "") {
  const items = state.chatMessages.filter((msg) => msg.messageType === "appointment" && Array.isArray(msg.participants) && msg.participants.includes(uid2));
  return {
    total: items.length,
    accepted: items.filter((msg) => msg.appointment?.status === "accepted").length,
    declined: items.filter((msg) => msg.appointment?.status === "declined").length
  };
}
function companyStatusLabel(status = "none") {
  if (status === "verified") return "Firma best\xE4tigt";
  if (status === "rejected") return "Firma abgelehnt";
  if (status === "pending") return "Firma ungepr\xFCft";
  return "";
}
function adminUsersUiState() {
  const defaults = structuredClone(seed.adminUsers);
  state.adminUsers = {
    ...defaults,
    ...state.adminUsers || {}
  };
  state.adminUsers.page = Math.max(1, Number(state.adminUsers.page || 1));
  state.adminUsers.pageSize = [10, 20, 50, 100].includes(Number(state.adminUsers.pageSize)) ? Number(state.adminUsers.pageSize) : 20;
  state.adminUsers.view = state.adminUsers.view === "archive" ? "archive" : "active";
  state.adminUsers.dir = state.adminUsers.dir === "asc" ? "asc" : "desc";
  return state.adminUsers;
}
function archivedUserStatus(user = {}) {
  if ((user.accountStatus || "") === "deleted" || (user.verificationStatus || "") === "deleted" || user.deletedAt) return "deleted";
  if ((user.accountStatus || "active") === "disabled") return "disabled";
  return user.accountStatus || "active";
}
function adminUserVerificationState(user = {}) {
  if (user.emailVerificationStatus === "pending" || user.accountStatus === "pending_email") return "pending";
  if (user.verified) return "verified";
  const status = user.verificationStatus || "none";
  if (["offen", "pending", "in_pruefung", "zur\xFCckgestellt"].includes(status)) return "pending";
  if (["abgelehnt", "rejected"].includes(status)) return "rejected";
  return "none";
}
function adminUserSearchText(user = {}) {
  return [
    user.displayName,
    user.email,
    user.initials,
    user.companyName,
    user.companyPurpose,
    user.municipalityName,
    user.municipalityDepartment,
    roleLabel(user.role || "resident"),
    accountTypeLabel(user.accountType || "resident"),
    adminUserLocationLabel(user),
    user.uid
  ].filter(Boolean).join(" ").toLowerCase();
}
function adminUserMatchesFilters(user = {}, ui = adminUsersUiState()) {
  const archived = isArchivedUser(user);
  if (ui.view === "archive" ? !archived : archived) return false;
  const status = archivedUserStatus(user);
  if (ui.status !== "all" && status !== ui.status) return false;
  if (ui.role !== "all" && (user.role || "resident") !== ui.role) return false;
  if (ui.accountType !== "all" && (user.accountType || "resident") !== ui.accountType) return false;
  if (ui.verification !== "all" && adminUserVerificationState(user) !== ui.verification) return false;
  if (ui.canton !== "all" && userCantonCode(user) !== ui.canton) return false;
  const q = String(ui.q || "").trim().toLowerCase();
  return !q || adminUserSearchText(user).includes(q);
}
function adminUserSortValue(user = {}, field = "updatedAt") {
  if (field === "name") return String(user.displayName || user.email || "").toLowerCase();
  if (field === "email") return String(user.email || "").toLowerCase();
  if (field === "canton") return userCantonCode(user) || "";
  if (field === "role") return user.role || "resident";
  if (field === "createdAt") return normalizeStoredDate(user.createdAt) || "";
  return normalizeStoredDate(user.updatedAt || user.createdAt) || "";
}
function sortAdminUsers(users = [], ui = adminUsersUiState()) {
  const direction = ui.dir === "asc" ? 1 : -1;
  return users.slice().sort((a, b) => {
    const aValue = adminUserSortValue(a, ui.sort);
    const bValue = adminUserSortValue(b, ui.sort);
    const compared = String(aValue).localeCompare(String(bValue), "de-CH", { numeric: true, sensitivity: "base" });
    if (compared) return compared * direction;
    return String(a.displayName || a.email || "").localeCompare(String(b.displayName || b.email || ""), "de-CH");
  });
}
function adminUsersOptions(options = [], selected = "all") {
  return options.map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === selected ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("");
}
function renderAdminUsersOverview() {
  const ui = adminUsersUiState();
  const allUsers = state.registeredUsers.slice();
  const archivedUsers = allUsers.filter(isArchivedUser);
  const activeUsers = allUsers.filter((user) => !isArchivedUser(user));
  const filtered = sortAdminUsers(allUsers.filter((user) => adminUserMatchesFilters(user, ui)), ui);
  const totalPages = Math.max(1, Math.ceil(filtered.length / ui.pageSize));
  ui.page = Math.min(ui.page, totalPages);
  const pageStart = (ui.page - 1) * ui.pageSize;
  const visibleUsers = filtered.slice(pageStart, pageStart + ui.pageSize);
  const adminCount = activeUsers.filter((user) => ["admin", "area_admin"].includes(user.role)).length;
  const verifiedCount = activeUsers.filter((user) => user.verified).length;
  const pushCount = activeUsers.filter((user) => pushTokenCountForUser(user.uid) > 0 || user.hasPushToken || user.notifications).length;
  const areaCount = new Set(activeUsers.map(adminUserLocationLabel).filter(Boolean)).size;
  const disabledCount = archivedUsers.filter((user) => archivedUserStatus(user) === "disabled").length;
  const deletedCount = archivedUsers.filter((user) => archivedUserStatus(user) === "deleted").length;
  const companyCount = activeUsers.filter((user) => user.accountType === "company").length;
  const municipalityCount = activeUsers.filter((user) => user.accountType === "municipality").length;
  const pendingMunicipalityCount = activeUsers.filter((user) => user.accountType === "municipality" && user.accountStatus === "pending_verification").length;
  const cantonOptions = [{ value: "all", label: "Alle Kantone" }].concat(
    cantons().map((canton) => ({ value: String(canton.code || "").toUpperCase(), label: `${canton.name} (${String(canton.code || "").toUpperCase()})` }))
  );
  const rows = visibleUsers.map((user) => {
    const title = profileTitle(user);
    const pushTokens = pushTokenCountForUser(user.uid);
    const stats = requestStatsForUser(user.uid);
    const appointmentStats = appointmentStatsForUser(user.uid);
    const updated = normalizeStoredDate(user.updatedAt || user.createdAt);
    const accountStatus = archivedUserStatus(user);
    const isDisabled = accountStatus === "disabled";
    const isDeleted = accountStatus === "deleted";
    const canToggle = !isDeleted && user.uid !== authState.user?.uid;
    const accountTypeBadge = user.accountType === "company" ? `<span class="badge info">${escapeHtml(user.companyName || "Firma")}</span>${user.companyStatus ? `<span class="badge">${escapeHtml(companyStatusLabel(user.companyStatus))}</span>` : ""}` : user.accountType === "municipality" ? `<span class="badge official">${escapeHtml(user.municipalityName || adminUserLocationLabel(user) || "Gemeinde")}</span><span class="badge">${escapeHtml(user.municipalityStatus === "verified" ? "gepr\xFCft" : user.municipalityStatus === "rejected" ? "abgelehnt" : "in Pr\xFCfung")}</span>` : `<span class="badge">${escapeHtml(accountTypeLabel(user.accountType))}</span>`;
    const municipalityActions = user.accountType === "municipality" && !isDeleted && user.municipalityStatus !== "verified" ? `<button class="success-button small" data-action="review-municipality" data-approved="true" data-uid="${escapeHtml(user.uid)}">Gemeinde freigeben</button>
         <button class="ghost-button small" data-action="review-municipality" data-approved="false" data-uid="${escapeHtml(user.uid)}">Ablehnen</button>` : "";
    const actionCell = canToggle ? `<div class="row-actions">
          ${municipalityActions}
          <button class="${isDisabled ? "success-button" : "danger-button"} small" data-action="toggle-user-status" data-uid="${escapeHtml(user.uid)}">${isDisabled ? "Aktivieren" : "Deaktivieren"}</button>
          ${user.verified ? `<button class="ghost-button small" data-action="revoke-verification" data-uid="${escapeHtml(user.uid)}">Verifizierung widerrufen</button>` : ""}
        </div>` : `<span class="badge">${isDeleted ? "Archiviert" : "Eigenes Konto"}</span>`;
    return `
      <tr>
        <td>
          <span class="user-cell">
            <strong>${escapeHtml(user.displayName || user.email || "Unbenannt")}</strong>
            <small>${escapeHtml(user.initials || initialsFromName(user.displayName || user.email || ""))}${title ? ` \xB7 ${escapeHtml(title)}` : ""}</small>
          </span>
        </td>
        <td>${escapeHtml(user.email || "-")}</td>
        <td>${escapeHtml(adminUserLocationLabel(user))}</td>
        <td><div class="badges">${trustBadge(user, { detail: true })}<span class="badge ${["admin", "area_admin"].includes(user.role) ? "official" : ""}">${escapeHtml(roleLabel(user.role || "resident"))}</span></div>${user.adminScopeArea ? `<small>${escapeHtml(user.adminScopeArea)}</small>` : ""}</td>
        <td><div class="badges">${accountTypeBadge}${accountStatusBadge(accountStatus)}</div></td>
        <td><span class="badge ${user.verified ? "official" : "info"}">${escapeHtml(adminUserVerificationLabel(user))}</span></td>
        <td><button class="ghost-button small" data-action="user-history" data-uid="${escapeHtml(user.uid)}">${stats.total} Eintr\xE4ge</button><small>${stats.suche} Suche \xB7 ${stats.biete} Biete \xB7 ${appointmentStats.total} Termine${isDisabled ? " \xB7 deaktiviert" : ""}</small></td>
        <td>${pushTokens ? `<span class="badge info">${pushTokens} Ger\xE4t${pushTokens > 1 ? "e" : ""}</span>` : '<span class="badge">0</span>'}</td>
        <td>${updated ? escapeHtml(fmtTime(updated)) : "-"}</td>
        <td>${actionCell}</td>
      </tr>
    `;
  }).join("");
  return `
    <section class="card admin-users-card">
      <div class="request-head">
        <div>
          <h2>${isAreaAdminRole() ? "Nutzer in meiner Gemeinde" : "Alle registrierten Nutzer"}</h2>
          <p>${isAreaAdminRole() ? "Gebietsgebundene Ansicht. Globale Rollen, Verifizierungen und fremde Konten sind gesch\xFCtzt." : "Nur f\xFCr Plattform-Admins. Aktive Konten und Archiv sind getrennt; Tokens werden nicht angezeigt, nur die Anzahl aktiver Push-Ger\xE4te."}</p>
        </div>
        <button class="ghost-button small" data-action="sync-now" type="button">Aktualisieren</button>
      </div>
      <div class="segmented admin-users-tabs" role="group" aria-label="Nutzeransicht">
        <button class="${ui.view === "active" ? "active" : ""}" type="button" data-action="set-admin-users-view" data-admin-users-view="active">Aktiv (${formatNumber(activeUsers.length)})</button>
        <button class="${ui.view === "archive" ? "active" : ""}" type="button" data-action="set-admin-users-view" data-admin-users-view="archive">Archiv (${formatNumber(archivedUsers.length)})</button>
      </div>
      <div class="admin-user-stats" aria-label="Nutzerstatistik">
        <span class="status-pill"><strong>${escapeHtml(formatNumber(allUsers.length))}</strong> total</span>
        <span class="status-pill"><strong>${escapeHtml(formatNumber(activeUsers.filter((u) => u.accountStatus !== "pending_email").length))}</strong> aktiv</span>
        <span class="status-pill"><strong>${escapeHtml(formatNumber(activeUsers.filter((u) => u.accountStatus === "pending_email").length))}</strong> E-Mail offen</span>
        <span class="status-pill"><strong>${escapeHtml(formatNumber(adminCount))}</strong> Admins</span>
        <span class="status-pill"><strong>${escapeHtml(formatNumber(verifiedCount))}</strong> verifiziert</span>
        <span class="status-pill"><strong>${escapeHtml(formatNumber(companyCount))}</strong> Firmen</span>
        <span class="status-pill"><strong>${escapeHtml(formatNumber(municipalityCount))}</strong> Gemeinden</span>
        <span class="status-pill"><strong>${escapeHtml(formatNumber(pendingMunicipalityCount))}</strong> Gemeindepr\xFCfungen</span>
        <span class="status-pill"><strong>${escapeHtml(formatNumber(disabledCount))}</strong> deaktiviert</span>
        <span class="status-pill"><strong>${escapeHtml(formatNumber(deletedCount))}</strong> gel\xF6scht</span>
        <span class="status-pill"><strong>${escapeHtml(formatNumber(pushCount))}</strong> mit Push</span>
        <span class="status-pill"><strong>${escapeHtml(formatNumber(areaCount))}</strong> Gebiete</span>
      </div>
      <div class="admin-users-controls" aria-label="Nutzer filtern">
        <label>
          Suche
          <input id="adminUserQ" type="search" value="${escapeHtml(ui.q)}" placeholder="Name, E-Mail, Firma, Gebiet">
        </label>
        <label>
          Status
          <select id="adminUserStatus">${adminUsersOptions([
    { value: "all", label: "Alle Status" },
    { value: "active", label: "Aktiv" },
    { value: "pending_email", label: "E-Mail offen" },
    { value: "disabled", label: "Deaktiviert" },
    { value: "deleted", label: "Gel\xF6scht" }
  ], ui.status)}</select>
        </label>
        <label>
          Rolle
          <select id="adminUserRole">${adminUsersOptions([
    { value: "all", label: "Alle Rollen" },
    { value: "admin", label: "Admin" },
    { value: "area_admin", label: "Gemeindeadmin" },
    { value: "resident", label: "Bewohner/in" }
  ], ui.role)}</select>
        </label>
        <label>
          Kontotyp
          <select id="adminUserAccountType">${adminUsersOptions([
    { value: "all", label: "Alle Typen" },
    { value: "resident", label: "Privatperson" },
    { value: "company", label: "Firma" },
    { value: "municipality", label: "Gemeinde" }
  ], ui.accountType)}</select>
        </label>
        <label>
          Verifizierung
          <select id="adminUserVerification">${adminUsersOptions([
    { value: "all", label: "Alle" },
    { value: "verified", label: "Verifiziert" },
    { value: "pending", label: "Offen/in Pr\xFCfung" },
    { value: "rejected", label: "Abgelehnt" },
    { value: "none", label: "Keine" }
  ], ui.verification)}</select>
        </label>
        <label>
          Kanton
          <select id="adminUserCanton">${adminUsersOptions(cantonOptions, ui.canton)}</select>
        </label>
        <label>
          Sortieren
          <select id="adminUserSort">${adminUsersOptions([
    { value: "updatedAt", label: "Aktualisiert" },
    { value: "createdAt", label: "Registriert" },
    { value: "name", label: "Name" },
    { value: "email", label: "E-Mail" },
    { value: "canton", label: "Kanton" },
    { value: "role", label: "Rolle" }
  ], ui.sort)}</select>
        </label>
        <label>
          Richtung
          <select id="adminUserDir">${adminUsersOptions([
    { value: "desc", label: "Absteigend" },
    { value: "asc", label: "Aufsteigend" }
  ], ui.dir)}</select>
        </label>
        <label>
          Pro Seite
          <select id="adminUserPageSize">${adminUsersOptions([
    { value: "10", label: "10" },
    { value: "20", label: "20" },
    { value: "50", label: "50" },
    { value: "100", label: "100" }
  ], String(ui.pageSize))}</select>
        </label>
      </div>
      <div class="request-head admin-users-pagination">
        <p class="help">${escapeHtml(formatNumber(filtered.length))} Treffer \xB7 Seite ${escapeHtml(formatNumber(ui.page))} von ${escapeHtml(formatNumber(totalPages))}</p>
        <div class="row-actions">
          <button class="ghost-button small" data-action="admin-users-page" data-page="${Math.max(1, ui.page - 1)}" ${ui.page <= 1 ? "disabled" : ""}>Zur\xFCck</button>
          <button class="ghost-button small" data-action="admin-users-page" data-page="${Math.min(totalPages, ui.page + 1)}" ${ui.page >= totalPages ? "disabled" : ""}>Weiter</button>
        </div>
      </div>
      <div class="table-wrap admin-users-table" style="margin-top:14px;">
        ${rows ? `<table>
              <thead><tr><th>Name</th><th>E-Mail</th><th>Gebiet</th><th>Rolle</th><th>Konto</th><th>Verifizierung</th><th>Verlauf</th><th>Push</th><th>Aktualisiert</th><th>Aktion</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>` : '<div class="empty">Noch keine registrierten Nutzer geladen.</div>'}
      </div>
    </section>
  `;
}
function userHistoryModal(uidValue) {
  const user = state.registeredUsers.find((item) => item.uid === uidValue);
  if (!user) {
    toast("Nutzer nicht gefunden.");
    return;
  }
  const entries = state.requests.filter((req) => req.uid === uidValue || req.authorId === uidValue).sort((a, b) => new Date(normalizeStoredDate(b.createdAt) || 0) - new Date(normalizeStoredDate(a.createdAt) || 0));
  const disabledNote = user.accountStatus === "disabled" ? '<p class="form-error">Dieses Konto ist deaktiviert. Der Verlauf bleibt zur Moderation sichtbar.</p>' : "";
  const rows = entries.map((req) => `
    <tr>
      <td><span class="badge ${req.type === "Suche" ? "need" : "offer"}">${escapeHtml(req.type)}</span></td>
      <td>${escapeHtml(req.category || "-")}</td>
      <td><strong>${escapeHtml(req.title || "-")}</strong><small>${escapeHtml(req.text || "")}</small></td>
      <td>${escapeHtml(req.status || "offen")}</td>
      <td>${escapeHtml(req.area || "-")}</td>
      <td>${escapeHtml(fmtTime(req.createdAt))}</td>
    </tr>
  `).join("");
  openModal(`Verlauf: ${user.displayName || user.email || "Nutzer/in"}`, `
    <section class="form-grid">
      <div class="badges">
        ${accountStatusBadge(user.accountStatus || "active")}
        <span class="badge">${escapeHtml(accountTypeLabel(user.accountType))}</span>
        <span class="badge">${entries.length} Suche/Biete-Eintr\xE4ge</span>
      </div>
      ${disabledNote}
      <div class="table-wrap">
        ${entries.length ? `
          <table>
            <thead><tr><th>Typ</th><th>Kategorie</th><th>Eintrag</th><th>Status</th><th>Gebiet</th><th>Datum</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        ` : '<div class="empty">Noch keine Suche/Biete-Eintr\xE4ge.</div>'}
      </div>
    </section>
  `);
}
function renderAdminAuditLog() {
  const rows = state.auditLog.slice(0, 20).map((entry) => `
    <tr>
      <td>${escapeHtml(fmtTime(entry.createdAt))}</td>
      <td><strong>${escapeHtml(entry.action)}</strong><small>${escapeHtml(entry.detail || "")}</small></td>
      <td>${escapeHtml(entry.targetLabel || entry.targetEmail || entry.targetUid || "-")}</td>
      <td>${escapeHtml(entry.actorLabel || entry.actorEmail || "-")}</td>
    </tr>
  `).join("");
  return `
    <section class="card">
      <h2>Audit-Log</h2>
      <p class="help">Admin-Aktionen wie Verifizierung, Namens\xE4nderung, Rollen und Deaktivierungen werden protokolliert.</p>
      <div class="table-wrap" style="margin-top:12px;">
        ${rows ? `
          <table>
            <thead><tr><th>Zeit</th><th>Aktion</th><th>Ziel</th><th>Admin</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        ` : '<div class="empty">Noch keine Audit-Eintr\xE4ge.</div>'}
      </div>
    </section>
  `;
}
function renderAdminRoleCard() {
  const editing = isEditCardOpen("admin-roles");
  return `
    <article class="card" data-edit-card="admin-roles">
      ${editCardHeader("Rollenverwaltung", "admin-roles", editing)}
      ${editing ? `
        <form id="adminRoleForm" class="form-grid" style="margin-top:12px;">
          <label>E-Mail
            <input name="email" type="email" required placeholder="name@example.ch" />
          </label>
          <label>Rolle
            <select name="role">
              <option value="admin">Admin</option>
              <option value="area_admin">Gemeindeadmin</option>
              <option value="resident">Bewohner/in</option>
            </select>
          </label>
          <label>Admin-Gebiet (optional)
            <input name="adminScopeArea" maxlength="80" placeholder="${escapeHtml(locationLabel())}" />
          </label>
          <div class="row-actions">
            <button class="secondary-button" type="submit">Rolle speichern</button>
            <button class="ghost-button" type="button" data-action="cancel-edit-card" data-edit-card-id="admin-roles">Abbrechen</button>
          </div>
        </form>
      ` : `
        <div class="list" style="margin-top:12px;">
          <div class="readonly-field"><strong>Aktueller Admin</strong><span>${escapeHtml(profileName())}</span></div>
          <div class="readonly-field"><strong>Hinweis</strong><span>Rollen\xE4nderungen sind eingeklappt und nur per Bleistift sichtbar.</span></div>
        </div>
      `}
      <p class="help" style="margin-top:10px;">Rollen werden serverseitig als Firebase Custom Claims gesetzt. Das Profilfeld dient nur der Anzeige und Synchronisation.</p>
    </article>
  `;
}
function requestAuthorLabel(req) {
  if (req.type === "Biete" && req.anonymousOffer) return "Anonym";
  if (req.authorAccountType === "company") return req.companyName || req.authorName || "Firma";
  return req.author || "ICH";
}
function requestRadiusBadge(req) {
  if (req.audienceLevel) {
    const label = { country: "Schweizweit", municipality: "Gemeinde", canton: "Kanton", radius: "Umkreis von " + Number(req.radiusKm || 10) + " km" }[req.audienceLevel];
    return label ? '<span class="badge info">' + escapeHtml(label) + "</span>" : "";
  }
  const radiusKm = requestRadiusKm(req);
  if (!radiusKm) return "";
  return `<span class="badge info">Reichweite \u2264 ${radiusKm} km</span>`;
}
function requestDistanceBadge(req) {
  const distance = requestDistanceKm(req);
  if (distance === null) return "";
  return `<span class="badge info">Distanz ~ ${escapeHtml(distance)} km</span>`;
}
function requestToneClass(req) {
  return req.type === "Biete" ? "offer" : "need";
}
var v44Social = { summaries: /* @__PURE__ */ new Map(), attempted: /* @__PURE__ */ new Set(), running: false, bookmarkPrefix: "quartinaut-v44-saved:" };
function v44Key(kind, id) {
  return `${kind}:${id}`;
}
function v44Saved(kind, id) {
  if (nativeWeb && kind !== "group_post") return nativeWeb.favoriteSaved(id);
  if (v47Sync) return v47Sync.isFavorite(kind, id);
  try {
    return JSON.parse(localStorage.getItem(v44Social.bookmarkPrefix + (authState.user?.uid || "guest")) || "[]").includes(v44Key(kind, id));
  } catch {
    return false;
  }
}
function v44SavedPanel() {
  const key = v44Social.bookmarkPrefix + (authState.user?.uid || "guest");
  let keys = v46SavedPostKeys();
  if (!v47Sync) try {
    keys = JSON.parse(localStorage.getItem(key) || "[]");
    if (!Array.isArray(keys)) keys = [];
  } catch {
  }
  const entries = keys.map((value) => {
    const [kind, ...parts] = String(value).split(":"), id = parts.join(":");
    const item = kind === "request" ? (state.requests || []).find((x) => x.id === id) : kind === "hub" ? hubState.items.find((x) => x.id === id) : null;
    return item ? { kind, id, title: item.title || "Beitrag", area: item.area || "", item } : null;
  }).filter(Boolean);
  return `<section class="v44-saved-list">${entries.length ? entries.map((x) => `<div class="v44-saved-entry"><div><strong>${escapeHtml(x.title)}</strong><small>${escapeHtml(x.area)} \xB7 ${x.kind === "request" ? "Nachbarschaft" : "Quartier+"}</small></div><button type="button" class="secondary-button small" data-v44-open-saved="${escapeHtml(x.kind)}" data-id="${escapeHtml(x.id)}">Ansehen</button></div>`).join("") : '<p class="help">Noch keine gespeicherten Beitr\xE4ge. Nutze das Merken-Symbol unter einem Beitrag.</p>'}</section>`;
}
function v44ToggleSaved(kind, id) {
  if (v47Sync) {
    const active = !v47Sync.isFavorite(kind, id);
    v47Sync.setFavorite(kind, id, active);
    return active;
  }
  const key = v44Key(kind, id), storage = v44Social.bookmarkPrefix + (authState.user?.uid || "guest");
  let all = [];
  try {
    all = JSON.parse(localStorage.getItem(storage) || "[]");
    if (!Array.isArray(all)) all = [];
  } catch {
  }
  all = all.includes(key) ? all.filter((x) => x !== key) : [...all.slice(-249), key];
  try {
    localStorage.setItem(storage, JSON.stringify(all));
  } catch {
  }
  return all.includes(key);
}
function v44Avatar(name) {
  const letters = String(name || "Q").trim().split(/\s+/).map((x) => x[0] || "").slice(0, 2).join("").toUpperCase();
  return `<span class="v44-avatar" aria-hidden="true">${escapeHtml(letters || "Q")}</span>`;
}
function v44FeedActions(kind, id) {
  const key = v44Key(kind, id), summary = v44Social.summaries.get(key) || {}, saved = v44Saved(kind, id);
  const likes = Number(summary.likes || 0), comments = Number(summary.comments || 0), liked = Boolean(summary.liked);
  return `<div class="v44-social-actions" data-social-kind="${escapeHtml(kind)}" data-social-id="${escapeHtml(id)}">
    <button type="button" data-v44-like aria-label="${liked ? "Gef\xE4llt mir entfernen" : "Gef\xE4llt mir"}" aria-pressed="${liked}">${iconSvg("heart")} <span>${likes ? formatNumber(likes) : "Gef\xE4llt mir"}</span></button>
    <button type="button" data-v44-comments aria-label="Kommentare anzeigen">${iconSvg("chat")} <span>${comments ? formatNumber(comments) : "Kommentieren"}</span></button>
    ${kind === "group_post" ? "" : `<button type="button" data-v44-save aria-label="${saved ? "Merkliste entfernen" : "Beitrag merken"}" aria-pressed="${saved}">${iconSvg("bookmark")}</button>
    <button type="button" data-v44-share aria-label="Beitrag teilen">${iconSvg("share")}</button>`}
  </div>`;
}
function v44PostHead(name, place, date, label) {
  return `<header class="v44-post-head">${v44Avatar(name)}<div class="v44-post-author"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(place || "Deine Gemeinde")} \xB7 ${escapeHtml(date || "")}</small></div><span class="v44-post-tag">${escapeHtml(label || "Beitrag")}</span></header>`;
}
async function v44LoadSocial() {
  if (v44Social.running || !isFirebaseMode() || !authState.user) return;
  const visible = [...document.querySelectorAll(".v44-social-actions[data-social-kind][data-social-id]")];
  const toFetch = visible.map((el) => ({ kind: el.dataset.socialKind, id: el.dataset.socialId })).filter((x) => /^(request|hub|group_post)$/.test(x.kind) && /^[a-zA-Z0-9_-]{5,150}$/.test(x.id) && !v44Social.attempted.has(v44Key(x.kind, x.id))).slice(0, 40);
  if (!toFetch.length) return;
  toFetch.forEach((x) => v44Social.attempted.add(v44Key(x.kind, x.id)));
  v44Social.running = true;
  try {
    const result = await callQuartinaut("quartinautSocial", { action: "summary", posts: toFetch });
    for (const [key, data] of Object.entries(result.summaries || {})) v44Social.summaries.set(key, data);
    document.querySelectorAll(".v44-social-actions").forEach((el) => v44RefreshSocial(el));
  } catch (error) {
    console.warn("[Quartinaut] Social-Funktion nicht verf\xFCgbar.", error);
  } finally {
    v44Social.running = false;
    queueMicrotask(() => void v44LoadSocial());
  }
}
function v44RefreshSocial(el) {
  const kind = el.dataset.socialKind, id = el.dataset.socialId, summary = v44Social.summaries.get(v44Key(kind, id)) || {};
  const like = el.querySelector("[data-v44-like]"), comment = el.querySelector("[data-v44-comments]"), save = el.querySelector("[data-v44-save]");
  if (like) {
    like.setAttribute("aria-pressed", String(Boolean(summary.liked)));
    like.setAttribute("aria-label", summary.liked ? "Gef\xE4llt mir entfernen" : "Gef\xE4llt mir");
    const text = like.querySelector("span");
    if (text) text.textContent = summary.likes ? formatNumber(summary.likes) : "Gef\xE4llt mir";
  }
  if (comment) {
    const text = comment.querySelector("span");
    if (text) text.textContent = summary.comments ? formatNumber(summary.comments) : "Kommentieren";
  }
  if (save) {
    save.setAttribute("aria-pressed", String(v44Saved(kind, id)));
    save.setAttribute("aria-label", v44Saved(kind, id) ? "Merkliste entfernen" : "Beitrag merken");
  }
}
async function v44CommentsModal(kind, id) {
  let renderComments = () => {
  };
  openModal("Kommentare", `<section class="v44-comments" aria-label="\xD6ffentliche Kommentare"><div data-v44-comment-list aria-live="polite">Kommentare werden geladen \u2026</div>
    <form id="v44CommentForm" class="v44-comment-form"><label for="v44CommentText">Kommentar schreiben</label>
    <textarea id="v44CommentText" name="text" maxlength="400" minlength="2" required rows="2" placeholder="Freundlich bleiben \u2013 keine privaten Kontaktdaten."></textarea>
    <button class="primary-button" type="submit">Kommentar ver\xF6ffentlichen</button></form><p class="help">Kommentare sind f\xFCr Personen sichtbar, die diesen Beitrag sehen d\xFCrfen. F\xFCr private Absprachen nutze den Chat.</p></section>`, (modal, close) => {
    const list = modal.querySelector("[data-v44-comment-list]");
    renderComments = async () => {
      try {
        const response = await callQuartinaut("quartinautSocial", { action: "comments.list", kind, id });
        const rows = response.comments || [];
        list.innerHTML = rows.length ? rows.map((c) => `<article class="v44-comment">${v44Avatar(c.authorName)}<div><div><strong>${escapeHtml(c.authorName || "Mitglied")}</strong> <small>${escapeHtml(relative(c.createdAt))}</small></div><p>${escapeHtml(c.text)}</p>${c.mine || c.moderator ? `<button class="ghost-button small" data-v44-delete-comment="${escapeHtml(c.id)}">Entfernen</button>` : `<button class="ghost-button small" data-v44-report-comment="${escapeHtml(c.id)}">Melden</button>`}</div></article>`).join("") : '<p class="v44-empty-comments">Noch keine Kommentare. Starte das Gespr\xE4ch.</p>';
      } catch (error) {
        list.textContent = "Kommentare konnten nicht geladen werden. Bitte sp\xE4ter erneut versuchen.";
      }
    };
    modal.querySelector("#v44CommentForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget, button = form.querySelector("[type=submit]");
      button.disabled = true;
      try {
        const text = form.elements.text.value.trim();
        if (text.length < 2) return;
        const result = await callQuartinaut("quartinautSocial", { action: "comment.create", kind, id, text });
        v44Social.summaries.set(v44Key(kind, id), result.summary || {});
        document.querySelectorAll(".v44-social-actions").forEach((el) => v44RefreshSocial(el));
        form.reset();
        await renderComments();
      } catch (error) {
        toast("Kommentar konnte nicht gespeichert werden: " + (error.message || "Bitte erneut versuchen."));
      } finally {
        button.disabled = false;
      }
    });
    list.addEventListener("click", async (event) => {
      const del = event.target.closest("[data-v44-delete-comment]");
      const report = event.target.closest("[data-v44-report-comment]");
      if (!del && !report) return;
      const clicked = del || report;
      clicked.disabled = true;
      try {
        const result = await callQuartinaut("quartinautSocial", { action: del ? "comment.delete" : "comment.report", kind, id, commentId: del?.dataset.v44DeleteComment || report?.dataset.v44ReportComment });
        if (result.summary) v44Social.summaries.set(v44Key(kind, id), result.summary);
        document.querySelectorAll(".v44-social-actions").forEach((el) => v44RefreshSocial(el));
        toast(del ? "Kommentar entfernt." : "Kommentar gemeldet.");
        await renderComments();
      } catch (error) {
        toast(error.message || "Aktion fehlgeschlagen.");
        clicked.disabled = false;
      }
    });
    void renderComments();
  });
}
document.addEventListener("pointerdown", (event) => {
  const gallery = event.target.closest?.("[data-v44-carousel]");
  if (!gallery) return;
  gallery.dataset.touchStartX = String(event.clientX);
  gallery.dataset.touchStartY = String(event.clientY);
});
document.addEventListener("pointerup", (event) => {
  const gallery = event.target.closest?.("[data-v44-carousel]");
  if (!gallery || !gallery.dataset.touchStartX) return;
  const dx = event.clientX - Number(gallery.dataset.touchStartX), dy = event.clientY - Number(gallery.dataset.touchStartY);
  delete gallery.dataset.touchStartX;
  delete gallery.dataset.touchStartY;
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4)
    gallery.querySelector(dx < 0 ? '[data-v44-carousel-step="1"]' : '[data-v44-carousel-step="-1"]')?.click();
});
document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-v44-carousel-step], [data-v44-like], [data-v44-comments], [data-v44-save], [data-v44-share], [data-v44-open-saved]");
  if (!target) return;
  event.preventDefault();
  if (target.matches("[data-v44-open-saved]")) {
    const kind2 = target.dataset.v44OpenSaved, id2 = target.dataset.id;
    if (kind2 === "request") {
      setRoute("bulletin");
      requestAnimationFrame(() => document.querySelector(`[data-request-id="${cssEscape(id2)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
    } else {
      const item = hubState.items.find((x) => x.id === id2);
      if (item) {
        hubState.section = item.kind;
        setRoute("hub");
        requestAnimationFrame(() => document.querySelector(`[data-hub-post-id="${cssEscape(id2)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
      } else toast("Bitte Quartier+ \xF6ffnen, um den Beitrag neu zu laden.");
    }
    return;
  }
  if (target.matches("[data-v44-carousel-step]")) {
    const gallery = target.closest("[data-v44-carousel]"), slides = gallery?.querySelectorAll(".v44-carousel-slide");
    if (!gallery || !slides?.length) return;
    const next = (Number(gallery.dataset.current || 0) + Number(target.dataset.v44CarouselStep) + slides.length) % slides.length;
    gallery.dataset.current = String(next);
    gallery.querySelector(".v44-carousel-track").style.transform = `translateX(-${next * 100}%)`;
    const counter = gallery.querySelector(".v44-carousel-count");
    if (counter) counter.textContent = `${next + 1} / ${slides.length}`;
    gallery.querySelectorAll(".v44-carousel-dots span").forEach((dot, i) => dot.classList.toggle("active", i === next));
    return;
  }
  const bar = target.closest(".v44-social-actions"), kind = bar?.dataset.socialKind, id = bar?.dataset.socialId;
  if (!kind || !id) return;
  if (target.matches("[data-v44-save]")) {
    const saved = v44ToggleSaved(kind, id);
    v44RefreshSocial(bar);
    toast(saved ? "Beitrag gemerkt." : "Aus Merkliste entfernt.");
    return;
  }
  if (target.matches("[data-v44-share]")) {
    const url = new URL(location.href);
    url.searchParams.set("route", kind === "request" ? "bulletin" : "hub");
    const info = `Quartinaut \u2013 Beitrag in deiner Gemeinde: ${url}`;
    try {
      if (navigator.share) await navigator.share({ title: "Quartinaut", url: url.toString() });
      else if (navigator.clipboard) {
        await navigator.clipboard.writeText(info);
        toast("Link kopiert.");
      } else toast("Bitte Browser-Link teilen.");
    } catch (error) {
      if (error?.name !== "AbortError") toast("Teilen nicht verf\xFCgbar.");
    }
    return;
  }
  if (target.matches("[data-v44-comments]")) {
    void v44CommentsModal(kind, id);
    return;
  }
  if (target.matches("[data-v44-like]")) {
    target.disabled = true;
    try {
      const result = await callQuartinaut("quartinautSocial", { action: "like.toggle", kind, id });
      v44Social.summaries.set(v44Key(kind, id), result.summary || {});
      document.querySelectorAll(".v44-social-actions").forEach((el) => v44RefreshSocial(el));
    } catch (error) {
      toast("Gef\xE4llt mir momentan nicht verf\xFCgbar.");
    } finally {
      target.disabled = false;
    }
  }
});
function requestCard(req) {
  const typeClass = requestToneClass(req), isPublic = (req.status || "offen") === "offen";
  const isAdmin = isAdminRole(), isOwner = requestOwnerUid(req) === authState.user?.uid;
  const canEdit = isOwner || isAdmin, canComplete = canEdit, ownerChats = isOwner ? requestChats(req.id) : [];
  const directChat = directChatForRequest(req);
  const chatLabel = isOwner ? `Gespr\xE4che (${ownerChats.length})` : directChat ? "Chat fortsetzen" : "Privat schreiben";
  const name = req.type === "Biete" && req.anonymousOffer ? "Anonym" : req.authorName || requestAuthorLabel(req);
  const status = requestStatusBadge(req);
  return `<article class="card request-card request-kind-${typeClass} v44-post" data-request-id="${escapeHtml(req.id)}">
    ${v44PostHead(name, req.area, relative(req.createdAt), req.type === "Biete" ? "Angebot" : "Gesuch")}
    <div class="v44-post-body"><h3>${escapeHtml(req.title)}</h3><p>${escapeHtml(req.text)}</p></div>
    ${postPhotoGallery(req.photoPaths)}
    <div class="v44-post-meta"><span>${escapeHtml(req.category || "Nachbarschaft")}</span><span>${escapeHtml(req.urgency || "")}</span>${status}</div>
    ${isPublic ? v44FeedActions("request", req.id) : ""}
    <div class="v44-post-contact">
      ${dynamicTextTranslateButton("request", req.id)}
      ${isPublic ? `<button class="secondary-button" data-action="open-chat" data-id="${escapeHtml(req.id)}">${iconSvg("chat")} ${escapeHtml(chatLabel)}</button>` : ""}
      <details class="v44-more"><summary>Weitere Optionen</summary><div class="v44-more-actions">
        ${trustBadge(profileFromRequest(req), { detail: true })}
        ${Number(state.publicTrust?.[requestOwnerUid(req)]?.count || 0) > 0 ? `<span class="badge v21-rating-badge">\u2605 ${escapeHtml(Number(state.publicTrust[requestOwnerUid(req)].average).toFixed(1))}</span>` : ""}
        ${requestRadiusBadge(req)}${requestDistanceBadge(req)}${recurringBadge(req)}
        ${req.expiresAt ? `<span class="badge ttl">\u23F3 ${escapeHtml(expiryLabel(req.expiresAt))}</span>` : ""}
        ${req.status === "abgelehnt" && req.rejectionReason ? `<span class="form-error">${escapeHtml(req.rejectionReason)}</span>` : ""}
        ${canEdit ? `<button class="ghost-button small" data-action="edit-request" data-id="${escapeHtml(req.id)}">Bearbeiten</button>` : ""}
        ${canComplete && isPublic ? `<button class="success-button small" data-action="complete" data-id="${escapeHtml(req.id)}">Erledigt</button>` : ""}
        ${isPublic ? `<button class="ghost-button small" data-action="report" data-id="${escapeHtml(req.id)}">Melden</button>` : ""}${isPublic ? `<button class="ghost-button small" type="button" data-v46-hide-post="request" data-id="${escapeHtml(req.id)}">Nur bei mir ausblenden</button>` : ""}
        ${isAdmin ? `<button class="ghost-button small" data-action="raise-escalation" data-id="${escapeHtml(req.id)}">Eskalieren</button>` : ""}
      </div></details>
    </div>
  </article>`;
}
var SEVERITY_META = {
  critical: { cls: "critical", badge: "need", label: "P0 \xB7 Notfall" },
  warn: { cls: "warn", badge: "warn", label: "P1 \xB7 Wichtig" },
  info: { cls: "", badge: "info", label: "P2 \xB7 Info" }
};
function alertCard(alert) {
  const meta = SEVERITY_META[alert.severity] || SEVERITY_META.info;
  const validNote = alert.validUntil ? `<span>\xB7</span><span>g\xFCltig bis ${fmtTime(alert.validUntil)}</span>` : "";
  const approvedNote = alert.approvedBy ? `<span>\xB7</span><span>freigegeben: ${escapeHtml(alert.approvedBy)}</span>` : "";
  const seen = hasSeenAlert(alert.id);
  const seenCount = alertReadCount(alert.id);
  const seenBadge = isAdminRole() ? `<span class="badge info">Gesehen: ${seenCount}</span>` : seen ? '<span class="badge done">Gesehen</span>' : "";
  return `
    <article class="card alert-card ${meta.cls}">
      <div class="badges">
        <span class="badge official">\u2713 verifiziert</span>
        <span class="badge ${meta.badge}">${meta.label}</span>
        <span class="badge">${escapeHtml(alert.area)}</span>
        ${seenBadge}
      </div>
      <h3 style="margin-top:10px;">${escapeHtml(alert.title)}</h3>
      <p>${escapeHtml(alert.text)}</p>
      <div class="alert-meta"><span>${escapeHtml(alert.createdBy)}</span><span>\xB7</span><span>${fmtTime(alert.createdAt)}</span><span>\xB7</span><span>${escapeHtml(alert.channel || "PWA")}</span>${validNote}${approvedNote}</div>
      <div class="row-actions" style="margin-top:12px;">
        <button class="ghost-button small" data-action="mark-alert-read" data-id="${alert.id}" ${seen ? "disabled" : ""}>${seen ? "Best\xE4tigt" : "Gesehen"}</button>
      </div>
    </article>
  `;
}
async function markAlertRead(alertId) {
  if (!authState.user) return;
  if (hasSeenAlert(alertId)) return;
  const payload = {
    id: `read_${alertId}_${authState.user.uid}`,
    alertId,
    uid: authState.user.uid,
    email: authState.user.email,
    displayName: profileName(),
    area: state.profile.area,
    readAt: nowIso(),
    createdAt: nowIso()
  };
  if (isFirebaseMode()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.alertReads, payload.id, payload, false);
    await syncStateFromFirestore();
  } else {
    state.alertReads.unshift(payload);
    saveState();
  }
  render();
  toast("Alarm als gelesen markiert.");
}
var modalDepth = 0;
var modalAppRestore = null;
function modalFocusableElements(modal) {
  return Array.from(modal.querySelectorAll([
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])'
  ].join(","))).filter((element) => !element.hidden && element.getClientRects().length > 0);
}
function enterModalPageState() {
  const appShell = byId("app");
  if (modalDepth === 0) {
    modalAppRestore = appShell ? {
      ariaHidden: appShell.getAttribute("aria-hidden"),
      inert: "inert" in appShell ? appShell.inert : null
    } : null;
    document.body.classList.add("modal-open");
    if (appShell) {
      appShell.setAttribute("aria-hidden", "true");
      if ("inert" in appShell) appShell.inert = true;
    }
  }
  modalDepth += 1;
}
function leaveModalPageState() {
  modalDepth = Math.max(0, modalDepth - 1);
  if (modalDepth !== 0) return;
  const appShell = byId("app");
  document.body.classList.remove("modal-open");
  if (!appShell || !modalAppRestore) return;
  if (modalAppRestore.ariaHidden === null) appShell.removeAttribute("aria-hidden");
  else appShell.setAttribute("aria-hidden", modalAppRestore.ariaHidden);
  if ("inert" in appShell && modalAppRestore.inert !== null) appShell.inert = modalAppRestore.inert;
  modalAppRestore = null;
}
var DRAFT_PREFIX = "quartinaut-draft-v42:";
var DRAFT_TTL = 72 * 60 * 60 * 1e3;
var DRAFT_FORM_IDS = /* @__PURE__ */ new Set(["requestForm", "v3HubCreate", "v3EventSeries", "v3GroupPost", "v3ContactForm", "v3DraftForm"]);
function draftKey(form, context = "") {
  if (!form || !DRAFT_FORM_IDS.has(form.id) || !authState.user?.uid) return "";
  const suffix = form.id === "v3HubCreate" ? context || hubState.section || "all" : form.id === "v3GroupPost" ? context || hubState.activeGroup || "" : form.id === "v3DraftForm" ? "draft-assistant" : context;
  return DRAFT_PREFIX + authState.user.uid + ":" + form.id + ":" + String(suffix).slice(0, 80);
}
function draftValues(form) {
  return [...form.elements].filter((el) => el.name && !["password", "file", "hidden"].includes(el.type) && !el.disabled).map((el) => ({ name: el.name, type: el.type, value: String(el.value || "").slice(0, 2500), checked: !!el.checked }));
}
function saveFormDraft(form, key) {
  if (!key) return;
  try {
    const values = draftValues(form), payload = { saved: Date.now(), values, step: Number(form.dataset.wizardStep || 0) };
    if (form.id === "requestForm") {
      payload.v47OpId = form.dataset.v47OpId || "";
      payload.v47CreatedAt = form.dataset.v47CreatedAt || "";
    }
    const raw = JSON.stringify(payload);
    if (raw.length < 24e3) localStorage.setItem(key, raw);
    const hint = form.closest(".modal-backdrop")?.querySelector(".v42-draft-hint");
    if (hint) hint.textContent = "Entwurf automatisch auf diesem Ger\xE4t gesichert";
  } catch (error) {
    console.warn("[Quartinaut] Entwurfsicherung nicht verf\xFCgbar", error);
  }
}
function restoreFormDraft(form, key) {
  if (!key) return false;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || Date.now() - Number(data.saved) > DRAFT_TTL) {
      localStorage.removeItem(key);
      return false;
    }
    const all = [...form.elements];
    const consumed = /* @__PURE__ */ new Set();
    for (const entry of data.values || []) {
      const target = all.find((el, index) => !consumed.has(index) && el.name === entry.name && el.type === entry.type);
      if (!target) continue;
      consumed.add(all.indexOf(target));
      if (target.type === "checkbox" || target.type === "radio") target.checked = Boolean(entry.checked);
      else target.value = String(entry.value || "");
      target.dispatchEvent(new Event("change", { bubbles: false }));
    }
    if (form.id === "requestForm") {
      if (data.v47OpId) form.dataset.v47OpId = data.v47OpId;
      if (data.v47CreatedAt) form.dataset.v47CreatedAt = data.v47CreatedAt;
      form.dispatchEvent(new CustomEvent("quartinaut:draft-restored", { detail: { step: Number(data.step || 0) } }));
    }
    return true;
  } catch (error) {
    console.warn("[Quartinaut] Entwurf konnte nicht wiederhergestellt werden", error);
    return false;
  }
}
function clearFormDraft(key) {
  if (key) try {
    localStorage.removeItem(key);
  } catch {
  }
}
function manageModalDraft(modal) {
  const form = modal.querySelector("form[id]");
  const key = draftKey(form, modal.dataset.draftContext || "");
  if (!key) return () => {
  };
  const hint = document.createElement("div");
  hint.className = "v42-draft-footer";
  hint.innerHTML = '<span class="v42-draft-hint" aria-live="polite">Eingaben werden automatisch auf diesem Ger\xE4t gespeichert</span><button class="ghost-button small v42-discard-draft" type="button">Entwurf verwerfen</button>';
  form.append(hint);
  const restored = restoreFormDraft(form, key);
  if (restored) hint.querySelector(".v42-draft-hint").textContent = "Gespeicherten Entwurf wiederhergestellt";
  let timer = 0;
  const write = () => {
    clearTimeout(timer);
    timer = setTimeout(() => saveFormDraft(form, key), 180);
  };
  const saveOnHide = () => {
    if (document.hidden) saveFormDraft(form, key);
  };
  const saveOnPageHide = () => saveFormDraft(form, key);
  document.addEventListener("visibilitychange", saveOnHide);
  window.addEventListener("pagehide", saveOnPageHide);
  modal.addEventListener("modal:close", () => {
    document.removeEventListener("visibilitychange", saveOnHide);
    window.removeEventListener("pagehide", saveOnPageHide);
  }, { once: true });
  form.addEventListener("input", write);
  form.addEventListener("change", write);
  form.addEventListener("quartinaut:wizard-step", write);
  hint.querySelector("button").addEventListener("click", () => {
    clearTimeout(timer);
    clearFormDraft(key);
    form.reset();
    form.dispatchEvent(new CustomEvent("quartinaut:draft-restored", { detail: { step: 0 } }));
    hint.querySelector(".v42-draft-hint").textContent = "Entwurf verworfen";
  });
  return (completed) => {
    clearTimeout(timer);
    if (completed) clearFormDraft(key);
    else if (form.isConnected) saveFormDraft(form, key);
  };
}
function persistInlineDraft() {
  const form = byId("v3DraftForm");
  if (form) saveFormDraft(form, draftKey(form));
}
function restoreInlineDraft() {
  const form = byId("v3DraftForm");
  if (form) restoreFormDraft(form, draftKey(form));
}
document.addEventListener("input", (event) => {
  const form = event.target.closest?.("#v3DraftForm");
  if (form) saveFormDraft(form, draftKey(form));
});
function openModal(title, bodyHtml, onReady) {
  const template = byId("modalTemplate");
  const modal = template.content.firstElementChild.cloneNode(true);
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const modalCard = modal.querySelector(".modal-card");
  modal.querySelector("#modalTitle").textContent = title;
  modal.querySelector(".modal-body").innerHTML = bodyHtml;
  modalCard?.setAttribute("tabindex", "-1");
  enterModalPageState();
  document.body.appendChild(modal);
  let closed = false;
  const onKeydown = (event) => {
    if (event.key === "Escape") {
      if (!modal.querySelector("form[id]")) close();
      event.preventDefault();
    }
    if (event.key !== "Tab") return;
    const focusable = modalFocusableElements(modal);
    if (!focusable.length) {
      event.preventDefault();
      modalCard?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  let finishDraft = () => {
  };
  const close = (completed = false) => {
    if (closed) return;
    finishDraft(Boolean(completed));
    closed = true;
    activeModalClosers.delete(close);
    window.removeEventListener("keydown", onKeydown);
    modal.dispatchEvent(new Event("modal:close"));
    modal.remove();
    leaveModalPageState();
    if (previousFocus?.isConnected) previousFocus.focus();
  };
  activeModalClosers.add(close);
  modal.querySelector("[data-close-modal]").addEventListener("click", () => close(false));
  modal.addEventListener("click", (event) => {
    if (event.target === modal && !modal.querySelector("form[id]")) close();
  });
  window.addEventListener("keydown", onKeydown);
  onReady?.(modal, close);
  finishDraft = manageModalDraft(modal);
  applyI18n(modal);
  enhanceInterface(modal, { title: false });
  const firstInput = modal.querySelector("input, textarea, select, button");
  (firstInput || modalCard)?.focus();
}
function requestLocationChangeModal() {
  const picker = locationOptions(state.profile.location);
  openModal("Standortwechsel beantragen", `
    <form id="locationChangeForm" class="form-grid">
      <div class="card compact soft"><strong>Aktueller Standort</strong><p>${escapeHtml(locationLabel())}</p></div>
      <div class="form-grid two">
        <label>Neuer Kanton
          ${picker.cantonSelect}
        </label>
        <label>Neue Gemeinde / neuer Ort
          ${picker.municipalitySelect}
        </label>
      </div>
      <label>Begr\xFCndung
        <textarea name="reason" maxlength="260" required placeholder="Kurze Begr\xFCndung f\xFCr den Standortwechsel"></textarea>
      </label>
      <button class="primary-button" type="submit">Antrag senden</button>
    </form>
  `, (modal, close) => {
    bindLocationPicker(modal);
    modal.querySelector("#locationChangeForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const submit = event.currentTarget.querySelector('button[type="submit"]');
      submit.disabled = true;
      const data = Object.fromEntries(new FormData(event.currentTarget));
      const targetLocation = buildLocation(data.cantonBfsCode, data.municipalityBfsCode);
      if (!targetLocation) {
        toast("Bitte g\xFCltigen Standort w\xE4hlen.");
        submit.disabled = false;
        return;
      }
      const payload = {
        id: uid("locreq"),
        uid: authState.user.uid,
        email: authState.user.email,
        displayName: profileName(),
        currentLocation: state.profile.location,
        currentLabel: locationLabel(),
        targetLocation,
        targetLabel: locationLabel(targetLocation),
        reason: data.reason,
        status: "offen",
        createdAt: nowIso()
      };
      try {
        if (isFirebaseMode()) {
          await setFirebaseDoc(FIRESTORE_COLLECTIONS.locationChangeRequests, payload.id, payload, false);
          await syncStateFromFirestore();
        } else {
          state.locationChangeRequests.unshift(payload);
          saveState();
        }
        close();
        render();
        toast("Standortantrag gesendet.");
      } finally {
        submit.disabled = false;
      }
    });
  });
}
function requestNameChangeModal() {
  openModal("Namens\xE4nderung beantragen", `
    <form id="nameChangeForm" class="form-grid">
      <div class="readonly-field"><strong>Aktueller Name</strong><span>${escapeHtml(state.profile.name)}</span></div>
      <label>Neuer Name
        <input name="requestedName" required maxlength="60" autocomplete="name" placeholder="Vorname Nachname" />
      </label>
      <label>Begr\xFCndung
        <textarea name="reason" required maxlength="320" placeholder="Warum soll der Name ge\xE4ndert werden?"></textarea>
      </label>
      <p class="help">Der Name wird erst nach Admin-Pr\xFCfung ge\xE4ndert. F\xFCr Identit\xE4tsbest\xE4tigungen kann zus\xE4tzlich eine Verifizierung mit Ausweisfoto beantragt werden.</p>
      <p id="nameChangeError" class="form-error" role="alert"></p>
      <button class="primary-button" type="submit">Antrag senden</button>
    </form>
  `, (modal, close) => {
    modal.querySelector("#nameChangeForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = form.querySelector('button[type="submit"]');
      const errorNode = modal.querySelector("#nameChangeError");
      submit.disabled = true;
      if (errorNode) errorNode.textContent = "";
      const data = Object.fromEntries(new FormData(form));
      const requestedName = String(data.requestedName || "").trim();
      const reason = String(data.reason || "").trim();
      if (requestedName.length < 3 || !requestedName.includes(" ")) {
        const message = "Bitte Vor- und Nachname angeben.";
        if (errorNode) errorNode.textContent = message;
        toast(message);
        submit.disabled = false;
        return;
      }
      const payload = {
        id: uid("namereq"),
        uid: authState.user.uid,
        email: authState.user.email,
        displayName: profileName(),
        type: "name_change",
        title: `Namens\xE4nderung: ${state.profile.name} \u2192 ${requestedName}`,
        scope: "Profil",
        currentName: state.profile.name,
        requestedName,
        reason,
        description: reason,
        status: "offen",
        createdAt: nowIso()
      };
      try {
        if (isFirebaseMode()) {
          await setFirebaseDoc(FIRESTORE_COLLECTIONS.changeRequests, payload.id, payload, false);
          await syncStateFromFirestore().catch((error) => reportBackgroundError("Nach Namensantrag synchronisieren", error));
        } else {
          state.changeRequests.unshift(payload);
          saveState();
        }
        close();
        render();
        toast("Namens\xE4nderung beantragt.");
      } catch (error) {
        const message = actionErrorMessage(error, "Namens\xE4nderung konnte nicht beantragt werden.");
        if (errorNode) errorNode.textContent = message;
        toast(message);
      } finally {
        submit.disabled = false;
      }
    });
  });
}
function requestVerificationModal() {
  const isCompanyProfile = state.profile.accountType === "company";
  openModal("Verifizierung beantragen", `
    <form id="verificationForm" class="form-grid">
      <div class="card compact soft">
        <strong>${isCompanyProfile ? "Firmenkonto: verantwortliche Person pr\xFCfen" : "Privatperson verifizieren"}</strong>
        <p class="help">${isCompanyProfile ? "Der Nachweis best\xE4tigt die verantwortliche Person. Die Firmenfreigabe wird separat als Firmenstatus gespeichert." : "Der Nachweis dient zur Namens- und Identit\xE4tspr\xFCfung."}</p>
      </div>
      <label>Verifizierungsmethode
        <select name="method">
          <option>Gemeinderegister / Einwohnerkontrolle</option>
          <option>Pers\xF6nliche Pr\xFCfung durch Administration</option>
          <option>Best\xE4tigung durch Quartierverein</option>
          ${isCompanyProfile ? "<option>Firmennachweis / UID- oder Handelsregister-Hinweis</option>" : ""}
        </select>
      </label>
      <label>Notiz
        <textarea name="note" maxlength="260" placeholder="Hinweis f\xFCr die Administration"></textarea>
      </label>
      <label>${isCompanyProfile ? "Nachweisfoto" : "Ausweisfoto"}
        <input name="idPhoto" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required />
      </label>
      <p class="help">Das Foto wird gesch\xFCtzt in Firebase Storage gespeichert, nicht \xF6ffentlich angezeigt und erst nach dem gespeicherten Admin-Entscheid aus dem Antrag entfernt.</p>
      <p id="verificationPhotoHint" class="help">Grosse Fotos werden automatisch verkleinert und als JPG gespeichert.</p>
      <p id="verificationError" class="form-error" role="alert"></p>
      <button class="primary-button" type="submit">Verifizierung beantragen</button>
    </form>
  `, (modal, close) => {
    modal.querySelector("#verificationForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = event.currentTarget.querySelector('button[type="submit"]');
      const errorNode = modal.querySelector("#verificationError");
      const hintNode = modal.querySelector("#verificationPhotoHint");
      const previousStatus = state.profile.verificationStatus;
      const previousUserStatus = authState.user?.verificationStatus || previousStatus;
      submit.disabled = true;
      if (errorNode) errorNode.textContent = "";
      const data = Object.fromEntries(new FormData(form));
      try {
        const requestId = uid("verreq");
        if (hintNode) hintNode.textContent = "Foto wird vorbereitet und automatisch verkleinert ...";
        const preparedPhoto = await prepareVerificationPhoto(form.elements.idPhoto?.files?.[0]);
        if (hintNode) hintNode.textContent = `Foto optimiert: ${formatFileSize(preparedPhoto.originalSize)} \u2192 ${formatFileSize(preparedPhoto.size)}. Antrag wird gesendet ...`;
        const idPhoto = await persistVerificationPhoto(requestId, preparedPhoto);
        state.profile.verificationStatus = "pending";
        syncCurrentUser({ verificationStatus: "pending" });
        const payload = {
          id: requestId,
          uid: authState.user.uid,
          email: authState.user.email,
          displayName: profileName(),
          registeredName: state.profile.name,
          accountType: state.profile.accountType || "resident",
          companyName: companyNameForProfile(),
          proofType: state.profile.accountType === "company" ? "company_responsible_person" : "personal_id",
          method: data.method,
          note: data.note,
          idPhoto,
          status: "offen",
          createdAt: nowIso()
        };
        if (isFirebaseMode()) {
          await setFirebaseDoc(FIRESTORE_COLLECTIONS.verificationRequests, payload.id, payload, false);
          await syncStateFromFirestore().catch((error) => reportBackgroundError("Nach Verifizierungsantrag synchronisieren", error));
        } else {
          state.verificationRequests.unshift(payload);
          saveState();
        }
        close();
        render();
        toast("Verifizierungsantrag gesendet.");
      } catch (error) {
        state.profile.verificationStatus = previousStatus || "none";
        syncCurrentUser({ verificationStatus: previousUserStatus || "none" });
        const message = actionErrorMessage(error, "Verifizierungsantrag konnte nicht gesendet werden.");
        if (errorNode) errorNode.textContent = message;
        toast(message);
      } finally {
        submit.disabled = false;
      }
    });
  });
}
function editVerificationRequestModal(id) {
  const req = state.verificationRequests.find((item) => item.id === id);
  if (!req) return;
  openModal("Verifizierungsantrag anpassen", `
    <form id="editVerificationForm" class="form-grid">
      <label>Verifizierungsmethode
        <select name="method">
          <option ${req.method === "Gemeinderegister / Einwohnerkontrolle" ? "selected" : ""}>Gemeinderegister / Einwohnerkontrolle</option>
          <option ${req.method === "Pers\xF6nliche Pr\xFCfung durch Administration" ? "selected" : ""}>Pers\xF6nliche Pr\xFCfung durch Administration</option>
          <option ${req.method === "Best\xE4tigung durch Quartierverein" ? "selected" : ""}>Best\xE4tigung durch Quartierverein</option>
        </select>
      </label>
      <label>Notiz
        <textarea name="note" maxlength="260">${escapeHtml(req.note || "")}</textarea>
      </label>
      <button class="primary-button" type="submit">\xC4nderung speichern</button>
    </form>
  `, (modal, close) => {
    modal.querySelector("#editVerificationForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const submit = event.currentTarget.querySelector('button[type="submit"]');
      submit.disabled = true;
      const data = Object.fromEntries(new FormData(event.currentTarget));
      req.method = String(data.method || req.method);
      req.note = String(data.note || "");
      try {
        if (isFirebaseMode()) {
          await setFirebaseDoc(FIRESTORE_COLLECTIONS.verificationRequests, req.id, {
            method: req.method,
            note: req.note,
            updatedAt: nowIso()
          }, true);
          await syncStateFromFirestore();
        } else {
          saveState();
        }
        close();
        render();
        toast("Verifizierungsantrag angepasst.");
      } finally {
        submit.disabled = false;
      }
    });
  });
}
function openHelpModal() {
  const canSubmit = Boolean(authState.user);
  openModal("Hilfe & \xC4nderungsanfrage", `
    <section class="form-grid">
      <div class="card compact soft">
        <strong>So funktioniert Quartinaut</strong>
        <p>Quartinaut verbindet Nachbarschaftshilfe mit verifizierten Gemeinde-Infos. Am Schwarzen Brett findest du lokale Gesuche und Angebote; Antworten bleiben im privaten 1:1-Chat.</p>
        <button class="secondary-button small" type="button" data-action="reopen-onboarding" style="margin-top:10px;">${iconSvg("help")} Wegleitung anzeigen</button>
      </div>
      <div class="card compact soft">
        <strong>\xC4nderungsanfrage</strong>
        <p>Teile Verbesserungen, Korrekturen oder neue Kategorien direkt mit der Administration. Du siehst den Status sp\xE4ter im Profil.</p>
      </div>
      <div class="card compact soft">
        <strong>Rechtliches & Kontakt</strong>
        <div class="row-actions legal-shortcuts" style="margin-top:10px;">
          <button class="ghost-button small" type="button" data-help-legal="privacy">Datenschutz</button>
          <button class="ghost-button small" type="button" data-help-legal="terms">Nutzungsbedingungen</button>
          <button class="ghost-button small" type="button" data-help-legal="imprint">Impressum</button>
        </div>
      </div>
      ${canSubmit ? `
        <form id="changeRequestForm" class="form-grid">
          <label>Titel
            <input name="title" required maxlength="90" placeholder="z. B. Neue Kategorie f\xFCr Seniorenhilfe" />
          </label>
          <label>Bereich
            <select name="scope">
              <option>App</option>
              <option>Schwarzes Brett</option>
              <option>Alarme</option>
              <option>Profil</option>
              <option>Moderation</option>
            </select>
          </label>
          <label>Beschreibung
            <textarea name="description" required maxlength="500" placeholder="Was soll ge\xE4ndert werden und warum?"></textarea>
          </label>
          <button class="primary-button" type="submit">Anfrage senden</button>
        </form>
      ` : '<p class="help">Bitte zuerst anmelden, um eine \xC4nderungsanfrage zu senden.</p>'}
    </section>
  `, (modal, close) => {
    modal.querySelectorAll("[data-help-legal]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = button.dataset.helpLegal || "privacy";
        close();
        openLegalModal(target);
      });
    });
    modal.querySelector('[data-action="reopen-onboarding"]')?.addEventListener("click", () => {
      close();
      setTimeout(() => openOnboardingTour({ manual: true }), 0);
    });
    if (!canSubmit) return;
    modal.querySelector("#changeRequestForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const submit = event.currentTarget.querySelector('button[type="submit"]');
      submit.disabled = true;
      const data = Object.fromEntries(new FormData(event.currentTarget));
      const payload = {
        id: uid("chgreq"),
        uid: authState.user.uid,
        email: authState.user.email,
        displayName: profileName(),
        title: String(data.title || "").trim(),
        scope: String(data.scope || "App"),
        description: String(data.description || "").trim(),
        status: "offen",
        createdAt: nowIso()
      };
      try {
        if (isFirebaseMode()) {
          await setFirebaseDoc(FIRESTORE_COLLECTIONS.changeRequests, payload.id, payload, false);
          await syncStateFromFirestore();
        } else {
          state.changeRequests.unshift(payload);
          saveState();
        }
        close();
        render();
        toast("\xC4nderungsanfrage gesendet.");
      } finally {
        submit.disabled = false;
      }
    });
  });
}
function onboardingWasSeen() {
  const profileState = normalizeOnboardingState(state.onboarding);
  if (profileState.version >= ONBOARDING_VERSION && (profileState.completed || profileState.skipped)) return true;
  const localState = parseJsonStorage(ONBOARDING_SEEN_KEY, null);
  return Number(localState?.version || 0) >= ONBOARDING_VERSION && Boolean(localState?.completed || localState?.skipped);
}
async function persistOnboardingResult({ skipped = false } = {}) {
  const current = normalizeOnboardingState(state.onboarding);
  const onboarding = {
    version: ONBOARDING_VERSION,
    completed: !skipped,
    completedAt: nowIso(),
    skipped: Boolean(skipped),
    checklist: current.checklist
  };
  state.onboarding = onboarding;
  localStorage.setItem(ONBOARDING_SEEN_KEY, JSON.stringify(onboarding));
  syncCurrentUser({ onboarding });
  saveState();
  if (isFirebaseMode()) {
    await updateFirebaseProfile({ onboarding }).catch((error) => {
      reportBackgroundError("Wegleitung speichern", error, {
        notify: false,
        collection: FIRESTORE_COLLECTIONS.users
      });
    });
  }
}
async function updateOnboardingChecklist(stepKey, value = true) {
  const onboarding = normalizeOnboardingState(state.onboarding);
  onboarding.checklist = { ...onboarding.checklist, [stepKey]: Boolean(value) };
  state.onboarding = onboarding;
  localStorage.setItem(ONBOARDING_SEEN_KEY, JSON.stringify(onboarding));
  syncCurrentUser({ onboarding });
  saveState();
  if (isFirebaseMode()) {
    await updateFirebaseProfile({ onboarding }).catch((error) => reportBackgroundError("Wegleitungs-Checkliste speichern", error, {
      notify: false,
      collection: FIRESTORE_COLLECTIONS.users
    }));
  }
}
async function handleOnboardingChecklistAction(stepKey, stepAction) {
  if (stepAction === "notifications") {
    await enableNotifications().catch((error) => reportBackgroundError("Benachrichtigungen aktivieren", error, { notify: true }));
  } else if (stepAction === "install") {
    await promptQuartinautInstall();
  } else if (stepAction === "bulletin") {
    await updateOnboardingChecklist(stepKey, true);
    setRoute("bulletin");
    return;
  } else if (stepAction === "verification") {
    await updateOnboardingChecklist(stepKey, true);
    setRoute("profile");
    if (!state.profile.verified && state.profile.verificationStatus !== "pending") setTimeout(() => requestVerificationModal(), 0);
    return;
  }
  await updateOnboardingChecklist(stepKey, true);
  render();
  toast("Schritt gespeichert.");
}
function installGuidance() {
  if (isInstalledPwa()) {
    return {
      title: "Quartinaut ist bereits installiert",
      text: "Du nutzt Quartinaut schon wie eine App. Du findest sie auf deinem Startbildschirm oder im App-Men\xFC.",
      steps: []
    };
  }
  const userAgent = String(navigator.userAgent || "");
  const isIOS = /iphone|ipad|ipod/i.test(userAgent);
  const isAndroid = /android/i.test(userAgent);
  if (isIOS) {
    return {
      title: "Auf iPhone oder iPad installieren",
      text: "\xD6ffne Quartinaut m\xF6glichst in Safari.",
      steps: ["Unten auf \u201ETeilen\u201C tippen.", "\u201EZum Home-Bildschirm\u201C w\xE4hlen.", "Mit \u201EHinzuf\xFCgen\u201C best\xE4tigen."]
    };
  }
  if (isAndroid) {
    return {
      title: "Auf Android installieren",
      text: "Chrome oder Edge zeigt die Installation im Browsermen\xFC an.",
      steps: ["Browsermen\xFC (\u22EE) \xF6ffnen.", "\u201EApp installieren\u201C oder \u201EZum Startbildschirm hinzuf\xFCgen\u201C w\xE4hlen.", "Installation best\xE4tigen."]
    };
  }
  return {
    title: "Auf dem Computer installieren",
    text: "In Chrome oder Edge findest du die Installation rechts in der Adresszeile oder im Browsermen\xFC.",
    steps: ["Installationssymbol in der Adresszeile anklicken.", "Alternativ das Browsermen\xFC \xF6ffnen und \u201EQuartinaut installieren\u201C w\xE4hlen.", "Installation best\xE4tigen."]
  };
}
async function promptQuartinautInstall() {
  if (isInstalledPwa()) {
    toast("Quartinaut ist bereits installiert.");
    return;
  }
  if (!deferredInstallPrompt) {
    toast("Nutze die angezeigten Schritte deines Browsers.");
    return;
  }
  await deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  if (choice?.outcome === "accepted") {
    deferredInstallPrompt = null;
    toast("Quartinaut wird installiert.");
  }
}
function openOnboardingTour({ manual = false } = {}) {
  const install = installGuidance();
  const steps = [
    {
      icon: "home",
      eyebrow: "Willkommen",
      title: "Quartinaut geh\xF6rt zu deinem Wohnort",
      body: `<p>Deine registrierte Gemeinde bleibt mit deinem Konto verbunden. So bleiben Gesuche, Angebote und Informationen lokal und \xFCbersichtlich.</p>`
    },
    {
      icon: "need",
      eyebrow: "Startseite",
      title: "Hilfe suchen oder anbieten",
      body: `
        <p>Mit den grossen Schaltfl\xE4chen erstellst du ein Gesuch oder ein Angebot. Du bestimmst Kategorie, Reichweite und Ablaufzeit. Neue Beitr\xE4ge werden zuerst freigegeben, bevor sie \xF6ffentlich erscheinen.</p>
        <div class="onboarding-example">
          <span class="badge need">Ich brauche Hilfe</span>
          <span class="badge offer">Ich biete Hilfe</span>
        </div>`
    },
    {
      icon: "bulletin",
      eyebrow: "Schwarzes Brett",
      title: "Das digitale Schwarze Brett",
      body: `<p>\u201ESchwarzes Brett\u201C bedeutet die lokale \xDCbersicht aller aktiven Gesuche und Angebote. \xD6ffnest du einen Eintrag, kannst du die Person privat anschreiben.</p>`
    },
    {
      icon: "chat",
      eyebrow: "Privat und direkt",
      title: "Nachrichten bleiben im 1:1-Chat",
      body: `<p>Ein Chat geh\xF6rt immer zu einem konkreten Eintrag. Nur du und die andere Person k\xF6nnen die Unterhaltung lesen. Unter \u201EChats\u201C findest du sie jederzeit wieder.</p>`
    },
    {
      icon: "download",
      eyebrow: "Installation",
      title: install.title,
      body: `
        <p>${escapeHtml(install.text)}</p>
        ${install.steps.length ? `<ol class="onboarding-steps">${install.steps.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>` : ""}
        ${!isInstalledPwa() ? `<button class="secondary-button" type="button" data-onboarding-install>${iconSvg("download")} Installation starten</button>` : '<span class="badge offer">Installiert</span>'}`
    },
    {
      icon: "bell",
      eyebrow: "Benachrichtigungen",
      title: "Nur wichtige Hinweise erlauben",
      body: `
        <p>Benachrichtigungen informieren dich \xFCber private Nachrichten, passende Gesuche und lokale Alarme. Quartinaut fragt erst nach deiner Zustimmung.</p>
        <div class="onboarding-notification-state">
          <span class="badge ${notificationPermissionState() === "granted" ? "offer" : "info"}">Status: ${escapeHtml(notificationPermissionState() === "granted" ? "aktiv" : notificationPermissionState() === "denied" ? "blockiert" : "noch nicht entschieden")}</span>
        </div>
        <button class="secondary-button" type="button" data-onboarding-notifications>${iconSvg("bell")} ${notificationPermissionState() === "granted" ? "Benachrichtigungen sind aktiv" : "Benachrichtigungen erlauben"}</button>`
    }
  ];
  let stepIndex = 0;
  let resultSaved = false;
  openModal("Wegleitung", '<section class="onboarding-tour" data-onboarding-host></section>', (modal, close) => {
    const host = modal.querySelector("[data-onboarding-host]");
    modal.classList.add("onboarding-modal");
    const finish = async (options = {}) => {
      if (!manual && !resultSaved) {
        resultSaved = true;
        await persistOnboardingResult(options);
      }
      close();
      if (options.route) setRoute(options.route);
    };
    const renderStep = () => {
      const step = steps[stepIndex];
      const isLast = stepIndex === steps.length - 1;
      host.innerHTML = `
        <div class="onboarding-progress" aria-label="Schritt ${stepIndex + 1} von ${steps.length}">
          <span>Schritt ${stepIndex + 1} von ${steps.length}</span>
          <div>${steps.map((_, index) => `<i class="${index <= stepIndex ? "active" : ""}"></i>`).join("")}</div>
        </div>
        <article class="onboarding-content">
          <div class="onboarding-icon">${iconSvg(step.icon)}</div>
          <span class="eyebrow onboarding-eyebrow">${escapeHtml(step.eyebrow)}</span>
          <h3>${escapeHtml(step.title)}</h3>
          <div class="onboarding-copy">${step.body}</div>
        </article>
        <div class="onboarding-actions">
          <button class="ghost-button" type="button" data-onboarding-skip>${manual ? "Schliessen" : "\xDCberspringen"}</button>
          <div class="onboarding-actions-main">
            <button class="ghost-button" type="button" data-onboarding-back ${stepIndex === 0 ? "disabled" : ""}>Zur\xFCck</button>
            <button class="primary-button" type="button" data-onboarding-next>${isLast ? "Wegleitung abschliessen" : "Weiter"}</button>
          </div>
        </div>
      `;
      applyI18n(host);
      host.querySelector("[data-onboarding-back]")?.addEventListener("click", () => {
        stepIndex = Math.max(0, stepIndex - 1);
        renderStep();
      });
      host.querySelector("[data-onboarding-next]")?.addEventListener("click", () => {
        if (isLast) {
          void finish({ skipped: false, route: "home" });
          return;
        }
        stepIndex += 1;
        renderStep();
      });
      host.querySelector("[data-onboarding-skip]")?.addEventListener("click", () => {
        void finish({ skipped: !manual });
      });
      host.querySelector("[data-onboarding-install]")?.addEventListener("click", () => {
        runAsyncAction(promptQuartinautInstall);
      });
      host.querySelector("[data-onboarding-notifications]")?.addEventListener("click", () => {
        runAsyncAction(async () => {
          await enableNotifications();
          renderStep();
        });
      });
    };
    modal.addEventListener("modal:close", () => {
      onboardingTourScheduled = false;
      if (!manual && !resultSaved) {
        resultSaved = true;
        void persistOnboardingResult({ skipped: true });
      }
    });
    renderStep();
  });
}
function maybeShowOnboardingTour() {
  if (!authState.user || onboardingTourScheduled || onboardingWasSeen() || isAccountPendingApproval()) return;
  onboardingTourScheduled = true;
  setTimeout(() => {
    if (!authState.user || document.querySelector(".modal-backdrop")) {
      onboardingTourScheduled = false;
      return;
    }
    openOnboardingTour();
  }, 450);
}
function newRequestModal(presetType) {
  const title = presetType === "Biete" ? "Hilfe anbieten" : presetType === "Suche" ? "Hilfe suchen" : "Anliegen erfassen";
  const isCompanyAccount = state.profile.accountType === "company";
  const defaultCategory = isCompanyAccount ? "Firmen / Arbeit" : orderedCategories()[0];
  openModal(title, `
    <form id="requestForm" class="form-grid">
      <div class="form-grid two">
        <label>Typ
          <select name="type"><option ${presetType === "Suche" ? "selected" : ""}>Suche</option><option ${presetType === "Biete" ? "selected" : ""}>Biete</option></select>
        </label>
        <label>Kategorie
          <select name="category">${orderedCategories().map((cat) => `<option ${cat === defaultCategory ? "selected" : ""}>${cat}</option>`).join("")}</select>
        </label>
      </div>
      ${isCompanyAccount ? `
        <p class="help">Firmenkonto aktiv: Eintr\xE4ge werden als Firma gekennzeichnet. Nutze \u201EFirmen / Arbeit\u201C f\xFCr Mitarbeitende, Lehrstellen, lokale Dienste oder kurzfristige Arbeit.</p>
        <label>Firmen-Eintragstyp
          <select name="companyPostType">
            <option value="arbeit">Mitarbeitende gesucht</option>
            <option value="lehrstelle">Lehrstelle / Ausbildung</option>
            <option value="dienstleistung">Lokale Dienstleistung</option>
            <option value="kurzfristig">Kurzfristige Aushilfe</option>
          </select>
        </label>
      ` : ""}
      <label>Titel
        <input name="title" required minlength="4" maxlength="80" placeholder="Kurzer Titel" />
      </label>
      <label>Beschreibung
        <textarea name="text" required minlength="5" maxlength="380" placeholder="Kurz, konkret, ohne private Details."></textarea>
      </label>
      ${postPhotoField()}
      <div class="form-grid two">
        <div class="readonly-field"><strong>Gemeinde / Ort</strong><span>${escapeHtml(locationLabel())}</span></div>
        <label>Dringlichkeit
          <select name="urgency"><option>Heute</option><option>Morgen</option><option>Diese Woche</option><option>Nicht dringend</option></select>
        </label>
      </div>
      <div class="form-grid two">
        <label>Reichweite (km)
          <input name="radiusKm" type="number" min="1" max="120" step="1" value="${DEFAULT_REQUEST_RADIUS_KM}" />
        </label>
        <label>Eskalationsstufe
          <select name="escalationLevel">
            <option value="keine">Keine</option>
            <option value="P2">P2 \xB7 Beobachtung</option>
            <option value="P1">P1 \xB7 Wichtig</option>
            <option value="P0">P0 \xB7 Notfall</option>
          </select>
        </label>
      </div>
      <div class="form-grid two">
        <label>Wiederholung
          <select name="recurringMode">
            <option value="einmalig">Einmalig</option>
            <option value="woechentlich">W\xF6chentlich</option>
          </select>
        </label>
        <label class="check-row" style="grid-template-columns:auto 1fr;">
          <input type="checkbox" name="shareApproxLocation" ${state.profile.geoOptIn !== false ? "checked" : ""} />
          <span><strong>Distanz-Freigabe aktivieren</strong><small>Speichert eine ungef\xE4hre Position f\xFCr km-Filter und Reichweite.</small></span>
        </label>
      </div>
      <label class="check-row" id="anonymousOfferRow" hidden style="grid-template-columns:auto 1fr;">
        <input type="checkbox" name="anonymousOffer" />
        <span><strong>Anonym ver\xF6ffentlichen</strong><small>Bei \u201EIch biete Hilfe\u201C wird dein K\xFCrzel am Schwarzen Brett verborgen.</small></span>
      </label>
      <div id="requestQualityHints" class="card compact soft request-quality" aria-live="polite">
        <strong>Beitragsqualit\xE4t</strong>
        <p class="help">Schreibe konkret, ohne Telefonnummer oder E-Mail. Antworten laufen gesch\xFCtzt im privaten 1:1-Chat.</p>
      </div>
      <p class="help">Neue Beitr\xE4ge werden vor der Ver\xF6ffentlichung kurz gepr\xFCft. So bleibt das Schwarze Brett vertrauensw\xFCrdig.</p>
      <button class="primary-button" type="submit">${isAdminRole() ? "Direkt ver\xF6ffentlichen" : "Zur Freigabe einreichen"}</button>
    </form>
  `, (modal, close) => {
    const requestForm = modal.querySelector("#requestForm");
    mountRequestWizard(requestForm);
    nativeWeb.requestAudience(requestForm);
    const requestPhotos = mountPostPhotoPicker(requestForm, "new-request");
    const typeSelect = requestForm.querySelector('select[name="type"]');
    const anonymousOfferRow = requestForm.querySelector("#anonymousOfferRow");
    const anonymousOfferInput = requestForm.querySelector('input[name="anonymousOffer"]');
    const qualityNode = modal.querySelector("#requestQualityHints");
    function syncAnonymousToggle() {
      const isOffer = typeSelect.value === "Biete";
      anonymousOfferRow.hidden = !isOffer;
      if (!isOffer) anonymousOfferInput.checked = false;
    }
    syncAnonymousToggle();
    typeSelect.addEventListener("change", syncAnonymousToggle);
    const syncQualityHints = () => {
      if (!qualityNode) return;
      const messages = requestQualityMessages(requestForm);
      qualityNode.innerHTML = `
        <strong>Beitragsqualit\xE4t</strong>
        ${messages.length ? `<ul class="quality-list">${messages.map((message) => `<li>${escapeHtml(message)}</li>`).join("")}</ul>` : '<p class="help">Sieht gut aus. Keine \xF6ffentlichen Kontaktdaten, genug Kontext und klare Dringlichkeit.</p>'}
      `;
    };
    requestForm.querySelectorAll("input, textarea, select").forEach((input) => input.addEventListener("input", syncQualityHints));
    requestForm.querySelectorAll("select").forEach((input) => input.addEventListener("change", syncQualityHints));
    syncQualityHints();
    requestForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submit = event.currentTarget.querySelector('button[type="submit"]');
      submit.disabled = true;
      const data = Object.fromEntries(new FormData(event.currentTarget));
      const photoModel = await requestPhotos;
      await photoModel.ready;
      if (await nativeWeb.createRegional(requestForm, data, photoModel, close)) return;
      const type = String(data.type || "Suche");
      const shareApproxLocation = Boolean(data.shareApproxLocation);
      const requestGeo = shareApproxLocation ? await ensureViewerGeo({ force: true, silent: true }) : null;
      const radiusRaw = Number(data.radiusKm);
      const radiusKm = Number.isFinite(radiusRaw) ? Math.min(120, Math.max(1, Math.round(radiusRaw))) : DEFAULT_REQUEST_RADIUS_KM;
      const anonymousOffer = type === "Biete" && Boolean(data.anonymousOffer);
      const requestArea = locationLabel();
      const publicationStatus = isAdminRole() ? "offen" : "wartet_freigabe";
      const ownerUid = authState.user?.uid, ownerEpoch = accountEpoch;
      requestForm.dataset.v47OpId ||= uid("req");
      requestForm.dataset.v47CreatedAt ||= nowIso();
      saveFormDraft(requestForm, draftKey(requestForm));
      const createdAt = requestForm.dataset.v47CreatedAt;
      const payload = {
        id: requestForm.dataset.v47OpId,
        tenantId: "quartinaut",
        uid: authState.user.uid,
        authorId: authState.user.uid,
        type,
        category: String(data.category || "Alltagshilfe"),
        title: String(data.title || "").trim(),
        text: String(data.text || "").trim(),
        urgency: String(data.urgency || "Heute"),
        area: requestArea,
        areaKey: normalizeAreaKey(requestArea),
        cantonCode: currentCantonCode(),
        author: anonymousOffer ? "Anonym" : state.profile.initials || "ICH",
        authorName: profileName(),
        authorRole: authState.user.role || state.profile.role || "resident",
        authorVerified: Boolean(state.profile.verified),
        authorVerificationStatus: state.profile.verificationStatus || "none",
        authorVerificationLabel: state.profile.verificationLabel || "",
        authorAccountType: state.profile.accountType || "resident",
        companyName: state.profile.accountType === "company" ? companyNameForProfile() : "",
        companyStatus: state.profile.companyStatus || "",
        companyPostType: state.profile.accountType === "company" ? String(data.companyPostType || "arbeit") : "",
        municipalityName: state.profile.accountType === "municipality" ? state.profile.municipalityName || state.profile.area || "" : "",
        municipalityStatus: state.profile.municipalityStatus || "",
        anonymousOffer,
        radiusKm,
        audienceLevel: "canton",
        geo: requestGeo,
        status: publicationStatus,
        submittedAt: createdAt,
        approvedAt: publicationStatus === "offen" ? createdAt : "",
        approvedBy: publicationStatus === "offen" ? profileName() : "",
        rejectedAt: "",
        rejectedBy: "",
        rejectionReason: "",
        resubmittedAt: "",
        reports: 0,
        escalationLevel: String(data.escalationLevel || "keine"),
        recurringMode: String(data.recurringMode || "einmalig"),
        createdAt,
        expiresAt: expiryForUrgency(data.urgency)
      };
      try {
        state.profile.geoOptIn = shareApproxLocation;
        if (photoModel.selected.length) payload.photoPaths = await uploadPostPhotos("requests", payload.id, photoModel.selected);
        if (!currentAccountEpoch(ownerUid, ownerEpoch)) throw new Error("Konto gewechselt; der Entwurf bleibt erhalten.");
        if (isFirebaseMode()) {
          await setFirebaseDoc(FIRESTORE_COLLECTIONS.requests, payload.id, payload, false);
          if (!currentAccountEpoch(ownerUid, ownerEpoch)) return;
          await syncStateFromFirestore();
          if (!currentAccountEpoch(ownerUid, ownerEpoch)) return;
        } else {
          state.requests.unshift(payload);
          saveState();
        }
        addChange(`Neues Anliegen erstellt: ${data.title}`);
        requestForm.dataset.photoSaved = "yes";
        close(true);
        setRoute(publicationStatus === "offen" ? "bulletin" : "home");
        toast(publicationStatus === "offen" ? "Anliegen ver\xF6ffentlicht." : "Anliegen zur Freigabe eingereicht.");
      } catch (error) {
        const message = actionErrorMessage(error, "Beitrag konnte nicht mit Fotos gespeichert werden.");
        postPhotoStatus(requestForm, message, true);
        toast(message);
      } finally {
        submit.disabled = false;
      }
    });
  });
}
function editRequestModal(id) {
  if (id.startsWith("arq_")) {
    nativeWeb.edit(id, "requests");
    return;
  }
  const req = state.requests.find((item) => item.id === id);
  if (!req) return;
  const canEdit = isAdminRole() || requestOwnerUid(req) === authState.user?.uid;
  if (!canEdit) throw new Error("Du kannst nur eigene Inserate bearbeiten.");
  const isCompanyRequest = req.authorAccountType === "company";
  openModal("Inserat bearbeiten", `
    <form id="editRequestForm" class="form-grid">
      <div class="form-grid two">
        <label>Typ
          <select name="type">
            <option ${req.type === "Suche" ? "selected" : ""}>Suche</option>
            <option ${req.type === "Biete" ? "selected" : ""}>Biete</option>
          </select>
        </label>
        <label>Kategorie
          <select name="category">${orderedCategories().map((cat) => `<option ${cat === req.category ? "selected" : ""}>${escapeHtml(cat)}</option>`).join("")}</select>
        </label>
      </div>
      ${isCompanyRequest ? `
        <label>Firmen-Eintragstyp
          <select name="companyPostType">
            <option value="arbeit" ${req.companyPostType === "arbeit" ? "selected" : ""}>Mitarbeitende gesucht</option>
            <option value="lehrstelle" ${req.companyPostType === "lehrstelle" ? "selected" : ""}>Lehrstelle / Ausbildung</option>
            <option value="dienstleistung" ${req.companyPostType === "dienstleistung" ? "selected" : ""}>Lokale Dienstleistung</option>
            <option value="kurzfristig" ${req.companyPostType === "kurzfristig" ? "selected" : ""}>Kurzfristige Aushilfe</option>
          </select>
        </label>
      ` : ""}
      <label>Titel
        <input name="title" required minlength="4" maxlength="80" value="${escapeHtml(req.title)}" />
      </label>
      <label>Beschreibung
        <textarea name="text" required minlength="5" maxlength="380">${escapeHtml(req.text)}</textarea>
      </label>
      ${postPhotoField()}
      <div class="form-grid two">
        <div class="readonly-field"><strong>Gemeinde / Ort</strong><span>${escapeHtml(req.area || locationLabel())}</span></div>
        <label>Dringlichkeit
          <select name="urgency">
            ${["Heute", "Morgen", "Diese Woche", "Nicht dringend"].map((value) => `<option ${value === req.urgency ? "selected" : ""}>${value}</option>`).join("")}
          </select>
        </label>
      </div>
      <div class="form-grid two">
        <label>Reichweite (km)
          <input name="radiusKm" type="number" min="1" max="120" step="1" value="${escapeHtml(requestRadiusKm(req) || DEFAULT_REQUEST_RADIUS_KM)}" />
        </label>
        <label>Eskalationsstufe
          <select name="escalationLevel">
            <option value="keine" ${req.escalationLevel === "keine" ? "selected" : ""}>Keine</option>
            <option value="P2" ${req.escalationLevel === "P2" ? "selected" : ""}>P2 \xB7 Beobachtung</option>
            <option value="P1" ${req.escalationLevel === "P1" ? "selected" : ""}>P1 \xB7 Wichtig</option>
            <option value="P0" ${req.escalationLevel === "P0" ? "selected" : ""}>P0 \xB7 Notfall</option>
          </select>
        </label>
      </div>
      <div class="form-grid two">
        <label>Wiederholung
          <select name="recurringMode">
            <option value="einmalig" ${req.recurringMode !== "woechentlich" ? "selected" : ""}>Einmalig</option>
            <option value="woechentlich" ${req.recurringMode === "woechentlich" ? "selected" : ""}>W\xF6chentlich</option>
          </select>
        </label>
        <label class="check-row" id="editAnonymousOfferRow" style="grid-template-columns:auto 1fr;">
          <input type="checkbox" name="anonymousOffer" ${req.anonymousOffer ? "checked" : ""} />
          <span><strong>Anonym ver\xF6ffentlichen</strong><small>Nur f\xFCr \u201EIch biete Hilfe\u201C.</small></span>
        </label>
      </div>
      <p class="help">Standort und Ersteller bleiben fix. \xC4nderungen sind nur am Inhalt, Status und Ablauf des Inserats m\xF6glich.</p>
      ${!isAdminRole() ? '<p class="help">Nach dem Speichern wird der Beitrag erneut gepr\xFCft, bevor er \xF6ffentlich sichtbar ist.</p>' : ""}
      <p id="editRequestError" class="form-error" role="alert"></p>
      <button class="primary-button" type="submit">\xC4nderungen speichern</button>
    </form>
  `, (modal, close) => {
    const form = modal.querySelector("#editRequestForm");
    const editPhotos = mountPostPhotoPicker(form, req.id, req.photoPaths);
    const typeSelect = form.querySelector('select[name="type"]');
    const anonymousRow = form.querySelector("#editAnonymousOfferRow");
    const anonymousInput = form.querySelector('input[name="anonymousOffer"]');
    const syncAnonymous = () => {
      const isOffer = typeSelect.value === "Biete";
      anonymousRow.hidden = !isOffer;
      if (!isOffer) anonymousInput.checked = false;
    };
    syncAnonymous();
    typeSelect.addEventListener("change", syncAnonymous);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      const errorNode = modal.querySelector("#editRequestError");
      submit.disabled = true;
      if (errorNode) errorNode.textContent = "";
      try {
        const data = Object.fromEntries(new FormData(form));
        const radiusRaw = Number(data.radiusKm);
        const radiusKm = Number.isFinite(radiusRaw) ? Math.min(120, Math.max(1, Math.round(radiusRaw))) : DEFAULT_REQUEST_RADIUS_KM;
        const type = String(data.type || req.type || "Suche");
        const nextStatus = isAdminRole() ? req.status || "offen" : "wartet_freigabe";
        const updates = {
          type,
          category: String(data.category || req.category || "Alltagshilfe"),
          title: String(data.title || "").trim(),
          text: String(data.text || "").trim(),
          urgency: String(data.urgency || req.urgency || "Heute"),
          radiusKm,
          escalationLevel: String(data.escalationLevel || "keine"),
          recurringMode: String(data.recurringMode || "einmalig"),
          anonymousOffer: type === "Biete" && Boolean(data.anonymousOffer),
          author: type === "Biete" && Boolean(data.anonymousOffer) ? "Anonym" : state.profile.initials || req.author || "ICH",
          status: nextStatus,
          resubmittedAt: !isAdminRole() ? nowIso() : req.resubmittedAt || "",
          rejectedAt: !isAdminRole() ? "" : req.rejectedAt || "",
          rejectedBy: !isAdminRole() ? "" : req.rejectedBy || "",
          rejectionReason: !isAdminRole() ? "" : req.rejectionReason || "",
          approvedAt: !isAdminRole() ? "" : req.approvedAt || "",
          approvedBy: !isAdminRole() ? "" : req.approvedBy || "",
          updatedAt: nowIso()
        };
        if (!updates.title || !updates.text) throw new Error("Titel und Beschreibung d\xFCrfen nicht leer sein.");
        const photoModel = await editPhotos;
        await photoModel.ready;
        const more = await uploadPostPhotos("requests", req.id + "-edit" + Date.now(), photoModel.selected);
        updates.photoPaths = [...photoModel.existing, ...more];
        if (isCompanyRequest) updates.companyPostType = String(data.companyPostType || req.companyPostType || "arbeit");
        const removedPhotoPaths = validPostPhotoPaths(req.photoPaths).filter((path) => !updates.photoPaths.includes(path));
        Object.assign(req, updates);
        if (isFirebaseMode()) {
          await setFirebaseDoc(FIRESTORE_COLLECTIONS.requests, req.id, updates, true);
          await syncStateFromFirestore();
          if (removedPhotoPaths.length) void removeOwnedPostPhotos(removedPhotoPaths);
        } else {
          saveState();
        }
        form.dataset.photoSaved = "yes";
        close();
        render();
        toast(isAdminRole() ? "Inserat aktualisiert." : "Inserat aktualisiert und erneut zur Freigabe eingereicht.");
      } catch (error) {
        const message = actionErrorMessage(error, "Inserat konnte nicht gespeichert werden.");
        if (errorNode) errorNode.textContent = message;
        toast(message);
      } finally {
        submit.disabled = false;
      }
    });
  });
}
function safeDocPart(value = "") {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "x";
}
function requestOwnerUid(req = {}) {
  return req.uid || req.authorId || "";
}
function chatIdForRequest(req, peerUid) {
  const participants = [authState.user.uid, peerUid].sort();
  return `chat_${safeDocPart(req.id)}_${participants.map(safeDocPart).join("_")}`;
}
function peerLabelFromUid(uidValue) {
  if (uidValue === authState.user?.uid) return profileName();
  const user = state.registeredUsers.find((item) => item.uid === uidValue);
  return user?.displayName || user?.companyName || user?.email || "Nutzer/in";
}
function requestChats(reqId) {
  hydrateChatsFromMessages(state.chatMessages);
  return state.chats.filter((chat) => chat.requestId === reqId && isChatVisibleForUser(chat)).sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
}
function directChatForRequest(req = {}) {
  const ownerUid = requestOwnerUid(req);
  if (!ownerUid || !authState.user?.uid || ownerUid === authState.user.uid) return null;
  const chatId = chatIdForRequest(req, ownerUid);
  return state.chats.find((chat) => chat.id === chatId) || null;
}
function chatMessagesFor(chatId) {
  return state.chatMessages.filter((msg) => msg.chatId === chatId).sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
}
function chatReadAt(chat, uidValue = authState.user?.uid) {
  return normalizeStoredDate(chat?.readBy?.[uidValue]) || "";
}
function chatUserMap(chat, field) {
  return chat?.[field] && typeof chat[field] === "object" && !Array.isArray(chat[field]) ? chat[field] : {};
}
function currentUserCanSeeChat(chat, uidValue = authState.user?.uid) {
  if (!chat || !uidValue) return false;
  return chat.participants?.includes(uidValue) || chat.requestOwnerUid === uidValue;
}
function chatTrashedAt(chat, uidValue = authState.user?.uid) {
  if (!uidValue) return "";
  return normalizeStoredDate(chatUserMap(chat, "trashedBy")[uidValue]) || "";
}
function chatPurgedAt(chat, uidValue = authState.user?.uid) {
  if (!uidValue) return "";
  return normalizeStoredDate(chatUserMap(chat, "purgedBy")[uidValue]) || "";
}
function isChatPurgedForUser(chat, uidValue = authState.user?.uid) {
  return Boolean(chatPurgedAt(chat, uidValue));
}
function isChatTrashedForUser(chat, uidValue = authState.user?.uid) {
  return Boolean(chatTrashedAt(chat, uidValue)) && !isChatPurgedForUser(chat, uidValue);
}
function isChatVisibleForUser(chat, uidValue = authState.user?.uid) {
  return currentUserCanSeeChat(chat, uidValue) && !isChatTrashedForUser(chat, uidValue) && !isChatPurgedForUser(chat, uidValue);
}
function isChatInTrashForUser(chat, uidValue = authState.user?.uid) {
  return currentUserCanSeeChat(chat, uidValue) && isChatTrashedForUser(chat, uidValue);
}
function chatTrashExpiresAt(chat, uidValue = authState.user?.uid) {
  const trashedAt = chatTrashedAt(chat, uidValue);
  if (!trashedAt) return "";
  const timestamp = new Date(trashedAt).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp + CHAT_TRASH_RETENTION_MS).toISOString() : "";
}
function chatTrashDaysLeft(chat, uidValue = authState.user?.uid) {
  const expiresAt = chatTrashExpiresAt(chat, uidValue);
  if (!expiresAt) return CHAT_TRASH_RETENTION_DAYS;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 864e5));
}
function chatTrashLabel(chat, uidValue = authState.user?.uid) {
  const days = chatTrashDaysLeft(chat, uidValue);
  if (days <= 0) return "wird gel\xF6scht";
  if (days === 1) return "l\xF6scht morgen";
  return `l\xF6scht in ${days} Tg.`;
}
function chatHasUnread(chat, uidValue = authState.user?.uid) {
  if (!chat || !uidValue) return false;
  if (!isChatVisibleForUser(chat, uidValue)) return false;
  if (!chat.lastMessageAt || chat.lastSenderUid === uidValue) return false;
  const lastMessage = new Date(chat.lastMessageAt).getTime();
  const readAt = new Date(chatReadAt(chat, uidValue) || 0).getTime();
  return Number.isFinite(lastMessage) && lastMessage > (Number.isFinite(readAt) ? readAt : 0);
}
function unreadChatCount() {
  return state.chats.filter((chat) => isChatVisibleForUser(chat) && chatHasUnread(chat)).length;
}
function upsertChatState(chat) {
  if (!chat?.id) return chat;
  const normalized = normalizeChatDoc(chat);
  state.chats = [
    normalized,
    ...state.chats.filter((item) => item.id !== normalized.id)
  ].sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
  return normalized;
}
function upsertChatMessages(chatId, messages = []) {
  const incoming = messages.map(normalizeChatMessage).filter((msg) => msg.chatId === chatId && msg.id);
  const otherMessages = state.chatMessages.filter((msg) => msg.chatId !== chatId);
  const chatMessages = new Map(
    state.chatMessages.filter((msg) => msg.chatId === chatId && msg.id).map((msg) => [msg.id, msg])
  );
  incoming.forEach((msg) => {
    chatMessages.set(msg.id, { ...chatMessages.get(msg.id) || {}, ...msg });
  });
  state.chatMessages = [
    ...otherMessages,
    ...chatMessages.values()
  ].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  hydrateChatsFromMessages(incoming);
}
function chatFromMessage(msg = {}) {
  if (!msg.chatId) return null;
  const existing = state.chats.find((chat) => chat.id === msg.chatId) || {};
  const req = requestById(msg.requestId) || {};
  const viewerOwnsRequest = msg.requestOwnerUid === authState.user?.uid;
  const rawParticipants = Array.isArray(msg.participants) ? msg.participants : [];
  let participants = normalizedChatParticipants({ participants: rawParticipants.length ? rawParticipants : existing.participants });
  if (viewerOwnsRequest && (participants.length !== 2 || !participants.includes(authState.user?.uid))) {
    participants = normalizedChatParticipants({ participants: [msg.senderUid, authState.user.uid] });
  }
  if (participants.length !== 2 || !participants.includes(authState.user?.uid) && !viewerOwnsRequest) return null;
  const participantLabels = {
    ...existing.participantLabels || {},
    ...msg.participantLabels || {}
  };
  participants.forEach((uidValue) => {
    if (!participantLabels[uidValue]) {
      participantLabels[uidValue] = uidValue === authState.user?.uid ? profileName() : peerLabelFromUid(uidValue);
    }
  });
  const existingTime = new Date(existing.lastMessageAt || existing.createdAt || 0).getTime();
  const messageTime = new Date(msg.createdAt || 0).getTime();
  const messageIsNewest = !Number.isFinite(existingTime) || Number.isFinite(messageTime) && messageTime >= existingTime;
  return normalizeChatDoc({
    ...existing,
    id: msg.chatId,
    requestId: existing.requestId || msg.requestId || req.id || "",
    requestTitle: existing.requestTitle || msg.requestTitle || req.title || "Privater Chat",
    requestOwnerUid: existing.requestOwnerUid || msg.requestOwnerUid || requestOwnerUid(req) || "",
    participants,
    participantLabels,
    mutedBy: existing.mutedBy || [],
    readBy: existing.readBy || {},
    createdAt: existing.createdAt || msg.createdAt || nowIso(),
    lastMessageAt: messageIsNewest ? msg.createdAt : existing.lastMessageAt,
    lastMessagePreview: messageIsNewest ? msg.text || existing.lastMessagePreview || "" : existing.lastMessagePreview || "",
    lastSenderUid: messageIsNewest ? msg.senderUid || existing.lastSenderUid || "" : existing.lastSenderUid || ""
  });
}
function hydrateChatsFromMessages(messages = []) {
  const latestByChat = /* @__PURE__ */ new Map();
  messages.map(normalizeChatMessage).filter((msg) => msg.chatId && (msg.participants?.includes(authState.user?.uid) || msg.requestOwnerUid === authState.user?.uid)).forEach((msg) => {
    const current = latestByChat.get(msg.chatId);
    if (!current || new Date(msg.createdAt || 0) > new Date(current.createdAt || 0)) {
      latestByChat.set(msg.chatId, msg);
    }
  });
  latestByChat.forEach((msg) => {
    const chat = chatFromMessage(msg);
    if (chat) upsertChatState(chat);
  });
}
function isChatMuted(chat, uidValue = authState.user?.uid) {
  return Array.isArray(chat?.mutedBy) && chat.mutedBy.includes(uidValue);
}
function chatPeerUid(chat) {
  return (chat.participants || []).find((uidValue) => uidValue !== authState.user?.uid) || "";
}
function normalizedChatParticipants(chat = {}) {
  return [...new Set((Array.isArray(chat.participants) ? chat.participants : []).filter(Boolean))].sort();
}
function chatPeerLabel(chat) {
  const peerUid = chatPeerUid(chat);
  return chat.participantLabels?.[peerUid] || peerLabelFromUid(peerUid);
}
function chatCreatePayload(chat, req = requestById(chat.requestId) || {}) {
  const normalizedParticipants = normalizedChatParticipants(chat);
  const participants = normalizedParticipants.length === 2 ? normalizedParticipants : [authState.user?.uid, chatPeerUid(chat)].filter(Boolean).sort();
  return {
    id: chat.id,
    requestId: chat.requestId || req.id || "",
    requestTitle: chat.requestTitle || req.title || "Direktvermittlung",
    requestOwnerUid: chat.requestOwnerUid || requestOwnerUid(req),
    participants,
    participantLabels: chat.participantLabels || {},
    mutedBy: Array.isArray(chat.mutedBy) ? chat.mutedBy : [],
    readBy: chat.readBy && typeof chat.readBy === "object" ? chat.readBy : {},
    createdAt: chat.createdAt || nowIso(),
    lastMessageAt: chat.lastMessageAt || chat.createdAt || nowIso(),
    lastMessagePreview: chat.lastMessagePreview || "",
    lastSenderUid: chat.lastSenderUid || ""
  };
}
async function ensureChatDocument(chat) {
  if (!isFirebaseMode()) return chat;
  const { db, doc, getDoc } = firebaseStoreApi;
  const ref = doc(db, FIRESTORE_COLLECTIONS.chats, chat.id);
  try {
    const snapshot = await getDoc(ref);
    if (snapshot.exists()) {
      const normalized = normalizeChatDoc({ id: chat.id, ...snapshot.data() });
      const labels = { ...normalized.participantLabels || {} };
      let labelsChanged = false;
      for (const uidValue of normalized.participants) {
        if (!labels[uidValue]) {
          labels[uidValue] = uidValue === authState.user?.uid ? profileName() : peerLabelFromUid(uidValue);
          labelsChanged = true;
        }
      }
      normalized.participantLabels = labels;
      Object.assign(chat, normalized);
      upsertChatState(chat);
      if (labelsChanged) {
        await setFirebaseDoc(FIRESTORE_COLLECTIONS.chats, chat.id, { participantLabels: labels, updatedAt: nowIso() }, true).catch((error) => reportBackgroundError("Chat-Teilnehmerlabels synchronisieren", error));
      }
      return chat;
    }
  } catch (error) {
    const raw = String(error?.code || error?.message || "");
    if (!raw.includes("permission-denied") && !raw.includes("Missing or insufficient permissions")) {
      throw error;
    }
    reportBackgroundError("Chat-Vorabpr\xFCfung \xFCberspringen", error);
  }
  const payload = { ...chatCreatePayload(chat), updatedAt: nowIso() };
  if (!payload.requestId || !payload.requestOwnerUid || payload.participants.length !== 2) {
    throw new Error("Chat konnte nicht vorbereitet werden. Bitte Anliegen neu \xF6ffnen.");
  }
  await setFirebaseDoc(FIRESTORE_COLLECTIONS.chats, chat.id, payload, true);
  Object.assign(chat, payload);
  upsertChatState(chat);
  saveState();
  return chat;
}
async function markChatThreadRead(chat) {
  if (!authState.user?.uid || !chat?.id) return;
  const readAt = nowIso();
  chat.readBy = { ...chat.readBy || {}, [authState.user.uid]: readAt };
  const existing = state.chats.find((item) => item.id === chat.id);
  if (existing) existing.readBy = { ...existing.readBy || {}, [authState.user.uid]: readAt };
  saveState();
  updateNavBadges();
  if (isFirebaseMode()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.chats, chat.id, { readBy: { [authState.user.uid]: readAt }, updatedAt: readAt }, true).catch((error) => reportBackgroundError("Chat-Lesestatus synchronisieren", error));
  }
}
async function toggleChatMute(chatId, options = {}) {
  const { rerender = true } = options;
  const chat = state.chats.find((item) => item.id === chatId);
  if (!chat || !authState.user?.uid) return;
  const muted = isChatMuted(chat);
  const nextMutedBy = muted ? (chat.mutedBy || []).filter((uidValue) => uidValue !== authState.user.uid) : [.../* @__PURE__ */ new Set([...chat.mutedBy || [], authState.user.uid])];
  chat.mutedBy = nextMutedBy;
  saveState();
  if (isFirebaseMode()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.chats, chat.id, { mutedBy: nextMutedBy, updatedAt: nowIso() }, true);
  }
  if (rerender) render();
  else updateNavBadges();
  toast(muted ? "Chat-Benachrichtigungen aktiviert." : "Chat stumm geschaltet.");
}
function updateLocalChatUserVisibility(chatId, updates = {}, uidValue = authState.user?.uid) {
  const chat = state.chats.find((item) => item.id === chatId);
  if (!chat || !uidValue) return null;
  chat.trashedBy = { ...chat.trashedBy || {} };
  chat.purgedBy = { ...chat.purgedBy || {} };
  if (Object.prototype.hasOwnProperty.call(updates, "trashedAt")) {
    if (updates.trashedAt) chat.trashedBy[uidValue] = updates.trashedAt;
    else delete chat.trashedBy[uidValue];
  }
  if (Object.prototype.hasOwnProperty.call(updates, "purgedAt")) {
    if (updates.purgedAt) chat.purgedBy[uidValue] = updates.purgedAt;
    else delete chat.purgedBy[uidValue];
  }
  chat.updatedAt = nowIso();
  return chat;
}
async function updateFirebaseChatUserVisibility(chatId, updates = {}) {
  if (!isFirebaseMode() || !authState.user?.uid || !firebaseStoreApi) return;
  const { db, doc, updateDoc, deleteField } = firebaseStoreApi;
  const payload = { updatedAt: nowIso() };
  const uidValue = authState.user.uid;
  if (Object.prototype.hasOwnProperty.call(updates, "trashedAt")) {
    payload[`trashedBy.${uidValue}`] = updates.trashedAt || deleteField();
  }
  if (Object.prototype.hasOwnProperty.call(updates, "purgedAt")) {
    payload[`purgedBy.${uidValue}`] = updates.purgedAt || deleteField();
  }
  await updateDoc(doc(db, FIRESTORE_COLLECTIONS.chats, chatId), payload);
}
function clearLocalChatTrashForParticipants(chat, participants = chat?.participants || []) {
  if (!chat) return;
  chat.trashedBy = { ...chat.trashedBy || {} };
  chat.purgedBy = { ...chat.purgedBy || {} };
  participants.filter(Boolean).forEach((uidValue) => {
    delete chat.trashedBy[uidValue];
    delete chat.purgedBy[uidValue];
  });
}
async function clearFirebaseChatTrashForParticipants(chatId, participants = []) {
  if (!isFirebaseMode() || !firebaseStoreApi || !participants.length) return;
  const { db, doc, updateDoc, deleteField } = firebaseStoreApi;
  const payload = { updatedAt: nowIso() };
  participants.filter(Boolean).forEach((uidValue) => {
    payload[`trashedBy.${uidValue}`] = deleteField();
    payload[`purgedBy.${uidValue}`] = deleteField();
  });
  await updateDoc(doc(db, FIRESTORE_COLLECTIONS.chats, chatId), payload);
}
async function moveChatToTrash(chatId, options = {}) {
  const { rerender = true } = options;
  if (!authState.user?.uid) return;
  const trashedAt = nowIso();
  const chat = updateLocalChatUserVisibility(chatId, { trashedAt, purgedAt: null });
  if (!chat) throw new Error("Chat nicht gefunden.");
  saveState();
  if (isFirebaseMode()) {
    await updateFirebaseChatUserVisibility(chatId, { trashedAt, purgedAt: null });
  }
  state.chatView = "trash";
  saveState();
  if (rerender) render();
  toast("Chat in den Papierkorb verschoben.");
}
async function restoreChatFromTrash(chatId) {
  if (!authState.user?.uid) return;
  const chat = updateLocalChatUserVisibility(chatId, { trashedAt: null, purgedAt: null });
  if (!chat) throw new Error("Chat nicht gefunden.");
  saveState();
  if (isFirebaseMode()) {
    await updateFirebaseChatUserVisibility(chatId, { trashedAt: null, purgedAt: null });
  }
  state.chatView = "active";
  saveState();
  render();
  toast("Chat wiederhergestellt.");
}
async function purgeChatForCurrentUser(chatId) {
  if (!authState.user?.uid) return;
  const purgedAt = nowIso();
  const chat = updateLocalChatUserVisibility(chatId, { trashedAt: null, purgedAt });
  if (!chat) throw new Error("Chat nicht gefunden.");
  saveState();
  if (isFirebaseMode()) {
    await updateFirebaseChatUserVisibility(chatId, { trashedAt: null, purgedAt });
  }
  render();
  toast("Chat endg\xFCltig aus deiner Ansicht entfernt.");
}
async function pruneExpiredChatTrash() {
  const uidValue = authState.user?.uid;
  if (!uidValue) return;
  const runKey = `${uidValue}:${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`;
  if (chatTrashPruneKey === runKey) return;
  chatTrashPruneKey = runKey;
  const now = Date.now();
  const expiredChats = state.chats.filter((chat) => {
    if (!isChatInTrashForUser(chat, uidValue)) return false;
    const expiresAt = chatTrashExpiresAt(chat, uidValue);
    return expiresAt && new Date(expiresAt).getTime() <= now;
  });
  if (!expiredChats.length) return;
  const purgedAt = nowIso();
  expiredChats.forEach((chat) => updateLocalChatUserVisibility(chat.id, { trashedAt: null, purgedAt }, uidValue));
  saveState();
  if (isFirebaseMode()) {
    await Promise.all(expiredChats.map((chat) => updateFirebaseChatUserVisibility(chat.id, { trashedAt: null, purgedAt }).catch((error) => reportBackgroundError("Abgelaufenen Chat-Papierkorb bereinigen", error))));
  }
}
function upsertLocalChatMessage(message) {
  if (!message?.id || !message.chatId) return null;
  const normalized = normalizeChatMessage(message);
  state.chatMessages = [
    ...state.chatMessages.filter((msg) => msg.id !== normalized.id),
    normalized
  ].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  return normalized;
}
function setLocalMessageDeliveryStatus(chatId, messageId, deliveryStatus) {
  const msg = state.chatMessages.find((item) => item.id === messageId && item.chatId === chatId);
  if (!msg) return null;
  msg.deliveryStatus = deliveryStatus;
  return msg;
}
function refreshOpenChatThread(chat, options = {}) {
  const { scrollBottom = false } = options;
  const box = byId("chatThreadBox");
  if (!box || !chat?.id) return;
  box.innerHTML = renderChatMessages(chat);
  bindAppointmentActions(chat, box);
  bindChatRetryActions(chat, box);
  if (scrollBottom) box.scrollTop = box.scrollHeight;
}
function ownMessageStatusHtml(msg) {
  if (msg.readAt) return ` \xB7 gelesen ${escapeHtml(fmtTime(msg.readAt))}`;
  if (msg.deliveryStatus === "pending") return " \xB7 wird gesendet ...";
  if (msg.deliveryStatus === "failed") {
    return ` \xB7 <button class="message-status-button" type="button" data-action="retry-chat-message" data-message-id="${escapeHtml(msg.id)}">fehlgeschlagen - erneut senden</button>`;
  }
  return " \xB7 gesendet";
}
function renderChatMessages(chat, messages = chatMessagesFor(chat.id)) {
  if (!messages.length) {
    return '<div class="empty" style="min-height:120px;">Noch keine private Nachricht. Starte den Chat.</div>';
  }
  return messages.map((msg, index, list) => {
    const mine = msg.senderUid === authState.user?.uid;
    const label = mine ? "Du" : chat.participantLabels?.[msg.senderUid] || peerLabelFromUid(msg.senderUid);
    const readState = mine ? ownMessageStatusHtml(msg) : "";
    const previous = list[index - 1];
    const next = list[index + 1];
    const groupedBefore = previous?.senderUid === msg.senderUid && previous?.messageType === msg.messageType;
    const groupedAfter = next?.senderUid === msg.senderUid && next?.messageType === msg.messageType;
    const messageClass = [mine ? "me" : "", groupedBefore ? "grouped-before" : "", groupedAfter ? "grouped-after" : ""].filter(Boolean).join(" ");
    if (msg.messageType === "appointment") {
      return renderAppointmentMessage(chat, msg, mine, label, readState, messageClass);
    }
    return `<div class="message ${messageClass}"><span>${escapeHtml(msg.text)}</span><small>${escapeHtml(label)} \xB7 ${fmtTime(msg.createdAt)}${readState} \xB7 <button class="message-status-button" type="button" data-action="translate-dynamic" data-translate-kind="chat-message" data-translate-id="${escapeHtml(msg.id)}">\xFCbersetzen</button></small></div>`;
  }).join("");
}
function formatAppointmentDate(value = "") {
  if (!value) return "Termin offen";
  try {
    return new Date(value).toLocaleString("de-CH", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return String(value);
  }
}
function appointmentStatusLabel(status = "proposed") {
  if (status === "accepted") return "best\xE4tigt";
  if (status === "declined") return "abgesagt";
  return "vorgeschlagen";
}
function renderAppointmentMessage(chat, msg, mine, label, readState = "", messageClass = "") {
  const appointment = msg.appointment || {};
  const canDecide = !mine && appointment.status === "proposed" && msg.recipientUid === authState.user?.uid;
  return `
    <div class="message appointment-message ${messageClass}">
      <strong>Termin ${escapeHtml(appointmentStatusLabel(appointment.status))}</strong>
      <span>${escapeHtml(formatAppointmentDate(appointment.startsAt))}</span>
      ${appointment.place ? `<span>Ort: ${escapeHtml(appointment.place)}</span>` : ""}
      ${appointment.note ? `<span>${escapeHtml(appointment.note)}</span>` : ""}
      <small>${escapeHtml(label)} \xB7 ${fmtTime(msg.createdAt)}${readState}</small>
      ${canDecide ? `
        <div class="row-actions appointment-actions">
          <button class="success-button small" data-action="appointment-decision" data-message-id="${escapeHtml(msg.id)}" data-status="accepted">Best\xE4tigen</button>
          <button class="danger-button small" data-action="appointment-decision" data-message-id="${escapeHtml(msg.id)}" data-status="declined">Absagen</button>
        </div>
      ` : ""}
    </div>
  `;
}
async function persistOutgoingChatMessage(chat, message, options = {}) {
  const { failureText = "Nachricht konnte nicht gespeichert werden." } = options;
  const ownerUid = authState.user?.uid, ownerEpoch = accountEpoch;
  if (!currentAccountEpoch(ownerUid, ownerEpoch)) throw new Error("Konto gewechselt; Nachricht nicht gesendet.");
  const sentMessage = { ...message, deliveryStatus: "sent" };
  if (!isFirebaseMode()) {
    setLocalMessageDeliveryStatus(chat.id, message.id, "sent");
    saveState();
    refreshOpenChatThread(chat, { scrollBottom: true });
    return sentMessage;
  }
  try {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.chatMessages, message.id, sentMessage, false);
    if (!currentAccountEpoch(ownerUid, ownerEpoch)) return sentMessage;
  } catch (error) {
    if (!currentAccountEpoch(ownerUid, ownerEpoch)) throw error;
    setLocalMessageDeliveryStatus(chat.id, message.id, "failed");
    saveState();
    refreshOpenChatThread(chat, { scrollBottom: true });
    toast(failureText);
    throw error;
  }
  setLocalMessageDeliveryStatus(chat.id, message.id, "sent");
  saveState();
  refreshOpenChatThread(chat, { scrollBottom: true });
  await setFirebaseDoc(FIRESTORE_COLLECTIONS.chats, chat.id, {
    lastMessageAt: chat.lastMessageAt,
    lastMessagePreview: chat.lastMessagePreview,
    lastSenderUid: chat.lastSenderUid,
    readBy: { [authState.user.uid]: message.createdAt },
    updatedAt: nowIso()
  }, true).catch((error) => reportBackgroundError("Chat-Vorschau aktualisieren", error, { notify: true, fallback: "Nachricht gesendet, Chat-Vorschau konnte aber nicht aktualisiert werden." }));
  clearFirebaseChatTrashForParticipants(chat.id, chat.participants).catch((error) => reportBackgroundError("Chat-Papierkorbstatus zur\xFCcksetzen", error));
  return sentMessage;
}
async function retryChatMessage(chat, messageId) {
  const msg = state.chatMessages.find((item) => item.id === messageId && item.chatId === chat.id);
  if (!msg) throw new Error("Nachricht nicht gefunden.");
  if (msg.senderUid !== authState.user?.uid) throw new Error("Nur eigene Nachrichten k\xF6nnen erneut gesendet werden.");
  msg.deliveryStatus = "pending";
  chat.lastMessageAt = msg.createdAt;
  chat.lastMessagePreview = String(msg.text || "").slice(0, 120);
  chat.lastSenderUid = authState.user.uid;
  chat.readBy = { ...chat.readBy || {}, [authState.user.uid]: msg.createdAt };
  clearLocalChatTrashForParticipants(chat, chat.participants);
  upsertChatState(chat);
  saveState();
  refreshOpenChatThread(chat, { scrollBottom: true });
  await persistOutgoingChatMessage(chat, msg, { failureText: "Nachricht konnte erneut nicht gesendet werden." });
  updateNavBadges();
  toast("Nachricht erneut gesendet.");
}
async function sendChatMessage(chat, text, operationId = "") {
  const ownerUid = authState.user?.uid, ownerEpoch = accountEpoch;
  const trimmed = String(text || "").trim();
  if (!trimmed) throw new Error("Bitte zuerst eine Nachricht eingeben.");
  const previous = operationId && state.chatMessages.find((m) => m.id === operationId && m.chatId === chat.id);
  if (previous) {
    await persistOutgoingChatMessage(chat, previous);
    return;
  }
  if (isFirebaseMode()) await ensureChatDocument(chat);
  if (!currentAccountEpoch(ownerUid, ownerEpoch)) throw new Error("Konto gewechselt; Nachricht wird nicht gesendet.");
  chat.participants = normalizedChatParticipants(chat);
  const recipientUid = chatPeerUid(chat);
  if (!recipientUid || chat.participants.length !== 2) throw new Error("Chat konnte nicht eindeutig zugeordnet werden.");
  const message = {
    id: operationId || uid("msg"),
    chatId: chat.id,
    requestId: chat.requestId,
    requestTitle: chat.requestTitle || "Privater Chat",
    requestOwnerUid: chat.requestOwnerUid || "",
    senderUid: ownerUid,
    recipientUid,
    participants: chat.participants.slice(),
    participantLabels: chat.participantLabels || {},
    text: trimmed,
    createdAt: nowIso(),
    readAt: "",
    deliveryStatus: "pending"
  };
  chat.lastMessageAt = message.createdAt;
  chat.lastMessagePreview = trimmed.slice(0, 120);
  chat.lastSenderUid = authState.user.uid;
  chat.readBy = { ...chat.readBy || {}, [authState.user.uid]: message.createdAt };
  clearLocalChatTrashForParticipants(chat, chat.participants);
  upsertChatState(chat);
  upsertLocalChatMessage(message);
  saveState();
  refreshOpenChatThread(chat, { scrollBottom: true });
  await persistOutgoingChatMessage(chat, message);
  updateNavBadges();
  addChange(`Private Nachricht gesendet: ${chat.requestTitle}`);
}
async function sendAppointmentProposal(chat, appointmentData = {}) {
  const startsAt = String(appointmentData.startsAt || "").trim();
  const place = String(appointmentData.place || "").trim();
  const note = String(appointmentData.note || "").trim();
  if (!startsAt) throw new Error("Bitte Datum und Uhrzeit ausw\xE4hlen.");
  if (new Date(startsAt).getTime() < Date.now() - 6e4) throw new Error("Der Termin muss in der Zukunft liegen.");
  if (isFirebaseMode()) await ensureChatDocument(chat);
  chat.participants = normalizedChatParticipants(chat);
  const recipientUid = chatPeerUid(chat);
  if (!recipientUid || chat.participants.length !== 2) throw new Error("Chat konnte nicht eindeutig zugeordnet werden.");
  const text = `Termin vorgeschlagen: ${formatAppointmentDate(startsAt)}${place ? `, ${place}` : ""}`;
  const message = {
    id: uid("appt"),
    chatId: chat.id,
    requestId: chat.requestId,
    requestTitle: chat.requestTitle || "Privater Chat",
    requestOwnerUid: chat.requestOwnerUid || "",
    senderUid: authState.user.uid,
    recipientUid,
    participants: chat.participants.slice(),
    participantLabels: chat.participantLabels || {},
    messageType: "appointment",
    text,
    appointment: {
      startsAt,
      place,
      note,
      status: "proposed",
      proposedByUid: authState.user.uid,
      createdAt: nowIso()
    },
    createdAt: nowIso(),
    readAt: "",
    deliveryStatus: "pending"
  };
  chat.lastMessageAt = message.createdAt;
  chat.lastMessagePreview = text.slice(0, 120);
  chat.lastSenderUid = authState.user.uid;
  chat.readBy = { ...chat.readBy || {}, [authState.user.uid]: message.createdAt };
  clearLocalChatTrashForParticipants(chat, chat.participants);
  upsertChatState(chat);
  upsertLocalChatMessage(message);
  saveState();
  refreshOpenChatThread(chat, { scrollBottom: true });
  await persistOutgoingChatMessage(chat, message, { failureText: "Termin konnte nicht gesendet werden." });
  updateNavBadges();
  addChange(`Termin vorgeschlagen: ${chat.requestTitle}`);
}
function appointmentProposalModal(chat) {
  openModal("Termin vorschlagen", `
    <form id="appointmentForm" class="form-grid">
      <div class="card compact soft">
        <strong>${escapeHtml(chat.requestTitle || "Privater Chat")}</strong>
        <p>Der Termin wird nur im privaten 1:1-Chat vorgeschlagen.</p>
      </div>
      <label>Datum und Uhrzeit
        <input name="startsAt" type="datetime-local" required />
      </label>
      <label>Ort
        <input name="place" maxlength="100" placeholder="z. B. Eingang Gemeindehaus" />
      </label>
      <label>Notiz
        <textarea name="note" maxlength="260" placeholder="Kurze Zusatzinfo"></textarea>
      </label>
      <p id="appointmentError" class="form-error" role="alert"></p>
      <button class="primary-button" type="submit">Termin senden</button>
    </form>
  `, (modal, close) => {
    modal.querySelector("#appointmentForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = form.querySelector('button[type="submit"]');
      const errorNode = modal.querySelector("#appointmentError");
      submit.disabled = true;
      if (errorNode) errorNode.textContent = "";
      try {
        await sendAppointmentProposal(chat, Object.fromEntries(new FormData(form)));
        close();
        toast("Termin vorgeschlagen.");
      } catch (error) {
        const message = actionErrorMessage(error, "Termin konnte nicht gesendet werden.");
        if (errorNode) errorNode.textContent = message;
        toast(message);
      } finally {
        submit.disabled = false;
      }
    });
  });
}
async function decideAppointment(chat, messageId, status) {
  const msg = state.chatMessages.find((item) => item.id === messageId && item.chatId === chat.id);
  if (!msg?.appointment) throw new Error("Termin nicht gefunden.");
  if (msg.recipientUid !== authState.user?.uid) throw new Error("Nur der Empf\xE4nger kann diesen Termin best\xE4tigen oder absagen.");
  const nextStatus = status === "accepted" ? "accepted" : "declined";
  const appointment = {
    ...msg.appointment,
    status: nextStatus,
    decidedAt: nowIso(),
    decidedByUid: authState.user.uid
  };
  msg.appointment = appointment;
  if (isFirebaseMode()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.chatMessages, msg.id, { appointment }, true).catch((error) => reportBackgroundError("Terminstatus synchronisieren", error, { notify: true, fallback: "Terminstatus konnte nicht gespeichert werden." }));
  } else {
    saveState();
  }
  await sendChatMessage(chat, nextStatus === "accepted" ? `Termin best\xE4tigt: ${formatAppointmentDate(appointment.startsAt)}` : `Termin abgesagt: ${formatAppointmentDate(appointment.startsAt)}`);
  toast(nextStatus === "accepted" ? "Termin best\xE4tigt." : "Termin abgesagt.");
}
function bindAppointmentActions(chat, container) {
  container.querySelectorAll('[data-action="appointment-decision"]').forEach((button) => {
    button.addEventListener("click", () => {
      button.disabled = true;
      runAsyncAction(() => decideAppointment(chat, button.dataset.messageId, button.dataset.status));
    });
  });
}
function bindChatRetryActions(chat, container) {
  container.querySelectorAll('[data-action="retry-chat-message"]').forEach((button) => {
    button.addEventListener("click", () => {
      button.disabled = true;
      runAsyncAction(() => retryChatMessage(chat, button.dataset.messageId));
    });
  });
}
async function markChatMessagesRead(chat, messages = chatMessagesFor(chat.id)) {
  if (!authState.user?.uid) return;
  const unread = messages.filter((msg) => msg.recipientUid === authState.user.uid && !msg.readAt && !readReceiptInFlight.has(msg.id));
  if (!unread.length) return;
  const readAt = nowIso();
  unread.forEach((msg) => {
    msg.readAt = readAt;
    readReceiptInFlight.add(msg.id);
  });
  if (!isFirebaseMode()) {
    saveState();
    unread.forEach((msg) => readReceiptInFlight.delete(msg.id));
    return;
  }
  await Promise.all(unread.slice(0, 20).map(
    (msg) => setFirebaseDoc(FIRESTORE_COLLECTIONS.chatMessages, msg.id, { readAt }, true).catch((error) => reportBackgroundError("Chat-Nachricht lesen markieren", error))
  ));
  unread.forEach((msg) => readReceiptInFlight.delete(msg.id));
}
function subscribeChatMessages(chat, chatThreadBox) {
  const expectedUid = authState.user?.uid, expectedEpoch = accountEpoch;
  if (!expectedUid || !chat.participants?.includes(expectedUid)) return;
  if (typeof activeChatUnsubscribe === "function") activeChatUnsubscribe();
  activeChatUnsubscribe = null;
  activeChatPagination = null;
  if (!isFirebaseMode() || !firebaseStoreApi?.onSnapshot) {
    chatThreadBox.innerHTML = renderChatMessages(chat);
    bindAppointmentActions(chat, chatThreadBox);
    bindChatRetryActions(chat, chatThreadBox);
    return;
  }
  const { db, collection, query, orderBy, where, limit, startAfter, getDocs, onSnapshot } = firebaseStoreApi;
  let anySnapshotReceived = false;
  function renderThread({ scrollBottom = false } = {}) {
    if (!currentAccountEpoch(expectedUid, expectedEpoch) || !chatThreadBox.isConnected) return;
    const mergedMessages = chatMessagesFor(chat.id);
    const hasMore = activeChatPagination?.chatId === chat.id && activeChatPagination.hasMore;
    chatThreadBox.innerHTML = `
      ${hasMore ? '<button class="ghost-button small load-more-chat" data-action="load-more-chat">\xC4ltere Nachrichten laden</button>' : ""}
      ${renderChatMessages(chat, mergedMessages)}
    `;
    bindAppointmentActions(chat, chatThreadBox);
    bindChatRetryActions(chat, chatThreadBox);
    chatThreadBox.querySelector('[data-action="load-more-chat"]')?.addEventListener("click", () => runAsyncAction(loadOlderMessages));
    if (scrollBottom) chatThreadBox.scrollTop = chatThreadBox.scrollHeight;
    void markChatMessagesRead(chat, mergedMessages);
  }
  function renderLiveMessages(snapshot) {
    if (!currentAccountEpoch(expectedUid, expectedEpoch) || !chatThreadBox.isConnected) return;
    anySnapshotReceived = true;
    activeChatPagination = {
      chatId: chat.id,
      oldestDoc: snapshot.docs[snapshot.docs.length - 1] || activeChatPagination?.oldestDoc || null,
      hasMore: snapshot.size >= 50
    };
    const messages = mapFirestoreDocs(snapshot).map(normalizeChatMessage).filter((msg) => msg.chatId === chat.id && (msg.participants?.includes(authState.user?.uid) || msg.requestOwnerUid === authState.user?.uid));
    upsertChatMessages(chat.id, messages);
    renderThread({ scrollBottom: true });
  }
  function handleLiveError(error) {
    if (!currentAccountEpoch(expectedUid, expectedEpoch)) return;
    reportBackgroundError("Chat-Nachrichten live laden", error, { notify: false, fallback: "Chat-Nachrichten konnten nicht live geladen werden.", collection: FIRESTORE_COLLECTIONS.chatMessages });
    if (!anySnapshotReceived && !chatMessagesFor(chat.id).length) {
      chatThreadBox.innerHTML = '<div class="empty" style="min-height:120px;">Private Nachrichten werden geladen. Falls nichts erscheint, bitte kurz erneut \xF6ffnen.</div>';
    }
  }
  async function loadOlderMessages() {
    if (!currentAccountEpoch(expectedUid, expectedEpoch)) return;
    if (!activeChatPagination?.oldestDoc || activeChatPagination.chatId !== chat.id) return;
    const olderQuery = query(
      collection(db, FIRESTORE_COLLECTIONS.chatMessages),
      where("chatId", "==", chat.id),
      orderBy("createdAt", "desc"),
      startAfter(activeChatPagination.oldestDoc),
      limit(50)
    );
    const snapshot = await getDocs(olderQuery);
    if (!currentAccountEpoch(expectedUid, expectedEpoch) || !chatThreadBox.isConnected) return;
    const olderMessages = mapFirestoreDocs(snapshot).map(normalizeChatMessage).filter((msg) => msg.chatId === chat.id && (msg.participants?.includes(authState.user?.uid) || msg.requestOwnerUid === authState.user?.uid));
    upsertChatMessages(chat.id, olderMessages);
    activeChatPagination = {
      chatId: chat.id,
      oldestDoc: snapshot.docs[snapshot.docs.length - 1] || activeChatPagination.oldestDoc,
      hasMore: snapshot.size >= 50
    };
    renderThread();
  }
  const messageQuery = query(
    collection(db, FIRESTORE_COLLECTIONS.chatMessages),
    where("chatId", "==", chat.id),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  const unsubscribe = onSnapshot(messageQuery, renderLiveMessages, handleLiveError);
  activeChatUnsubscribe = () => {
    if (typeof unsubscribe === "function") unsubscribe();
    activeChatPagination = null;
  };
}
function reportChatModal(chat) {
  openModal("Privaten Chat melden", `
    <form id="chatReportForm" class="form-grid">
      <div class="card compact soft">
        <strong>${escapeHtml(chat.requestTitle || "Privater Chat")}</strong>
        <p>Mit dem Melden gibst du Metadaten und deine Begr\xFCndung an die Administration weiter. Der private Nachrichtenverlauf bleibt gesch\xFCtzt.</p>
      </div>
      <label>Grund
        <select name="reasonType">
          <option value="missbrauch">Missbrauch / Betrug</option>
          <option value="beleidigung">Beleidigung / Bel\xE4stigung</option>
          <option value="sicherheit">Sicherheitsproblem</option>
          <option value="sonstiges">Sonstiges</option>
        </select>
      </label>
      <label>Begr\xFCndung
        <textarea name="reason" required maxlength="420" placeholder="Kurz beschreiben, was gepr\xFCft werden soll"></textarea>
      </label>
      <p id="chatReportError" class="form-error" role="alert"></p>
      <button class="danger-button" type="submit">Chat melden</button>
    </form>
  `, (modal, close) => {
    modal.querySelector("#chatReportForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = form.querySelector('button[type="submit"]');
      const errorNode = modal.querySelector("#chatReportError");
      const data = Object.fromEntries(new FormData(form));
      const reason = String(data.reason || "").trim();
      if (reason.length < 8) {
        const message = "Bitte den Grund etwas genauer beschreiben.";
        if (errorNode) errorNode.textContent = message;
        toast(message);
        return;
      }
      submit.disabled = true;
      try {
        await reportChat(chat, String(data.reasonType || "sonstiges"), reason);
        close();
        toast("Chat-Meldung an die Administration gesendet.");
      } catch (error) {
        const message = actionErrorMessage(error, "Chat-Meldung konnte nicht gesendet werden.");
        if (errorNode) errorNode.textContent = message;
        toast(message);
      } finally {
        submit.disabled = false;
      }
    });
  });
}
async function reportChat(chat, reasonType, reason) {
  if (!authState.user?.uid) throw new Error("Bitte zuerst anmelden.");
  if (!chat.participants?.includes(authState.user.uid)) throw new Error("Du kannst nur eigene Chats melden.");
  const req = requestById(chat.requestId) || {};
  const payload = {
    id: uid("mod"),
    type: "Privater Chat",
    requestId: chat.requestId || "",
    chatId: chat.id,
    title: `Privater Chat: ${chat.requestTitle || req.title || "Direktvermittlung"}`,
    area: req.area || state.profile.area || "",
    risk: "mittel",
    status: "offen",
    detail: `Chat wurde von ${profileName()} gemeldet. Grund: ${reasonType}. Begr\xFCndung: ${reason}`,
    reporterUid: authState.user.uid,
    reporterEmail: authState.user.email || "",
    reporterLabel: profileName(),
    reportedPeerUid: chatPeerUid(chat),
    lastMessageAt: chat.lastMessageAt || "",
    lastMessagePreview: chat.lastMessagePreview || "",
    createdAt: nowIso()
  };
  if (isFirebaseMode()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.moderation, payload.id, payload, false);
  } else {
    state.moderation.unshift(payload);
    saveState();
  }
  addChange(`Privater Chat gemeldet: ${chat.requestTitle || chat.id}`);
}
function chatModalForChat(chat) {
  void markChatThreadRead(chat);
  const muted = isChatMuted(chat);
  const hasMessages = chatMessagesFor(chat.id).length > 0 || Boolean(chat.lastMessagePreview);
  openModal(hasMessages ? "Privater Direkt-Chat" : "Privat anschreiben", `
    <section class="form-grid">
      <div class="card compact soft">
        <strong>${escapeHtml(chat.requestTitle || "Anliegen")}</strong>
        <p>1:1 mit ${escapeHtml(chatPeerLabel(chat))}. Der Verlauf ist privat und wird live zugestellt.</p>
        <div class="badges" style="margin-top:8px;">
          <span class="badge">P2P</span>
          <span class="badge">privat</span>
          ${muted ? '<span class="badge">stumm</span>' : '<span class="badge info">Push aktiv</span>'}
        </div>
      </div>
      <div id="chatThreadBox" class="chat-thread">${renderChatMessages(chat)}</div>
      <form id="chatForm" class="form-grid">
        <label>Nachricht
          <textarea name="text" required maxlength="500" placeholder="${hasMessages ? "Nachricht schreiben" : "Kurze Nachricht zum Inserat schreiben"}"></textarea>
        </label>
        <p class="help">Workflow: Inserat \xF6ffnen, privat anschreiben, danach l\xE4uft alles hier im 1:1-Chat.</p>
        <p id="chatSendError" class="form-error" role="alert"></p>
        <div class="row-actions">
          <button class="primary-button" type="submit">Senden</button>
          <button class="secondary-button" type="button" data-action="propose-appointment">Termin</button>
          <button class="ghost-button" type="button" data-action="toggle-chat-mute" data-chat-id="${escapeHtml(chat.id)}">${iconSvg(muted ? "bell" : "bellOff")} ${muted ? "Benachrichtigen" : "Stumm"}</button>
          <button class="ghost-button" type="button" data-action="trash-current-chat">${iconSvg("trash")} Papierkorb</button>
          <button class="ghost-button" type="button" data-action="report-private-chat">Chat melden</button>
        </div>
      </form>
    </section>
  `, (modal, close) => {
    const chatForm = modal.querySelector("#chatForm");
    const chatThreadBox = modal.querySelector("#chatThreadBox");
    subscribeChatMessages(chat, chatThreadBox);
    modal.addEventListener("modal:close", () => {
      if (typeof activeChatUnsubscribe === "function") activeChatUnsubscribe();
      activeChatUnsubscribe = null;
    });
    modal.querySelector('[data-action="report-private-chat"]')?.addEventListener("click", () => reportChatModal(chat));
    modal.querySelector('[data-action="propose-appointment"]')?.addEventListener("click", () => appointmentProposalModal(chat));
    modal.querySelector('[data-action="toggle-chat-mute"]')?.addEventListener("click", () => runAsyncAction(() => toggleChatMute(chat.id, { rerender: false })));
    modal.querySelector('[data-action="trash-current-chat"]')?.addEventListener("click", () => runAsyncAction(async () => {
      await moveChatToTrash(chat.id);
      close();
      setRoute("chats");
    }));
    chatForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submit = chatForm.querySelector('button[type="submit"]');
      const errorNode = modal.querySelector("#chatSendError");
      submit.disabled = true;
      if (errorNode) errorNode.textContent = "";
      try {
        const text = new FormData(chatForm).get("text");
        chatForm.dataset.v47MessageId ||= uid("msg");
        await sendChatMessage(chat, text, chatForm.dataset.v47MessageId);
        delete chatForm.dataset.v47MessageId;
        chatForm.reset();
        if (errorNode) errorNode.textContent = "";
        if (!isFirebaseMode()) {
          chatThreadBox.innerHTML = renderChatMessages(chat);
          bindAppointmentActions(chat, chatThreadBox);
          bindChatRetryActions(chat, chatThreadBox);
        }
        toast("Nachricht gesendet.");
      } catch (error) {
        const message = actionErrorMessage(error, "Nachricht konnte nicht gesendet werden.");
        if (errorNode) errorNode.textContent = message;
        toast(message);
      } finally {
        submit.disabled = false;
      }
    });
  });
}
async function openChatForRequest(id) {
  const target = state.requests.find((x) => x.id === id);
  if (target?.uid === authState.user?.uid) {
    nativeWeb.go("chats");
    return;
  }
  await nativeWeb.startChat(id);
}
function chatModal(id) {
  runAsyncAction(() => openChatForRequest(id));
}
async function decideRequestPublication(id, decision) {
  if (id.startsWith("arq_")) {
    await callQuartinaut("quartinautAudience", { action: decision === "approve" ? "approve" : "reject", id });
    await nativeWeb.refreshRegional();
    toast("Pr\xFCfung gespeichert.");
    render();
    return;
  }
  if (!isAdminRole()) throw new Error("Nur Admins k\xF6nnen Beitr\xE4ge freigeben.");
  const req = state.requests.find((item) => item.id === id);
  if (!req) throw new Error("Beitrag nicht gefunden.");
  const now = nowIso();
  let update = {};
  if (decision === "approve") {
    update = {
      status: "offen",
      approvedAt: now,
      approvedBy: profileName(),
      rejectedAt: "",
      rejectedBy: "",
      rejectionReason: "",
      updatedAt: now
    };
  } else {
    const fallbackReason = decision === "revise" ? "Bitte Beitrag konkretisieren und erneut einreichen." : "Beitrag wurde nicht freigegeben.";
    const reason = window.prompt("Begr\xFCndung f\xFCr den Nutzer:", fallbackReason);
    if (reason === null) return;
    update = {
      status: "abgelehnt",
      rejectedAt: now,
      rejectedBy: profileName(),
      rejectionReason: String(reason || fallbackReason).trim(),
      updatedAt: now
    };
  }
  Object.assign(req, update);
  if (isFirebaseMode()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.requests, req.id, update, true);
    await writeAuditLog("request_publication_decision", req, `${requestStatusLabel(update.status)}: ${req.title}`);
    await syncStateFromFirestore();
  } else {
    saveState();
  }
  render();
  toast(decision === "approve" ? "Beitrag freigegeben." : "Beitrag zur \xDCberarbeitung zur\xFCckgegeben.");
}
function newOfficialNoticeModal() {
  if (!canManageOfficialNotices()) {
    toast("Nur Admins oder verifizierte Gemeinde-Konten k\xF6nnen offizielle Hinweise erstellen.");
    return;
  }
  const fixedArea = locationLabel();
  const canChooseCantonScope = isAdminRole();
  openModal("Gemeinde-Hinweis erstellen", `
    <form id="officialNoticeForm" class="form-grid">
      <label>Titel
        <input name="title" required maxlength="100" placeholder="z. B. \xD6ffnungszeiten Werkhof" />
      </label>
      <label>Hinweis
        <textarea name="text" required maxlength="700" placeholder="Sachlich, konkret und ohne Diskussion."></textarea>
      </label>
      <div class="form-grid three">
        <div class="readonly-field"><strong>Gebiet</strong><span>${escapeHtml(fixedArea)}</span></div>
        <label>Kategorie
          <select name="category">
            ${OFFICIAL_NOTICE_CATEGORIES.map((category) => `<option>${escapeHtml(category)}</option>`).join("")}
          </select>
        </label>
        <label>Priorit\xE4t
          <select name="priority">
            <option value="info">Info</option>
            <option value="wichtig">Wichtig</option>
          </select>
        </label>
      </div>
      <div class="form-grid two">
        ${canChooseCantonScope ? `
          <label>Reichweite
            <select name="scopeLevel">
              <option value="municipality">Nur eigene Gemeinde</option>
              <option value="canton">Ganzer Kanton ${escapeHtml(currentCantonCode())}</option>
            </select>
          </label>
        ` : '<input type="hidden" name="scopeLevel" value="municipality" />'}
        <label>Status
          <select name="status">
            <option value="online">Direkt online</option>
            <option value="entwurf">Entwurf</option>
          </select>
        </label>
        <label>G\xFCltig bis
          <input name="validUntil" type="date" />
        </label>
      </div>
      <p class="help">Gemeinde-Hinweise sind nicht f\xFCr Notf\xE4lle gedacht. Dringende Meldungen geh\xF6ren zu \u201ELokale Alarme\u201C.</p>
      <button class="primary-button" type="submit">Hinweis speichern</button>
    </form>
  `, (modal, close) => {
    modal.querySelector("#officialNoticeForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const submit = event.currentTarget.querySelector('button[type="submit"]');
      submit.disabled = true;
      try {
        const data = Object.fromEntries(new FormData(event.currentTarget));
        const validUntil = data.validUntil ? (/* @__PURE__ */ new Date(`${data.validUntil}T23:59:59`)).toISOString() : "";
        const payload = {
          id: uid("notice"),
          tenantId: "quartinaut",
          uid: authState.user.uid,
          createdByUid: authState.user.uid,
          createdByLabel: state.profile.accountType === "municipality" ? state.profile.municipalityName || state.profile.area || "Gemeinde" : "Gemeinde",
          title: String(data.title || "").trim(),
          text: String(data.text || "").trim(),
          category: String(data.category || "Allgemein"),
          priority: String(data.priority || "info"),
          status: String(data.status || "online"),
          area: fixedArea,
          areaKey: currentAreaKey(),
          cantonCode: currentCantonCode(),
          scopeLevel: data.scopeLevel === "canton" && isAdminRole() ? "canton" : "municipality",
          validFrom: nowIso(),
          validUntil,
          createdAt: nowIso(),
          updatedAt: nowIso()
        };
        if (!payload.title || !payload.text) throw new Error("Titel und Hinweistext sind Pflicht.");
        state.officialNotices.unshift(normalizeOfficialNoticeDoc(payload));
        if (isFirebaseMode()) {
          await setFirebaseDoc(FIRESTORE_COLLECTIONS.officialNotices, payload.id, payload, false);
          await syncStateFromFirestore();
        } else {
          saveState();
        }
        close();
        render();
        toast(payload.status === "online" ? "Gemeinde-Hinweis ver\xF6ffentlicht." : "Gemeinde-Hinweis als Entwurf gespeichert.");
      } finally {
        submit.disabled = false;
      }
    });
  });
}
async function updateOfficialNoticeStatus(id, status) {
  if (!canManageOfficialNotices()) throw new Error("Keine Berechtigung f\xFCr Gemeinde-Hinweise.");
  const notice = state.officialNotices.find((item) => item.id === id);
  if (!notice) throw new Error("Hinweis nicht gefunden.");
  const update = { status, updatedAt: nowIso() };
  Object.assign(notice, update);
  if (isFirebaseMode()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.officialNotices, id, update, true);
    await syncStateFromFirestore();
  } else {
    saveState();
  }
  render();
  toast(status === "online" ? "Hinweis online gestellt." : "Hinweis archiviert.");
}
function newAlertModal() {
  const fixedArea = locationLabel();
  openModal("Gemeinde-Alarm erstellen", `
    <form id="alertForm" class="form-grid">
      <label>Titel
        <input name="title" required maxlength="90" placeholder="Kurzer Titel" />
      </label>
      <label>Meldung
        <textarea name="text" required maxlength="460" placeholder="Faktisch, kurz, ohne Diskussion."></textarea>
      </label>
      <div class="form-grid three">
        <div class="readonly-field"><strong>Gebiet</strong><span>${escapeHtml(fixedArea)}</span></div>
        <label>Priorit\xE4t
          <select name="severity" id="alertSeverity"><option value="info">P2 \xB7 Info</option><option value="warn">P1 \xB7 Wichtig</option><option value="critical">P0 \xB7 Notfall</option></select>
        </label>
        <label>Kanal
          <select name="channel"><option>Push + PWA</option><option>Push + E-Mail</option><option>Nur PWA</option></select>
        </label>
      </div>
      <div class="form-grid two">
        <label>Reichweite
          <select name="scopeLevel"><option value="municipality">Nur eigene Gemeinde</option><option value="canton">Ganzer Kanton ${escapeHtml(currentCantonCode())}</option></select>
        </label>
        <label>G\xFCltig f\xFCr
          <select name="validHours"><option value="4">4 Stunden</option><option value="6">6 Stunden</option><option value="12">12 Stunden</option><option value="24" selected>24 Stunden</option><option value="48">48 Stunden</option></select>
        </label>
        <label>Freigegeben durch
          <input name="approvedBy" maxlength="60" placeholder="z. B. Werkhof, Einsatzleitung" />
        </label>
      </div>
      <label class="check-row" id="approvalRow" hidden style="grid-template-columns:auto 1fr;">
        <input type="checkbox" name="approved" id="alertApproved" />
        <span><strong>Vier-Augen-Freigabe best\xE4tigt</strong><small>F\xFCr P1/P0 zwingend: eine zweite berechtigte Person hat die Meldung gepr\xFCft.</small></span>
      </label>
      <p class="help">Verifizierte Meldungen sind strikt von privaten Gesuchen getrennt und werden nach Ablauf automatisch ausgeblendet.</p>
      <p id="alertError" class="form-error" role="alert"></p>
      <button class="primary-button" type="submit">Alarm ver\xF6ffentlichen</button>
    </form>
  `, (modal, close) => {
    const severitySelect = modal.querySelector("#alertSeverity");
    const approvalRow = modal.querySelector("#approvalRow");
    const syncApproval = () => {
      approvalRow.hidden = severitySelect.value === "info";
    };
    severitySelect.addEventListener("change", syncApproval);
    syncApproval();
    modal.querySelector("#alertForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      const errorNode = modal.querySelector("#alertError");
      const submit = event.currentTarget.querySelector('button[type="submit"]');
      submit.disabled = true;
      const needsApproval = data.severity !== "info";
      if (needsApproval && !data.approved) {
        if (errorNode) errorNode.textContent = "F\xFCr P1/P0 ist die Vier-Augen-Freigabe erforderlich.";
        submit.disabled = false;
        return;
      }
      const priority = data.severity === "critical" ? "P0" : data.severity === "warn" ? "P1" : "P2";
      const payload = {
        id: uid("alert"),
        uid: authState.user.uid,
        title: data.title,
        text: data.text,
        area: fixedArea,
        areaKey: currentAreaKey(),
        cantonCode: currentCantonCode(),
        scopeLevel: data.scopeLevel === "canton" ? "canton" : "municipality",
        severity: data.severity,
        priority,
        channel: data.channel,
        createdBy: isAdminRole() ? "Gemeinde" : state.profile.initials,
        approvedBy: data.approvedBy || (needsApproval ? "Vier-Augen-Freigabe" : ""),
        createdAt: nowIso(),
        validUntil: hoursFromNow(Number(data.validHours) || 24)
      };
      try {
        if (isFirebaseMode()) {
          await setFirebaseDoc(FIRESTORE_COLLECTIONS.alerts, payload.id, payload, false);
          await syncStateFromFirestore();
        } else {
          state.alerts.unshift(payload);
          saveState();
        }
        addChange(`Gemeinde-Alarm ver\xF6ffentlicht (${priority}): ${data.title}`);
        close();
        render();
        toast("Alarm ver\xF6ffentlicht.");
      } finally {
        submit.disabled = false;
      }
    });
  });
}
async function completeRequest(id) {
  if (id.startsWith("arq_")) {
    await nativeWeb.enhancement("post.status", { id, status: "erledigt" });
    await nativeWeb.refreshRegional();
    return;
  }
  const req = state.requests.find((item) => item.id === id);
  if (!req) return;
  req.status = "erledigt";
  req.closedAt = nowIso();
  state.archive.unshift({ id: req.id, title: req.title, closedAt: nowIso(), closedAtText: `abgeschlossen am ${(/* @__PURE__ */ new Date()).toLocaleDateString("de-CH")} um ${(/* @__PURE__ */ new Date()).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}` });
  addChange(`Anliegen abgeschlossen: ${req.title}`);
  if (isFirebaseMode()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.requests, req.id, { status: req.status, closedAt: req.closedAt, updatedAt: nowIso() }, true);
  }
  if (req.recurringMode === "woechentlich") {
    const { replies: _legacyReplies, ...baseRequest } = req;
    const followUpStatus = isAdminRole() ? "offen" : "wartet_freigabe";
    const followUpCreatedAt = nowIso();
    const followUp = {
      ...baseRequest,
      id: uid("req"),
      status: followUpStatus,
      reports: 0,
      createdAt: followUpCreatedAt,
      submittedAt: followUpCreatedAt,
      approvedAt: followUpStatus === "offen" ? followUpCreatedAt : "",
      approvedBy: followUpStatus === "offen" ? profileName() : "",
      rejectedAt: "",
      rejectedBy: "",
      rejectionReason: "",
      resubmittedAt: "",
      closedAt: "",
      expiresAt: expiryForUrgency(req.urgency),
      recurringParentId: req.recurringParentId || req.id
    };
    if (isFirebaseMode()) {
      await setFirebaseDoc(FIRESTORE_COLLECTIONS.requests, followUp.id, followUp, false);
    } else {
      state.requests.unshift(followUp);
    }
    addChange(`W\xF6chentliches Anliegen neu erstellt: ${followUp.title}`);
  }
  if (isFirebaseMode()) await syncStateFromFirestore();
  saveState();
  render();
  toast("Eintrag abgeschlossen und archiviert.");
}
async function reportRequest(id) {
  const req = state.requests.find((item) => item.id === id);
  if (!req) return;
  req.reports = (req.reports || 0) + 1;
  const reportDetail = `Nutzer/in hat den Eintrag gemeldet. Anzahl Meldungen: ${req.reports}`;
  const riskLevel = req.escalationLevel && req.escalationLevel !== "keine" ? req.escalationLevel : req.category === "Notfall" ? "P1" : "Pr\xFCfung";
  const existing = state.moderation.find((m) => m.requestId === id && m.status === "offen");
  if (existing) {
    existing.detail = reportDetail;
    existing.risk = riskLevel;
  } else {
    state.moderation.unshift({
      id: uid("mod"),
      requestId: id,
      type: "Meldung",
      title: req.title,
      area: req.area,
      risk: riskLevel,
      status: "offen",
      detail: reportDetail,
      reporterUid: authState.user?.uid || "",
      reporterEmail: authState.user?.email || "",
      reporterLabel: profileName(),
      createdAt: nowIso()
    });
  }
  if (isFirebaseMode()) {
    if (existing && !isAdminRole()) {
      state.moderation.unshift({
        id: uid("mod"),
        requestId: id,
        type: "Meldung",
        title: req.title,
        area: req.area,
        risk: riskLevel,
        status: "offen",
        detail: reportDetail,
        reporterUid: authState.user?.uid || "",
        reporterEmail: authState.user?.email || "",
        reporterLabel: profileName(),
        createdAt: nowIso()
      });
    }
    const canUpdateRequestReport = isAdminRole() || requestOwnerUid(req) === authState.user?.uid;
    if (canUpdateRequestReport && !id.startsWith("arq_")) {
      await setFirebaseDoc(FIRESTORE_COLLECTIONS.requests, req.id, { reports: req.reports, updatedAt: nowIso() }, true);
    }
    if (existing && isAdminRole()) {
      await setFirebaseDoc(FIRESTORE_COLLECTIONS.moderation, existing.id, { detail: existing.detail, updatedAt: nowIso() }, true);
    } else {
      const newCase = state.moderation[0];
      await setFirebaseDoc(FIRESTORE_COLLECTIONS.moderation, newCase.id, newCase, false);
    }
    await syncStateFromFirestore();
  }
  addChange(`Eintrag zur Moderation gemeldet: ${req.title}`);
  saveState();
  render();
  toast("Meldung in Moderation gelegt.");
}
async function cleanupLegacyPublicReplies() {
  if (!isAdminRole()) throw new Error("Nur Admins k\xF6nnen Alt-Chats bereinigen.");
  const targets = legacyPublicReplyRequests();
  if (!targets.length) {
    toast("Keine alten \xF6ffentlichen Antworten gefunden.");
    return;
  }
  if (!window.confirm(`${targets.length} Anliegen von alten \xF6ffentlichen Antworten bereinigen? Private 1:1-Chats bleiben unver\xE4ndert.`)) return;
  const deleteField = firebaseStoreApi?.deleteField;
  let cleaned = 0;
  if (isFirebaseMode()) {
    await Promise.all(targets.map(async (req) => {
      const update = {
        legacyReplyCount: req.replies.length,
        legacyRepliesClearedAt: nowIso(),
        updatedAt: nowIso()
      };
      update.replies = typeof deleteField === "function" ? deleteField() : [];
      await setFirebaseDoc(FIRESTORE_COLLECTIONS.requests, req.id, update, true);
      cleaned += 1;
    }));
    await writeAuditLog("legacy_replies_cleanup", { label: "requests" }, `${cleaned} Anliegen bereinigt`);
    await syncStateFromFirestore();
  } else {
    targets.forEach((req) => {
      req.legacyReplyCount = req.replies.length;
      req.legacyRepliesClearedAt = nowIso();
      req.replies = [];
      cleaned += 1;
    });
    saveState();
  }
  render();
  toast(`${cleaned} alte \xF6ffentliche Chat-Verl\xE4ufe bereinigt.`);
}
async function raiseRequestEscalation(id) {
  const req = state.requests.find((item) => item.id === id);
  if (!req) return;
  const next = req.escalationLevel === "keine" ? "P2" : req.escalationLevel === "P2" ? "P1" : "P0";
  req.escalationLevel = next;
  if (isFirebaseMode()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.requests, req.id, { escalationLevel: next, updatedAt: nowIso() }, true);
    await syncStateFromFirestore();
  }
  saveState();
  render();
  toast(`Eskalationsstufe auf ${next} gesetzt.`);
}
async function generateInvite() {
  const prefix = state.profile.area.slice(0, 3).toUpperCase().replace(/[^A-ZÄÖÜ]/g, "QRT");
  const code = `${prefix}-${Math.floor(1e3 + Math.random() * 9e3)}`;
  const payload = { id: uid("inv"), code, area: state.profile.area, role: "Bewohner/in", status: "offen", createdAt: nowIso(), uid: authState.user.uid };
  if (isFirebaseMode()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.inviteCodes, payload.id, payload, false);
    await syncStateFromFirestore();
  } else {
    state.inviteCodes.unshift(payload);
  }
  addChange(`Einladungscode erzeugt: ${code}`);
  saveState();
  render();
  toast(`Einladungscode ${code} erstellt.`);
}
async function resolveModeration(id, escalated = false) {
  const item = state.moderation.find((m) => m.id === id);
  if (isFirebaseMode()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.moderation, id, {
      status: escalated ? "eskaliert" : "erledigt",
      resolvedAt: nowIso(),
      resolvedBy: authState.user.uid,
      updatedAt: nowIso()
    }, true);
    await syncStateFromFirestore();
  } else {
    state.moderation = state.moderation.filter((m) => m.id !== id);
  }
  addChange(`${escalated ? "Moderationsfall eskaliert" : "Moderationsfall erledigt"}: ${item?.title || id}`);
  saveState();
  render();
  toast(escalated ? "Fall eskaliert." : "Fall erledigt.");
}
async function updateStoredUser(email, updates, uidValue = "") {
  if (isFirebaseMode() && uidValue) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.users, uidValue, { ...updates, updatedAt: nowIso() }, true);
  } else if (email) {
    const users = loadLocalUsers();
    if (users[email]) {
      users[email] = { ...users[email], ...updates };
      saveLocalUsers(users);
    }
  }
  if (authState.user?.uid === uidValue || authState.user?.email === email) {
    syncCurrentUser(updates);
    applyAuthenticatedUser(authState.user);
  }
}
async function toggleUserAccountStatus(uidValue) {
  const user = state.registeredUsers.find((item) => item.uid === uidValue);
  if (!user) throw new Error("Nutzer nicht gefunden.");
  if (uidValue === authState.user?.uid) throw new Error("Du kannst dein eigenes Admin-Konto nicht deaktivieren.");
  if (archivedUserStatus(user) === "deleted") throw new Error("Gel\xF6schte Konten bleiben im Archiv und k\xF6nnen nicht reaktiviert werden.");
  const current = user.accountStatus || "active";
  const next = current === "disabled" ? "active" : "disabled";
  const updates = {
    accountStatus: next,
    disabledAt: next === "disabled" ? nowIso() : "",
    disabledBy: next === "disabled" ? authState.user?.uid || "" : ""
  };
  await updateStoredUser(user.email, updates, uidValue);
  await writeAuditLog(next === "disabled" ? "Nutzer deaktiviert" : "Nutzer aktiviert", { uid: uidValue, email: user.email, label: user.displayName || user.email }, `Status: ${accountStatusLabel(next)}`);
  if (isFirebaseMode()) await syncStateFromFirestore();
  saveState();
  render();
  toast(next === "disabled" ? "Nutzer deaktiviert." : "Nutzer aktiviert.");
}
async function reviewMunicipalityAccount(uidValue, approved) {
  if (!isPlatformAdminRole()) throw new Error("Gemeindekonten werden nur durch die Plattformverwaltung verifiziert.");
  const user = state.registeredUsers.find((item) => item.uid === uidValue);
  if (!user || user.accountType !== "municipality") throw new Error("Gemeindekonto nicht gefunden.");
  const actionLabel = approved ? "freigeben" : "ablehnen";
  if (!window.confirm(`${user.municipalityName || user.area || user.displayName || "Dieses Gemeindekonto"} wirklich ${actionLabel}?`)) return;
  if (isFirebaseMode()) {
    if (!firebaseFunctionsApi?.httpsCallable || !firebaseFunctionsApi?.functions) {
      throw new Error("Die sichere Gemeinde-Freigabe ist momentan nicht verf\xFCgbar.");
    }
    const callable = firebaseFunctionsApi.httpsCallable(firebaseFunctionsApi.functions, "reviewMunicipalityAccount");
    await callable({ uid: uidValue, approved: Boolean(approved) });
    await syncStateFromFirestore();
  } else {
    const updates = approved ? {
      role: "resident",
      adminScopeArea: "",
      accountStatus: "active",
      municipalityStatus: "verified",
      verified: true,
      verificationStatus: "verified",
      verificationLabel: "Gemeinde",
      titlePreset: "municipality",
      titleGrants: ["verified"]
    } : {
      role: "resident",
      adminScopeArea: "",
      accountStatus: "pending_verification",
      municipalityStatus: "rejected",
      verified: false,
      verificationStatus: "rejected",
      verificationLabel: "",
      titlePreset: "auto",
      titleGrants: []
    };
    await updateStoredUser(user.email, updates, uidValue);
    Object.assign(user, updates);
  }
  await writeAuditLog(
    approved ? "Gemeindekonto freigegeben" : "Gemeindekonto abgelehnt",
    { uid: uidValue, email: user.email, label: user.municipalityName || user.displayName || user.email },
    user.area || user.municipalityName || ""
  );
  saveState();
  render();
  toast(approved ? "Gemeindekonto freigegeben." : "Gemeindekonto abgelehnt.");
}
async function revokeUserVerification(uidValue) {
  if (!isPlatformAdminRole()) throw new Error("Diese \xC4nderung erfordert die Plattformverwaltung.");
  const user = state.registeredUsers.find((item) => item.uid === uidValue);
  if (!user) throw new Error("Nutzer nicht gefunden.");
  if (!window.confirm(`Verifizierung von ${user.displayName || user.email || "diesem Konto"} widerrufen? Der Nutzer kann danach erneut eine Pr\xFCfung beantragen.`)) return;
  const updates = {
    verified: false,
    verificationStatus: "none",
    verificationLabel: "",
    titlePreset: "auto",
    titleGrants: [],
    verificationRevokedAt: nowIso(),
    verificationRevokedBy: authState.user?.uid || "",
    ...user.accountType === "company" ? { companyStatus: "pending" } : {},
    ...user.accountType === "municipality" ? {
      municipalityStatus: "pending",
      accountStatus: "pending_verification",
      role: "resident",
      adminScopeArea: ""
    } : {}
  };
  await updateStoredUser(user.email, updates, uidValue);
  await writeAuditLog("Verifizierung widerrufen", { uid: uidValue, email: user.email, label: user.displayName || user.email }, user.accountType === "company" ? "Firma wieder auf Pr\xFCfung gesetzt" : "Profil nicht mehr verifiziert");
  if (isFirebaseMode()) await syncStateFromFirestore();
  saveState();
  render();
  toast("Verifizierung widerrufen.");
}
async function approveLocationRequest(id, approved) {
  const req = state.locationChangeRequests.find((item) => item.id === id);
  if (!req) return;
  req.status = approved ? "best\xE4tigt" : "abgelehnt";
  req.decidedAt = nowIso();
  req.decidedBy = authState.user.uid;
  if (approved) {
    const area = locationLabel(req.targetLocation);
    await updateStoredUser(req.email, { location: req.targetLocation, area }, req.uid);
    if (authState.user?.uid === req.uid) {
      state.profile.location = req.targetLocation;
      state.profile.area = area;
    }
  }
  if (isFirebaseMode()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.locationChangeRequests, req.id, {
      status: req.status,
      decidedAt: req.decidedAt,
      decidedBy: req.decidedBy
    }, true);
    await writeAuditLog(approved ? "Standortwechsel best\xE4tigt" : "Standortwechsel abgelehnt", { uid: req.uid, email: req.email, label: req.displayName }, `${req.currentLabel} \u2192 ${req.targetLabel}`);
    await syncStateFromFirestore();
  }
  saveState();
  render();
  toast(approved ? "Standortwechsel best\xE4tigt." : "Standortwechsel abgelehnt.");
}
async function approveVerificationRequest(id, approved, approvedTitlePreset = "verified") {
  const req = state.verificationRequests.find((item) => item.id === id);
  if (!req) return;
  const targetUser = state.registeredUsers.find((user) => user.uid === req.uid);
  const isCompanyTarget = req.accountType === "company" || targetUser?.accountType === "company";
  if (approved && !verificationPhotoAvailable(req)) throw new Error("Verifizierung ben\xF6tigt ein Ausweisfoto.");
  const safeTitlePreset = ["verified", "resident", "registry", "district"].includes(approvedTitlePreset) ? approvedTitlePreset : "verified";
  const titleGrants = approved && ["registry", "district"].includes(safeTitlePreset) ? [safeTitlePreset, "verified"] : approved ? ["verified"] : [];
  const decidedAt = nowIso();
  const decisionPayload = {
    status: approved ? "best\xE4tigt" : "abgelehnt",
    decidedAt,
    decidedBy: authState.user?.uid || "",
    approvedTitlePreset: approved ? safeTitlePreset : "",
    approvedTitleLabel: approved ? titlePresetLabel(safeTitlePreset) : "",
    proofType: req.proofType || (isCompanyTarget ? "company_responsible_person" : "personal_id"),
    updatedAt: decidedAt
  };
  const updates = {
    verified: approved,
    verificationStatus: approved ? "verified" : "rejected",
    verificationLabel: approved ? titlePresetLabel(safeTitlePreset) : "",
    titlePreset: approved ? safeTitlePreset : "auto",
    titleGrants,
    ...isCompanyTarget ? { companyStatus: approved ? "verified" : "rejected" } : {}
  };
  if (isFirebaseMode()) {
    const { db, doc, writeBatch } = firebaseStoreApi;
    if (typeof writeBatch === "function") {
      const batch = writeBatch(db);
      batch.set(doc(db, FIRESTORE_COLLECTIONS.users, req.uid), { ...updates, updatedAt: nowIso() }, { merge: true });
      batch.set(doc(db, FIRESTORE_COLLECTIONS.verificationRequests, req.id), decisionPayload, { merge: true });
      await batch.commit();
    } else {
      await updateStoredUser(req.email, updates, req.uid);
      await setFirebaseDoc(FIRESTORE_COLLECTIONS.verificationRequests, req.id, decisionPayload, true);
    }
    if (authState.user?.uid === req.uid) {
      syncCurrentUser(updates);
      applyAuthenticatedUser(authState.user);
    }
    await writeAuditLog(approved ? "Profil verifiziert" : "Verifizierung abgelehnt", { uid: req.uid, email: req.email, label: req.displayName }, approved ? `Titel: ${titlePresetLabel(safeTitlePreset)}` : "abgelehnt").catch((error) => reportBackgroundError("Audit-Log Verifizierungsentscheid", error, { notify: false, collection: FIRESTORE_COLLECTIONS.auditLog }));
    try {
      await deleteVerificationPhoto(req);
      await setFirebaseDoc(FIRESTORE_COLLECTIONS.verificationRequests, req.id, { idPhoto: null, photoCleanupPending: false, photoDeletedAt: nowIso(), updatedAt: nowIso() }, true);
    } catch (error) {
      await setFirebaseDoc(FIRESTORE_COLLECTIONS.verificationRequests, req.id, { photoCleanupPending: true, photoCleanupError: String(error?.message || error || "unbekannt"), updatedAt: nowIso() }, true).catch(() => {
      });
      reportBackgroundError("Verifizierungsfoto nach Entscheid l\xF6schen", error, { notify: false, collection: "storage:verification-photos" });
    }
    await syncStateFromFirestore();
  } else {
    await updateStoredUser(req.email, updates, req.uid);
    Object.assign(req, decisionPayload, { idPhoto: null, photoDeletedAt: nowIso() });
  }
  if (authState.user?.uid === req.uid) {
    state.profile.verified = approved;
    state.profile.verificationStatus = updates.verificationStatus;
    state.profile.verificationLabel = updates.verificationLabel;
    state.profile.titlePreset = updates.titlePreset;
    state.profile.titleGrants = updates.titleGrants;
    if (isCompanyTarget) state.profile.companyStatus = updates.companyStatus;
  }
  saveState();
  render();
  toast(approved ? isCompanyTarget ? "Person/Firma freigegeben." : "Profil verifiziert." : "Verifizierung abgelehnt.");
}
function handleVerificationDecisionClick(button, approved) {
  runAsyncAction(async () => {
    const id = button.dataset.id || "";
    const card = button.closest(".card");
    const errorNode = card?.querySelector(`[data-verification-error="${cssEscape(id)}"]`);
    const titlePreset = card?.querySelector("[data-verification-title]")?.value || "verified";
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = approved ? "Wird gepr\xFCft ..." : "Wird abgelehnt ...";
    if (errorNode) errorNode.textContent = "";
    try {
      await approveVerificationRequest(id, approved, titlePreset);
    } catch (error) {
      const message = actionErrorMessage(error, approved ? "Verifizierung konnte nicht best\xE4tigt werden." : "Verifizierung konnte nicht abgelehnt werden.");
      if (errorNode) errorNode.textContent = message;
      reportBackgroundError(approved ? "Verifizierungsentscheid best\xE4tigen" : "Verifizierungsentscheid ablehnen", error, { notify: false, collection: FIRESTORE_COLLECTIONS.verificationRequests });
      toast(message);
    } finally {
      if (button.isConnected) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  });
}
async function setVerificationRequestQueueStatus(id, status) {
  const req = state.verificationRequests.find((item) => item.id === id);
  if (!req) return;
  req.status = status;
  req.decidedAt = "";
  req.decidedBy = "";
  if (isFirebaseMode()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.verificationRequests, req.id, {
      status: req.status,
      decidedAt: req.decidedAt,
      decidedBy: req.decidedBy,
      updatedAt: nowIso()
    }, true);
    await syncStateFromFirestore();
  }
  saveState();
  render();
  toast(status === "zur\xFCckgestellt" ? "Verifizierungsantrag zur\xFCckgestellt." : "Verifizierungsantrag wieder ge\xF6ffnet.");
}
async function updateChangeRequestStatus(id, status) {
  const req = state.changeRequests.find((item) => item.id === id);
  if (!req) return;
  req.status = status;
  req.decidedAt = nowIso();
  req.decidedBy = authState.user?.uid || "";
  const updatePayload = {
    status: req.status,
    decidedAt: req.decidedAt,
    decidedBy: req.decidedBy,
    updatedAt: nowIso()
  };
  if (status === "freigegeben" && req.type === "name_change") {
    const requestedName = String(req.requestedName || "").trim();
    if (!requestedName) throw new Error("Namensantrag enth\xE4lt keinen neuen Namen.");
    const updates = {
      displayName: requestedName,
      initials: initialsFromName(requestedName)
    };
    await updateStoredUser(req.email, updates, req.uid);
    req.appliedName = requestedName;
    updatePayload.appliedName = requestedName;
    if (authState.user?.uid === req.uid) {
      state.profile.name = requestedName;
      state.profile.initials = updates.initials;
    }
  }
  if (isFirebaseMode()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.changeRequests, req.id, updatePayload, true);
    await writeAuditLog(status === "freigegeben" ? "\xC4nderung freigegeben" : status === "abgelehnt" ? "\xC4nderung abgelehnt" : "\xC4nderung in Pr\xFCfung", { uid: req.uid, email: req.email, label: req.displayName }, req.type === "name_change" ? `${req.currentName} \u2192 ${req.requestedName}` : req.title);
    await syncStateFromFirestore();
  }
  saveState();
  render();
  const map = { freigegeben: req.type === "name_change" ? "Namens\xE4nderung freigegeben." : "Anfrage freigegeben.", in_pruefung: "Anfrage in Pr\xFCfung verschoben.", abgelehnt: "Anfrage abgelehnt." };
  toast(map[status] || "Anfrage aktualisiert.");
}
function downloadJsonFile(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
function localOwnDataExport() {
  const uidValue = authState.user?.uid || "";
  return {
    exportedAt: nowIso(),
    mode: "local",
    profile: state.profile,
    requests: state.requests.filter((req) => requestOwnerUid(req) === uidValue || req.uid === uidValue),
    chats: state.chats.filter((chat) => Array.isArray(chat.participants) && chat.participants.includes(uidValue)),
    chatMessages: state.chatMessages.filter((msg) => Array.isArray(msg.participants) && msg.participants.includes(uidValue)),
    alertsRead: state.alertReads.filter((item) => item.uid === uidValue),
    deviceTokens: state.deviceTokens.filter((item) => item.uid === uidValue),
    locationChangeRequests: state.locationChangeRequests.filter((item) => item.uid === uidValue),
    verificationRequests: state.verificationRequests.filter((item) => item.uid === uidValue).map((item) => ({ ...item, idPhoto: item.idPhoto ? { ...item.idPhoto, dataUrl: void 0, downloadUrl: void 0 } : null })),
    changeRequests: state.changeRequests.filter((item) => item.uid === uidValue)
  };
}
async function exportOwnData() {
  let data = localOwnDataExport();
  if (isFirebaseMode() && firebaseFunctionsApi?.httpsCallable && firebaseFunctionsApi?.functions) {
    const callable = firebaseFunctionsApi.httpsCallable(firebaseFunctionsApi.functions, "exportOwnData");
    const result = await callable({});
    data = result.data || data;
  }
  const safeDate = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  downloadJsonFile(`quartinaut-datenexport-${safeDate}.json`, data);
  toast("Datenexport erstellt.");
}
async function deleteOwnAccountData() {
  const confirmed = window.confirm("Konto wirklich l\xF6schen? Dein Konto und der Zugang werden gel\xF6scht/anonymisiert. Du kannst dich danach jederzeit neu registrieren, beginnst aber mit einem neuen, leeren Konto. Admins sehen nur einen Archivvermerk zur Missbrauchs- und Rechtsnachvollziehbarkeit. Dieser Schritt kann nicht r\xFCckg\xE4ngig gemacht werden.");
  if (!confirmed) return;
  if (isFirebaseMode() && firebaseFunctionsApi?.httpsCallable && firebaseFunctionsApi?.functions) {
    const callable = firebaseFunctionsApi.httpsCallable(firebaseFunctionsApi.functions, "deleteOwnAccountData");
    await callable({});
    toast("Konto gel\xF6scht. Du wirst abgemeldet.");
    await firebaseAuthApi?.signOut(firebaseAuthApi.auth).catch((error) => reportBackgroundError("Nach Konto-L\xF6schung abmelden", error));
    localStorage.removeItem(USER_PREFS_PREFIX + (authState.user?.uid || ""));
    saveLocalSession(null);
    resetAccountSession("", "firebase");
    authState.user = null;
    render();
    return;
  }
  localStorage.removeItem(LOCAL_STATE_PREFIX + (authState.user?.uid || ""));
  resetAccountSession("", "local");
  authState.user = null;
  saveLocalSession(null);
  toast("Lokales Konto gel\xF6scht.");
  render();
}
async function updateUserRoleByEmail(email, role, adminScopeArea = "") {
  if (!isAdminRole()) throw new Error("F\xFCr Rollen\xE4nderungen ist ein g\xFCltiger Administrator-Claim erforderlich.");
  const targetEmail = normalizeEmail(email);
  if (!targetEmail || !["admin", "area_admin", "resident"].includes(role)) throw new Error("E-Mail oder Rolle ung\xFCltig.");
  if (!isFirebaseMode()) throw new Error("Rollen lassen sich nur mit Firebase sicher \xE4ndern.");
  const { db, collection, query, where, limit, getDocs } = firebaseStoreApi;
  const users = await getDocs(query(collection(db, FIRESTORE_COLLECTIONS.users), where("email", "==", targetEmail), limit(1)));
  if (users.empty) throw new Error("Kein Nutzer mit dieser E-Mail gefunden.");
  const target = users.docs[0];
  const result = await callQuartinaut("quartinautSetRole", {
    uid: target.id,
    role,
    adminScopeArea: role === "area_admin" ? String(adminScopeArea || "").trim() : ""
  });
  if (!result?.ok) throw new Error("Die Rollen\xE4nderung wurde nicht best\xE4tigt.");
  await syncStateFromFirestore();
  render();
  toast("Rolle wurde serverseitig aktualisiert. Die betroffene Person muss die Anmeldung ggf. erneuern.");
}
async function updateAreaCategoryPriority(rawValue) {
  const areaName = baseMunicipalityName(state.profile.area);
  if (!areaName) throw new Error("Bitte zuerst ein Gebiet ausw\xE4hlen.");
  const priority = String(rawValue || "").split(",").map((item) => item.trim()).filter(Boolean).filter((value, index, arr) => arr.indexOf(value) === index).filter((value) => CATEGORIES.includes(value));
  const payload = {
    id: `priority_${areaName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
    areaName,
    areaLabel: state.profile.area,
    priority,
    updatedAt: nowIso(),
    updatedBy: authState.user?.uid || ""
  };
  if (isFirebaseMode()) {
    await setFirebaseDoc(FIRESTORE_COLLECTIONS.areaCategoryPriority, payload.id, payload, true);
    await syncStateFromFirestore();
  } else {
    state.areaCategoryPriority = state.areaCategoryPriority.filter((item) => item.id !== payload.id);
    state.areaCategoryPriority.unshift(payload);
    saveState();
  }
  render();
  toast("Kategorie-Priorit\xE4t gespeichert.");
}
async function enableNotifications() {
  if (!("Notification" in window)) {
    toast("Dieser Browser unterst\xFCtzt keine Benachrichtigungen.");
    return;
  }
  const current = Notification.permission;
  const permission = current === "default" ? await Notification.requestPermission() : current;
  localStorage.removeItem(NOTIFICATION_BANNER_DISMISSED_KEY);
  if (permission !== "granted") {
    const blocked = permission === "denied";
    toast(blocked ? "Benachrichtigungen sind im Browser blockiert." : "Benachrichtigungen nicht aktiviert.");
    renderNotificationPermissionBanner();
    if (blocked) openNotificationBlockedHelpModal();
    return;
  }
  await persistNotificationPreferences({
    ...currentNotificationPreferences(),
    enabled: true
  }, { notify: false });
  let pushReady = false;
  if (isFirebaseMode()) {
    try {
      await registerPushToken();
      pushReady = true;
    } catch (error) {
      toast(`Push-Token konnte nicht gespeichert werden: ${error?.message || "unbekannter Fehler"}`);
    }
  }
  saveState();
  const notificationResult = await tryShowSystemNotification(
    "Quartinaut ist bereit",
    pushReady ? "Push ist aktiv. Welche Inhalte zugestellt werden, bestimmst du im Profil." : "Benachrichtigungen sind aktiv. Push wird beim n\xE4chsten Sync erneut versucht.",
    { tag: "quartinaut-permission-ready", data: { route: "alarme" } }
  );
  renderNotificationPermissionBanner();
  if (!notificationResult.shown) {
    toast("Benachrichtigung konnte lokal nicht angezeigt werden.");
    openModal("Benachrichtigung nicht sichtbar", `
      <section class="form-grid legal-copy">
        <p>Die Browser-Berechtigung ist aktiv, aber dein Betriebssystem oder Browser hat keine sichtbare Systemmeldung angezeigt.</p>
        <ul class="help-list">
          <li><strong>Browser:</strong> ${escapeHtml(notificationPermissionState())}</li>
          <li><strong>FCM-Token:</strong> ${pushReady ? "gespeichert" : "noch nicht best\xE4tigt"}</li>
          <li><strong>Fehler:</strong> ${escapeHtml(notificationResult.error || "keine technische Fehlermeldung")}</li>
        </ul>
        <p>Pr\xFCfe zus\xE4tzlich die Benachrichtigungen im Betriebssystem und ob \u201ENicht st\xF6ren\u201C aktiv ist.</p>
      </section>
    `);
  }
}
async function sendNotificationTest() {
  if (!("Notification" in window)) {
    toast("Dieser Browser unterst\xFCtzt keine Benachrichtigungen.");
    return;
  }
  if (Notification.permission !== "granted") {
    await enableNotifications();
    if (Notification.permission !== "granted") return;
  }
  let tokenError = "";
  let fcmTestQueued = false;
  let fcmTestError = "";
  if (isFirebaseMode() && authState.user) {
    try {
      const token = await registerPushToken();
      await queueFcmSelfTest(token);
      fcmTestQueued = true;
    } catch (error) {
      tokenError = error?.message || "FCM-Token konnte nicht erneuert werden.";
      fcmTestError = tokenError;
    }
  }
  const stamp = (/* @__PURE__ */ new Date()).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const notificationResult = await tryShowSystemNotification(
    "Quartinaut Test",
    `Testmeldung um ${stamp}. Wenn du das siehst, ist dein Ger\xE4t korrekt eingerichtet.`,
    { tag: "quartinaut-push-test", data: { route: "alarme" } }
  );
  if (notificationResult.shown && !tokenError && (!isFirebaseMode() || fcmTestQueued)) {
    toast(fcmTestQueued ? "Lokaler Test gesendet, FCM-Test ausgel\xF6st." : "Testbenachrichtigung gesendet.");
    return;
  }
  toast(notificationResult.shown ? "Lokaler Test gesendet, FCM bitte pr\xFCfen." : "Testbenachrichtigung nicht sichtbar.");
  openModal("Push-Test Ergebnis", `
    <section class="form-grid legal-copy">
      <p><strong>Lokaler Systemtest:</strong> ${notificationResult.shown ? "ausgel\xF6st" : "nicht sichtbar"}</p>
      <p><strong>FCM-Token:</strong> ${tokenError ? `Fehler: ${escapeHtml(tokenError)}` : currentPushToken ? "gespeichert" : "noch nicht im Speicher"}</p>
      <p><strong>FCM-Server-Test:</strong> ${fcmTestQueued ? "ausgel\xF6st" : isFirebaseMode() ? `nicht ausgel\xF6st${fcmTestError ? ` \xB7 ${escapeHtml(fcmTestError)}` : ""}` : "nicht im lokalen Modus"}</p>
      <p><strong>Browser-Berechtigung:</strong> ${escapeHtml(notificationPermissionState())}</p>
      ${notificationResult.error ? `<p><strong>Systemmeldung-Fehler:</strong> ${escapeHtml(notificationResult.error)}</p>` : ""}
      <div class="card compact soft">
        <strong>Was sichtbar sein sollte</strong>
        <p>Bei erfolgreichem Test erscheint eine Systembenachrichtigung von Quartinaut ausserhalb der Seite. Wenn nur diese Meldung in der App erscheint, blockiert meist das Betriebssystem, der Browser oder der FCM-Token ist nicht gespeichert.</p>
      </div>
    </section>
  `);
}
async function openPushDiagnosticsModal() {
  const permission = "Notification" in window ? Notification.permission : "unsupported";
  const registration = await resolveNotificationRegistration();
  const ownTokens = state.deviceTokens.filter((token) => token.uid === authState.user?.uid && token.active !== false).length;
  const tokenVisible = currentPushToken ? `${currentPushToken.slice(0, 10)}\u2026${currentPushToken.slice(-8)}` : "noch nicht im Speicher";
  const latestDelivery = state.pushDeliveries[0];
  const latestChatDelivery = state.pushDeliveries.find((item) => item.type === "chat_message");
  const preferences = currentNotificationPreferences();
  const latestDeliveryLabel = latestDelivery ? `${latestDelivery.status || "unbekannt"} \xB7 ${latestDelivery.successCount || 0}/${latestDelivery.requested || 0} erfolgreich` : "noch kein Alarmversand protokolliert";
  const latestChatDeliveryLabel = latestChatDelivery ? `${latestChatDelivery.status || "unbekannt"} \xB7 ${latestChatDelivery.successCount || 0}/${latestChatDelivery.requested || 0} erfolgreich` : isAdminRole() ? "noch keine Chat-Push-Zustellung protokolliert" : "wird beim Empf\xE4nger \xFCber Chat-Nachrichten gepr\xFCft";
  const statusRows = [
    `<li><strong>Browser-Berechtigung:</strong> ${escapeHtml(permission)}</li>`,
    `<li><strong>Service Worker:</strong> ${registration ? "bereit" : "nicht bereit"}</li>`,
    `<li><strong>Firebase Modus:</strong> ${isFirebaseMode() ? "aktiv" : "lokal"}</li>`,
    `<li><strong>VAPID Key:</strong> ${FIREBASE_VAPID_KEY ? "gesetzt" : "fehlt"}</li>`,
    `<li><strong>Eigene Push-Tokens:</strong> ${escapeHtml(String(ownTokens))}</li>`,
    `<li><strong>Benachrichtigungsprofil:</strong> ${preferences.enabled ? "aktiv" : "pausiert"}</li>`,
    `<li><strong>Stichwortregeln:</strong> ${escapeHtml(String(preferences.keywordRules.filter((rule) => rule.enabled).length))} aktiv</li>`,
    `<li><strong>Gemeinde-Hinweise:</strong> ${preferences.officialNotices.enabled ? escapeHtml(preferences.officialNotices.priorities.join(", ") || "keine Priorit\xE4t") : "deaktiviert"}</li>`,
    `<li><strong>Aktueller Token (gek\xFCrzt):</strong> ${escapeHtml(tokenVisible)}</li>`,
    `<li><strong>Letzter FCM-Versand:</strong> ${escapeHtml(latestDeliveryLabel)}</li>`,
    `<li><strong>Letzter Chat-Push:</strong> ${escapeHtml(latestChatDeliveryLabel)}</li>`,
    `<li><strong>Chat-Push-Trigger:</strong> aktiv f\xFCr neue private Nachrichten</li>`
  ].join("");
  openModal("Push-Diagnose", `
    <section class="form-grid legal-copy">
      <p>So pr\xFCfst du Schritt f\xFCr Schritt, ob Push vollst\xE4ndig funktioniert.</p>
      <ul>${statusRows}</ul>
      <div class="card compact soft">
        <strong>Testablauf</strong>
        <p>1) \u201EBenachrichtigungen aktivieren\u201C dr\xFCcken, 2) \u201ETest senden\u201C dr\xFCcken, 3) mit einem zweiten Konto eine private Chat-Nachricht senden. Der Empf\xE4nger erh\xE4lt die Systemmeldung, wenn sein Ger\xE4t Push erlaubt.</p>
      </div>
      <div class="row-actions legal-shortcuts">
        <button class="secondary-button small" type="button" data-action="enable-notifications">Berechtigung erneuern</button>
        <button class="ghost-button small" type="button" data-action="test-notification">Test senden</button>
      </div>
    </section>
  `, (modal) => {
    modal.querySelector('[data-action="enable-notifications"]')?.addEventListener("click", () => runAsyncAction(enableNotifications));
    modal.querySelector('[data-action="test-notification"]')?.addEventListener("click", () => runAsyncAction(sendNotificationTest));
  });
}
async function passkeyCheck() {
  if (!window.PublicKeyCredential || !navigator.credentials?.create || !window.crypto?.getRandomValues) {
    toast("WebAuthn wird auf diesem Ger\xE4t nicht unterst\xFCtzt.");
    return;
  }
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));
    await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "Quartinaut" },
        user: { id: userId, name: state.profile.name, displayName: state.profile.name },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { userVerification: "preferred" },
        timeout: 45e3,
        attestation: "none"
      }
    });
    state.profile.passkeyReady = true;
    if (isFirebaseMode()) await updateFirebaseProfile({ passkeyReady: true });
    addChange("Passkey erfolgreich gestartet.");
    saveState();
    render();
    toast("Passkey erfolgreich gestartet.");
  } catch {
    toast("Passkey abgebrochen oder nicht verf\xFCgbar.");
  }
}
function resetLocalData() {
  if (!window.confirm("Lokale Daten wirklich zur\xFCcksetzen? Schwarzes Brett, Alarme und Archiv dieses Browsers werden geleert.")) return;
  localStorage.removeItem(USER_PREFS_PREFIX + (authState.user?.uid || ""));
  if (authState.mode === "local") localStorage.removeItem(LOCAL_STATE_PREFIX + (authState.user?.uid || ""));
  state = structuredClone(seed);
  state.route = "home";
  if (authState.user) applyAuthenticatedUser(authState.user);
  if (isFirebaseMode()) {
    syncStateFromFirestore().then(() => {
      saveState();
      render();
      toast("Lokale Cache-Daten zur\xFCckgesetzt.");
    }).catch(() => {
      saveState();
      render();
      toast("Lokale Daten zur\xFCckgesetzt.");
    });
    return;
  }
  saveState();
  render();
  toast("Lokale Daten zur\xFCckgesetzt.");
}
function runAsyncAction(action) {
  Promise.resolve().then(action).catch((error) => {
    console.error(error);
    toast(actionErrorMessage(error));
  });
}
function bindDashboardControls() {
  const tiles = [...document.querySelectorAll("[data-dashboard-tile]")];
  startDashboardMasonry();
  document.querySelectorAll('[data-action="dashboard-move"]').forEach((btn) => btn.addEventListener("click", () => {
    moveDashboardTile(btn.dataset.tile, Number(btn.dataset.dir || 0));
  }));
  document.querySelectorAll('[data-action="dashboard-hide"]').forEach((btn) => btn.addEventListener("click", () => {
    setDashboardTileHidden(btn.dataset.tile, true);
  }));
  document.querySelectorAll('[data-action="dashboard-show"]').forEach((btn) => btn.addEventListener("click", () => {
    setDashboardTileHidden(btn.dataset.tile, false);
  }));
  document.querySelectorAll('[data-action="dashboard-toggle-collapse"]').forEach((btn) => btn.addEventListener("click", () => {
    const tileId = btn.dataset.tile || "";
    const collapsed = !(state.dashboard.collapsed || []).includes(tileId);
    runAsyncAction(() => setDashboardTileCollapsed(tileId, collapsed));
  }));
  document.querySelectorAll('[data-action="dashboard-reset"]').forEach((btn) => btn.addEventListener("click", resetDashboardLayout));
  document.querySelectorAll('[data-action="dashboard-save"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(saveDashboardLayout)));
  document.querySelectorAll('[data-action="dashboard-cancel-edit"]').forEach((btn) => btn.addEventListener("click", () => setDashboardEditMode(false)));
  if (!dashboardEditMode()) return;
  tiles.forEach((tile) => {
    tile.addEventListener("dragstart", (event) => {
      dashboardDragId = tile.dataset.dashboardTile || "";
      tile.classList.add("is-dragging");
      event.dataTransfer?.setData("text/plain", dashboardDragId);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    });
    tile.addEventListener("dragend", () => {
      dashboardDragId = "";
      document.querySelectorAll(".dashboard-tile").forEach((item) => item.classList.remove("is-dragging", "drop-target"));
    });
    tile.addEventListener("dragover", (event) => {
      if (!dashboardDragId) return;
      event.preventDefault();
      tile.classList.add("drop-target");
    });
    tile.addEventListener("dragleave", () => tile.classList.remove("drop-target"));
    tile.addEventListener("drop", (event) => {
      event.preventDefault();
      const source = event.dataTransfer?.getData("text/plain") || dashboardDragId;
      dropDashboardTile(source, tile.dataset.dashboardTile || "");
    });
  });
  document.querySelectorAll(".tile-grip").forEach((grip) => {
    grip.addEventListener("pointerdown", (event) => {
      const tile = grip.closest("[data-dashboard-tile]");
      if (!tile || event.pointerType === "mouse") return;
      dashboardPointerDrag = { id: tile.dataset.dashboardTile || "", pointerId: event.pointerId };
      tile.classList.add("is-dragging");
      grip.setPointerCapture?.(event.pointerId);
    });
    grip.addEventListener("pointermove", (event) => {
      if (!dashboardPointerDrag || dashboardPointerDrag.pointerId !== event.pointerId) return;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.("[data-dashboard-tile]");
      document.querySelectorAll(".dashboard-tile").forEach((item) => item.classList.toggle("drop-target", item === target && target.dataset.dashboardTile !== dashboardPointerDrag.id));
    });
    grip.addEventListener("pointerup", (event) => {
      if (!dashboardPointerDrag || dashboardPointerDrag.pointerId !== event.pointerId) return;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.("[data-dashboard-tile]");
      if (target) dropDashboardTile(dashboardPointerDrag.id, target.dataset.dashboardTile || "");
      dashboardPointerDrag = null;
      document.querySelectorAll(".dashboard-tile").forEach((item) => item.classList.remove("is-dragging", "drop-target"));
    });
    grip.addEventListener("pointercancel", () => {
      dashboardPointerDrag = null;
      document.querySelectorAll(".dashboard-tile").forEach((item) => item.classList.remove("is-dragging", "drop-target"));
    });
  });
}
function bindAuthGate() {
  bindLocationPicker();
  const accountTypeSelect = byId("accountTypeSelect");
  const companyFields = byId("companyRegistrationFields");
  const municipalityFields = byId("municipalityRegistrationFields");
  const syncAccountTypeFields = () => {
    if (!accountTypeSelect) return;
    if (companyFields) companyFields.hidden = accountTypeSelect.value !== "company";
    if (municipalityFields) municipalityFields.hidden = accountTypeSelect.value !== "municipality";
    companyFields?.querySelectorAll("input").forEach((input) => {
      input.required = accountTypeSelect.value === "company" && input.name === "companyName";
    });
    municipalityFields?.querySelectorAll("input").forEach((input) => {
      input.required = accountTypeSelect.value === "municipality" && input.name === "municipalityDepartment";
    });
  };
  accountTypeSelect?.addEventListener("change", syncAccountTypeFields);
  syncAccountTypeFields();
  document.querySelectorAll("[data-auth-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      authMode = btn.dataset.authMode;
      render();
    });
  });
  byId("authForm")?.addEventListener("submit", handleAuthSubmit);
  byId("resetEmailPassword")?.addEventListener("click", () => runAsyncAction(resetFirebaseEmailPassword));
}
function bindCurrentRoute() {
  v462BindDashboardBackground();
  bindV41Settings();
  bindHubControls();
  bindV50();
  bindV53Controls();
  bindV46Features();
  byId("main")?.querySelectorAll("[data-community-route]").forEach((btn) => btn.addEventListener("click", () => setRoute(btn.dataset.communityRoute)));
  document.querySelectorAll('[data-community-action="new-event"]').forEach((btn) => btn.addEventListener("click", openCommunityEventModal));
  document.querySelectorAll('[data-community-action="review-event"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => decideCommunityEvent(btn.dataset.id, btn.dataset.decision))));
  document.querySelectorAll('[data-community-action="open-inbox"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => openInboxItem(btn.dataset.key, btn.dataset.route))));
  document.querySelectorAll('[data-community-action="review-help"]').forEach((btn) => btn.addEventListener("click", () => openCommunityReviewModal(btn.dataset.id)));
  document.querySelectorAll('[data-community-action="reload"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(loadCommunityFeatures)));
  document.querySelectorAll("[data-route]").forEach((el) => {
    if (el.dataset.routeBound === "true") return;
    el.dataset.routeBound = "true";
    el.addEventListener("click", () => setRoute(el.dataset.route));
    if (!el.matches("button,a,input,select")) el.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setRoute(el.dataset.route);
      }
    });
  });
  bindDashboardControls();
  document.querySelectorAll('[data-action="v2-interest"]').forEach((btn) => btn.addEventListener("click", () => {
    const prefs = readPreferences(authState.user?.uid);
    const category2 = btn.dataset.value;
    const categories = prefs.categories.includes(category2) ? prefs.categories.filter((v) => v !== category2) : [...prefs.categories, category2];
    updatePreferences(authState.user?.uid, { categories });
    render();
  }));
  document.querySelectorAll('[data-action="v2-type"]').forEach((btn) => btn.addEventListener("click", () => {
    state.filter.type = btn.dataset.value;
    saveState();
    render();
  }));
  document.querySelectorAll('[data-action="v2-category"]').forEach((btn) => btn.addEventListener("click", () => {
    state.filter.category = btn.dataset.value;
    saveState();
    render();
  }));
  document.querySelectorAll('[data-action="new-request"]').forEach((btn) => {
    if (btn.dataset.actionBound === "true") return;
    btn.dataset.actionBound = "true";
    btn.addEventListener("click", () => newRequestModal());
  });
  document.querySelectorAll('[data-action="new-need"]').forEach((btn) => btn.addEventListener("click", () => newRequestModal("Suche")));
  document.querySelectorAll('[data-action="new-offer"]').forEach((btn) => btn.addEventListener("click", () => newRequestModal("Biete")));
  document.querySelectorAll('[data-action="reply"]').forEach((btn) => btn.addEventListener("click", () => chatModal(btn.dataset.id)));
  document.querySelectorAll('[data-action="open-chat"]').forEach((btn) => btn.addEventListener("click", () => chatModal(btn.dataset.id)));
  document.querySelectorAll('[data-action="edit-request"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => editRequestModal(btn.dataset.id))));
  document.querySelectorAll('[data-action="open-private-chat"]').forEach((btn) => btn.addEventListener("click", () => {
    runAsyncAction(async () => {
      const chat = state.chats.find((item) => item.id === btn.dataset.chatId);
      if (!chat) throw new Error("Chat nicht gefunden. Bitte kurz aktualisieren.");
      chatModalForChat(await ensureChatDocument(chat));
    });
  }));
  document.querySelectorAll('[data-action="set-chat-view"]').forEach((btn) => btn.addEventListener("click", () => {
    state.chatView = btn.dataset.chatView === "trash" ? "trash" : "active";
    saveState();
    render();
  }));
  document.querySelectorAll('[data-action="toggle-chat-mute"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => toggleChatMute(btn.dataset.chatId))));
  document.querySelectorAll('[data-action="trash-chat"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => moveChatToTrash(btn.dataset.chatId))));
  document.querySelectorAll('[data-action="restore-chat"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => restoreChatFromTrash(btn.dataset.chatId))));
  document.querySelectorAll('[data-action="purge-chat"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => purgeChatForCurrentUser(btn.dataset.chatId))));
  document.querySelectorAll('[data-action="complete"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => completeRequest(btn.dataset.id))));
  document.querySelectorAll('[data-action="report"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => reportRequest(btn.dataset.id))));
  document.querySelectorAll('[data-action="raise-escalation"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => raiseRequestEscalation(btn.dataset.id))));
  document.querySelectorAll('[data-action="approve-request-publication"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => decideRequestPublication(btn.dataset.id, "approve"))));
  document.querySelectorAll('[data-action="reject-request-publication"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => decideRequestPublication(btn.dataset.id, "reject"))));
  document.querySelectorAll('[data-action="revise-request-publication"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => decideRequestPublication(btn.dataset.id, "revise"))));
  document.querySelectorAll('[data-action="new-official-notice"]').forEach((btn) => btn.addEventListener("click", newOfficialNoticeModal));
  document.querySelectorAll('[data-action="publish-notice"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => updateOfficialNoticeStatus(btn.dataset.id, "online"))));
  document.querySelectorAll('[data-action="archive-notice"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => updateOfficialNoticeStatus(btn.dataset.id, "archiviert"))));
  document.querySelectorAll('[data-action="onboarding-checklist"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => handleOnboardingChecklistAction(btn.dataset.step, btn.dataset.stepAction))));
  document.querySelectorAll('[data-action="reopen-onboarding"]').forEach((btn) => btn.addEventListener("click", () => openOnboardingTour({ manual: true })));
  document.querySelectorAll('[data-action="focus-official-notices"]').forEach((btn) => btn.addEventListener("click", () => {
    const target = byId("officialNoticesCard");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    target?.focus({ preventScroll: true });
  }));
  document.querySelectorAll('[data-action="new-alert"]').forEach((btn) => btn.addEventListener("click", newAlertModal));
  document.querySelectorAll('[data-action="generate-invite"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(generateInvite)));
  document.querySelectorAll('[data-action="cleanup-legacy-replies"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(cleanupLegacyPublicReplies)));
  document.querySelectorAll('[data-action="resolve-mod"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => resolveModeration(btn.dataset.id, false))));
  document.querySelectorAll('[data-action="escalate-mod"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => resolveModeration(btn.dataset.id, true))));
  document.querySelectorAll('[data-action="request-location-change"]').forEach((btn) => btn.addEventListener("click", requestLocationChangeModal));
  document.querySelectorAll('[data-action="request-name-change"]').forEach((btn) => btn.addEventListener("click", requestNameChangeModal));
  document.querySelectorAll('[data-action="request-verification"]').forEach((btn) => btn.addEventListener("click", requestVerificationModal));
  document.querySelectorAll('[data-action="approve-location"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => approveLocationRequest(btn.dataset.id, true))));
  document.querySelectorAll('[data-action="reject-location"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => approveLocationRequest(btn.dataset.id, false))));
  document.querySelectorAll('[data-action="approve-verification"]').forEach((btn) => btn.addEventListener("click", () => handleVerificationDecisionClick(btn, true)));
  document.querySelectorAll('[data-action="reject-verification"]').forEach((btn) => btn.addEventListener("click", () => handleVerificationDecisionClick(btn, false)));
  document.querySelectorAll('[data-action="view-verification-photo"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => openVerificationPhotoModal(btn.dataset.id))));
  document.querySelectorAll('[data-action="pause-verification"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => setVerificationRequestQueueStatus(btn.dataset.id, "zur\xFCckgestellt"))));
  document.querySelectorAll('[data-action="resume-verification"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => setVerificationRequestQueueStatus(btn.dataset.id, "offen"))));
  document.querySelectorAll('[data-action="edit-verification"]').forEach((btn) => btn.addEventListener("click", () => editVerificationRequestModal(btn.dataset.id)));
  document.querySelectorAll('[data-action="approve-change-request"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => updateChangeRequestStatus(btn.dataset.id, "freigegeben"))));
  document.querySelectorAll('[data-action="review-change-request"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => updateChangeRequestStatus(btn.dataset.id, "in_pruefung"))));
  document.querySelectorAll('[data-action="reject-change-request"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => updateChangeRequestStatus(btn.dataset.id, "abgelehnt"))));
  document.querySelectorAll('[data-action="enable-notifications"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(enableNotifications)));
  document.querySelectorAll('[data-action="test-notification"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(sendNotificationTest)));
  document.querySelectorAll('[data-action="push-diagnostics"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(openPushDiagnosticsModal)));
  document.querySelectorAll('[data-action="add-notification-keyword"]').forEach((btn) => btn.addEventListener("click", () => openNotificationKeywordModal()));
  document.querySelectorAll('[data-action="edit-notification-keyword"]').forEach((btn) => btn.addEventListener("click", () => openNotificationKeywordModal(btn.dataset.id)));
  document.querySelectorAll('[data-action="toggle-notification-keyword"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => toggleNotificationKeyword(btn.dataset.id))));
  document.querySelectorAll('[data-action="delete-notification-keyword"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => deleteNotificationKeyword(btn.dataset.id))));
  document.querySelectorAll('[data-action="save-bulletin-filter"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(saveCurrentBulletinFilter)));
  document.querySelectorAll('[data-action="load-bulletin-filter"]').forEach((btn) => btn.addEventListener("click", loadSavedBulletinFilter));
  document.querySelectorAll('[data-action="delete-bulletin-filter"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(deleteSavedBulletinFilter)));
  document.querySelectorAll('[data-action="translate-dynamic"]').forEach((btn) => btn.addEventListener("click", () => {
    openDynamicTranslateModal(btn.dataset.translateKind || "", btn.dataset.translateId || "");
  }));
  document.querySelectorAll('[data-action="sync-now"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(async () => {
    await syncStateFromFirestore();
    render();
    toast("Nutzerdaten aktualisiert.");
  })));
  document.querySelectorAll('[data-action="mark-alert-read"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => markAlertRead(btn.dataset.id))));
  document.querySelectorAll('[data-action="passkey-check"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(passkeyCheck)));
  document.querySelectorAll('[data-action="export-own-data"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(exportOwnData)));
  document.querySelectorAll('[data-action="delete-own-account"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(deleteOwnAccountData)));
  document.querySelectorAll('[data-action="reset-local-data"]').forEach((btn) => btn.addEventListener("click", resetLocalData));
  document.querySelectorAll('[data-action="toggle-edit-card"]').forEach((btn) => btn.addEventListener("click", () => {
    const cardId = btn.dataset.editCardId || "";
    setEditCardOpen(cardId, !isEditCardOpen(cardId));
  }));
  document.querySelectorAll('[data-action="cancel-edit-card"]').forEach((btn) => btn.addEventListener("click", () => {
    setEditCardOpen(btn.dataset.editCardId || "", false);
  }));
  document.querySelectorAll('[data-action="user-history"]').forEach((btn) => btn.addEventListener("click", () => userHistoryModal(btn.dataset.uid)));
  document.querySelectorAll('[data-action="toggle-user-status"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => toggleUserAccountStatus(btn.dataset.uid))));
  document.querySelectorAll('[data-action="review-municipality"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => reviewMunicipalityAccount(btn.dataset.uid, btn.dataset.approved === "true"))));
  document.querySelectorAll('[data-action="revoke-verification"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(() => revokeUserVerification(btn.dataset.uid))));
  document.querySelectorAll('[data-action="logout"]').forEach((btn) => btn.addEventListener("click", () => runAsyncAction(signOutCurrentUser)));
  document.querySelectorAll('[data-action="set-admin-users-view"]').forEach((btn) => btn.addEventListener("click", () => {
    const ui = adminUsersUiState();
    ui.view = btn.dataset.adminUsersView === "archive" ? "archive" : "active";
    ui.page = 1;
    saveState();
    render();
  }));
  document.querySelectorAll('[data-action="admin-users-page"]').forEach((btn) => btn.addEventListener("click", () => {
    const ui = adminUsersUiState();
    ui.page = Math.max(1, Number(btn.dataset.page || 1));
    saveState();
    render();
  }));
  const adminFilterBindings = [
    ["adminUserStatus", "status", "change"],
    ["adminUserRole", "role", "change"],
    ["adminUserAccountType", "accountType", "change"],
    ["adminUserVerification", "verification", "change"],
    ["adminUserCanton", "canton", "change"],
    ["adminUserSort", "sort", "change"],
    ["adminUserDir", "dir", "change"],
    ["adminUserPageSize", "pageSize", "change"],
    ["adminUserQ", "q", "input"]
  ];
  adminFilterBindings.forEach(([id, key, eventName]) => {
    byId(id)?.addEventListener(eventName, (event) => {
      const ui = adminUsersUiState();
      ui[key] = key === "pageSize" ? Number(event.target.value || 20) : event.target.value;
      ui.page = 1;
      saveState();
      render();
    });
  });
  const q = byId("filterQ");
  const category = byId("filterCategory");
  const type = byId("filterType");
  const distance = byId("filterDistance");
  q?.addEventListener("input", (event) => {
    const position = event.target.selectionStart;
    state.filter.q = event.target.value;
    saveState();
    const filtersOpen = Boolean(document.querySelector(".v2-filter-drawer")?.open);
    render();
    const input = byId("filterQ");
    if (input) {
      input.focus({ preventScroll: true });
      try {
        input.setSelectionRange(position, position);
      } catch {
      }
    }
    const drawer = document.querySelector(".v2-filter-drawer");
    if (drawer) drawer.open = filtersOpen;
  });
  category?.addEventListener("change", (event) => {
    state.filter.category = event.target.value;
    saveState();
    render();
  });
  type?.addEventListener("change", (event) => {
    state.filter.type = event.target.value;
    saveState();
    render();
  });
  distance?.addEventListener("change", (event) => {
    state.filter.distanceKm = event.target.value;
    saveState();
    if (parseDistanceFilterKm(state.filter.distanceKm) > 0) {
      void ensureViewerGeo({ silent: true }).then(() => render());
    }
    render();
  });
  byId("themeChoiceSelect")?.addEventListener("change", (event) => {
    setThemeChoice(event.target.value, { notify: true });
  });
  byId("localeChoiceSelect")?.addEventListener("change", (event) => {
    setLocale(event.target.value);
    syncCurrentUser({ locale: currentLocale() });
    if (isFirebaseMode()) {
      void updateFirebaseProfile({ locale: currentLocale() }).catch((error) => reportBackgroundError("Sprache speichern", error, { notify: false, collection: FIRESTORE_COLLECTIONS.users }));
    }
    render();
    toast("Sprache gespeichert.");
  });
  const profileForm = byId("profileForm");
  profileForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const nextTitlePreset = normalizeTitlePresetForProfile(String(data.titlePreset || "auto"), state.profile);
    state.profile = {
      ...state.profile,
      titleVisible: Boolean(data.titleVisible),
      titlePreset: nextTitlePreset
    };
    if (authState.user) {
      syncCurrentUser({
        titleVisible: state.profile.titleVisible,
        titlePreset: state.profile.titlePreset,
        locale: currentLocale()
      });
    }
    if (isFirebaseMode()) {
      await updateFirebaseProfile({
        titleVisible: state.profile.titleVisible,
        titlePreset: state.profile.titlePreset,
        locale: currentLocale()
      });
      await syncStateFromFirestore();
    }
    addChange(`Profil aktualisiert: ${state.profile.initials}`);
    editCards.delete("profile-identity");
    saveState();
    render();
    toast("Profil gespeichert.");
  });
  const notificationPreferencesForm = byId("notificationPreferencesForm");
  notificationPreferencesForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    runAsyncAction(() => saveNotificationPreferencesForm(form));
  });
  const adminRoleForm = byId("adminRoleForm");
  adminRoleForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    runAsyncAction(async () => {
      await updateUserRoleByEmail(String(data.email || ""), String(data.role || "resident"), String(data.adminScopeArea || ""));
      editCards.delete("admin-roles");
      render();
    });
  });
  const areaPriorityForm = byId("areaPriorityForm");
  areaPriorityForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    runAsyncAction(() => updateAreaCategoryPriority(String(data.priorityRaw || "")));
  });
  scheduleSwissMapHydration();
}
byId("logoutButton")?.addEventListener("click", () => runAsyncAction(signOutCurrentUser));
byId("helpButton")?.addEventListener("click", () => openHelpModal());
document.querySelector(".v21-inbox-shortcut")?.addEventListener("click", () => setRoute("inbox"));
byId("themeButton")?.addEventListener("click", cycleThemeChoice);
byId("headerRegisterButton")?.addEventListener("click", () => {
  authMode = "register";
  render();
  byId("main")?.focus();
});
byId("headerLoginButton")?.addEventListener("click", () => {
  authMode = "login";
  render();
  byId("main")?.focus();
});
document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const legalButton = event.target.closest('[data-action="open-legal"]');
  if (!legalButton) return;
  const section = legalButton.dataset.legal || "privacy";
  openLegalModal(section);
});
window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  toast("Quartinaut wurde installiert.");
  render();
});
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
});
window.addEventListener("online", render);
window.addEventListener("offline", render);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && authState.user) render();
});
window.addEventListener("load", () => {
  setupConnectivity();
  void setupPwaUpdates();
});
var V50_NAV = [
  { id: "v50calendar", title: "Gemeindekalender", desc: "Entsorgung & offizielle Termine", icon: "\u{1F5D3}\uFE0F" },
  { id: "v50loans", title: "Ausleihkalender", desc: "Zeitr\xE4ume anfragen & best\xE4tigen", icon: "\u{1F9F0}" },
  { id: "v50associations", title: "Vereinsanmeldungen", desc: "Pl\xE4tze & Wartelisten", icon: "\u{1F465}" },
  { id: "v50market", title: "Marktreservierungen", desc: "Zeitlich begrenzte Reservationen", icon: "\u{1F6CD}\uFE0F" }
];
var v50 = { loaded: false, busy: false, error: "", id: "", calendar: [], loans: [], associations: [], market: [] };
function v50Go(route, id = "") {
  v50.id = id;
  hubState.section = route;
  setRoute("hub");
  void v50Load();
}
async function v50Load() {
  if (!authState.user || v50.busy) return;
  v50.busy = true;
  v50.error = "";
  const uidBefore = authState.user.uid, epochBefore = accountEpoch;
  if (state.route === "hub") render();
  const reqs = ["calendar.list", "loan.list", "association.list", "market.list"];
  const results = await Promise.allSettled(reqs.map((action) => callQuartinaut("quartinautV50", { action })));
  if (!currentAccountEpoch(uidBefore, epochBefore)) return;
  ["calendar", "loans", "associations", "market"].forEach((name, i) => {
    if (results[i].status === "fulfilled") v50[name] = results[i].value?.entries || results[i].value?.items || [];
  });
  if (results.some((x) => x.status === "rejected")) v50.error = "Deine Termine oder Anfragen konnten nicht vollst\xE4ndig geladen werden. Bitte pr\xFCfe deine Internetverbindung und versuche es erneut.";
  v50.loaded = !v50.error;
  v50.busy = false;
  if (state.route === "hub" && hubState.section.startsWith("v50") || ["enh-qr", "enh-trust", "calendar-planner"].includes(state.route)) render();
}
function v50Title(id) {
  return hubState.items.find((x) => x.id === id)?.title || "Quartierangebot";
}
function v50Date(v) {
  if (!v) return "\u2013";
  const d = new Date(v);
  return Number.isFinite(+d) ? d.toLocaleString("de-CH", { dateStyle: "medium", timeStyle: "short" }) : escapeHtml(String(v));
}
function v50Options(kinds) {
  const items = hubState.items.filter((x) => kinds.includes(x.kind) && x.status === "published" && x.availability !== "completed");
  return items.map((i) => `<option value="${escapeHtml(i.id)}" ${i.id === v50.id ? "selected" : ""}>${escapeHtml(i.title)} \xB7 ${escapeHtml(i.area || "")}</option>`).join("");
}
function v50Control(action, label, props = {}, primary = false) {
  return `<button type="button" class="${primary ? "secondary-button" : "ghost-button"} small" data-v50-action="${action}" ${Object.entries(props).map(([key, val]) => `data-${key}="${escapeHtml(val)}"`).join(" ")}>${label}</button>`;
}
function v50Cal() {
  const canPost = isAdminRole() || isAreaAdminRole() || state.profile.accountType === "municipality" && state.profile.municipalityStatus === "verified" && state.profile.verified === true;
  return `<div class="v50-panel"><h2>Gemeindetermine und Entsorgung</h2><p>Termine aus verifizierten Gemeindekonten. Kalendereintr\xE4ge (.ics) erinnern auf Wunsch am Vorabend; es erfolgt keine automatische Push-Anmeldung.</p>
 ${canPost ? `<details class="v50-form"><summary>+ Offiziellen Termin hinzuf\xFCgen</summary><form class="form-grid" data-v50-form="calendar.create"><label>Titel<input name="title" minlength="4" maxlength="100" required></label><label>Kategorie<select name="kind"><option value="waste">Entsorgung</option><option value="municipality">Gemeindetermin</option><option value="association">Vereinstermin</option><option value="event">Veranstaltung</option></select></label><label>Datum<input type="date" name="date" required></label><label>Ort<input name="venue" maxlength="120"></label><label>Beschreibung<textarea name="description" maxlength="1200"></textarea></label><label>Offizielle Quellen-URL (bei Entsorgung Pflicht)<input type="url" name="sourceUrl" maxlength="300" placeholder="https://..."></label><button class="primary-button">Termin ver\xF6ffentlichen</button></form></details>` : ""}
 <div class="v50-grid">${v50.calendar.length ? v50.calendar.map((e) => `<article class="v50-card"><h3>${escapeHtml(e.title)}</h3><p>${escapeHtml(dateOnlyLabel(e.date))} \xB7 ${escapeHtml(e.area || "")}</p><p>${escapeHtml(e.description || "")}</p><div class="row-actions"><button type="button" class="secondary-button small" data-v50-ics="calendar" data-id="${escapeHtml(e.id)}">Mit Erinnerung \xFCbernehmen</button>${e.sourceUrl ? `<a href="${escapeHtml(e.sourceUrl)}" rel="noopener noreferrer" target="_blank">Offizielle Quelle</a>` : ""}</div></article>`).join("") : '<p class="empty">Noch keine offiziellen Termine verf\xFCgbar.</p>'}</div></div>`;
}
function v50Loan() {
  return `<div class="v50-panel"><h2>Ausleihe anfragen</h2><p>W\xE4hle einen Gegenstand und den gew\xFCnschten Zeitraum. Die andere Person muss deine Anfrage best\xE4tigen.</p>
 <form class="form-grid v50-form" data-v50-form="loan.request"><label>Gegenstand<select name="listingId" required>${v50Options(["lend"])}</select></label><label>\xDCbergabe \xB7 Datum und Uhrzeit<input type="datetime-local" name="from" required></label><label>R\xFCckgabe \xB7 Datum und Uhrzeit<input type="datetime-local" name="to" required></label><button class="primary-button">Zeitraum anfragen</button></form><h3>Meine Anfragen</h3><div class="v50-grid">
 ${v50.loans.map((e) => `<article class="v50-card"><h3>${escapeHtml(v50Title(e.listingId))}</h3><p>${v50Date(e.from)} \u2013 ${v50Date(e.to)}</p><p>Status: <strong>${escapeHtml(statusLabel(e.status))}</strong></p><div class="row-actions">${e.status === "requested" && e.ownerUid === authState.user?.uid ? v50Control("loan.accept", "Best\xE4tigen", { id: e.id }, true) + v50Control("loan.decline", "Ablehnen", { id: e.id }) : ""}${e.status === "requested" && e.borrowerUid === authState.user?.uid ? v50Control("loan.cancel", "Stornieren", { id: e.id }) : ""}${e.status === "accepted" && e.ownerUid === authState.user?.uid ? v50Control("loan.return", "R\xFCckgabe best\xE4tigen", { id: e.id }, true) : ""}${e.status === "accepted" ? `<button class="ghost-button small" data-v50-ics="loan" data-id="${escapeHtml(e.id)}">Kalendererinnerung</button>` : ""}</div></article>`).join("") || '<p class="empty">Noch keine Ausleihen.</p>'}</div></div>`;
}
function v50Assoc() {
  return `<div class="v50-panel"><h2>Vereine und Gruppen \u2013 Anmeldung</h2><p>Bei vollen Veranstaltungen werden weitere Personen automatisch auf die Warteliste gesetzt.</p><form class="form-grid v50-form" data-v50-form="association.signup"><label>Verein oder Quartierprojekt<select name="eventId" required>${v50Options(["group", "project"])}</select></label><button class="primary-button">Anmelden</button></form><h3>Meine Anmeldungen / Teilnehmende</h3><div class="v50-grid">${v50.associations.map((e) => `<article class="v50-card"><h3>${escapeHtml(v50Title(e.eventId))}</h3><p>${e.displayName ? escapeHtml(e.displayName) + " \xB7 " : ""}Status: <strong>${escapeHtml(statusLabel(e.status))}</strong></p><div class="row-actions">${["confirmed", "waitlisted"].includes(e.status) && (e.uid === authState.user?.uid || e.organizerUid === authState.user?.uid) ? v50Control("association.cancel", "Stornieren", { id: e.id }) : ""}${e.organizerUid === authState.user?.uid && e.status === "waitlisted" ? v50Control("association.manage", "Von Warteliste best\xE4tigen", { id: e.id, decision: "confirm" }, true) : ""}${e.organizerUid === authState.user?.uid && ["confirmed", "waitlisted"].includes(e.status) ? v50Control("association.manage", "Ablehnen", { id: e.id, decision: "decline" }) : ""}</div></article>`).join("") || '<p class="empty">Noch keine Anmeldungen.</p>'}</div></div>`;
}
function v50Market() {
  return `<div class="v50-panel"><h2>Marktplatz \u2013 Reservationen mit Ablauf</h2><p>30 bis 240 Minuten reservieren, durch Verk\xE4ufer best\xE4tigen und danach als abgeschlossen markieren. Es werden keine Zahlungen verarbeitet.</p><form class="form-grid v50-form" data-v50-form="market.request"><label>Artikel<select name="listingId" required>${v50Options(["market"])}</select></label><label>Zeitraum<select name="minutes"><option value="30">30 Minuten</option><option value="60">1 Stunde</option><option value="120">2 Stunden</option><option value="240">4 Stunden</option></select></label><button class="primary-button">Artikel reservieren</button></form><h3>Meine Reservationen</h3><div class="v50-grid">${v50.market.map((e) => `<article class="v50-card"><h3>${escapeHtml(v50Title(e.listingId))}</h3><p>Status: <strong>${escapeHtml(statusLabel(e.status))}</strong></p><p>G\xFCltig bis ${v50Date(e.expiresAt)}</p><div class="row-actions">${e.buyerUid === authState.user?.uid && ["requested", "accepted"].includes(e.status) ? v50Control("market.cancel", "Stornieren", { "listing-id": e.listingId }) : ""}${e.sellerUid === authState.user?.uid && e.status === "requested" ? v50Control("market.accept", "Best\xE4tigen", { "listing-id": e.listingId }, true) + v50Control("market.decline", "Ablehnen", { "listing-id": e.listingId }) : ""}${e.sellerUid === authState.user?.uid && e.status === "accepted" ? v50Control("market.complete", "Verkauf abschliessen", { "listing-id": e.listingId }, true) : ""}<button class="ghost-button small" data-v50-seller="${escapeHtml(e.listingId)}">Verk\xE4uferprofil</button></div></article>`).join("") || '<p class="empty">Noch keine Reservationen.</p>'}</div></div>`;
}
function renderV50(section) {
  let views = { v50calendar: v50Cal, v50loans: v50Loan, v50associations: v50Assoc, v50market: v50Market };
  return `<section class="v50-module">${v50.busy ? '<p role="status">Anfragen werden geladen \u2026</p>' : ""}${v50.error ? `<p class="v3-safety-note" role="alert">${escapeHtml(v50.error)}</p>` : ""}${views[section]?.() || ""}</section>`;
}
function bindV50() {
  document.querySelectorAll("[data-v50-open]").forEach((b) => b.addEventListener("click", () => v50Go(b.dataset.v50Open, b.dataset.id || "")));
  document.querySelectorAll("[data-v50-reload]").forEach((b) => b.addEventListener("click", () => void v50Load()));
  document.querySelectorAll("[data-v50-action]").forEach((b) => b.addEventListener("click", () => runAsyncAction(async () => {
    b.disabled = true;
    try {
      await callQuartinaut("quartinautV50", { action: b.dataset.v50Action, id: b.dataset.id, listingId: b.dataset.listingId, decision: b.dataset.decision });
      await v50Load();
      await loadHub(true);
      toast({ "loan.accept": "Ausleihe best\xE4tigt. Die \xDCbergabe kann jetzt stattfinden.", "loan.decline": "Ausleihanfrage abgelehnt.", "loan.cancel": "Ausleihanfrage storniert.", "loan.return": "R\xFCckgabe erfolgreich best\xE4tigt.", "association.cancel": "Anmeldung wurde storniert.", "association.manage": "Teilnehmerstatus aktualisiert.", "market.cancel": "Reservation aufgehoben.", "market.accept": "Reservation best\xE4tigt.", "market.decline": "Reservation abgelehnt.", "market.complete": "Verkauf abgeschlossen." }[b.dataset.v50Action] || "Status aktualisiert.");
    } finally {
      b.disabled = false;
    }
  })));
  document.querySelectorAll("[data-v50-seller]").forEach((b) => b.addEventListener("click", () => runAsyncAction(async () => {
    const r = await callQuartinaut("quartinautV50", { action: "market.seller", listingId: b.dataset.v50Seller });
    openModal("Verk\xE4uferprofil", `<h3>${escapeHtml(r.seller?.displayName || "Quartiermitglied")}</h3><p>${r.seller?.verified ? "Verifiziert" : "Nicht verifiziert"}</p>`);
  })));
  document.querySelectorAll("[data-v50-ics]").forEach((b) => b.addEventListener("click", () => {
    const kind = b.dataset.v50Ics, e = (kind === "calendar" ? v50.calendar : v50.loans).find((x) => x.id === b.dataset.id);
    if (!e) return;
    try {
      saveIcs(makeIcs({ ...e, title: e.title || "Ausleihe " + v50Title(e.listingId) }, kind), e.id);
    } catch (err) {
      toast(err.message);
    }
  }));
  document.querySelectorAll("[data-v50-form]").forEach((f) => f.addEventListener("submit", (event) => {
    event.preventDefault();
    if (f.dataset.sending) return;
    const action = f.dataset.v50Form, inputs = Object.fromEntries(new FormData(f).entries()), btn = f.querySelector("button");
    const data = { action, ...inputs };
    if (action === "calendar.create") data.entry = inputs;
    if (action === "loan.request") {
      if (!inputs.from || !inputs.to) return toast("Bitte \xDCbergabe und R\xFCckgabe eingeben.");
      data.from = new Date(inputs.from).toISOString();
      data.to = new Date(inputs.to).toISOString();
      f.dataset.opId ||= makeOperationId("loan");
      data.opId = f.dataset.opId;
    }
    if (action === "market.request") data.minutes = Number(inputs.minutes);
    f.dataset.sending = "yes";
    if (btn) btn.disabled = true;
    runAsyncAction(async () => {
      try {
        await callQuartinaut("quartinautV50", data);
        delete f.dataset.opId;
        await v50Load();
        await loadHub(true);
        toast({ "calendar.create": "Gemeindetermin ver\xF6ffentlicht.", "loan.request": "Ausleihanfrage gesendet. Warte auf die Best\xE4tigung.", "association.signup": "Anmeldung \xFCbermittelt. Pr\xFCfe den Anmeldestatus.", "market.request": "Reservation angefragt. Der Verk\xE4ufer kann best\xE4tigen." }[action] || "Eintrag gespeichert.");
      } finally {
        delete f.dataset.sending;
        if (btn) btn.disabled = false;
      }
    });
  }));
}
void initLocations().then(() => {
  const editing = document.activeElement?.closest?.("#authForm");
  if (editing) {
    document.activeElement?.addEventListener("blur", () => render(), { once: true });
  } else render();
}).catch(() => {
  if (!document.activeElement?.closest?.("#authForm")) render();
});
if (parseDistanceFilterKm(state.filter.distanceKm) > 0) {
  void ensureViewerGeo({ silent: true }).then(() => render());
}
document.addEventListener("click", (event) => {
  if (!event.target.closest("[data-v4-create]")) return;
  event.preventDefault();
  openModal("Was m\xF6chtest du erstellen?", `<div class="v4-create-grid">
  <button type="button" data-v4-create-kind="need">\u{1F91D} <strong>Hilfe suchen</strong><small>Unterst\xFCtzung anfragen</small></button>
  <button type="button" data-v4-create-kind="offer">\u{1F49A} <strong>Hilfe anbieten</strong><small>Nachbarn unterst\xFCtzen</small></button>
  <button type="button" data-v4-create-kind="lend">\u{1F9F0} <strong>Etwas verleihen</strong><small>Leihb\xF6rse</small></button>
  <button type="button" data-v4-create-kind="market">\u{1F6CD}\uFE0F <strong>Etwas verkaufen</strong><small>Marktplatz</small></button>
  <button type="button" data-v4-create-kind="group">\u{1F465} <strong>Gruppe oder Verein</strong><small>Gemeinschaft</small></button>
  <button type="button" data-v4-create-kind="project">\u{1F331} <strong>Quartierprojekt</strong><small>Freiwilligenaktion</small></button>
 </div>`, (modal, close) => {
    modal.querySelectorAll("[data-v4-create-kind]").forEach((btn) => btn.addEventListener("click", () => {
      const kind = btn.dataset.v4CreateKind;
      close();
      if (kind === "need" || kind === "offer") {
        setRoute("home");
        document.querySelector(`[data-action="${kind === "need" ? "new-need" : "new-offer"}"]`)?.click();
      } else {
        hubState.section = kind;
        setRoute("hub");
        if (!hubState.loaded) void loadHub();
      }
    }));
  });
});
installAccessibilityShell();
nativeWeb = createNativeParity({
  escape: escapeHtml,
  auth: () => authState.user,
  state: () => state,
  hub: () => hubState.items,
  hubSection: () => hubState.section,
  call: callQuartinautRaw,
  setRoute,
  run: runAsyncAction,
  schedule: scheduleRender,
  toast,
  modal: openModal,
  newRequest: newRequestModal,
  openHubCreate,
  openTarget: v47OpenTarget,
  help: openHelpModal,
  openHub: (section) => {
    hubState.section = section;
    setRoute("hub");
    if (section.startsWith("v50")) void v50Load();
    else void loadHub();
  },
  readAudience: async (ids) => {
    const { db, doc, getDocFromServer } = firebaseStoreApi;
    const results = await Promise.allSettled(ids.slice(0, 200).map((id) => getDocFromServer(doc(db, "quartinautAudienceFeeds", authState.user.uid, "items", id))));
    return results.filter((x) => x.status === "fulfilled" && x.value.exists()).map((x) => normalizeRequestDoc({ id: x.value.id, ...x.value.data() }));
  },
  setRegional: (rows) => {
    regionalRequests = rows;
    state.requests = mergeById([...state.requests.filter((x) => !x.id.startsWith("arq_")), ...rows]);
  },
  backgroundReset: resetPrivateWebMemory,
  backgroundLoad: async () => {
    await loadCloudDashboardPhoto(authState.user.uid);
  },
  refreshBookmarks: () => document.querySelectorAll(".v44-social-actions").forEach(v44RefreshSocial),
  requestCard,
  hubCard: hubItemCard,
  statusLabel,
  date: communityDate,
  locations: () => locationData.cantons,
  coat: (code) => window.QUARTINAUT_LOCAL_COATS?.[code] || "",
  overview: renderV48QuickOverview,
  recommendations: () => renderRelevantHomeCard(state.requests.filter((x) => x.status === "offen").slice(0, 3)),
  quickActions: renderV53QuickActions,
  priorities: renderV53Priorities,
  notices: renderOfficialNoticesCard,
  oldFavorites: renderSavedCollection,
  adminOverview: () => isAdminRole() ? renderAdminWorkQueueCard(pendingPublicationRequests(), state.moderation.filter((x) => x.status === "offen"), 0) : "",
  settings: renderProfile,
  theme: storedThemeChoice,
  setTheme: setThemeChoice,
  legal: openLegalModal,
  intro: () => openOnboardingTour({ manual: true }),
  notifications: enableNotifications,
  uploadPhotos: uploadPostPhotos,
  saveDraft: (f) => saveFormDraft(f, draftKey(f)),
  photoStatus: postPhotoStatus,
  loadTransactions: v50Load,
  loans: () => v50.loans,
  marketEntries: () => v50.market,
  calendarEntries: () => v50.calendar,
  chatImage: async (path) => {
    const expected = authState.user.uid, epoch = accountEpoch, key = expected + ":" + path;
    if (privateChatUrls.has(key)) return privateChatUrls.get(key);
    const api = await initFirebaseStorage(), blob = await api.getBlob(api.ref(api.storage, path));
    if (!currentAccountEpoch(expected, epoch)) throw Error("Konto gewechselt.");
    const url = URL.createObjectURL(blob);
    if (privateChatUrls.size >= 30) {
      const first = privateChatUrls.keys().next().value;
      URL.revokeObjectURL(privateChatUrls.get(first));
      privateChatUrls.delete(first);
    }
    privateChatUrls.set(key, url);
    return url;
  },
  uploadChatImage: async (chatId, operationId, file) => {
    const expected = authState.user.uid, epoch = accountEpoch;
    const photo = await preparePostPhoto(file), messageId = "msg_" + expected + "_" + operationId, path = "chat-media/" + chatId + "/" + expected + "/" + messageId + ".jpg", api = await initFirebaseStorage();
    if (!currentAccountEpoch(expected, epoch)) throw Error("Konto gewechselt.");
    await api.uploadString(api.ref(api.storage, path), photo.dataUrl, "data_url", { contentType: "image/jpeg", customMetadata: { chatId, senderUid: expected, messageId } });
    return { storagePath: path, contentType: "image/jpeg", size: photo.size };
  }
});
configureDashboardCloud({ call: callQuartinautRaw, currentUid: () => authState.user?.uid });
nativeWeb.initialize();
window.addEventListener("popstate", () => {
  const route = new URLSearchParams(location.search).get("route") || "home";
  if (VALID_ROUTES.includes(route)) {
    state.route = route;
    render();
  }
});
applyTheme();
saveState();
render();
void initAuth();
