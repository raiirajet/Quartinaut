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
    var nextStatus by remember {mutableStateOf("")}
    LaunchedEffect(Unit) {repo.loadEnhancementList("posts.mine")}
    val uid=repo.user?.uid.orEmpty()
    val readOnly=!repo.enhancementReady || repo.enhancementLoading || repo.enhancementError.isNotBlank()
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
        if(readOnly)ownHub+ownRequests else repo.enhancedItems
    Column(Modifier.fillMaxSize().background(PlusBg).padding(16.dp),
        verticalArrangement=Arrangement.spacedBy(12.dp)) {
        ExtraHeader("Meine Beiträge","Inserate kontrollieren, überarbeiten oder abschliessen.")
        OutlinedButton(onClick={repo.loadEnhancementList("posts.mine")},
            modifier=Modifier.fillMaxWidth()) {Text("Aktualisieren")}
        if(repo.enhancementLoading)LinearProgressIndicator(Modifier.fillMaxWidth())
        if(readOnly)
            Text("Die erweiterte Beitragsverwaltung ist derzeit nicht verfügbar. " +
                "Deine bereits geladenen eigenen Beiträge werden schreibgeschützt angezeigt. " +
                "Bearbeiten, Pausieren und Archivieren benötigen den geschützten Erweiterungsdienst.",
                color=PlusMuted,style=MaterialTheme.typography.bodySmall)
        LazyColumn(verticalArrangement=Arrangement.spacedBy(11.dp)) {
            items(visiblePosts) { row ->
                Surface(color=PlusSurface,shape=RoundedCornerShape(18.dp),
                    border=BorderStroke(1.dp,PlusBorder)) {
                    Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(7.dp)) {
                        Text(DocString(row["title"]),fontWeight=FontWeight.SemiBold,color=MaterialTheme.colorScheme.onSurface)
                        Text(DocString(row["description"]).take(180),color=PlusMuted)
                        Text("Status: "+DocString(row["status"])+" · "+
                            DocString(row["kind"]),color=PlusAccent,
                            style=MaterialTheme.typography.labelMedium)
                        val collection=if(DocString(row["kind"])=="request")
                            "requests" else "communityHubItems"
                        if(readOnly) OutlinedButton(onClick={
                            navigate(when(DocString(row["kind"])) {
                                "request"->"board"
                                "market"->"market"
                                "lend"->"lend"
                                "group"->"group"
                                "calendar"->"calendar"
                                else->"plus"
                            })
                        }) { Text("In Übersicht öffnen") }
                        if(!readOnly) Row(Modifier.horizontalScroll(rememberScrollState()),
                            horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(onClick={
                                editing=row
                                editingTitle=DocString(row["title"])
                                editingBody=DocString(row["description"])
                                editingPrice=DocString(row["priceChf"])
                            }) {Text("Bearbeiten")}
                            listOf(
                                "paused" to "Pausieren",
                                "published" to "Reaktivieren",
                                "completed" to "Erledigt",
                                "archived" to "Archivieren"
                            ).filter { (s,_) ->
                                when {
                                    collection=="requests" -> s in listOf("archived","completed")
                                    s=="published" -> DocString(row["status"])=="paused"
                                    s=="paused" -> DocString(row["status"])=="published"
                                    s=="completed" -> DocString(row["kind"]) in listOf("market","lend","lost")
                                    else -> true
                                }
                            }.forEach{ (status,label) ->
                                OutlinedButton(onClick={
                                    statusTarget=row;nextStatus=status
                                }) {Text(label)}
                            }
                        }
                    }
                }
            }
            if(visiblePosts.isEmpty())item {
                Text(if(readOnly)"Keine eigenen Beiträge im lokalen Datenbestand geladen. Dies ist kein vollständiger Serverabgleich."
                    else "Noch keine eigenen Beiträge gefunden.",color=PlusMuted)
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