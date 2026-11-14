package ch.quartinaut.nativeapp

import android.content.Intent
import android.provider.CalendarContract
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
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
import com.google.firebase.firestore.DocumentSnapshot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Shared, theme-aware UI. All counts refer to the records actually available in the app. */
@Composable
private fun V6Header(title: String, subtitle: String) {
    Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
    Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodyMedium)
}

@Composable
private fun V6Tile(title: String, subtitle: String, tag: String = "", action: () -> Unit) {
    Surface(onClick=action,modifier=Modifier.fillMaxWidth().heightIn(min=74.dp),
        color=MaterialTheme.colorScheme.surface,shape=RoundedCornerShape(18.dp),
        border=BorderStroke(1.dp,MaterialTheme.colorScheme.outlineVariant)) {
        Row(Modifier.padding(14.dp),verticalAlignment=Alignment.CenterVertically) {
            Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(4.dp)) {
                Text(title,fontWeight=FontWeight.SemiBold,style=MaterialTheme.typography.titleMedium,
                    maxLines=2,overflow=TextOverflow.Ellipsis)
                Text(subtitle,color=MaterialTheme.colorScheme.onSurfaceVariant,
                    style=MaterialTheme.typography.bodySmall,maxLines=3,
                    overflow=TextOverflow.Ellipsis)
                if(tag.isNotBlank()) Text(tag,color=MaterialTheme.colorScheme.primary,
                    style=MaterialTheme.typography.labelSmall)
            }
            Icon(Icons.Default.ChevronRight,contentDescription="Öffnen",tint=MaterialTheme.colorScheme.primary)
        }
    }
}

internal fun recentRouteLabel(route: String): String = mapOf(
    "home" to "Start", "board" to "Schwarzes Brett", "plus" to "Quartier+",
    "market" to "Marktplatz", "lend" to "Leihbörse", "group" to "Vereine",
    "calendar" to "Gemeindekalender", "map" to "Schweizkarte",
    "enh-radar" to "Quartinaut Radar", "enh-favorites" to "Favoriten",
    "enh-posts" to "Meine Beiträge", "enh-clubs" to "Vereinszentrale",
    "community-pulse" to "Gemeinde aktuell", "personal-center" to "Mein Quartinaut",
    "municipal-compare" to "Gemeinden vergleichen", "calendar-planner" to "Meine Termine"
)[route] ?: ""

/** History stores route names only, never messages or user-generated text. */
internal fun recordRecentlyVisited(context: android.content.Context, uid: String, route: String) {
    if(uid.isBlank() || recentRouteLabel(route).isBlank() || route=="home") return
    val prefs=context.getSharedPreferences("qt_v6_recent",android.content.Context.MODE_PRIVATE)
    val key="recent_"+uid
    val old=prefs.getString(key,"").orEmpty().split("|").filter { it.isNotBlank() }
    prefs.edit().putString(key,(listOf(route)+old.filter { it!=route }).take(7).joinToString("|")).apply()
}

@Composable
fun NativePersonalCenter(repo: QuartinautRepository, navigate: (String)->Unit) {
    val context=LocalContext.current
    var recent by remember(repo.user?.uid) { mutableStateOf(emptyList<String>()) }
    LaunchedEffect(repo.user?.uid) {
        recent=context.getSharedPreferences("qt_v6_recent",android.content.Context.MODE_PRIVATE)
            .getString("recent_"+repo.user?.uid.orEmpty(),"").orEmpty()
            .split("|").filter { recentRouteLabel(it).isNotBlank() }
    }
    val mine=repo.requests.count { it.str("uid")==repo.user?.uid }
    val ownHub=repo.hubItems.count { it["isMine"]==true || DocString(it["uid"])==repo.user?.uid }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement=Arrangement.spacedBy(12.dp)) {
        V6Header("Mein Quartinaut", "Deine persönlichen Aktivitäten und schnellen Wege")
        Text("Gemeinde: "+repo.area().ifBlank { "Noch nicht hinterlegt" },
            color=MaterialTheme.colorScheme.primary)
        Row(horizontalArrangement=Arrangement.spacedBy(10.dp)) {
            Card(Modifier.weight(1f),colors=CardDefaults.cardColors(containerColor=MaterialTheme.colorScheme.surfaceVariant)) {
                Column(Modifier.padding(14.dp)) {
                    Text("$mine",style=MaterialTheme.typography.headlineMedium)
                    Text("Meine Anliegen",style=MaterialTheme.typography.bodySmall)
                }
            }
            Card(Modifier.weight(1f),colors=CardDefaults.cardColors(containerColor=MaterialTheme.colorScheme.surfaceVariant)) {
                Column(Modifier.padding(14.dp)) {
                    Text("$ownHub",style=MaterialTheme.typography.headlineMedium)
                    Text("Weitere Einträge",style=MaterialTheme.typography.bodySmall)
                }
            }
        }
        Text("Deine Aktivitäten",style=MaterialTheme.typography.titleMedium)
        V6Tile("Eigene Beiträge","Bearbeiten, pausieren oder archivieren") {navigate("enh-posts")}
        V6Tile("Gespeicherte Beiträge","Favoriten ansehen und entfernen") {navigate("enh-favorites")}
        V6Tile("Nachrichten","Private Chats und Kontaktanfragen") {navigate("chats")}
        V6Tile("Ausleihen und Reservierungen","Laufende Anfragen und Rückgaben") {navigate("v50loans")}
        V6Tile("Meine Termine","Termine prüfen und in deinen Kalender übernehmen") {navigate("calendar-planner")}
        if(recent.isNotEmpty()) {
            Text("Zuletzt geöffnet",style=MaterialTheme.typography.titleMedium)
            recent.take(5).forEach { route ->
                V6Tile(recentRouteLabel(route),"Erneut öffnen") {navigate(route)}
            }
        }
        Text("Angezeigt werden nur die Daten, die dein angemeldetes Konto laden darf.",
            color=MaterialTheme.colorScheme.onSurfaceVariant,style=MaterialTheme.typography.bodySmall)
    }
}

@Composable
fun NativeUnifiedSearch(repo: QuartinautRepository, navigate:(String)->Unit,
                        openRequest:(DocumentSnapshot)->Unit,
                        openHub:(Map<String,Any?>)->Unit,
                        openMunicipality:(String,String)->Unit) {
    val context=LocalContext.current
    val uid=repo.user?.uid.orEmpty()
    val preferences=remember(context) {
        context.getSharedPreferences("quartinaut_search_filters",android.content.Context.MODE_PRIVATE)
    }
    var query by rememberSaveable(uid) { mutableStateOf("") }
    var scope by rememberSaveable(uid) {
        mutableStateOf(preferences.getString(uid+"_scope","Alle") ?: "Alle")
    }
    var region by rememberSaveable(uid) {
        mutableStateOf(preferences.getString(uid+"_region","Alle verfügbaren") ?: "Alle verfügbaren")
    }
    val scopes=listOf("Alle","Funktionen","Anliegen","Angebote","Gemeinden","Mitteilungen")
    val regions=listOf("Alle verfügbaren","Meine Gemeinde","Mein Kanton")
    val q=query.trim()
    val matches: (String)->Boolean = { value ->
        q.isBlank() || value.contains(q,ignoreCase=true)
    }
    val myArea=repo.area().substringBefore(" (").trim()
    val canton=repo.canton()
    val myAreaKey=repo.areaKey()
    val isLocal: (String,String,String)->Boolean = { area,areaCode,areaKey ->
        when(region) {
            "Meine Gemeinde" -> (areaKey.isNotBlank() && areaKey==myAreaKey) ||
                (myArea.isNotBlank() && area.substringBefore(" (").trim()
                    .equals(myArea, ignoreCase=true))
            "Mein Kanton" -> (canton.isNotBlank() && areaCode.equals(canton,ignoreCase=true)) ||
                (myArea.isNotBlank() && area.substringBefore(" (").trim()
                    .equals(myArea,ignoreCase=true))
            else -> true
        }
    }
    val functionResults=quartierMatchingRoutes(q)
    val requests=repo.requests.filter {
        it.str("status")=="offen" &&
        matches(it.title()+" "+it.str("text")+" "+it.str("category")) &&
        isLocal(it.str("area"),it.str("cantonCode"),it.str("areaKey"))
    }.take(if(q.isBlank())4 else 30)
    val hubs=repo.hubItems.filter {
        (DocString(it["status"])=="published" || it["isMine"]==true) &&
        matches(DocString(it["title"])+" "+DocString(it["description"])+" "+
            DocString(it["area"])+" "+DocString(it["category"])) &&
        isLocal(DocString(it["area"]),DocString(it["cantonCode"]),
            DocString(it["areaKey"]))
    }.take(if(q.isBlank())4 else 30)
    val municipalities=repo.regions.flatMap { c -> c.municipalities
        .filter { municipality ->
            matches(municipality.name+" "+c.name+" "+c.code) &&
            (region!="Mein Kanton" || c.code==canton) &&
            (region!="Meine Gemeinde" || municipality.name.equals(myArea,ignoreCase=true))
        }.map { c to it }
    }.take(if(q.isBlank())4 else 30)
    val official=(repo.notices+repo.alerts).distinctBy {it.id}.filter {
        matches(it.title()+" "+it.str("text")+" "+it.str("description")) &&
        isLocal(it.str("area"),it.str("cantonCode"),it.str("areaKey"))
    }.take(if(q.isBlank())4 else 30)
    val totalVisible=(if(scope in listOf("Alle","Funktionen"))functionResults.size else 0)+
        (if(scope in listOf("Alle","Anliegen"))requests.size else 0)+
        (if(scope in listOf("Alle","Angebote"))hubs.size else 0)+
        (if(scope in listOf("Alle","Gemeinden"))municipalities.size else 0)+
        (if(scope in listOf("Alle","Mitteilungen"))official.size else 0)
    Column(Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement=Arrangement.spacedBy(10.dp)) {
        V6Header("Alles durchsuchen", "Funktionen, Beiträge, Angebote und Gemeinden")
        OutlinedTextField(value=query,onValueChange={query=it.take(90)},
            label={Text("Wonach suchst du?")},
            leadingIcon={Icon(Icons.Default.Search,contentDescription=null)},
            singleLine=true,modifier=Modifier.fillMaxWidth(),
            trailingIcon={if(query.isNotEmpty()) IconButton(onClick={query=""}) {
                Icon(Icons.Default.Close,"Suche löschen") }})
        Row(Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement=Arrangement.spacedBy(7.dp)) {
            scopes.forEach { option ->
                FilterChip(selected=scope==option,onClick={
                    scope=option
                    preferences.edit().putString(uid+"_scope",option).apply()
                },label={Text(option)})
            }
        }
        Row(verticalAlignment=Alignment.CenterVertically,
            horizontalArrangement=Arrangement.spacedBy(8.dp)) {
            Icon(Icons.Default.Place,contentDescription=null,
                tint=MaterialTheme.colorScheme.primary)
            Text("Umgebung",style=MaterialTheme.typography.labelMedium,
                color=MaterialTheme.colorScheme.onSurfaceVariant)
            Box {
                var menuOpen by remember {mutableStateOf(false)}
                OutlinedButton(onClick={menuOpen=true}) {
                    Text(region)
                    Icon(Icons.Default.ArrowDropDown,contentDescription=null)
                }
                DropdownMenu(expanded=menuOpen,onDismissRequest={menuOpen=false}) {
                    regions.forEach { option ->
                        DropdownMenuItem(text={Text(option)},onClick={
                            region=option
                            preferences.edit().putString(uid+"_region",option).apply()
                            menuOpen=false
                        })
                    }
                }
            }
        }
        Text(if(q.isBlank()) "Vorschau der verfügbaren Einträge" else
            "$totalVisible angezeigte Treffer für „$q“",
            color=MaterialTheme.colorScheme.onSurfaceVariant,
            style=MaterialTheme.typography.bodySmall)
        LazyColumn(verticalArrangement=Arrangement.spacedBy(9.dp),
            contentPadding=PaddingValues(bottom=20.dp)) {
            if(scope in listOf("Alle","Funktionen") && q.isNotBlank()) {
                item {Text("App-Funktionen ("+functionResults.size+")",
                    fontWeight=FontWeight.SemiBold)}
                items(functionResults,key={"f:"+it.first}) { result ->
                    V6Tile(result.second,"Direkt zur Funktion",result.third) {
                        navigate(result.first)
                    }
                }
            }
            if(scope in listOf("Alle","Anliegen")) {
                item{Text("Anliegen ("+requests.size+")",fontWeight=FontWeight.SemiBold)}
                items(requests,key={"r:"+it.id}) { doc ->
                    V6Tile(doc.title(),doc.str("text").take(145),
                        "Schwarzes Brett · "+doc.str("area")) {openRequest(doc)}
                }
            }
            if(scope in listOf("Alle","Angebote")) {
                item{Text("Angebote & Veranstaltungen ("+hubs.size+")",
                    fontWeight=FontWeight.SemiBold)}
                items(hubs) { item ->
                    V6Tile(DocString(item["title"]),
                        DocString(item["description"]).take(145),
                        DocString(item["kind"])+" · "+DocString(item["area"])) {
                        openHub(item)
                    }
                }
            }
            if(scope in listOf("Alle","Gemeinden")) {
                item {Text("Gemeinden ("+municipalities.size+")",
                    fontWeight=FontWeight.SemiBold)}
                items(municipalities) { (c,municipality) ->
                    V6Tile(municipality.name,"Kanton "+c.name,"Gemeindesteckbrief") {
                        openMunicipality(c.code,municipality.bfs)
                    }
                }
            }
            if(scope in listOf("Alle","Mitteilungen")) {
                item {Text("Mitteilungen ("+official.size+")",
                    fontWeight=FontWeight.SemiBold)}
                items(official,key={"n:"+it.id}) { doc ->
                    V6Tile(doc.title(),doc.str("text").take(145),
                        "Quartinaut-Mitteilungen · "+doc.str("area")) {
                        navigate("community-pulse")
                    }
                }
            }
            if(totalVisible==0) item {
                Surface(color=MaterialTheme.colorScheme.surfaceVariant,
                    shape=RoundedCornerShape(18.dp),modifier=Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                        Text("Keine passenden Ergebnisse",fontWeight=FontWeight.SemiBold)
                        Text("Prüfe Suchbegriff und Umgebung oder wähle «Alle»." ,
                            color=MaterialTheme.colorScheme.onSurfaceVariant)
                        TextButton(onClick={
                            query="";scope="Alle";region="Alle verfügbaren"
                            preferences.edit().putString(uid+"_scope",scope)
                                .putString(uid+"_region",region).apply()
                        }) {Text("Filter zurücksetzen")}
                    }
                }
            }
        }
    }
}

@Composable
fun NativeCommunityPulse(repo:QuartinautRepository,navigate:(String)->Unit,
                         openRequest:(DocumentSnapshot)->Unit) {
    var filter by rememberSaveable {mutableStateOf("Alles")}
    val notices=repo.notices+repo.alerts
    val requests=repo.requests.filter {it.str("status")=="offen"}
    val events=repo.hubItems.filter {it["kind"]=="calendar" && it["status"]=="published"}
    Column(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
        V6Header("Gemeinde aktuell", "Was in "+repo.area()+" und Umgebung geschieht")
        OutlinedButton(onClick={navigate("official-calendar")},
            modifier=Modifier.fillMaxWidth()) {Text("Amtliche Termine & Feiertage mit Quellen öffnen")}
        Text("Quelle: bereits in Quartinaut geladene Mitteilungen und Beiträge. Keine Live-Daten aus externen Amtsportalen.",
            color=MaterialTheme.colorScheme.onSurfaceVariant,style=MaterialTheme.typography.bodySmall)
        Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(7.dp)) {
            listOf("Alles","Mitteilungen","Nachbarschaft","Termine").forEach { option ->
                FilterChip(selected=filter==option,onClick={filter=option},label={Text(option)})
            }
        }
        LazyColumn(verticalArrangement=Arrangement.spacedBy(9.dp)) {
            if(filter in listOf("Alles","Mitteilungen")) {
                item{Text("Gemeindemitteilungen",fontWeight=FontWeight.SemiBold)}
                items(notices.take(20),key={"n:"+it.id}) { doc->
                    V6Tile(doc.title(),doc.str("text").ifBlank {doc.str("description")}.take(160),
                        "Quartinaut-Mitteilung · "+doc.str("createdAt").take(10)) {navigate("official")}
                }
            }
            if(filter in listOf("Alles","Nachbarschaft")) {
                item{Text("Aus der Nachbarschaft",fontWeight=FontWeight.SemiBold)}
                items(requests.take(20),key={"r:"+it.id}) {doc->
                    V6Tile(doc.title(),doc.str("text").take(145),"Benutzerbeitrag · "+doc.str("area")) {
                        openRequest(doc)
                    }
                }
            }
            if(filter in listOf("Alles","Termine")) {
                item{Text("Veranstaltungen",fontWeight=FontWeight.SemiBold)}
                items(events.take(20)) {row->
                    V6Tile(DocString(row["title"]),DocString(row["description"]).take(145),
                        "Veranstaltung · "+DocString(row["area"])) {navigate("calendar-planner")}
                }
            }
            if(notices.isEmpty()&&requests.isEmpty()&&events.isEmpty()) item {
                Text("Zurzeit sind keine passenden Daten geladen. Versuche die Aktualisierung in Quartier+.")
            }
        }
    }
}

@Composable
fun NativeSafetyCenter(repo:QuartinautRepository,navigate:(String)->Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement=Arrangement.spacedBy(12.dp)) {
        V6Header("Vertrauen & Sicherheit", "Transparent handeln und Privatsphäre schützen")
        V6Tile("Deine Verifizierung",if(repo.profile["verified"]==true)
            "Dein Profil ist als verifiziert gekennzeichnet." else
            "Dein Profil hat aktuell keinen bestätigten Verifizierungsstatus.",
            "Kontostatus aus deinem Quartinaut-Profil") {navigate("profile")}
        V6Tile("Transaktionsbewertungen", "Nur nach bestätigter Transaktion bewerten") {
            navigate("enh-trust")
        }
        V6Tile("Private Nachrichten", "Kontakte stummschalten, blockieren oder melden") {
            navigate("chats")
        }
        V6Tile("Hilfe und Datenschutz", "Meldewege, Hinweise und Datennutzung") {
            navigate("help")
        }
        Text("Ein Verifizierungsstatus ist keine Garantie für Sicherheit. Teile persönliche Daten nur, wenn es notwendig ist.",
            color=MaterialTheme.colorScheme.onSurfaceVariant,style=MaterialTheme.typography.bodySmall)
    }
}

@Composable
fun NativeCalendarPlanner(repo:QuartinautRepository,navigate:(String)->Unit) {
    val context=LocalContext.current
    var keyword by rememberSaveable {mutableStateOf("")}
    val events=repo.hubItems.filter {DocString(it["kind"])=="calendar" &&
        (DocString(it["status"])=="published" || it["isMine"]==true) &&
        (DocString(it["title"])+DocString(it["description"])).contains(keyword,ignoreCase=true)}
    Column(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
        V6Header("Meine Termine", "Gemeindetermine entdecken und in deinen Kalender übernehmen")
        Text("Terminzeiten werden in der Kalender-App von dir bestätigt. Quartinaut setzt keine erfundenen Anfangszeiten.",
            style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant)
        OutlinedButton(onClick={navigate("official-calendar")},
            modifier=Modifier.fillMaxWidth()) {Text("Offizieller Quellenkalender Schweiz")}
        OutlinedTextField(keyword,{keyword=it},label={Text("Termine durchsuchen")},
            singleLine=true,modifier=Modifier.fillMaxWidth())
        OutlinedButton(onClick={navigate("v50associations")}) {Text("Meine Vereinsanmeldungen")}
        LazyColumn(verticalArrangement=Arrangement.spacedBy(9.dp)) {
            items(events) {item->
                V6Tile(DocString(item["title"]),DocString(item["description"]).take(140),
                    "Im Android-Kalender erstellen") {
                    runCatching {
                        val intent=Intent(Intent.ACTION_INSERT).apply {
                            data=CalendarContract.Events.CONTENT_URI
                            putExtra(CalendarContract.Events.TITLE,DocString(item["title"]).take(150))
                            putExtra(CalendarContract.Events.DESCRIPTION,
                                DocString(item["description"]).take(500))
                            putExtra(CalendarContract.Events.EVENT_LOCATION,
                                DocString(item["area"]).take(120))
                        }
                        context.startActivity(intent)
                    }.onFailure {repo.showMessage("Keine kompatible Kalender-App gefunden.")}
                }
            }
            if(events.isEmpty()) item {Text("Keine passenden veröffentlichten Veranstaltungen geladen.")}
        }
    }
}

@Composable
fun NativeMunicipalityComparison(repo:QuartinautRepository,navigate:(String)->Unit) {
    val options=remember(repo.regions){repo.regions.flatMap {region->
        region.municipalities.map {region to it} }.sortedBy {it.second.name}}
    var firstBfs by rememberSaveable {mutableStateOf("")}
    var secondBfs by rememberSaveable {mutableStateOf("")}
    var term by rememberSaveable {mutableStateOf("")}
    var choosing by rememberSaveable {mutableIntStateOf(1)}
    val first=options.firstOrNull {it.second.bfs==firstBfs}
    val second=options.firstOrNull {it.second.bfs==secondBfs}
    val factsA by produceState<MunicipalityFacts?>(null,firstBfs) {
        value=if(firstBfs.isBlank())null else withContext(Dispatchers.IO) {queryMunicipalityFacts(firstBfs)}
    }
    val factsB by produceState<MunicipalityFacts?>(null,secondBfs) {
        value=if(secondBfs.isBlank())null else withContext(Dispatchers.IO) {queryMunicipalityFacts(secondBfs)}
    }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement=Arrangement.spacedBy(12.dp)) {
        V6Header("Gemeinden vergleichen", "Zwei Gemeinden anhand der verfügbaren Fakten gegenüberstellen")
        Text("Quelle: Gemeindeliste BFS 2026; ergänzende Kennzahlen Wikidata mit Datenjahr (falls vorhanden).",
            color=MaterialTheme.colorScheme.onSurfaceVariant,style=MaterialTheme.typography.bodySmall)
        Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
            FilterChip(selected=choosing==1,onClick={choosing=1},label={Text("1: "+(first?.second?.name?:"Wählen"))})
            FilterChip(selected=choosing==2,onClick={choosing=2},label={Text("2: "+(second?.second?.name?:"Wählen"))})
        }
        OutlinedTextField(term,{term=it.take(60)},label={Text("Gemeinde suchen")},
            singleLine=true,modifier=Modifier.fillMaxWidth())
        if(term.trim().length>=2) {
            options.asSequence().filter {it.second.name.contains(term,ignoreCase=true) ||
                it.first.name.contains(term,ignoreCase=true)}.take(7).forEach { (region,municipality)->
                V6Tile(municipality.name,"Kanton "+region.code,"Auswählen") {
                    if(choosing==1){firstBfs=municipality.bfs;choosing=2}
                    else secondBfs=municipality.bfs
                    term=""
                }
            }
        }
        if(first!=null) {
            Text("Gemeinde 1",style=MaterialTheme.typography.titleMedium)
            NativeMunicipalityFactCard(first.second,first.first)
        }
        if(second!=null) {
            Text("Gemeinde 2",style=MaterialTheme.typography.titleMedium)
            NativeMunicipalityFactCard(second.second,second.first)
        }
        if(first!=null&&second!=null) {
            val pA=factsA?.population
            val pB=factsB?.population
            Text("Einwohnervergleich",style=MaterialTheme.typography.titleMedium)
            if(pA!=null && pB!=null && factsA?.populationYear==factsB?.populationYear) {
                Text("Differenz: "+kotlin.math.abs(pA-pB).toString()+
                    " Personen (Datenjahr "+factsA?.populationYear+")")
            } else Text("Ein direkter Einwohnervergleich ist nur mit identischen Datenjahren möglich.")
        }
        OutlinedButton(onClick={navigate("map")}) {Text("Zur Schweizkarte")}
    }
}