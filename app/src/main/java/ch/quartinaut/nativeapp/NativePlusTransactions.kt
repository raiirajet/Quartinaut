package ch.quartinaut.nativeapp

import android.content.Intent
import android.provider.CalendarContract
import android.graphics.Bitmap
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.font.FontWeight
import com.google.zxing.BarcodeFormat
import com.google.zxing.MultiFormatWriter
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import java.time.LocalDate
import java.time.ZoneId
import java.util.Calendar

private val TBg=Color(0xFF111F19)
private val TPanel=Color(0xFF203A2E)
private val TMute=Color(0xFFC5DBCA)
private val TGreen=Color(0xFF9CE2B5)
private val TBorder=Color(0xFF52725E)

@Composable
private fun ToolCard(title:String,subtitle:String,content:@Composable ColumnScope.()->Unit={}) {
    Surface(color=TPanel,shape=RoundedCornerShape(18.dp),
        border=BorderStroke(1.dp,TBorder),modifier=Modifier.fillMaxWidth()) {
        Column(Modifier.padding(15.dp),verticalArrangement=Arrangement.spacedBy(9.dp)) {
            Text(title,color=Color.White,fontWeight=FontWeight.SemiBold,
                style=MaterialTheme.typography.titleMedium)
            if(subtitle.isNotBlank())Text(subtitle,color=TMute,
                style=MaterialTheme.typography.bodySmall)
            content()
        }
    }
}
@Composable
fun NativeLoanPlanner(repo:QuartinautRepository,navigate:(String)->Unit) {
    LaunchedEffect(Unit){repo.loadV50("loan.list")}
    val rows=repo.v50Items.sortedBy{DocString(it["from"])}
    Column(Modifier.fillMaxSize().background(TBg).padding(15.dp),
        verticalArrangement=Arrangement.spacedBy(10.dp)) {
        Text("Ausleih-Kalender",color=Color.White,
            style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)
        Text("Anfragen, verfügbare Zeiträume und Rückgaben an einem Ort.",
            color=TMute)
        Row(horizontalArrangement=Arrangement.spacedBy(10.dp)) {
            OutlinedButton(onClick={repo.loadV50("loan.list")}){Text("Aktualisieren")}
            OutlinedButton(onClick={navigate("lend")}){Text("Leihangebote")}
        }
        LazyColumn(verticalArrangement=Arrangement.spacedBy(12.dp)) {
            items(rows) { loan ->
                val uid=repo.user?.uid
                val owner=DocString(loan["ownerUid"])==uid
                val status=DocString(loan["status"])
                ToolCard(
                    "Ausleihe · "+status,
                    DocString(loan["from"]).take(16).replace('T',' ')+" – "+
                        DocString(loan["to"]).take(16).replace('T',' ')+
                        (if(owner)" · du verleihst" else " · du leihst")
                ){
                    Text("Buchungs-ID: "+DocString(loan["id"]),
                        color=TMute,style=MaterialTheme.typography.labelSmall)
                    Row(Modifier.horizontalScroll(rememberScrollState()),
                        horizontalArrangement=Arrangement.spacedBy(7.dp)) {
                        if(owner&&status=="requested") {
                            Button(onClick={
                                repo.v50Action("loan.accept",mapOf("id" to loan["id"]))
                            }){Text("Annehmen")}
                            OutlinedButton(onClick={
                                repo.v50Action("loan.decline",mapOf("id" to loan["id"]))
                            }){Text("Ablehnen")}
                        }
                        if(!owner&&status=="requested") {
                            OutlinedButton(onClick={
                                repo.v50Action("loan.cancel",mapOf("id" to loan["id"]))
                            }){Text("Anfrage stornieren")}
                        }
                        if(owner&&status=="accepted") {
                            Button(onClick={
                                repo.v50Action("loan.return",mapOf("id" to loan["id"]))
                            }){Text("Rückgabe verbuchen")}
                        }
                        if(status=="accepted") {
                            OutlinedButton(onClick={navigate("enh-qr")}) {
                                Text("QR-Übergabe")
                            }
                        }
                    }
                }
            }
            if(rows.isEmpty())item {
                Text("Noch keine reservierten Ausleihen vorhanden.",color=TMute)
            }
        }
    }
}
@Composable
fun NativeClubCenter(repo:QuartinautRepository,navigate:(String)->Unit) {
    LaunchedEffect(Unit){repo.loadV50("association.list")}
    val all=repo.hubItems.filter{it["kind"]=="group"||it["kind"]=="project"}
    var groupPosts by remember {mutableStateOf<List<Map<String,Any?>>>(emptyList())}
    var selected by remember {mutableStateOf("")}
    var post by remember {mutableStateOf("")}
    Column(Modifier.fillMaxSize().background(TBg).padding(16.dp),
        verticalArrangement=Arrangement.spacedBy(12.dp)) {
        Text("Vereinszentrale",color=Color.White,
            style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)
        Text("Vereine entdecken, teilnehmen und eigene Anmeldungen verwalten.",
            color=TMute,style=MaterialTheme.typography.bodySmall)
        Row(horizontalArrangement=Arrangement.spacedBy(7.dp)) {
            OutlinedButton(onClick={repo.loadV50("association.list")}){Text("Anmeldungen")}
            OutlinedButton(onClick={navigate("group")}){Text("Alle Vereine")}
        }
        LazyColumn(verticalArrangement=Arrangement.spacedBy(11.dp)) {
            item {Text("Meine Anmeldungen",color=TGreen,
                style=MaterialTheme.typography.titleMedium)}
            items(repo.v50Items){entry->
                ToolCard(DocString(entry["eventId"]), "Status: "+DocString(entry["status"])) {
                    if(DocString(entry["uid"])==repo.user?.uid &&
                        DocString(entry["status"]) in listOf("confirmed","waitlisted")) {
                        OutlinedButton(onClick={
                            repo.v50Action("association.cancel",mapOf("id" to entry["id"]))
                        }){Text("Teilnahme absagen")}
                    }
                    if(DocString(entry["organizerUid"])==repo.user?.uid &&
                       DocString(entry["status"])=="waitlisted") {
                        Button(onClick={
                            repo.v50Action("association.manage",
                                mapOf("id" to entry["id"],"decision" to "confirm"))
                        }){Text("Warteliste bestätigen")}
                    }
                }
            }
            item {Text("Vereine und Quartieraktionen",color=TGreen,
                style=MaterialTheme.typography.titleMedium)}
            items(all){row->
                ToolCard(DocString(row["title"]),DocString(row["description"])) {
                    Text("Mitglieder: "+DocString(row["memberCount"]),
                        color=TMute)
                    Row(Modifier.horizontalScroll(rememberScrollState()),
                        horizontalArrangement=Arrangement.spacedBy(7.dp)) {
                        if(row["status"]=="published"&&row["isMine"]!=true)
                            Button(onClick={
                                repo.v50Action("association.signup",mapOf("eventId" to row["id"]))
                            }){Text("Teilnehmen")}
                        OutlinedButton(onClick={
                            selected=DocString(row["id"])
                            repo.communityAction("group.posts",mapOf("id" to selected),false) {
                                val raw=it["posts"] as? List<*> ?:emptyList<Any>()
                                groupPosts=raw.mapNotNull{r->(r as? Map<*,*>)?.entries?.associate{
                                    e->DocString(e.key) to e.value
                                }}
                            }
                        }){Text("Vereinsbeiträge")}
                    }
                    if(selected==DocString(row["id"])) {
                        groupPosts.take(12).forEach { entry ->
                            Text(DocString(entry["message"]),color=Color.White,
                                style=MaterialTheme.typography.bodySmall)
                        }
                        OutlinedTextField(post,{post=it.take(500)},
                            label={Text("Neuer Gruppenbeitrag")},minLines=2)
                        Button(onClick={
                            repo.communityAction("group.post",mapOf(
                                "id" to selected,"message" to post.trim(),
                                "opId" to "android_"+java.util.UUID.randomUUID()
                                    .toString().replace("-","")
                            ),false){post="";selected=""}
                        },enabled=post.trim().length>=3) {Text("Im Verein veröffentlichen")}
                    }
                }
            }
        }
    }
}
@Composable
fun NativeCalendarPlus(repo:QuartinautRepository) {
    val context=LocalContext.current
    LaunchedEffect(Unit){repo.loadV50("calendar.list")}
    var hours by remember {mutableIntStateOf(24)}
    var selected by remember {mutableStateOf("")}
    Column(Modifier.fillMaxSize().background(TBg).padding(16.dp),
        verticalArrangement=Arrangement.spacedBy(10.dp)) {
        Text("Gemeindekalender+",color=Color.White,
            style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)
        Text("Termine, Entsorgung und Veranstaltungen aus offiziellen Quellen.",
            color=TMute)
        OutlinedButton(onClick={repo.loadV50("calendar.list")}){Text("Kalender aktualisieren")}
        LazyColumn(verticalArrangement=Arrangement.spacedBy(10.dp)) {
            items(repo.v50Items.sortedBy{DocString(it["date"])}){event->
                val id=DocString(event["id"])
                ToolCard(DocString(event["title"]),
                    DocString(event["date"])+" · "+DocString(event["venue"])) {
                    if(DocString(event["description"]).isNotBlank())
                        Text(DocString(event["description"]),
                            color=TMute,style=MaterialTheme.typography.bodySmall)
                    Row(Modifier.horizontalScroll(rememberScrollState()),
                        horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                        Button(onClick={
                            val date=runCatching {
                                LocalDate.parse(DocString(event["date"]))
                            }.getOrNull()
                            if(date==null)repo.loadV50("calendar.list")
                            else {
                                val start=date.atStartOfDay(ZoneId.of("Europe/Zurich"))
                                    .toInstant().toEpochMilli()
                                val intent=Intent(Intent.ACTION_INSERT).apply {
                                    data=CalendarContract.Events.CONTENT_URI
                                    putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME,start)
                                    putExtra(CalendarContract.EXTRA_EVENT_END_TIME,start+3600000L)
                                    putExtra(CalendarContract.Events.TITLE,DocString(event["title"]))
                                    putExtra(CalendarContract.Events.DESCRIPTION,DocString(event["description"]))
                                    putExtra(CalendarContract.Events.EVENT_LOCATION,DocString(event["venue"]))
                                }
                                runCatching{context.startActivity(intent)}
                            }
                        }) {Text("In Handy-Kalender")}
                        OutlinedButton(onClick={selected=id}){Text("Erinnerung")}
                    }
                    if(selected==id) {
                        Row(horizontalArrangement=Arrangement.spacedBy(4.dp)) {
                            listOf(1,3,12,24,48).forEach { v ->
                                FilterChip(selected=hours==v,onClick={hours=v},
                                    label={Text(v.toString()+"h")})
                            }
                        }
                        Button(onClick={
                            repo.enhancement("reminders.save",mapOf(
                                "id" to id,"hoursBefore" to hours
                            )) {selected=""}
                        }) {Text("Erinnerung speichern")}
                        Text("Die zusätzliche Erinnerung ist zunächst im Quartinaut-Profil gespeichert. Handy-Erinnerungen funktionieren über den Kalender.",
                            color=TMute,style=MaterialTheme.typography.labelSmall)
                    }
                }
            }
            if(repo.v50Items.isEmpty())item{Text("Keine kommenden Termine verfügbar.",color=TMute)}
        }
    }
}
@Composable
fun NativeQRHandover(repo:QuartinautRepository) {
    var token by remember {mutableStateOf("")}
    var expiry by remember {mutableStateOf("")}
    var loanId by remember {mutableStateOf("")}
    var scanned by remember {mutableStateOf("")}
    var confirmed by remember {mutableStateOf(false)}
    LaunchedEffect(Unit){repo.loadV50("loan.list")}
    val accepted=repo.v50Items.filter{it["status"]=="accepted"}
    val scanner=rememberLauncherForActivityResult(ScanContract()) { result->
        val content=result.contents.orEmpty()
        val code=when {
            content.startsWith("quartinaut://handover?t=") -> content.substringAfter("?t=")
            else -> content
        }
        if(code.matches(Regex("[A-Za-z0-9_-]{36,120}")))scanned=code
    }
    Column(Modifier.fillMaxSize().background(TBg).verticalScroll(rememberScrollState())
        .padding(17.dp),verticalArrangement=Arrangement.spacedBy(13.dp)) {
        Text("QR-Übergabe",color=Color.White,
            style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)
        Text("Einmaliger Code · 10 Minuten gültig · nur für bestätigte Ausleihen.",
            color=TMute)
        Text("Wähle eine bestätigte Ausleihe:",color=TGreen)
        accepted.forEach { loan->
            val id=DocString(loan["id"])
            FilterChip(selected=loanId==id,onClick={loanId=id;token="";confirmed=false},
                label={Text(id.take(18)+"…")})
        }
        Button(onClick={
            repo.enhancement("handover.create",mapOf("loanId" to loanId)){
                token=DocString(it["token"])
                expiry=DocString(it["expiresAt"])
                confirmed=false
            }
        },enabled=loanId.isNotBlank()&&!repo.enhancementLoading,
            modifier=Modifier.fillMaxWidth()) {Text("Einmaligen QR-Code erstellen")}
        if(token.isNotBlank()) {
            val code="quartinaut://handover?t="+token
            val qr=remember(code){renderQR(code)}
            ToolCard("Übergabecode","Gültig bis: "+expiry) {
                if(qr!=null) Image(qr.asImageBitmap(),
                    contentDescription="Einmaliger QR-Code für Übergabe",
                    modifier=Modifier.size(225.dp).align(Alignment.CenterHorizontally))
                Text("Die andere beteiligte Person scannt den QR-Code. Er kann nur einmal verwendet werden.",
                    color=TMute,style=MaterialTheme.typography.bodySmall)
            }
        }
        HorizontalDivider(color=TBorder)
        Button(onClick={
            scanner.launch(ScanOptions()
                .setDesiredBarcodeFormats(ScanOptions.QR_CODE)
                .setPrompt("Quartinaut-Übergabe scannen")
                .setBeepEnabled(false)
                .setOrientationLocked(false))
        },modifier=Modifier.fillMaxWidth()) {
            Icon(Icons.Default.QrCodeScanner,null)
            Spacer(Modifier.width(9.dp))
            Text("QR-Code scannen")
        }
        if(scanned.isNotBlank()) {
            Text("QR-Code erfasst. Bestätige nur eine tatsächlich erfolgte Übergabe.",
                color=TGreen)
            Button(onClick={
                repo.enhancement("handover.confirm",mapOf("token" to scanned)){
                    scanned="";confirmed=true;token=""
                }
            },modifier=Modifier.fillMaxWidth()) {Text("Übergabe bestätigen")}
        }
        if(confirmed)Text("Übergabe bestätigt. Die Ausleihe bleibt bis zur Rückgabe aktiv.",
            color=TGreen)
        if(repo.enhancementError.isNotBlank())Text(repo.enhancementError,
            color=Color(0xFFFFB4AB))
    }
}
private fun renderQR(content:String):Bitmap? = runCatching{
    val matrix=MultiFormatWriter().encode(content,BarcodeFormat.QR_CODE,600,600)
    val bmp=Bitmap.createBitmap(matrix.width,matrix.height,Bitmap.Config.ARGB_8888)
    val dark=android.graphics.Color.rgb(10,40,26)
    val white=android.graphics.Color.WHITE
    for(y in 0 until matrix.height)for(x in 0 until matrix.width) {
        bmp.setPixel(x,y,if(matrix[x,y])dark else white)
    }
    bmp
}.getOrNull()
