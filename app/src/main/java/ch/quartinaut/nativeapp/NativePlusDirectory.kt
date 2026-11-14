package ch.quartinaut.nativeapp

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
import androidx.compose.ui.platform.LocalContext
import org.json.JSONArray
import org.json.JSONObject
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import java.util.Locale

private val PlusBg: Color @Composable get() = MaterialTheme.colorScheme.background
private val PlusSurface: Color @Composable get() = MaterialTheme.colorScheme.surface
private val PlusAccent: Color @Composable get() = MaterialTheme.colorScheme.primary
private val PlusMuted: Color @Composable get() = MaterialTheme.colorScheme.onSurfaceVariant
private val PlusBorder: Color @Composable get() = MaterialTheme.colorScheme.outlineVariant

private data class RadarPreset(val term:String,val scope:String,val tags:List<String>)
private val radarTags=listOf("market" to "Marktplatz","lend" to "Ausleihen",
    "group" to "Vereine","project" to "Aktionen","request" to "Hilfegesuche",
    "calendar" to "Gemeindetermine","lost" to "Fundbüro")

@Composable
fun NativeExtrasDirectory(repo:QuartinautRepository,navigate:(String)->Unit) {
    NativeQuartierAllFeatures(repo,navigate)
}
@Composable
private fun ExtraHeader(title:String,description:String) {
    Text(title,color=MaterialTheme.colorScheme.onSurface,style=MaterialTheme.typography.headlineSmall,
        fontWeight=FontWeight.Bold)
    Text(description,color=PlusMuted,style=MaterialTheme.typography.bodySmall)
}
@Composable
private fun ExtraItem(title:String,description:String,detail:String="",
                      onClick:(()->Unit)?=null) {
    val shape=RoundedCornerShape(18.dp)
    val content:@Composable ()->Unit={
        Column(Modifier.padding(15.dp),verticalArrangement=Arrangement.spacedBy(7.dp)) {
            Text(title,color=MaterialTheme.colorScheme.onSurface,fontWeight=FontWeight.SemiBold,
                maxLines=3,overflow=TextOverflow.Ellipsis)
            if(description.isNotBlank())Text(description,color=PlusMuted,
                maxLines=4,overflow=TextOverflow.Ellipsis,
                style=MaterialTheme.typography.bodyMedium)
            if(detail.isNotBlank())Text(detail,color=PlusAccent,
                style=MaterialTheme.typography.labelSmall)
        }
    }
    if(onClick==null) Surface(color=PlusSurface,shape=shape,
        modifier=Modifier.fillMaxWidth(),border=BorderStroke(1.dp,PlusBorder),
        content=content)
    else Surface(onClick=onClick,color=PlusSurface,shape=shape,
        modifier=Modifier.fillMaxWidth(),border=BorderStroke(1.dp,PlusBorder),
        content=content)
}
@Composable
fun NativeRadarScreen(repo:QuartinautRepository,navigate:(String)->Unit) {
    val context=LocalContext.current
    val uid=repo.user?.uid.orEmpty()
    val preferences=remember(context) { context.getSharedPreferences(
        "quartinaut_radar_presets",android.content.Context.MODE_PRIVATE) }
    val presetKey="presets_"+uid
    val presets=remember(uid) { mutableStateListOf<RadarPreset>().also { list ->
        runCatching {
            val raw=JSONArray(preferences.getString(presetKey,"[]") ?: "[]")
            for(i in 0 until raw.length()) {
                val item=raw.optJSONObject(i) ?: continue
                val tagsJson=item.optJSONArray("tags") ?: JSONArray()
                val savedTags=(0 until tagsJson.length()).mapNotNull {tagsJson.optString(it).takeIf(String::isNotBlank)}
                list.add(RadarPreset(item.optString("term").take(80),
                    item.optString("scope","municipality"),savedTags))
            }
        }
    }}
    val savePresets: () -> Unit = {
        val array=JSONArray()
        presets.forEach {preset->
            array.put(JSONObject().put("term",preset.term)
                .put("scope",preset.scope).put("tags",JSONArray(preset.tags)))
        }
        preferences.edit().putString(presetKey,array.toString()).apply()
    }
    var text by rememberSaveable(uid) {mutableStateOf("")}
    var scope by rememberSaveable(uid) {mutableStateOf("municipality")}
    val tags=remember(uid){mutableStateListOf<String>()}
    LaunchedEffect(scope,tags.toList()){
        repo.loadEnhancementList("radar.list",mapOf("scope" to scope,"tags" to tags.toList()))
    }
    val localPublicItems:List<Map<String,Any?>> = repo.hubItems.filter {
        DocString(it["status"])=="published"
    } + repo.requests.filter {
        it.str("status")=="offen"
    }.map { doc ->
        mapOf<String,Any?>("id" to doc.id,"title" to doc.title(),
            "description" to doc.str("text"),"kind" to "request",
            "area" to doc.str("area"),"cantonCode" to doc.str("cantonCode"))
    }
    val localFallback=!repo.enhancementReady
    val localOrServer=if(localFallback)localPublicItems else repo.enhancedItems
    val shown=localOrServer.filter { row ->
        val kind=DocString(row["kind"])
        val area=DocString(row["area"])
        val matchesArea=scope=="canton" ||
            area.contains(repo.area().substringBefore("(").trim(),ignoreCase=true)
        val matchesTags=tags.isEmpty() || kind in tags
        val matchesText=(DocString(row["title"])+" "+DocString(row["description"]))
            .contains(text,ignoreCase=true)
        matchesArea && matchesTags && matchesText
    }
    Column(Modifier.fillMaxSize().background(PlusBg).padding(15.dp),
        verticalArrangement=Arrangement.spacedBy(10.dp)) {
        ExtraHeader("Quartinaut Radar","Was gibt es Neues in deiner Umgebung?")
        OutlinedTextField(text,{text=it},label={Text("Beiträge durchsuchen")},
            singleLine=true,modifier=Modifier.fillMaxWidth(),
            leadingIcon={Icon(Icons.Default.Search,null)})
        Row(verticalAlignment=Alignment.CenterVertically) {
            Text("Suchaufträge",modifier=Modifier.weight(1f),fontWeight=FontWeight.SemiBold)
            TextButton(onClick={
                val next=RadarPreset(text.trim().take(80),scope,tags.toList())
                if(next.term.isNotBlank() || next.tags.isNotEmpty()) {
                    presets.removeAll {it==next}
                    presets.add(0,next)
                    while(presets.size>5)presets.removeAt(presets.lastIndex)
                    savePresets()
                }
            },enabled=text.isNotBlank()||tags.isNotEmpty()) {Text("Suche merken")}
        }
        presets.forEach { preset->
            Row(verticalAlignment=Alignment.CenterVertically) {
                AssistChip(onClick={
                    text=preset.term;scope=preset.scope;tags.clear();tags.addAll(preset.tags)
                },modifier=Modifier.weight(1f),
                    label={Text(preset.term.ifBlank{"Kategorien: "+preset.tags.joinToString(", ")},
                        maxLines=1,overflow=TextOverflow.Ellipsis)})
                IconButton(onClick={presets.remove(preset);savePresets()}) {
                    Icon(Icons.Default.Close,contentDescription="Suchauftrag entfernen")
                }
            }
        }
        Text("Gemerkte Suchen werden beim Öffnen abgeglichen. Automatische Push-Hinweise benötigen eine zusätzliche serverseitige Freischaltung.",
            style=MaterialTheme.typography.bodySmall,color=PlusMuted)
        Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
            FilterChip(selected=scope=="municipality",onClick={scope="municipality"},
                label={Text("Meine Gemeinde")})
            FilterChip(selected=scope=="canton",onClick={scope="canton"},
                label={Text("Ganzer Kanton")})
        }
        Row(Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement=Arrangement.spacedBy(7.dp)) {
            radarTags.forEach { (key,label) ->
                FilterChip(selected=key in tags,onClick={
                    if(key in tags)tags.remove(key) else tags.add(key)
                },label={Text(label)})
            }
        }
        if(repo.enhancementLoading) LinearProgressIndicator(Modifier.fillMaxWidth())
        if(localFallback)
            Text("Lokaler Fallback – unvollständig und schreibgeschützt. " +
                "Nur bereits geladene öffentliche Beiträge; keine vollständige oder live aktualisierte Suche.",
                color=PlusMuted,style=MaterialTheme.typography.bodySmall)
        LazyColumn(verticalArrangement=Arrangement.spacedBy(10.dp)) {
            items(shown) { row ->
                ExtraItem(DocString(row["title"]),DocString(row["description"]),
                    (if(DocString(row["kind"])=="request") "Schwarzes Brett"
                     else DocString(row["kind"]))+" · "+DocString(row["area"])) {
                    val kind=DocString(row["kind"])
                    navigate(when(kind){
                        "request" -> "board"
                        "lend","market","lost","group","project","calendar" -> kind
                        else -> "plus"
                    })
                }
            }
            if(shown.isEmpty()&&!repo.enhancementLoading)item {
                Text(if(localFallback) "Lokal sind derzeit keine passenden öffentlichen Beiträge geladen; der Radar-Dienst ist nicht bestätigt erreichbar."
                    else "Keine passenden Beiträge. Wechsle zum ganzen Kanton oder entferne Filter.",
                    color=PlusMuted)
            }
        }
    }
}
@Composable
fun NativeMyPostsScreen(repo:QuartinautRepository,navigate:(String)->Unit) {
    var editing by remember {mutableStateOf<Map<String,Any?>?>(null)}
    var editingTitle by remember {mutableStateOf("")}
    var editingBody by remember {mutableStateOf("")}
    var editingPrice by remember {mutableStateOf("")}
    var statusTarget by remember {mutableStateOf<Map<String,Any?>?>(null)}
    var deletionTarget by remember {mutableStateOf<Map<String,Any?>?>(null)}
    var nextStatus by remember {mutableStateOf("")}
    LaunchedEffect(repo.user?.uid) {repo.loadEnhancementList("posts.mine")}
    val uid=repo.user?.uid.orEmpty()
    val readOnly=!repo.enhancementReady || !repo.myPostsLoaded
    val ownHub=repo.hubItems.filter {
        it["isMine"]==true || DocString(it["ownerUid"])==uid
    }
    val ownRequests=repo.requests.filter {it.str("uid")==uid}.map {doc ->
        mapOf<String,Any?>(
            "id" to doc.id,"title" to doc.title(),
            "description" to doc.str("text"),
            "status" to doc.str("status"),"kind" to "request"
        )
    }
    val visiblePosts:List<Map<String,Any?>> =
        (if(repo.myPostsLoaded)repo.myPostsItems else ownHub+ownRequests)
        .filterNot {DocString(it["status"]) in listOf("deleted","gelöscht")}
        .distinctBy {DocString(it["kind"])+":"+DocString(it["id"])}
    val statusLabel:(String)->String={value->when(value){
        "published","offen"->"Aktiv"
        "paused"->"Pausiert"
        "pending","wartet_freigabe"->"In Prüfung"
        "completed","erledigt"->"Erledigt"
        "archived","archiviert"->"Archiviert"
        else->value.ifBlank{"Unbekannt"}
    }}
    val kindLabel:(String)->String={value->when(value){
        "request"->"Anliegen";"market"->"Marktplatz";"lend"->"Leihbörse"
        "group"->"Verein";"project"->"Quartieraktion";"calendar"->"Veranstaltung"
        "lost"->"Fundbüro";"issue"->"Mangelmeldung"
        else->"Beitrag"
    }}
    Column(Modifier.fillMaxSize().background(PlusBg).padding(horizontal=16.dp,vertical=12.dp),
        verticalArrangement=Arrangement.spacedBy(12.dp)) {
        Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Meine Beiträge",style=MaterialTheme.typography.headlineSmall,
                    fontWeight=FontWeight.Bold,color=MaterialTheme.colorScheme.onSurface)
                Text("${visiblePosts.size} Einträge",
                    color=PlusMuted,style=MaterialTheme.typography.bodySmall)
            }
            IconButton(onClick={repo.loadEnhancementList("posts.mine")},
                enabled=!repo.myPostsLoading) {
                Icon(Icons.Default.Refresh,contentDescription="Beiträge aktualisieren",
                    tint=PlusAccent)
            }
        }
        if(repo.myPostsLoading)LinearProgressIndicator(Modifier.fillMaxWidth())
        if(readOnly && !repo.myPostsLoading) {
            Surface(modifier=Modifier.fillMaxWidth(),
                shape=RoundedCornerShape(14.dp),
                color=MaterialTheme.colorScheme.surfaceVariant) {
                Row(Modifier.padding(12.dp),verticalAlignment=Alignment.CenterVertically,
                    horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Default.Info,contentDescription=null,
                        tint=MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("Verwaltung gerade nicht verfügbar. Beiträge bleiben sichtbar.",
                        modifier=Modifier.weight(1f),color=PlusMuted,
                        style=MaterialTheme.typography.bodySmall)
                    TextButton(onClick={repo.loadEnhancementList("posts.mine")}) {
                        Text("Erneut")
                    }
                }
            }
        }
        LazyColumn(modifier=Modifier.fillMaxWidth().weight(1f),
            verticalArrangement=Arrangement.spacedBy(12.dp),
            contentPadding=PaddingValues(bottom=24.dp)) {
            items(visiblePosts,key={
                DocString(it["kind"])+":"+DocString(it["id"])
            }) { row ->
                val kind=DocString(row["kind"])
                val status=DocString(row["status"])
                val collection=if(kind=="request")"requests" else "communityHubItems"
                var menuOpen by remember(DocString(row["id"])) {mutableStateOf(false)}
                val viewRoute=when(kind){
                    "request"->"board";"market"->"market";"lend"->"lend"
                    "group"->"group";"project"->"project";"calendar"->"calendar"
                    "lost"->"lost";"issue"->"issue";else->"plus"
                }
                Surface(modifier=Modifier.fillMaxWidth(),color=PlusSurface,
                    shape=RoundedCornerShape(20.dp),
                    border=BorderStroke(1.dp,PlusBorder),tonalElevation=1.dp) {
                    Column(Modifier.fillMaxWidth().padding(14.dp),
                        verticalArrangement=Arrangement.spacedBy(10.dp)) {
                        Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically,
                            horizontalArrangement=Arrangement.spacedBy(9.dp)) {
                            Surface(shape=RoundedCornerShape(12.dp),
                                color=MaterialTheme.colorScheme.primaryContainer) {
                                Box(Modifier.size(42.dp),contentAlignment=Alignment.Center) {
                                    Icon(when(kind){
                                        "request"->Icons.Default.Handshake
                                        "market"->Icons.Default.Storefront
                                        "lend"->Icons.Default.Handyman
                                        "group"->Icons.Default.Groups
                                        "calendar"->Icons.Default.Event
                                        else->Icons.Default.Article
                                    },contentDescription=null,
                                        tint=MaterialTheme.colorScheme.onPrimaryContainer,
                                        modifier=Modifier.size(23.dp))
                                }
                            }
                            Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(3.dp)) {
                                Text(DocString(row["title"]).ifBlank{"Ohne Titel"},
                                    fontWeight=FontWeight.SemiBold,
                                    color=MaterialTheme.colorScheme.onSurface,
                                    style=MaterialTheme.typography.titleMedium,
                                    maxLines=2,overflow=TextOverflow.Ellipsis)
                                Text(kindLabel(kind),color=PlusMuted,
                                    style=MaterialTheme.typography.labelMedium)
                            }
                            Surface(shape=RoundedCornerShape(12.dp),
                                color=MaterialTheme.colorScheme.primaryContainer) {
                                Text(statusLabel(status),
                                    modifier=Modifier.padding(horizontal=9.dp,vertical=6.dp),
                                    color=MaterialTheme.colorScheme.onPrimaryContainer,
                                    style=MaterialTheme.typography.labelSmall)
                            }
                        }
                        if(DocString(row["id"]) in repo.myPostsBusyIds) {
                            Row(verticalAlignment=Alignment.CenterVertically,
                                horizontalArrangement=Arrangement.spacedBy(7.dp)) {
                                CircularProgressIndicator(Modifier.size(14.dp),strokeWidth=2.dp)
                                Text("Änderung wird bestätigt …",
                                    style=MaterialTheme.typography.labelSmall,
                                    color=PlusMuted)
                            }
                        }
                        val description=DocString(row["description"]).trim()
                        if(description.isNotBlank()) {
                            Text(description,maxLines=2,
                                overflow=TextOverflow.Ellipsis,color=PlusMuted,
                                style=MaterialTheme.typography.bodyMedium)
                        }
                        HorizontalDivider(color=PlusBorder)
                        Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically,
                            horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(onClick={navigate(viewRoute)},
                                modifier=Modifier.weight(1f),
                                contentPadding=PaddingValues(horizontal=5.dp,vertical=9.dp)) {
                                Icon(Icons.Default.Visibility,contentDescription=null,
                                    modifier=Modifier.size(16.dp))
                                Spacer(Modifier.width(4.dp))
                                Text("Ansehen",maxLines=1)
                            }
                            Button(onClick={
                                editing=row
                                editingTitle=DocString(row["title"])
                                editingBody=DocString(row["description"])
                                editingPrice=DocString(row["priceChf"])
                            },modifier=Modifier.weight(1f),
                                enabled=!readOnly && DocString(row["id"]) !in repo.myPostsBusyIds,
                                contentPadding=PaddingValues(horizontal=5.dp,vertical=9.dp)) {
                                Icon(Icons.Default.Edit,contentDescription=null,
                                    modifier=Modifier.size(16.dp))
                                Spacer(Modifier.width(4.dp))
                                Text("Bearbeiten",maxLines=1)
                            }
                            Box {
                                IconButton(onClick={menuOpen=true},
                                    enabled=!readOnly && DocString(row["id"]) !in repo.myPostsBusyIds,
                                    modifier=Modifier.size(44.dp)) {
                                    Icon(Icons.Default.MoreVert,
                                        contentDescription="Weitere Aktionen")
                                }
                                DropdownMenu(expanded=menuOpen,onDismissRequest={menuOpen=false}) {
                                    listOf("paused" to "Pausieren",
                                        "published" to "Reaktivieren",
                                        "completed" to "Erledigt",
                                        "archived" to "Archivieren")
                                        .filter {(next,_)->
                                            when {
                                                collection=="requests"->next in listOf("archived","completed")
                                                next=="published"->status=="paused"
                                                next=="paused"->status=="published"
                                                next=="completed"->kind in listOf("market","lend","lost")
                                                else->true
                                            }
                                        }.forEach {(next,label)->
                                            DropdownMenuItem(text={Text(label)},onClick={
                                                statusTarget=row;nextStatus=next;menuOpen=false
                                            })
                                        }
                                    HorizontalDivider()
                                    DropdownMenuItem(
                                        text={Text("Löschen",
                                            color=MaterialTheme.colorScheme.error)},
                                        leadingIcon={Icon(Icons.Default.DeleteOutline,
                                            contentDescription=null,
                                            tint=MaterialTheme.colorScheme.error)},
                                        onClick={deletionTarget=row;menuOpen=false}
                                    )
                                }
                            }
                        }
                    }
                }
            }
            if(visiblePosts.isEmpty()) item {
                Column(Modifier.fillMaxWidth().padding(vertical=30.dp),
                    horizontalAlignment=Alignment.CenterHorizontally,
                    verticalArrangement=Arrangement.spacedBy(10.dp)) {
                    Icon(Icons.Default.Inventory2,contentDescription=null,
                        tint=PlusAccent,modifier=Modifier.size(40.dp))
                    Text("Noch keine eigenen Beiträge geladen")
                    OutlinedButton(onClick={navigate("create")}){Text("Eintrag erstellen")}
                }
            }
        }
    }

    if(editing!=null) {
        val row=editing!!
        val rawEditPrice=editingPrice.trim().replace(',','.')
        val editPriceValid=DocString(row["kind"]) !in listOf("lend","market") ||
            (rawEditPrice.matches(Regex("""[0-9]+(\.[0-9]{1,2})?""")) &&
                (rawEditPrice.toDoubleOrNull()?.let { it in 0.0..100000.0 } == true))
        AlertDialog(onDismissRequest={editing=null},
            title={Text("Beitrag bearbeiten")},
            text={
                Column(verticalArrangement=Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(editingTitle,{editingTitle=it.take(100)},
                        label={Text("Titel")})
                    OutlinedTextField(editingBody,{editingBody=it.take(1200)},
                        label={Text("Beschreibung")},minLines=3)
                    if(DocString(row["kind"]) in listOf("market","lend"))
                        OutlinedTextField(editingPrice,{editingPrice=it},
                            label={Text(if(DocString(row["kind"])=="lend") "Preis pro Ausleihtag in CHF (0 = kostenlos)" else "Preis in CHF (0 = kostenlos)")})
                    Text("Änderungen an veröffentlichten Beiträgen müssen neu geprüft werden.",
                        style=MaterialTheme.typography.bodySmall)
                }
            },
            confirmButton={
                TextButton(onClick={
                    val collection=if(DocString(row["kind"])=="request")
                        "requests" else "communityHubItems"
                    val args=mutableMapOf<String,Any?>(
                        "title" to editingTitle.trim(),
                        "description" to editingBody.trim())
                    if(DocString(row["kind"]) in listOf("market","lend"))
                        args["priceChf"]=rawEditPrice.toDoubleOrNull() ?: -1.0
                    repo.updateMyPost(collection,DocString(row["id"]),"post.edit",args)
                    editing=null
                },enabled=!readOnly && editPriceValid && editingTitle.trim().length in 5..100 &&
                    editingBody.trim().length in 12..1200) {Text("Speichern")}
            },
            dismissButton={TextButton(onClick={editing=null}) {Text("Abbrechen")}})
    }
    deletionTarget?.let { row ->
        val collection=if(DocString(row["kind"])=="request") "requests"
            else "communityHubItems"
        AlertDialog(
            onDismissRequest={deletionTarget=null},
            title={Text("Eigenen Beitrag entfernen?")},
            text={Text("«"+DocString(row["title"])+"» wird aus den öffentlichen " +
                "Ansichten entfernt. Titel, Beschreibung und hochgeladene Fotos " +
                "werden gelöscht. Technische Referenzen für bestehende " +
                "Ausleihen, Nachrichten oder Prüfungen bleiben erhalten. " +
                "Dieser Schritt lässt sich nicht rückgängig machen.")},
            confirmButton={TextButton(onClick={
                val id=DocString(row["id"])
                deletionTarget=null
                repo.updateMyPost(collection,id,"post.delete")
            },enabled=!readOnly && !repo.enhancementLoading) {
                Text("Inhalt endgültig entfernen",
                    color=MaterialTheme.colorScheme.error)
            }},
            dismissButton={TextButton(onClick={deletionTarget=null}) {
                Text("Abbrechen")
            }}
        )
    }
    statusTarget?.let{ row ->
        val collection=if(DocString(row["kind"])=="request")
            "requests" else "communityHubItems"
        val serverStatus=if(collection=="requests")when(nextStatus){
            "archived" -> "archiviert";"completed" -> "erledigt";else -> "wartet_freigabe"
        } else nextStatus
        AlertDialog(onDismissRequest={statusTarget=null},
            title={Text("Beitragsstatus ändern?")},
            text={Text("«"+DocString(row["title"])+"» auf «"+serverStatus+"» setzen?")},
            confirmButton={TextButton(onClick={
                repo.updateMyPost(collection,DocString(row["id"]),"post.status",
                    mapOf("status" to serverStatus))
                statusTarget=null
            },enabled=!readOnly) {Text("Bestätigen")}},
            dismissButton={TextButton(onClick={statusTarget=null}){Text("Abbrechen")}})
    }
}
@Composable
fun NativeFavoriteScreen(repo:QuartinautRepository,navigate:(String)->Unit) {
    LaunchedEffect(Unit){repo.loadEnhancementList("favorites.list")}
    Column(Modifier.fillMaxSize().background(PlusBg).padding(16.dp),
        verticalArrangement=Arrangement.spacedBy(12.dp)) {
        ExtraHeader("Meine Favoriten","Gespeicherte Angebote aus deinem Kanton.")
        OutlinedButton(onClick={repo.loadEnhancementList("favorites.list")}) {Text("Aktualisieren")}
        if(repo.enhancementLoading)LinearProgressIndicator(Modifier.fillMaxWidth())
        if(repo.enhancementError.isNotBlank()) Text(repo.enhancementError,
            color=Color(0xFFFFB4AB))
        LazyColumn(verticalArrangement=Arrangement.spacedBy(10.dp)) {
            items(repo.enhancedItems){ row ->
                ExtraItem(DocString(row["title"]),DocString(row["kind"]),
                    "Öffnen"){
                    navigate(if(row["collection"]=="requests")"board"
                        else DocString(row["kind"]).ifBlank{"plus"})
                }
                TextButton(onClick={
                    repo.enhancement("favorite.toggle",mapOf(
                        "collection" to DocString(row["collection"]),
                        "id" to DocString(row["itemId"])
                    )){repo.loadEnhancementList("favorites.list")}
                }){Text("Aus Favoriten entfernen",color=PlusAccent)}
            }
            if(repo.enhancedItems.isEmpty())item {Text("Noch keine Favoriten gespeichert.",color=PlusMuted)}
        }
    }
}
@Composable
fun NativeTrustScreen(repo:QuartinautRepository,navigate:(String)->Unit) {
    var chosen by remember { mutableStateOf<Map<String,Any?>?>(null) }
    var profile by remember { mutableStateOf<Map<String,Any?>>(emptyMap()) }
    var score by remember { mutableIntStateOf(5) }
    var review by remember { mutableStateOf("") }
    var transaction by remember { mutableStateOf("") }
    var type by remember { mutableStateOf("market") }
    Column(Modifier.fillMaxSize().background(PlusBg).verticalScroll(rememberScrollState())
        .padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
        ExtraHeader("Vertrauensprofil","Nur bestätigte Transaktionen werden bewertet.")
        Text("Wähle einen veröffentlichten Eintrag, um den Anbieterstatus abzurufen.",
            color=PlusMuted)
        repo.hubItems.filter{it["status"]=="published" &&
            it["kind"] in listOf("market","lend","group")}.take(20).forEach{item->
            ExtraItem(DocString(item["title"]),DocString(item["area"])) {
                chosen=item;profile=emptyMap()
                repo.enhancement("trust.profile",mapOf(
                    "collection" to "communityHubItems",
                    "id" to DocString(item["id"])
                )) { response ->
                    val p=response["profile"] as? Map<*,*> ?:emptyMap<String,Any?>()
                    profile=p.entries.associate{DocString(it.key) to it.value}
                }
            }
        }
        if(chosen!=null){
            HorizontalDivider(color=PlusBorder)
            Text("Anbieterprofil",color=MaterialTheme.colorScheme.onSurface,
                style=MaterialTheme.typography.titleLarge)
            Text(DocString(profile["displayName"]).ifBlank{"Wird geladen …"},color=PlusAccent)
            if(profile.isNotEmpty()){
                Text(if(profile["verified"]==true)"✓ Verifiziert" else "Nicht verifiziert",
                    color=MaterialTheme.colorScheme.onSurface)
                Text(DocString(profile["totalReviews"])+" Bewertungen · Ø "+
                    DocString(profile["averageRating"])+" / 5",color=PlusMuted)
            }
        }
        HorizontalDivider(color=PlusBorder)
        Text("Abgeschlossene Transaktion bewerten",
            color=MaterialTheme.colorScheme.onSurface,style=MaterialTheme.typography.titleMedium)
        Text("Nur wenn du eine bestätigte abgeschlossene Marktreservierung oder Ausleihe hast. Die Transaktions-ID findest du in deinen Buchungen.",
            color=PlusMuted,style=MaterialTheme.typography.bodySmall)
        Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
            FilterChip(type=="market",{type="market"},label={Text("Marktplatz")})
            FilterChip(type=="loan", {type="loan"},label={Text("Ausleihe")})
        }
        OutlinedTextField(transaction,{transaction=it},label={Text("Transaktions-ID")},
            modifier=Modifier.fillMaxWidth())
        Text("Sterne",color=PlusMuted)
        Row{
            (1..5).forEach{ n->
                IconButton(onClick={score=n}) {
                    Icon(if(n<=score)Icons.Default.Star else Icons.Default.StarBorder,
                        "Stern $n",tint=Color(0xFFE4C16B))
                }
            }
        }
        OutlinedTextField(review,{review=it.take(300)},label={Text("Erfahrung")},
            minLines=2,modifier=Modifier.fillMaxWidth())
        Button(onClick={
            repo.enhancement("trust.review",mapOf(
                "type" to type,"transactionId" to transaction.trim(),
                "score" to score,"comment" to review.trim()
            )) {repo.loadEnhancementList("favorites.list")}
        },enabled=transaction.length>=5&&review.trim().length>=5){
            Text("Bewertung verbindlich abgeben")
        }
    }
}