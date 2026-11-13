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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import java.util.Locale

private val PlusBg=Color(0xFF101F19)
private val PlusSurface=Color(0xFF203A2E)
private val PlusAccent=Color(0xFFA6DCB7)
private val PlusMuted=Color(0xFFC1D7C6)
private val PlusBorder=Color(0xFF52725E)

private data class PlusRoute(val key:String,val name:String,val detail:String,val emoji:String)
private val allExtensions=listOf(
    PlusRoute("chats","Private Chats","Nachrichten, sichere Kontakte und Lesestatus","💬"),
    PlusRoute("enh-posts","Meine Beiträge","Bearbeiten, pausieren und abschliessen","📝"),
    PlusRoute("create","Fotos & Inserate","Bilder hochladen und Beiträge erstellen","📷"),
    PlusRoute("enh-radar","Quartinaut Radar","Neue Angebote in Kanton oder Gemeinde","📡"),
    PlusRoute("enh-assist","Inserat-Assistent","Titel und Kategorien offline vorbereiten","✨"),
    PlusRoute("enh-loans","Ausleih-Kalender","Anfragen, Zeiträume und Rückgaben","🗓️"),
    PlusRoute("enh-map","Schweizkarte+","26 Kantone und 2'110 Gemeinden","🇨🇭"),
    PlusRoute("enh-clubs","Vereinszentrale","Anmeldungen und Mitglieder verwalten","👥"),
    PlusRoute("enh-trust","Vertrauensprofile","Verifizierungsstatus und echte Bewertungen","🛡️"),
    PlusRoute("enh-calendar","Gemeindekalender+","Entsorgung, Termine und Erinnerungen","📆"),
    PlusRoute("enh-qr","QR-Übergabe","Sichere Ausleihe bestätigen","🔳"),
    PlusRoute("enh-offline","Offline-Modus","Gemeindeverzeichnis und zwischengespeicherte Daten","📱")
)
private val radarTags=listOf("market" to "Marktplatz","lend" to "Ausleihen",
    "group" to "Vereine","project" to "Aktionen","request" to "Hilfegesuche",
    "calendar" to "Gemeindetermine","lost" to "Fundbüro")

@Composable
fun NativeExtrasDirectory(repo:QuartinautRepository,navigate:(String)->Unit) {
    Column(Modifier.fillMaxSize().background(PlusBg).verticalScroll(rememberScrollState())
        .padding(16.dp),verticalArrangement=Arrangement.spacedBy(11.dp)) {
        Text("QUARTINAUT · MEHR",color=PlusAccent,style=MaterialTheme.typography.labelLarge)
        Text("Alles für dein Quartier",color=Color.White,
            style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)
        Text("Entdecken, helfen, verkaufen, ausleihen und gemeinsam aktiv sein.",
            color=PlusMuted)
        allExtensions.forEach { option ->
            Surface(onClick={navigate(option.key)},
                color=PlusSurface,shape=RoundedCornerShape(19.dp),
                border=BorderStroke(1.dp,PlusBorder)) {
                Row(Modifier.fillMaxWidth().padding(15.dp),
                    verticalAlignment=Alignment.CenterVertically) {
                    Text(option.emoji,style=MaterialTheme.typography.headlineSmall)
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(option.name,color=Color.White,
                            fontWeight=FontWeight.SemiBold)
                        Text(option.detail,color=PlusMuted,
                            style=MaterialTheme.typography.bodySmall)
                    }
                    Icon(Icons.Default.ChevronRight,null,tint=PlusAccent)
                }
            }
        }
        Text("Deine Gemeinde: "+repo.area()+" ("+repo.canton()+")",
            color=PlusMuted,style=MaterialTheme.typography.bodySmall)
    }
}
@Composable
private fun ExtraHeader(title:String,description:String) {
    Text(title,color=Color.White,style=MaterialTheme.typography.headlineSmall,
        fontWeight=FontWeight.Bold)
    Text(description,color=PlusMuted,style=MaterialTheme.typography.bodySmall)
}
@Composable
private fun ExtraItem(title:String,description:String,detail:String="",
                      onClick:(()->Unit)?=null) {
    val shape=RoundedCornerShape(18.dp)
    val content:@Composable ()->Unit={
        Column(Modifier.padding(15.dp),verticalArrangement=Arrangement.spacedBy(7.dp)) {
            Text(title,color=Color.White,fontWeight=FontWeight.SemiBold,
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
    var text by remember {mutableStateOf("")}
    var scope by remember {mutableStateOf("municipality")}
    val tags=remember{mutableStateListOf<String>()}
    LaunchedEffect(scope,tags.toList()){
        repo.loadEnhancementList("radar.list",mapOf("scope" to scope,"tags" to tags.toList()))
    }
    val shown=repo.enhancedItems.filter{
        (DocString(it["title"])+" "+DocString(it["description"]))
            .contains(text,ignoreCase=true)
    }
    Column(Modifier.fillMaxSize().background(PlusBg).padding(15.dp),
        verticalArrangement=Arrangement.spacedBy(10.dp)) {
        ExtraHeader("Quartinaut Radar","Was gibt es Neues in deiner Umgebung?")
        OutlinedTextField(text,{text=it},label={Text("Beiträge durchsuchen")},
            singleLine=true,modifier=Modifier.fillMaxWidth(),
            leadingIcon={Icon(Icons.Default.Search,null)})
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
        if(repo.enhancementError.isNotBlank())
            Text(repo.enhancementError,color=Color(0xFFFFB4AB),
                style=MaterialTheme.typography.bodySmall)
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
                Text("Keine passenden Beiträge. Wechsle zum ganzen Kanton oder entferne Filter.",
                    color=PlusMuted)
            }
        }
    }
}
@Composable
fun NativeMyPostsScreen(repo:QuartinautRepository) {
    var editing by remember {mutableStateOf<Map<String,Any?>?>(null)}
    var editingTitle by remember {mutableStateOf("")}
    var editingBody by remember {mutableStateOf("")}
    var editingPrice by remember {mutableStateOf("")}
    var statusTarget by remember {mutableStateOf<Map<String,Any?>?>(null)}
    var nextStatus by remember {mutableStateOf("")}
    LaunchedEffect(Unit) {repo.loadEnhancementList("posts.mine")}
    Column(Modifier.fillMaxSize().background(PlusBg).padding(16.dp),
        verticalArrangement=Arrangement.spacedBy(12.dp)) {
        ExtraHeader("Meine Beiträge","Inserate kontrollieren, überarbeiten oder abschliessen.")
        OutlinedButton(onClick={repo.loadEnhancementList("posts.mine")},
            modifier=Modifier.fillMaxWidth()) {Text("Aktualisieren")}
        if(repo.enhancementLoading)LinearProgressIndicator(Modifier.fillMaxWidth())
        if(repo.enhancementError.isNotBlank())
            Text(repo.enhancementError,color=Color(0xFFFFB4AB))
        LazyColumn(verticalArrangement=Arrangement.spacedBy(11.dp)) {
            items(repo.enhancedItems) { row ->
                Surface(color=PlusSurface,shape=RoundedCornerShape(18.dp),
                    border=BorderStroke(1.dp,PlusBorder)) {
                    Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(7.dp)) {
                        Text(DocString(row["title"]),fontWeight=FontWeight.SemiBold,color=Color.White)
                        Text(DocString(row["description"]).take(180),color=PlusMuted)
                        Text("Status: "+DocString(row["status"])+" · "+
                            DocString(row["kind"]),color=PlusAccent,
                            style=MaterialTheme.typography.labelMedium)
                        val collection=if(DocString(row["kind"])=="request")
                            "requests" else "communityHubItems"
                        Row(Modifier.horizontalScroll(rememberScrollState()),
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
            if(repo.enhancedItems.isEmpty())item {
                Text("Noch keine eigenen Beiträge gefunden.",color=PlusMuted)
            }
        }
    }
    if(editing!=null) {
        val row=editing!!
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
                            label={Text("Preis CHF")})
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
                        args["priceChf"]=editingPrice.replace(',','.').toDoubleOrNull() ?: -1.0
                    repo.updateMyPost(collection,DocString(row["id"]),"post.edit",args)
                    editing=null
                },enabled=editingTitle.trim().length in 5..100 &&
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
            }) {Text("Bestätigen")}},
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
            Text("Anbieterprofil",color=Color.White,
                style=MaterialTheme.typography.titleLarge)
            Text(DocString(profile["displayName"]).ifBlank{"Wird geladen …"},color=PlusAccent)
            if(profile.isNotEmpty()){
                Text(if(profile["verified"]==true)"✓ Verifiziert" else "Nicht verifiziert",
                    color=Color.White)
                Text(DocString(profile["totalReviews"])+" Bewertungen · Ø "+
                    DocString(profile["averageRating"])+" / 5",color=PlusMuted)
            }
        }
        HorizontalDivider(color=PlusBorder)
        Text("Abgeschlossene Transaktion bewerten",
            color=Color.White,style=MaterialTheme.typography.titleMedium)
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
