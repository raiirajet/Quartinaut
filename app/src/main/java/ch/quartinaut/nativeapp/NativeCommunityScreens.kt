package ch.quartinaut.nativeapp

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.google.firebase.firestore.DocumentSnapshot
import java.time.Instant
import java.time.temporal.ChronoUnit

private val NativeKinds = linkedMapOf(
    "market" to "Marktplatz", "lend" to "Leihbörse",
    "lost" to "Verloren & Gefunden", "group" to "Vereine & Gruppen",
    "project" to "Quartieraktionen", "issue" to "Mängel melden",
    "calendar" to "Gemeindetermine"
)
private val NativeCategories = mapOf(
    "market" to listOf("Zu verkaufen","Zu verschenken","Tauschen"),
    "lend" to listOf("Werkzeug","Garten","Haushalt","Freizeit","Sonstiges"),
    "lost" to listOf("Verloren","Gefunden"),
    "group" to listOf("Verein","Sport","Familie","Hobby","Nachbarschaft"),
    "project" to listOf("Quartieraktion","Freiwilligenarbeit","Umwelt","Nachbarschaft"),
    "issue" to listOf("Strasse","Abfall","Beleuchtung","Spielplatz","Sonstiges"),
    "calendar" to listOf("Entsorgung","Gemeindetermin","Veranstaltung","Information")
)
private val FieldGreen = Color(0xFF195A42)

@Composable
fun NativeNewChooser(onSelect: (String) -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement=Arrangement.spacedBy(12.dp)) {
        Text("Was möchtest du erstellen?",
            style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)
        Text("Wähle den passenden Bereich. Neue Beiträge werden wie in Quartinaut Web geprüft.")
        ItemAction("Schwarzes Brett","Hilfe suchen oder anbieten", Icons.Default.Handshake) {onSelect("create-request")}
        NativeKinds.forEach { (kind,label) ->
            ItemAction(label,when(kind) {
                "market" -> "Artikel verkaufen, verschenken oder tauschen"
                "lend" -> "Gegenstände zur Ausleihe anbieten"
                "lost" -> "Etwas verloren oder gefunden?"
                "group" -> "Eine Gemeinschaft oder einen Verein vorstellen"
                "project" -> "Eine lokale Aktion organisieren"
                "issue" -> "Mängel in der Gemeinde melden"
                else -> "Gemeindetermin eintragen (mit Berechtigung)"
            }, Icons.Default.AddCircleOutline) { onSelect("hub-create:$kind") }
        }
    }
}
@Composable
private fun ItemAction(label: String, description: String,
                       icon: androidx.compose.ui.graphics.vector.ImageVector,
                       action: () -> Unit) {
    Card(Modifier.fillMaxWidth().clickable(onClick=action),
        colors=CardDefaults.cardColors(containerColor=MaterialTheme.colorScheme.surface),
        elevation=CardDefaults.cardElevation(2.dp)) {
        Row(Modifier.padding(15.dp),verticalAlignment=Alignment.CenterVertically) {
            Icon(icon,null,tint=MaterialTheme.colorScheme.primary,modifier=Modifier.size(29.dp))
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(label,fontWeight=FontWeight.SemiBold)
                Text(description,style=MaterialTheme.typography.bodySmall)
            }
            Icon(Icons.Default.ChevronRight,null,tint=MaterialTheme.colorScheme.primary)
        }
    }
}
@Composable
fun NativeCreateHubPage(
    repo: QuartinautRepository, initialKind: String,
    onCompleted: () -> Unit
) {
    val green=Color(0xFFA6E4BC)
    val bg=Color(0xFF172C23)
    var step by remember { mutableIntStateOf(0) }
    var kind by remember(initialKind) {
        mutableStateOf(initialKind.takeIf{it in NativeKinds} ?: "market")
    }
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var category by remember(kind) { mutableStateOf(NativeCategories[kind]?.firstOrNull().orEmpty()) }
    var price by remember { mutableStateOf("0") }
    var capacity by remember { mutableStateOf("0") }
    var venue by remember { mutableStateOf("") }
    var localDate by remember { mutableStateOf("") }
    var expanded by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var confirmed by remember { mutableStateOf(false) }
    // The same op ID is reused on every retry, preventing duplicate listings
    // after a slow or interrupted connection.
    val operationId=remember { "android_"+java.util.UUID.randomUUID().toString().replace("-","") }
    val date=remember(localDate) {
        if(localDate.isBlank()) "" else runCatching {
            java.time.LocalDateTime.parse(
                localDate.trim(),
                java.time.format.DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm"))
                .atZone(java.time.ZoneId.of("Europe/Zurich")).toInstant().toString()
        }.getOrDefault("")
    }
    val rawPrice=price.trim().replace(',','.')
    val priceValue=rawPrice.toDoubleOrNull()
    val priceValid=kind !in listOf("market","lend") ||
        (rawPrice.matches(Regex("""[0-9]+(\.[0-9]{1,2})?""")) &&
         priceValue!=null && priceValue in 0.0..100000.0)
    val count=capacity.toIntOrNull()
    val capValid=kind !in listOf("group","project") ||
        (count!=null && count in 0..300)
    val eventDateValid=(kind !in listOf("calendar","project")) ||
        (kind=="project"&&localDate.isBlank()) ||
        (date.isNotBlank() && runCatching {
            val v=java.time.Instant.parse(date)
            v.isAfter(java.time.Instant.now()) &&
                v.isBefore(java.time.Instant.now().plusSeconds(370L*86400))
        }.getOrDefault(false))
    val municipalityOnly=kind=="calendar" &&
        (DocString(repo.profile["accountType"])!="municipality" ||
        repo.profile["verified"]!=true)
    val canAdvance=title.trim().length in 5..100 && category.isNotBlank() &&
        description.trim().length in 12..1200 &&
        priceValid && capValid && eventDateValid && !municipalityOnly
    Column(Modifier.fillMaxSize().background(Color(0xFF111F19))
        .verticalScroll(rememberScrollState()).padding(18.dp),
        verticalArrangement=Arrangement.spacedBy(14.dp)) {
        Text("QUARTIER+ · "+(NativeKinds[kind] ?: "Eintrag"),
            style=MaterialTheme.typography.labelLarge,color=green)
        Text("Beitrag erstellen",style=MaterialTheme.typography.headlineSmall,
            color=Color.White,fontWeight=FontWeight.Bold)
        Text("Schritt "+(step+1)+" von 3 · "+
            when(step){0->"Bereich und Titel";1->"Beschreibung und Angaben";else->"Vorschau & Freigabe"},
            color=Color(0xFFC5DBCA),style=MaterialTheme.typography.bodySmall)
        LinearProgressIndicator(progress={ (step+1)/3f },
            modifier=Modifier.fillMaxWidth(),color=green)
        Surface(shape=RoundedCornerShape(22.dp),color=bg,
            border=androidx.compose.foundation.BorderStroke(1.dp,Color(0xFF416C54)),
            modifier=Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp),
                verticalArrangement=Arrangement.spacedBy(13.dp)) {
                if(step==0) {
                    Text("Was möchtest du veröffentlichen?",
                        color=Color.White,style=MaterialTheme.typography.titleMedium)
                    Box {
                        OutlinedButton(onClick={expanded=true},
                            modifier=Modifier.fillMaxWidth()) {
                            Text(NativeKinds[kind] ?: "Bereich wählen",
                                modifier=Modifier.weight(1f))
                            Icon(Icons.Default.ExpandMore,null)
                        }
                        DropdownMenu(expanded=expanded,onDismissRequest={expanded=false}) {
                            NativeKinds.forEach { (key,label) ->
                                DropdownMenuItem(text={Text(label)},onClick={
                                    kind=key; expanded=false; confirmed=false
                                })
                            }
                        }
                    }
                    if(municipalityOnly) {
                        Text("Offizielle Gemeindetermine können nur durch bestätigte Gemeindekonten erstellt werden.",
                            color=Color(0xFFFFC7A4),
                            style=MaterialTheme.typography.bodySmall)
                    }
                    OutlinedTextField(title,{title=it.take(100);error=""},
                        label={Text("Titel")},modifier=Modifier.fillMaxWidth(),
                        singleLine=true,
                        supportingText={Text(title.length.toString()+" / 100 Zeichen")})
                    Text("Kategorie",fontWeight=FontWeight.SemiBold,color=Color.White)
                    (NativeCategories[kind] ?: emptyList()).forEach { value ->
                        Row(Modifier.fillMaxWidth().clickable{category=value},
                            verticalAlignment=Alignment.CenterVertically) {
                            RadioButton(selected=category==value,onClick={category=value})
                            Text(value,color=Color.White)
                        }
                    }
                } else if(step==1) {
                    Text("Erzähle den Menschen in deiner Gemeinde mehr darüber",
                        color=Color.White,style=MaterialTheme.typography.titleMedium)
                    OutlinedTextField(description,{
                        description=it.take(1200);error=""
                    },label={Text("Beschreibung")},minLines=5,maxLines=12,
                        modifier=Modifier.fillMaxWidth(),
                        supportingText={Text(description.length.toString()+" / 1200 Zeichen")})
                    if(kind in listOf("market","lend")) {
                        OutlinedTextField(price,{price=it;error=""},
                            modifier=Modifier.fillMaxWidth(),label={Text("Preis in CHF (0 = kostenlos)")},
                            singleLine=true)
                        if(!priceValid)Text("Bitte einen Betrag von 0 bis 100'000 CHF mit maximal zwei Nachkommastellen eingeben.",
                            color=Color(0xFFFFB4AB),
                            style=MaterialTheme.typography.bodySmall)
                    }
                    if(kind in listOf("group","project")) {
                        OutlinedTextField(capacity,{capacity=it;error=""},
                            modifier=Modifier.fillMaxWidth(),
                            label={Text("Max. Teilnehmer (0 = unbegrenzt)")},singleLine=true)
                        if(!capValid)Text("Zahl zwischen 0 und 300 eingeben.",
                            color=Color(0xFFFFB4AB))
                    }
                    if(kind in listOf("project","calendar")) {
                        OutlinedTextField(localDate,{localDate=it;error=""},
                            modifier=Modifier.fillMaxWidth(),
                            label={Text("Datum und Uhrzeit: TT.MM.JJJJ HH:MM")},singleLine=true)
                        if(!eventDateValid)Text("Ein gültiger zukünftiger Termin ist erforderlich.",
                            color=Color(0xFFFFB4AB),
                            style=MaterialTheme.typography.bodySmall)
                    }
                    if(kind in listOf("calendar","project","group")) {
                        OutlinedTextField(venue,{venue=it.take(120)},
                            modifier=Modifier.fillMaxWidth(),
                            label={Text("Ort oder Treffpunkt (optional)")},singleLine=true)
                    }
                    Text("Persönliche Kontaktdaten müssen nicht veröffentlicht werden. Für Rückfragen ist der Quartinaut-Kontakt vorgesehen.",
                        color=Color(0xFFC5DBCA),style=MaterialTheme.typography.bodySmall)
                } else {
                    Text("Vorschau deines Beitrags",color=Color.White,
                        style=MaterialTheme.typography.titleMedium)
                    Text((NativeKinds[kind] ?: kind)+" · "+category,color=green)
                    HorizontalDivider(color=Color(0xFF416C54))
                    Text(title.trim(),color=Color.White,
                        fontWeight=FontWeight.Bold,
                        style=MaterialTheme.typography.titleLarge)
                    Text(description.trim(),color=Color(0xFFE4F2E8))
                    if(kind in listOf("market","lend"))
                        Text("Preis: CHF "+price.trim(),color=green)
                    if(date.isNotBlank())
                        Text("Termin: "+localDate,color=Color.White)
                    if(venue.isNotBlank())
                        Text("Ort: "+venue,color=Color.White)
                    Text("Gemeinde: "+repo.area()+" ("+repo.canton()+")",
                        color=Color(0xFFC5DBCA))
                    HorizontalDivider(color=Color(0xFF416C54))
                    Text(when(kind){
                        "issue" -> "Dein Mängelbericht wird der Prüfung zugeführt."
                        "calendar" -> "Gemeindetermine werden gemäss deiner Rolle geprüft."
                        else -> "Der Beitrag wird zur Freigabe eingereicht und zunächst als Entwurf zur Prüfung markiert."
                    },color=Color(0xFFC5DBCA),
                        style=MaterialTheme.typography.bodySmall)
                }
            }
        }
        if(error.isNotBlank()) Text(error,color=Color(0xFFFFB4AB))
        if(step==2) Row(verticalAlignment=Alignment.CenterVertically,
            modifier=Modifier.clickable{confirmed=!confirmed}) {
            Checkbox(confirmed,onCheckedChange={confirmed=it})
            Text("Alle Angaben stimmen; ich möchte den Beitrag einreichen.",
                color=Color.White,style=MaterialTheme.typography.bodySmall)
        }
        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(10.dp)) {
            if(step>0) {
                OutlinedButton(onClick={step--;error=""},
                    modifier=Modifier.weight(1f),enabled=!repo.busy) {Text("Zurück")}
            }
            Button(
                onClick={
                    error=""
                    when(step) {
                        0 -> {
                            if(title.trim().length !in 5..100)error="Bitte einen Titel mit 5–100 Zeichen eingeben."
                            else if(municipalityOnly)error="Für Gemeindetermine ist ein bestätigtes Gemeindekonto erforderlich."
                            else step=1
                        }
                        1 -> {
                            if(description.trim().length !in 12..1200)
                                error="Bitte eine Beschreibung mit 12–1200 Zeichen eingeben."
                            else if(!priceValid||!capValid||!eventDateValid)
                                error="Bitte Preis, Teilnehmerzahl und Datum überprüfen."
                            else step=2
                        }
                        else -> {
                            if(!canAdvance||!confirmed) {
                                error="Bitte die Angaben prüfen und bestätigen."
                            } else {
                                val data=mapOf<String,Any?>(
                                    "kind" to kind,"title" to title.trim(),
                                    "description" to description.trim(),"category" to category,
                                    "priceChf" to (priceValue ?: 0.0),
                                    "capacity" to (count ?: 0),
                                    "venue" to venue.trim(),"startsAt" to date,
                                    "photoPaths" to emptyList<String>())
                                repo.createCommunityItem(data,onCompleted,operationId)
                            }
                        }
                    }
                },modifier=Modifier.weight(1f).height(49.dp),enabled=!repo.busy
            ) { Text(when(step){0->"Weiter";1->"Vorschau";else->"Einreichen"}) }
        }
        Spacer(Modifier.height(16.dp))
    }
}

@Composable
fun NativeHubDetail(
    repo: QuartinautRepository, item: Map<String,Any?>,
    onClose: () -> Unit
) {
    val id=DocString(item["id"])
    val kind=DocString(item["kind"])
    val owner=DocString(item["ownerUid"])==repo.user?.uid
    val v50=item["v50ReservationMode"]==true
    val paths=(item["photoPaths"] as? List<*>)?.filterIsInstance<String>() ?: emptyList()
    val published=DocString(item["status"])=="published"
    var showComments by remember(id) { mutableStateOf(false) }
    var comments by remember(id) { mutableStateOf<List<Map<String,Any?>>>(emptyList()) }
    var commentInput by remember(id) { mutableStateOf("") }
    var liked by remember(id) { mutableStateOf<Boolean?>(null) }
    var likedCount by remember(id) { mutableStateOf(0) }
    var loanFrom by remember(id) { mutableStateOf(Instant.now().plus(1,ChronoUnit.DAYS).truncatedTo(ChronoUnit.HOURS).toString()) }
    var loanTo by remember(id) { mutableStateOf(Instant.now().plus(3,ChronoUnit.DAYS).truncatedTo(ChronoUnit.HOURS).toString()) }
    var holdMinutes by remember(id) { mutableIntStateOf(60) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement=Arrangement.spacedBy(13.dp)) {
        TextButton(onClick=onClose) { Text("← Zur Übersicht") }
        Text(DocString(item["title"]),style=MaterialTheme.typography.headlineSmall,
            fontWeight=FontWeight.Bold)
        Text((NativeKinds[kind] ?: "Quartier+")+" · "+DocString(item["area"]),
            style=MaterialTheme.typography.bodySmall)
        if(!published) {
            Text("Status: " + DocString(item["status"]) + " – noch nicht öffentlich",
                color=MaterialTheme.colorScheme.error)
        }
        NativeProtectedGallery(repo,paths)
        Card(colors=CardDefaults.cardColors(containerColor=MaterialTheme.colorScheme.surface)) {
            Column(Modifier.padding(17.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                Text(DocString(item["description"]))
                if(item["priceChf"]!=null) Text("CHF " + DocString(item["priceChf"]),
                    color=MaterialTheme.colorScheme.primary,fontWeight=FontWeight.Bold)
                if(DocString(item["venue"]).isNotBlank()) Text("Ort: "+DocString(item["venue"]))
                if(DocString(item["startsAt"]).isNotBlank()) Text("Termin: "+DocString(item["startsAt"]))
                if(kind in listOf("lend","market","lost")) Text("Verfügbarkeit: "+DocString(item["availability"]))
                if(kind in listOf("group","project")) Text(
                    "Mitglieder: "+DocString(item["memberCount"])+
                    " / "+DocString(item["capacity"]).ifBlank{"unbegrenzt"})
            }
        }
        if(published && !owner) {
            when(kind) {
                "group","project" -> Button(onClick={repo.communityAction("join",mapOf("id" to id))},
                    modifier=Modifier.fillMaxWidth(),enabled=!repo.busy) {Text("Beitreten")}
                "market" -> if(v50) {
                    Text("Artikel reservieren",style=MaterialTheme.typography.titleMedium)
                    Row(horizontalArrangement=Arrangement.spacedBy(5.dp)) {
                        listOf(30,60,120,240).forEach { minutes ->
                            FilterChip(holdMinutes==minutes,{holdMinutes=minutes},label={Text("$minutes Min.")})
                        }
                    }
                    Button(onClick={repo.v50Action("market.request",
                            mapOf("listingId" to id,"minutes" to holdMinutes))},
                        enabled=!repo.busy,modifier=Modifier.fillMaxWidth()) {Text("Reservierung anfragen")}
                } else {
                    Button(onClick={repo.communityAction("reserve",mapOf("id" to id))},
                        modifier=Modifier.fillMaxWidth(),enabled=!repo.busy) { Text("Artikel reservieren") }
                }
                "lend" -> if(v50) {
                    Text("Ausleihzeitraum",style=MaterialTheme.typography.titleMedium)
                    OutlinedTextField(loanFrom,{loanFrom=it},label={Text("Von (ISO-8601)")},modifier=Modifier.fillMaxWidth())
                    OutlinedTextField(loanTo,{loanTo=it},label={Text("Bis (ISO-8601)")},modifier=Modifier.fillMaxWidth())
                    Button(onClick={repo.v50Action("loan.request", mapOf("listingId" to id,
                            "from" to loanFrom,"to" to loanTo,
                            "opId" to "android_"+java.util.UUID.randomUUID().toString().replace("-","")))},
                        modifier=Modifier.fillMaxWidth(),enabled=!repo.busy) { Text("Ausleihe anfragen") }
                } else {
                    Button(onClick={repo.communityAction("reserve",mapOf("id" to id))},
                        modifier=Modifier.fillMaxWidth(),enabled=!repo.busy) {Text("Gegenstand reservieren")}
                }
                "lost" -> Button(onClick={repo.communityAction("reserve",mapOf("id" to id))},
                    modifier=Modifier.fillMaxWidth()) {Text("Kontakt aufnehmen")}
            }
        }
        if(owner) Text("Das ist dein eigener Quartier+-Eintrag.",
            style=MaterialTheme.typography.bodySmall)
        if(published && kind !in listOf("issue","calendar")) {
            HorizontalDivider()
            Text("Reaktionen und Kommentare",
                style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold)
            OutlinedButton(onClick={
                repo.reactionAction("like.toggle","hub",id){ response->
                    val summary=response["summary"] as? Map<*, *>
                    liked=summary?.get("liked")==true
                    likedCount=(summary?.get("likes") as? Number)?.toInt() ?: likedCount
                }
            }) { Text((if(liked==true)"♥" else "♡") + " Gefällt mir" +
                (if(likedCount>0)" ($likedCount)" else "")) }
            TextButton(onClick={
                showComments=!showComments
                if(showComments) repo.reactionAction("comments.list","hub",id){ result ->
                    val list=result["comments"] as? List<*> ?: emptyList<Any>()
                    comments=list.mapNotNull{ row -> (row as? Map<*, *>)?.entries?.associate {
                        DocString(it.key) to it.value
                    }}
                }
            }) { Text(if(showComments)"Kommentare ausblenden" else "Kommentare anzeigen") }
            if(showComments) {
                if(comments.isEmpty()) Text("Noch keine sichtbaren Kommentare.")
                comments.forEach { entry ->
                    Card(colors=CardDefaults.cardColors(containerColor=MaterialTheme.colorScheme.surface)) {
                        Column(Modifier.fillMaxWidth().padding(12.dp)) {
                            Text(DocString(entry["authorName"]),fontWeight=FontWeight.SemiBold)
                            Text(DocString(entry["text"]))
                        }
                    }
                }
                OutlinedTextField(commentInput,{commentInput=it.take(400)},
                    label={Text("Kommentar")},minLines=2,modifier=Modifier.fillMaxWidth())
                Button(onClick={
                    repo.reactionAction("comment.create","hub",id,
                        mapOf("text" to commentInput.trim())) {
                        commentInput=""
                        repo.reactionAction("comments.list","hub",id){ result ->
                            comments=(result["comments"] as? List<*>)?.mapNotNull { row ->
                                (row as? Map<*, *>)?.entries?.associate { DocString(it.key) to it.value }
                            } ?: emptyList()
                        }
                    }
                },enabled=commentInput.trim().length in 2..400) { Text("Kommentar senden") }
            }
        }
    }
}


@Composable
fun NativeRequestDetail(
    repo: QuartinautRepository, doc: DocumentSnapshot,
    onClose: () -> Unit, onChat: () -> Unit
) {
    val paths=(doc.get("photoPaths") as? List<*>)?.filterIsInstance<String>() ?: emptyList()
    val id=doc.id
    var comments by remember(id) { mutableStateOf<List<Map<String,Any?>>>(emptyList()) }
    var showComments by remember(id) { mutableStateOf(false) }
    var text by remember(id) { mutableStateOf("") }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement=Arrangement.spacedBy(12.dp)) {
        TextButton(onClick=onClose) { Text("← Schwarzes Brett") }
        Text(doc.title(),style=MaterialTheme.typography.headlineSmall,
            fontWeight=FontWeight.Bold)
        Text(doc.str("category") + " · " + doc.str("area"),
            style=MaterialTheme.typography.bodySmall)
        NativeProtectedGallery(repo,paths)
        Card(colors=CardDefaults.cardColors(containerColor=MaterialTheme.colorScheme.surface)) {
            Text(doc.str("text").ifBlank{doc.str("description")},
                modifier=Modifier.padding(16.dp))
        }
        Text("Art: "+doc.str("type") + " · Dringlichkeit: "+doc.str("urgency"),
            style=MaterialTheme.typography.bodySmall)
        if(doc.str("uid") != repo.user?.uid && doc.str("status")=="offen") {
            Button(onClick=onChat,modifier=Modifier.fillMaxWidth()) {
                Icon(Icons.Default.MailOutline,null)
                Spacer(Modifier.width(6.dp))
                Text("Privaten Chat starten")
            }
        }
        OutlinedButton(onClick={
            repo.reactionAction("like.toggle","request",id){ }
        }) { Text("♡ Gefällt mir") }
        TextButton(onClick={
            showComments=!showComments
            if(showComments) repo.reactionAction("comments.list","request",id){ result ->
                val rows=result["comments"] as? List<*> ?: emptyList<Any>()
                comments=rows.mapNotNull { r ->
                    (r as? Map<*, *>)?.entries?.associate { DocString(it.key) to it.value }
                }
            }
        }) { Text(if(showComments) "Kommentare ausblenden" else "Kommentare anzeigen") }
        if(showComments) {
            comments.forEach { entry ->
                Card(colors=CardDefaults.cardColors(containerColor=MaterialTheme.colorScheme.surface)) {
                    Column(Modifier.fillMaxWidth().padding(12.dp)) {
                        Text(DocString(entry["authorName"]),fontWeight=FontWeight.Bold)
                        Text(DocString(entry["text"]))
                    }
                }
            }
            OutlinedTextField(text,{text=it.take(400)},label={Text("Kommentar")},
                modifier=Modifier.fillMaxWidth(),minLines=2)
            Button(onClick={
                repo.reactionAction("comment.create","request",id,mapOf("text" to text.trim())) {
                    text=""
                    repo.reactionAction("comments.list","request",id){ data ->
                        val rows=data["comments"] as? List<*> ?: emptyList<Any>()
                        comments=rows.mapNotNull { r ->
                            (r as? Map<*, *>)?.entries?.associate { DocString(it.key) to it.value }
                        }
                    }
                }
            },enabled=text.trim().length in 2..400) { Text("Kommentar senden") }
        }
    }
}
