package ch.quartinaut.nativeapp

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

/** A single, task-oriented directory shared by Quartier+ and Quartinaut Extras.
 * Every function has exactly one home; old routes remain intact.
 */
private data class QuartierLink(
    val route: String, val title: String, val description: String, val symbol: String
)
private data class QuartierSubsection(
    val id: String, val title: String, val description: String,
    val links: List<QuartierLink>
)
private data class QuartierSection(
    val id: String, val title: String, val description: String,
    val icon: ImageVector, val subsections: List<QuartierSubsection>
) {
    val count: Int get() = subsections.sumOf { it.links.size }
}

private fun link(route: String, title: String, description: String, symbol: String) =
    QuartierLink(route, title, description, symbol)

private val quartierSections = listOf(
    QuartierSection("entdecken", "Entdecken & Informieren",
        "Angebote finden, Neues erfahren und Orte erkunden", Icons.Default.TravelExplore,
        listOf(
            QuartierSubsection("angebote", "Beiträge & Angebote", "Was gibt es in deiner Umgebung?",
                listOf(
                    link("board","Schwarzes Brett","Hilfegesuche und Angebote aus dem Quartier","📋"),
                    link("market","Marktplatz","Kaufen, verkaufen, tauschen und verschenken","🛍️"),
                    link("lend","Leihbörse","Gegenstände aus deiner Nähe ausleihen","🧰"),
                    link("lost","Verloren & Gefunden","Vermisste und gefundene Dinge","🔎"),
                    link("enh-radar","Quartinaut Radar","Passende Neuigkeiten aus Gemeinde und Kanton","📡"),
                    link("search","Alles durchsuchen","Beiträge, Gemeinden und Mitteilungen finden","🔍")
                )),
            QuartierSubsection("karten", "Karten & Gemeinden", "Die Schweiz und deine Nachbarschaft",
                listOf(
                    link("map","Schweizkarte","Kantone und Gemeinden erkunden","🇨🇭"),
                    link("enh-map","Schweizkarte+","Interaktive Gemeinde- und Kantonsansicht","🗺️"),
                    link("municipal-compare","Gemeinden vergleichen","Zwei Gemeinden gegenüberstellen","🏘️")
                ))
        )),
    QuartierSection("erstellen", "Erstellen & Veröffentlichen",
        "Beiträge, Gesuche und Meldungen erfassen", Icons.Default.EditNote,
        listOf(
            QuartierSubsection("inserate", "Inserate erstellen", "Verkaufen, verleihen und Fundstücke melden",
                listOf(
                    link("create","Eintrag erstellen","Alle verfügbaren Beitragstypen wählen","➕"),
                    link("hub-create:market","Marktplatz-Inserat","Verkaufen, verschenken oder tauschen","🛍️"),
                    link("hub-create:lend","Ausleih-Angebot","Einen Gegenstand zur Ausleihe anbieten","🧰"),
                    link("hub-create:lost","Fundmeldung","Verlorenes oder Gefundenes veröffentlichen","🔎")
                )),
            QuartierSubsection("nachbarschaft", "Hilfe & Nachbarschaft", "Andere unterstützen oder Hilfe finden",
                listOf(
                    link("create-request","Hilfe suchen","Ein neues Anliegen erstellen","🙋"),
                    link("create-offer","Hilfe anbieten","Unterstützung im Quartier anbieten","🤝"),
                    link("hub-create:project","Quartieraktion organisieren","Gemeinsame Aktivitäten veröffentlichen","🌱")
                )),
            QuartierSubsection("gemeindebeitrag", "Vereine & Gemeinde", "Informationen und Anliegen einreichen",
                listOf(
                    link("hub-create:group","Verein vorstellen","Vereins- oder Gruppeneintrag erstellen","👥"),
                    link("hub-create:issue","Mangel melden","Ein Problem in der Gemeinde dokumentieren","⚠️"),
                    link("hub-create:calendar","Termin eintragen","Gemeindetermin erstellen, falls berechtigt","📆"),
                    link("enh-assist","Inserat-Assistent","Titel und Kategorien vorbereiten","✨")
                ))
        )),
    QuartierSection("meine", "Meine Aktivitäten",
        "Deine Einträge, Reservierungen und Kontakte", Icons.Default.BookmarkBorder,
        listOf(
            QuartierSubsection("inhalte", "Meine Inhalte", "Eigene und gespeicherte Beiträge",
                listOf(
                    link("enh-posts","Meine Beiträge","Bearbeiten, pausieren und abschliessen","📝"),
                    link("enh-favorites","Meine Favoriten","Gespeicherte Inserate und Angebote","⭐"),
                    link("personal-center","Mein Quartinaut","Aktivitäten, Verlauf und Schnellzugriffe","👤")
                )),
            QuartierSubsection("buchungen", "Ausleihen & Reservationen", "Anfragen, Übergaben und Rückgaben",
                listOf(
                    link("v50market","Meine Reservationen","Marktplatz-Reservationen verwalten","🛒"),
                    link("v50loans","Meine Ausleihen","Laufende Ausleihen und Rückgaben","📅"),
                    link("enh-loans","Ausleih-Planer","Zeiträume und Anfragen koordinieren","🗓️"),
                    link("enh-qr","QR-Übergabe","Übergaben sicher bestätigen","🔳")
                )),
            QuartierSubsection("kommunikation", "Nachrichten & Termine", "Alles Wichtige für dich",
                listOf(
                    link("chats","Private Nachrichten","Deine privaten Unterhaltungen","💬"),
                    link("calendar-planner","Meine Termine","Termine in Android-Kalender übernehmen","📅")
                ))
        )),
    QuartierSection("gemeinde", "Gemeinde & Gemeinschaft",
        "Vereine, Veranstaltungen und offizielle Informationen", Icons.Default.Groups,
        listOf(
            QuartierSubsection("vereine", "Vereine & Gruppen", "Engagieren und gemeinsam aktiv werden",
                listOf(
                    link("group","Vereine & Gruppen","Gemeinschaften in deiner Nähe entdecken","👥"),
                    link("enh-clubs","Vereinszentrale","Anmeldungen und Mitglieder verwalten","🏘️"),
                    link("v50associations","Meine Vereinsanmeldungen","Teilnahmen und Wartelisten","✅"),
                    link("project","Quartieraktionen","Gemeinsame Aktionen und Freiwilligenarbeit","🌱")
                )),
            QuartierSubsection("kalender", "Kalender & Veranstaltungen", "Anlässe und wichtige Daten",
                listOf(
                    link("calendar","Gemeindekalender","Termine, Veranstaltungen und Entsorgung","📆"),
                    link("enh-calendar","Gemeindekalender+","Kalender, Entsorgung und Erinnerungen","🗓️"),
                    link("official-calendar","Offizielle Termine","Bestätigte Schweizer Termine und Feiertage","🇨🇭")
                )),
            QuartierSubsection("mitteilungen", "Informationen & Warnungen", "Was die Gemeinde mitteilt",
                listOf(
                    link("community-pulse","Gemeinde aktuell","Neuigkeiten und Beiträge im Überblick","📣"),
                    link("official","Offizielle Mitteilungen","Nachrichten deiner Gemeinde","📢"),
                    link("alerts","Gemeinde-Alarme","Wichtige Hinweise und Warnungen","🚨"),
                    link("issue","Gemeldete Mängel","Meldungen zu Problemen vor Ort ansehen","⚠️")
                ))
        )),
    QuartierSection("sicherheit", "Sicherheit & Einstellungen",
        "Vertrauen, Datenschutz und Offline-Nutzung", Icons.Default.Shield,
        listOf(
            QuartierSubsection("schutz", "Schutz & Vertrauen", "Sicher und transparent unterwegs",
                listOf(
                    link("enh-trust","Vertrauensprofile","Verifizierungen und Bewertungen ansehen","🛡️"),
                    link("safety-center","Sicherheit","Meldungen, Privatsphäre und Schutzfunktionen","🔐"),
                    link("help","Hilfe & Datenschutz","Hinweise und Kontaktmöglichkeiten","❓")
                )),
            QuartierSubsection("system", "App & Offline", "Deine technischen Einstellungen",
                listOf(
                    link("enh-offline","Offline-Modus","Gespeicherte Daten ohne Internet nutzen","📱"),
                    link("settings","Einstellungen","Darstellung und App-Verhalten anpassen","⚙️"),
                    link("diagnostics","Verbindungsdiagnose","Datenverbindung und Synchronisation prüfen","🔧")
                ))
        ))
)

/** Explicit route allowlist to protect against broken links and accidental duplicates. */
internal fun quartierNavigationRoutes(): List<String> =
    quartierSections.flatMap { section ->
        section.subsections.flatMap { subsection -> subsection.links.map { it.route } }
    }

internal fun quartierSectionTitle(id: String): String =
    quartierSections.firstOrNull { it.id == id }?.title ?: "Quartier+"

/** Area names may already contain the canton abbreviation. */
internal fun quartierAreaLabel(area: String, canton: String): String {
    val base=area.trim()
    val suffix=if(canton.isBlank()) "" else " ("+canton.trim()+")"
    return base.removeSuffix(suffix).trim()+suffix
}

/** Only action titles and descriptions are indexed, never private content. */
internal fun quartierMatchingRoutes(term: String): List<Triple<String, String, String>> {
    val needle = term.trim()
    if (needle.isBlank()) return emptyList()
    return quartierSections.flatMap { section ->
        section.subsections.flatMap { subsection ->
            subsection.links.filter { item ->
                (item.title + " " + item.description + " " + subsection.title)
                    .contains(needle, ignoreCase = true)
            }.map { item -> Triple(item.route, item.title, section.title) }
        }
    }.take(12)
}

@Composable
fun NativeQuartierOverview(repo: QuartinautRepository, navigate: (String) -> Unit) {
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text("Quartier+", style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold)
        Text("Was möchtest du machen? Alle Funktionen sind nach Aufgaben getrennt.",
            color = MaterialTheme.colorScheme.onSurfaceVariant)
        quartierSections.forEach { section ->
            Surface(
                onClick = { navigate("hub-section:" + section.id) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                color = MaterialTheme.colorScheme.surface,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                tonalElevation = 1.dp
            ) {
                Row(Modifier.fillMaxWidth().heightIn(min = 80.dp).padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    Quartinaut3DIcon(section.id, Modifier.size(52.dp))
                    Spacer(Modifier.width(13.dp))
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text(section.title, fontWeight = FontWeight.SemiBold,
                            style = MaterialTheme.typography.titleMedium)
                        Text(section.description, style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(section.subsections.size.toString() + " Untergruppen · " +
                            section.count + " Funktionen",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.primary)
                    }
                    Icon(Icons.Default.ChevronRight,
                        contentDescription = "Bereich öffnen",
                        tint = MaterialTheme.colorScheme.primary)
                }
            }
        }
        OutlinedButton(onClick = { navigate("enhancements") },
            modifier = Modifier.fillMaxWidth()) {
            Icon(Icons.Default.Search, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text("Alle Funktionen durchsuchen")
        }
        Text("Deine Gemeinde: " + quartierAreaLabel(repo.area(),repo.canton()),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
        TextButton(onClick = repo::loadHub, modifier = Modifier.fillMaxWidth()) {
            Text("Quartier+ aktualisieren")
        }
    }
}

@Composable
fun NativeQuartierCategoryPage(
    sectionId: String, navigate: (String) -> Unit
) {
    val section = quartierSections.firstOrNull { it.id == sectionId }
    if (section == null) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("Dieser Bereich ist nicht verfügbar.")
        }
        return
    }
    var query by rememberSaveable(sectionId) { mutableStateOf("") }
    var expanded by rememberSaveable(sectionId) {
        mutableStateOf(section.subsections.firstOrNull()?.id.orEmpty())
    }
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Quartinaut3DIcon(section.id, Modifier.size(64.dp))
            Spacer(Modifier.width(13.dp))
            Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(3.dp)) {
                Text(section.title,style=MaterialTheme.typography.headlineSmall,
                    fontWeight=FontWeight.Bold)
                Text(section.description,color=MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        OutlinedTextField(
            value = query, onValueChange = { query = it.take(80) },
            modifier = Modifier.fillMaxWidth(), singleLine = true,
            label = { Text("In diesem Bereich suchen") },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) }
        )
        var visible = 0
        section.subsections.forEachIndexed { index, subsection ->
            val matching = subsection.links.filter {
                query.isBlank() || (it.title + " " + it.description)
                    .contains(query, ignoreCase = true)
            }
            if (matching.isNotEmpty()) {
                visible += matching.size
                val open = query.isNotBlank() || expanded == subsection.id
                QuartierAccordion(subsection.title, subsection.description, matching.size,
                    open, { expanded = if (expanded == subsection.id) "" else subsection.id }) {
                    matching.forEach { QuartierActionRow(it, navigate) }
                }
            }
        }
        if (visible == 0) Text("Keine passende Funktion gefunden.",
            color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

/** Old Extras entry remains valid but now uses the very same directory. */
@Composable
fun NativeQuartierAllFeatures(repo: QuartinautRepository, navigate: (String) -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    var expanded by rememberSaveable { mutableStateOf("") }
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("QUARTINAUT · MEHR", color = MaterialTheme.colorScheme.primary,
            style = MaterialTheme.typography.labelLarge)
        Text("Alle Funktionen", style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold)
        Text("Nach Aufgaben geordnet. Tippe auf einen Bereich, um ihn auszuklappen.",
            color = MaterialTheme.colorScheme.onSurfaceVariant)
        OutlinedTextField(
            value = query, onValueChange = { query = it.take(80) },
            modifier = Modifier.fillMaxWidth(), singleLine = true,
            label = { Text("Funktionen durchsuchen") },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) }
        )
        var found = 0
        quartierSections.forEach { section ->
            val count = section.subsections.sumOf { sub ->
                sub.links.count { query.isBlank() ||
                    (it.title + " " + it.description).contains(query, ignoreCase = true) }
            }
            if (count > 0) {
                found += count
                val open = query.isNotBlank() || expanded == section.id
                QuartierAccordion(section.title, section.description, count, open,
                    { expanded = if (expanded == section.id) "" else section.id },
                    iconKey=section.id) {
                    section.subsections.forEach { sub ->
                        val options = sub.links.filter {
                            query.isBlank() || (it.title + " " + it.description)
                                .contains(query, ignoreCase = true)
                        }
                        if (options.isNotEmpty()) {
                            Text(sub.title, fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.primary)
                            options.forEach { QuartierActionRow(it, navigate) }
                        }
                    }
                }
            }
        }
        if (found == 0) Text("Keine passende Funktion gefunden.",
            color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text("Deine Gemeinde: " + quartierAreaLabel(repo.area(),repo.canton()),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun QuartierAccordion(
    title: String, description: String, count: Int, expanded: Boolean,
    onToggle: () -> Unit, iconKey: String? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    Surface(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(18.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
        Column {
            Row(Modifier.fillMaxWidth().clickable(onClick = onToggle)
                .heightIn(min = 72.dp).padding(14.dp),
                verticalAlignment = Alignment.CenterVertically) {
                if(iconKey != null) {
                    Quartinaut3DIcon(iconKey, Modifier.size(38.dp))
                    Spacer(Modifier.width(10.dp))
                }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(title, fontWeight = FontWeight.SemiBold,
                        style = MaterialTheme.typography.titleMedium)
                    Text(description, style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Text(count.toString(), color = MaterialTheme.colorScheme.primary,
                    style = MaterialTheme.typography.labelMedium)
                Spacer(Modifier.width(8.dp))
                Icon(if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    contentDescription = if (expanded) "Einklappen" else "Ausklappen",
                    tint = MaterialTheme.colorScheme.primary)
            }
            if (expanded) {
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(8.dp),
                    content = content)
            }
        }
    }
}

@Composable
private fun QuartierActionRow(link: QuartierLink, navigate: (String) -> Unit) {
    Surface(onClick = { navigate(link.route) }, modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.50f)) {
        Row(Modifier.fillMaxWidth().heightIn(min = 66.dp).padding(12.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Text(link.symbol, style = MaterialTheme.typography.titleLarge)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(link.title, fontWeight = FontWeight.Medium)
                Text(link.description, style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Icon(Icons.Default.ChevronRight, contentDescription = "Öffnen",
                tint = MaterialTheme.colorScheme.primary)
        }
    }
}
