package ch.quartinaut.nativeapp

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.CalendarContract
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import org.json.JSONObject
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Bundled, provenance-aware reference data. The read-only catalogue does NOT
 * claim to replace an official authority feed or to cover every Swiss commune.
 * No changes to production Firestore/Storage security rules are required.
 */
private data class PublicAppointment(
    val id:String,
    val title:String,
    val category:String,
    val kind:String,
    val from:String,
    val until:String,
    val dateLabel:String,
    val city:String,
    val canton:String,
    val venue:String,
    val region:String,
    val status:String,
    val sourceName:String,
    val sourceUrl:String,
    val sourceNote:String,
    val evidence:String,
    val calendarExact:Boolean
)

private data class PublicCalendarData(val rows:List<PublicAppointment>,val asOf:String)

private fun loadPublicCalendar(context:Context): PublicCalendarData = runCatching {
    val raw=context.assets.open("official_calendar_ch_2026_2030.json")
        .bufferedReader(Charsets.UTF_8).use {it.readText()}
    val root=JSONObject(raw)
    val arr=root.getJSONArray("items")
    val rows=ArrayList<PublicAppointment>(arr.length())
    for(i in 0 until arr.length()) {
        val o=arr.optJSONObject(i) ?:continue
        fun v(key:String)=o.optString(key,"")
        rows.add(PublicAppointment(
            id=v("id"),title=v("title"),category=v("category"),kind=v("kind"),
            from=v("start"),until=v("end"),dateLabel=v("dateLabel"),
            city=v("city"),canton=v("canton"),venue=v("venue"),region=v("region"),
            status=v("status"),sourceName=v("sourceName"),sourceUrl=v("sourceUrl"),
            sourceNote=v("sourceNote"),evidence=v("evidence"),
            calendarExact=o.optBoolean("calendarExact",false)
        ))
    }
    PublicCalendarData(rows,root.optString("researchAsOf","2026-11-13"))
}.getOrElse {PublicCalendarData(emptyList(),"2026-11-13")}

private fun PublicAppointment.statusText():String=when(status){
    "confirmed_exact_date" -> "Datum in verlinkter Originalquelle"
    "reported_official" -> "Offizielle Stelle laut Recherchebericht"
    "needs_review" -> "Datumsabweichung: überprüfen"
    "official_recurrence_rule" -> "Offizielle Regel – kein bestätigter Einzeltermin"
    "year_confirmed_date_pending" -> "Jahr bestätigt – Datum noch offen"
    else -> "Bestätigungsgrad unbekannt"
}

private fun PublicAppointment.displayDate():String {
    if(from.isBlank())return dateLabel
    val fmt=DateTimeFormatter.ofPattern("dd.MM.yyyy",Locale.GERMAN)
    return runCatching {
        val first=LocalDate.parse(from).format(fmt)
        val last=LocalDate.parse(until.ifBlank{from}).format(fmt)
        if(first==last)first else "$first – $last"
    }.getOrElse {dateLabel}
}

private fun launchVerifiedSource(context:Context,url:String,onError:()->Unit) {
    val parsed=runCatching{Uri.parse(url)}.getOrNull()
    if(parsed==null || parsed.scheme!="https" || parsed.host.isNullOrBlank()) {onError();return}
    try {
        context.startActivity(Intent(Intent.ACTION_VIEW,parsed)
            .addCategory(Intent.CATEGORY_BROWSABLE))
    }catch(_:Exception){onError()}
}

private fun addPublishedAppointment(context:Context,entry:PublicAppointment,onError:()->Unit) {
    if(!entry.calendarExact || entry.from.isBlank() || entry.kind=="pending" ||
        entry.kind=="series" || entry.status=="needs_review")return
    runCatching {
        val begin=LocalDate.parse(entry.from).atStartOfDay(ZoneOffset.UTC)
            .toInstant().toEpochMilli()
        val end=LocalDate.parse(entry.until.ifBlank{entry.from})
            .plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
        val description=buildString {
            append("Quartinaut · ").append(entry.statusText()).append("\n")
            append("Quelle: ").append(entry.sourceName).append("\n")
            if(entry.sourceUrl.isNotBlank())append(entry.sourceUrl).append("\n")
            append("Stand der Recherche: 13.11.2026. Zeiten nicht angegeben.")
        }
        val intent=Intent(Intent.ACTION_INSERT).apply {
            data=CalendarContract.Events.CONTENT_URI
            putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME,begin)
            putExtra(CalendarContract.EXTRA_EVENT_END_TIME,end)
            putExtra(CalendarContract.EXTRA_EVENT_ALL_DAY,true)
            putExtra(CalendarContract.Events.TITLE,entry.title)
            putExtra(CalendarContract.Events.DESCRIPTION,description)
            putExtra(CalendarContract.Events.EVENT_LOCATION,
                listOf(entry.venue,entry.city,entry.canton).filter{it.isNotBlank()}.joinToString(", "))
        }
        context.startActivity(intent)
    }.onFailure {onError()}
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun NativeOfficialCalendarScreen(repo:QuartinautRepository,navigate:(String)->Unit) {
    val context=LocalContext.current
    val all=remember(context) {loadPublicCalendar(context)}
    val today=remember {LocalDate.now(ZoneId.of("Europe/Zurich")).toString()}
    var search by rememberSaveable { mutableStateOf("") }
    var canton by rememberSaveable { mutableStateOf("ALLE") }
    var section by rememberSaveable { mutableStateOf("alle") }
    var year by rememberSaveable { mutableStateOf("alle") }
    var futureOnly by rememberSaveable { mutableStateOf(true) }
    var sourcedOnly by rememberSaveable { mutableStateOf(false) }
    var showCantons by remember {mutableStateOf(false)}
    var info by remember {mutableStateOf<PublicAppointment?>(null)}
    var source by remember {mutableStateOf<PublicAppointment?>(null)}
    var message by remember {mutableStateOf("")}
    val cantonLabels=remember(repo.regions) {
        listOf("ALLE" to "Alle Kantone")+repo.regions.sortedBy {it.name}
            .map {it.code to "${it.name} (${it.code})"}
    }
    val results=remember(all,search,canton,section,year,futureOnly,sourcedOnly,today) {
        all.rows.filter {item ->
            (canton=="ALLE" || item.canton==canton || item.canton=="CH") &&
            (section=="alle" || when(section){
                "veranstaltungen"->item.kind=="event"
                "feiertage"->item.kind=="holiday"
                "regeln"->item.kind=="series" || item.kind=="pending"
                else->true
            }) &&
            (year=="alle" || item.from.startsWith(year) ||
                (item.from.isBlank() && item.dateLabel.startsWith(year))) &&
            (!futureOnly || item.from.isBlank() || item.until>=today) &&
            (!sourcedOnly || item.status=="confirmed_exact_date") &&
            (search.isBlank() || listOf(item.title,item.city,item.canton,item.category,
                item.sourceName,item.venue).joinToString(" ").contains(search.trim(),ignoreCase=true))
        }
    }
    if(message.isNotBlank()) AlertDialog(onDismissRequest={message=""},
        title={Text("Hinweis")},text={Text(message)},
        confirmButton={TextButton(onClick={message=""}){Text("Schliessen")}})
    val selected=info
    if(selected!=null) {
        AlertDialog(onDismissRequest={info=null},
            title={Text(selected.title)},
            text={Column(Modifier.heightIn(max=440.dp).verticalScroll(rememberScrollState()),
                verticalArrangement=Arrangement.spacedBy(9.dp)) {
                Text(selected.displayDate(),fontWeight=FontWeight.SemiBold)
                Text(listOf(selected.category,selected.city,selected.canton)
                    .filter{it.isNotBlank()}.joinToString(" · "))
                if(selected.region.isNotBlank())Text("Geltungsbereich: ${selected.region}")
                if(selected.venue.isNotBlank())Text("Ort: ${selected.venue}")
                Text("Bestätigung: ${selected.statusText()}",
                    color=MaterialTheme.colorScheme.primary,fontWeight=FontWeight.SemiBold)
                Text(selected.sourceNote,style=MaterialTheme.typography.bodySmall)
                HorizontalDivider()
                Text("Quelle",fontWeight=FontWeight.SemiBold)
                Text(selected.sourceName)
                Text(selected.evidence,style=MaterialTheme.typography.bodySmall)
                if(selected.sourceUrl.isNotBlank()) {
                    Text(selected.sourceUrl,style=MaterialTheme.typography.bodySmall,
                        color=MaterialTheme.colorScheme.primary)
                    OutlinedButton(onClick={launchVerifiedSource(context,selected.sourceUrl){
                        message="Die Quellen-Webseite konnte nicht geöffnet werden." }}) {
                        Icon(Icons.Default.OpenInNew,null)
                        Spacer(Modifier.width(6.dp));Text("Offizielle Quelle öffnen")
                    }
                } else Text("Im Recherchebericht ist keine direkte Quellen-URL angegeben.",
                    style=MaterialTheme.typography.bodySmall)
                if(selected.calendarExact && selected.status!="needs_review" &&
                    selected.kind!="series" && selected.kind!="pending") {
                    Button(onClick={addPublishedAppointment(context,selected){
                        message="Kein geeigneter Kalender auf diesem Gerät verfügbar."}},
                        modifier=Modifier.fillMaxWidth()) {
                        Icon(Icons.Default.EventAvailable,null)
                        Spacer(Modifier.width(6.dp));Text("Als Ganztagstermin übernehmen")
                    }
                }
            }},confirmButton={TextButton(onClick={info=null}){Text("Schliessen")}})
    }
    val sourceOnly=source
    if(sourceOnly!=null) AlertDialog(onDismissRequest={source=null},
        title={Text("Quelle & Bestätigungsgrad")},
        text={Column(verticalArrangement=Arrangement.spacedBy(10.dp)) {
            Text(sourceOnly.title,fontWeight=FontWeight.SemiBold)
            Text(sourceOnly.displayDate())
            Text(sourceOnly.statusText(),color=MaterialTheme.colorScheme.primary)
            Text(sourceOnly.sourceName)
            Text(sourceOnly.sourceNote,style=MaterialTheme.typography.bodySmall)
            if(sourceOnly.sourceUrl.isNotBlank()) OutlinedButton(onClick={
                launchVerifiedSource(context,sourceOnly.sourceUrl) {
                    message="Die Quellen-Webseite konnte nicht geöffnet werden."
                }
            }) {Text("Originalquelle öffnen")}
            else Text("Keine direkte URL im Recherchebericht hinterlegt.",
                style=MaterialTheme.typography.bodySmall)
        }},confirmButton={TextButton(onClick={source=null}){Text("Schliessen")}})

    LazyColumn(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background),
        contentPadding=PaddingValues(15.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
        item {
            Column(verticalArrangement=Arrangement.spacedBy(7.dp)) {
                Text("SCHWEIZ · QUELLENKALENDER",color=MaterialTheme.colorScheme.primary,
                    style=MaterialTheme.typography.labelLarge)
                Text("Feiertage & öffentliche Termine",style=MaterialTheme.typography.headlineSmall,
                    fontWeight=FontWeight.Bold)
                Text("Stand: ${all.asOf} · ${all.rows.size} Einträge aus verfügbaren Quellen. " +
                    "Keine Garantie auf vollständige Gemeindeabdeckung oder automatische Aktualisierung.",
                    color=MaterialTheme.colorScheme.onSurfaceVariant,
                    style=MaterialTheme.typography.bodySmall)
                Text("Kurz tippen: Details mit Quelle · Lange drücken: Quellen-Popup",
                    style=MaterialTheme.typography.labelMedium,
                    color=MaterialTheme.colorScheme.onSurfaceVariant)
                OutlinedTextField(value=search,onValueChange={search=it.take(90)},
                    label={Text("Termin, Gemeinde oder Kategorie suchen")},singleLine=true,
                    leadingIcon={Icon(Icons.Default.Search,null)},modifier=Modifier.fillMaxWidth())
            }
        }
        item {
            Row(Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement=Arrangement.spacedBy(7.dp)) {
                listOf("alle" to "Alle","veranstaltungen" to "Veranstaltungen",
                    "feiertage" to "Feiertage","regeln" to "Regeln & offen").forEach { (key,label) ->
                    FilterChip(selected=section==key,onClick={section=key},label={Text(label)})
                }
            }
        }
        item {
            Row(verticalAlignment=Alignment.CenterVertically,
                horizontalArrangement=Arrangement.spacedBy(9.dp)) {
                Box(Modifier.weight(1f)) {
                    OutlinedButton(onClick={showCantons=true},modifier=Modifier.fillMaxWidth()) {
                        Text(cantonLabels.firstOrNull{it.first==canton}?.second ?: "Alle Kantone",
                            maxLines=1,overflow=TextOverflow.Ellipsis)
                        Spacer(Modifier.width(4.dp));Icon(Icons.Default.ArrowDropDown,null)
                    }
                    DropdownMenu(expanded=showCantons,onDismissRequest={showCantons=false}) {
                        cantonLabels.forEach { (code,label) ->
                            DropdownMenuItem(text={Text(label)},onClick={canton=code;showCantons=false})
                        }
                    }
                }
                OutlinedButton(onClick={canton=repo.canton().ifBlank{"ALLE"}},
                    enabled=repo.canton().isNotBlank()) {Text("Mein Kanton")}
            }
        }
        item {
            Row(Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                listOf("alle","2026","2027","2028","2029","2030").forEach { choice ->
                    FilterChip(selected=year==choice,onClick={year=choice},
                        label={Text(if(choice=="alle")"Alle Jahre" else choice)})
                }
            }
        }
        item {
            Column {
                Row(verticalAlignment=Alignment.CenterVertically) {
                    Checkbox(checked=futureOnly,onCheckedChange={futureOnly=it})
                    Text("Vergangene Termine ausblenden",style=MaterialTheme.typography.bodySmall)
                }
                Row(verticalAlignment=Alignment.CenterVertically) {
                    Checkbox(checked=sourcedOnly,onCheckedChange={sourcedOnly=it})
                    Text("Nur direkt verlinkte offizielle Jahresdaten",
                        style=MaterialTheme.typography.bodySmall)
                }
                Text("${results.size} Treffer",style=MaterialTheme.typography.titleMedium,
                    fontWeight=FontWeight.SemiBold)
            }
        }
        if(all.rows.isEmpty()) item {
            Text("Die integrierten Termine konnten nicht geladen werden. " +
                "Bitte überprüfe die App-Installation.",color=MaterialTheme.colorScheme.error)
        } else if(results.isEmpty()) item {
            Text("Keine passenden Termine in dieser Auswahl. " +
                "Versuche einen anderen Kanton, ein anderes Jahr oder deaktiviere die Filter.",
                color=MaterialTheme.colorScheme.onSurfaceVariant)
        } else {
            items(results,key={it.id}) { appointment ->
                val emphasis=if(appointment.status=="needs_review")MaterialTheme.colorScheme.error
                    else MaterialTheme.colorScheme.primary
                Surface(modifier=Modifier.fillMaxWidth().combinedClickable(
                    onClick={info=appointment},onLongClick={source=appointment}),
                    shape=RoundedCornerShape(17.dp),color=MaterialTheme.colorScheme.surface,
                    tonalElevation=1.dp,border=androidx.compose.foundation.BorderStroke(
                        1.dp,MaterialTheme.colorScheme.outlineVariant)) {
                    Row(Modifier.fillMaxWidth().padding(13.dp),
                        verticalAlignment=Alignment.CenterVertically) {
                        Icon(when(appointment.kind){
                            "holiday"->Icons.Default.Event;"series"->Icons.Default.Repeat;
                            "pending"->Icons.Default.HelpOutline;else->Icons.Default.Celebration
                        },contentDescription=null,tint=emphasis,modifier=Modifier.size(25.dp))
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(4.dp)) {
                            Text(appointment.title,style=MaterialTheme.typography.titleMedium,
                                fontWeight=FontWeight.SemiBold,maxLines=2,
                                overflow=TextOverflow.Ellipsis)
                            Text(appointment.displayDate(),color=MaterialTheme.colorScheme.onSurfaceVariant,
                                style=MaterialTheme.typography.bodyMedium)
                            Text(listOf(appointment.city,appointment.canton,appointment.region)
                                .filter{it.isNotBlank()}.joinToString(" · "),
                                color=MaterialTheme.colorScheme.onSurfaceVariant,
                                style=MaterialTheme.typography.bodySmall,
                                maxLines=2,overflow=TextOverflow.Ellipsis)
                            Text(appointment.statusText(),color=emphasis,
                                style=MaterialTheme.typography.labelSmall,
                                maxLines=2,overflow=TextOverflow.Ellipsis)
                        }
                        Icon(Icons.Default.Info,contentDescription="Quellen anzeigen",
                            tint=MaterialTheme.colorScheme.primary)
                    }
                }
            }
        }
        item {
            HorizontalDivider()
            Text("Datenhinweis: Die Berichtsanlage (Excel) mit weiteren Detailzeilen war " +
                "nicht verfügbar. Die App enthält deshalb nur die sichtbaren Tabellen, " +
                "direkt nachgeprüfte Einzeltermine und öffentlich abrufbare Feiertagslisten. " +
                "Lokale Feiertagsregeln können innerhalb eines Kantons unterschiedlich sein.",
                style=MaterialTheme.typography.bodySmall,
                color=MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}