package ch.quartinaut.nativeapp

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.google.firebase.firestore.DocumentSnapshot

private val Forest = Color(0xFF195A42)
private val SoftGreen = Color(0xFFEDF5EF)
private val Amber = Color(0xFFB77F20)
private val SwissScheme = lightColorScheme(
    primary = Forest, onPrimary = Color.White, secondary = Amber,
    background = Color(0xFFF7FAF8), surface = Color.White,
    surfaceVariant = SoftGreen, onSurface = Color(0xFF183127)
)

private val SwissDarkScheme = darkColorScheme(
    primary = Color(0xFF87D5AE), onPrimary = Color(0xFF123624),
    background=Color(0xFF101C16), surface=Color(0xFF1D2D24),
    surfaceVariant=Color(0xFF294739)
)
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val repository = remember { QuartinautRepository(applicationContext) }
            val prefs = remember {
                applicationContext.getSharedPreferences("quartinaut_android", MODE_PRIVATE)
            }
            var dark by remember { mutableStateOf(prefs.getBoolean("dark",false)) }
            MaterialTheme(colorScheme = if(dark) SwissDarkScheme else SwissScheme) {
                QuartinautApp(repository,dark) { next ->
                    dark=next
                    prefs.edit().putBoolean("dark",next).apply()
                }
            }
        }
    }
}

@Composable
private fun QuartinautApp(repo: QuartinautRepository,
    dark: Boolean, updateDark: (Boolean) -> Unit) {
    var page by remember { mutableStateOf("home") }
    var selectedHubItem by remember { mutableStateOf<Map<String,Any?>>(emptyMap()) }
    var selectedRequest by remember { mutableStateOf<DocumentSnapshot?>(null) }
    val authUser = repo.user
    var appliedHome by remember(authUser?.uid) { mutableStateOf(false) }
    LaunchedEffect(authUser?.uid) {
        if(authUser != null) repo.loadCommunitySettings()
    }
    LaunchedEffect(repo.communitySettings,authUser?.uid) {
        if(!appliedHome && authUser != null && repo.communitySettings.isNotEmpty()) {
            page = when(DocString(repo.communitySettings["homeView"])) {
                "hub" -> "plus"; "bulletin" -> "board"
                "events" -> "calendar"; "inbox" -> "official"
                "chats" -> "chats"; else -> "home"
            }
            appliedHome=true
        }
    }
    val notice = repo.message
    if (notice.isNotBlank()) {
        AlertDialog(onDismissRequest = repo::clearMessage,
            title = { Text("Quartinaut") },
            text = { Text(notice) },
            confirmButton = { TextButton(onClick = repo::clearMessage) { Text("Schliessen") } })
    }
    if (authUser == null) {
        LoginPage(repo)
        return
    }
    if (!authUser.isEmailVerified) {
        Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Default.MarkEmailUnread, null, tint = Forest, modifier = Modifier.size(48.dp))
                Text("E-Mail-Adresse bestätigen", style = MaterialTheme.typography.headlineSmall)
                Text("Öffne den Bestätigungslink in deinem E-Mail-Postfach.")
                Button(onClick = repo::refreshUser) { Text("E-Mail geprüft") }
                OutlinedButton(onClick = repo::resendVerification) { Text("Link erneut senden") }
                TextButton(onClick = repo::logout) { Text("Abmelden") }
            }
        }
        return
    }
    if (repo.profile.isEmpty()) {
        Box(Modifier.fillMaxSize().padding(20.dp), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                CircularProgressIndicator()
                Text("Dein Quartinaut-Profil wird geladen.")
                Text("Wenn du noch kein Profil hast, schliesse die Registrierung zuerst auf quartinaut.web.app ab.")
                TextButton(onClick = repo::logout) { Text("Abmelden") }
            }
        }
        return
    }
    if (!repo.active()) {
        Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Konto noch nicht freigegeben oder gesperrt.", style = MaterialTheme.typography.titleLarge)
                Spacer(Modifier.height(14.dp))
                Button(onClick = repo::logout) { Text("Abmelden") }
            }
        }
        return
    }
    val navTo: (String) -> Unit = { page = it; if (it == "plus") repo.loadHub() }
    val openHub: (Map<String,Any?>) -> Unit = { selectedHubItem = it; page = "hub-detail" }
    val openRequest: (DocumentSnapshot) -> Unit = { selectedRequest = it; page = "request-detail" }
    val title = when(page) {
        "home" -> "Mein Quartier"
        "board" -> "Schwarzes Brett"
        "plus" -> "Quartier+"
        "chats" -> "Private Chats"
        "profile" -> "Profil"
        "map" -> "Schweizkarte"
        "alerts" -> "Gemeinde-Alarme"
        "official" -> "Mitteilungen"
        "create" -> "Eintrag erstellen"
        "market" -> "Marktplatz"
        "lend" -> "Leihbörse"
        "group" -> "Vereine & Gruppen"
        "calendar" -> "Gemeindetermine"
        "v50market" -> "Reservierungen"
        "v50loans" -> "Ausleih-Kalender"
        "v50associations" -> "Anmeldungen"
        "search" -> "Suche"
        "settings" -> "Einstellungen"
        "admin" -> "Verwaltung"
        "help" -> "Hilfe & Datenschutz"
        "hub-detail" -> "Quartier+"
        "request-detail" -> "Anliegen"
        "create-request" -> "Anliegen erstellen"
        else -> "Quartinaut"
    }
    Scaffold(
        topBar = {
            Surface(shadowElevation = 3.dp, color = Forest) {
                Row(Modifier.fillMaxWidth().height(60.dp).padding(horizontal = 14.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    if (page !in listOf("home", "board", "plus", "chats", "profile"))
                        IconButton(onClick = { page = "plus" }) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, "Zurück", tint = Color.White)
                        }
                    QuartinautLogo(modifier=Modifier.size(width=42.dp,height=44.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(if(page == "home") "Quartinaut" else title,
                        color = Color.White, style = MaterialTheme.typography.titleLarge,
                        modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    IconButton(onClick = { page = "search" }) {
                        Icon(Icons.Default.Search, "Suchen", tint = Color.White)
                    }
                    IconButton(onClick = { page = "settings" }) {
                        Icon(Icons.Default.Settings, "Einstellungen", tint = Color.White)
                    }
                }
            }
        },
        bottomBar = {
            NavigationBar(containerColor = Color.White, tonalElevation = 5.dp) {
                listOf(
                    Triple("home","Start","start"),
                    Triple("plus","Quartier+","quartier"),
                    Triple("create","Neu","neu"),
                    Triple("chats","Chats","chats"),
                    Triple("profile","Profil","profil")
                ).forEach { (route,label,asset) ->
                    NavigationBarItem(selected = page == route,
                        onClick = { navTo(route) },
                        icon = { OriginalNavigationIcon(asset,Modifier.size(37.dp)) },
                        label = { Text(label, maxLines = 1) },
                        alwaysShowLabel = true)
                }
            }
        }
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when(page) {
                "home" -> DashboardPage(repo, navTo)
                "board" -> BulletinPage(repo, navTo, openRequest)
                "plus" -> HubPage(repo, navTo)
                "chats" -> ChatsPage(repo)
                "profile" -> ProfilePage(repo, navTo)
                "create" -> NativeNewChooser(navTo)
                "create-request" -> CreateRequestPage(repo, navTo)
                "request-detail" -> selectedRequest?.let { doc ->
                    NativeRequestDetail(repo,doc,{page="board"},{repo.openRequestChat(doc){page="chats"}})
                }
                "hub-detail" -> NativeHubDetail(repo,selectedHubItem) { page = "plus" }
                "map" -> RegionPage(repo)
                "alerts" -> DocumentsPage(repo, "Alarme", repo.alerts.filter {
                    it.str("cantonCode") == repo.canton() || it.str("scopeLevel") == "canton"
                })
                "official" -> DocumentsPage(repo, "Offizielle Mitteilungen", repo.notices)
                "market" -> HubItemsPage(repo, "market", navTo, openHub)
                "lend" -> HubItemsPage(repo, "lend", navTo, openHub)
                "group" -> HubItemsPage(repo, "group", navTo, openHub)
                "calendar" -> HubItemsPage(repo, "calendar", navTo, openHub)
                "lost" -> HubItemsPage(repo, "lost", navTo, openHub)
                "project" -> HubItemsPage(repo, "project", navTo, openHub)
                "issue" -> HubItemsPage(repo, "issue", navTo, openHub)
                "v50market", "v50loans", "v50associations" -> V50Page(repo, page)
                "search" -> SearchPage(repo, navTo)
                "settings" -> NativeSettingsScreen(repo,dark,updateDark,navTo)
                "admin" -> NativeAdminScreen(repo,navTo)
                "help" -> NativeHelpScreen()
                else -> {
                    if(page.startsWith("hub-create:")) {
                        NativeCreateHubPage(repo,page.substringAfter(":")) { navTo("plus") }
                    } else DashboardPage(repo,navTo)
                }
            }
            if (repo.busy) LinearProgressIndicator(Modifier.fillMaxWidth().align(Alignment.TopCenter))
        }
    }
}

@Composable
private fun LoginPage(repo: QuartinautRepository) {
    var creating by remember { mutableStateOf(false) }
    if (creating) {
        RegistrationPage(repo) { creating = false }
        return
    }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    val ctx = LocalContext.current
    Column(Modifier.fillMaxSize().background(SoftGreen).verticalScroll(rememberScrollState())
        .padding(horizontal = 24.dp, vertical = 32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Spacer(Modifier.height(26.dp))
        QuartinautLogo(modifier = Modifier.size(118.dp))
        Spacer(Modifier.height(14.dp))
        Text("Quartinaut", style = MaterialTheme.typography.headlineLarge, color = Forest,
            fontWeight = FontWeight.Bold)
        Text("Deine Nachbarschaft. Dein Quartier.")
        Spacer(Modifier.height(26.dp))
        Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(22.dp), color = Color.White, shadowElevation = 4.dp) {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Text("Anmelden", style = MaterialTheme.typography.titleLarge)
                OutlinedTextField(value = email, onValueChange = { email=it },
                    label = { Text("E-Mail") }, singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = password, onValueChange = { password=it },
                    label = { Text("Passwort") }, singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth())
                Button(onClick = { repo.login(email, password) },
                    enabled = !repo.busy, modifier = Modifier.fillMaxWidth().height(50.dp)) {
                    Text("Anmelden")
                }
                TextButton(onClick = { repo.sendReset(email) }, modifier = Modifier.align(Alignment.End)) {
                    Text("Passwort vergessen?")
                }
            }
        }
        Spacer(Modifier.height(18.dp))
        Text("Neues Konto?", fontWeight = FontWeight.SemiBold)
        OutlinedButton(onClick = { creating = true }) { Text("Privatkonto nativ registrieren") }
        TextButton(onClick = {
            ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://quartinaut.web.app/")))
        }) { Text("Firmen- oder Gemeindekonto: Web-Registrierung") }
    }
}


@Composable
private fun RegistrationPage(repo: QuartinautRepository, onBack: () -> Unit) {
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var repeated by remember { mutableStateOf("") }
    var canton by remember { mutableStateOf<Region?>(null) }
    var municipality by remember { mutableStateOf<Municipality?>(null) }
    var cantonMenu by remember { mutableStateOf(false) }
    var muniMenu by remember { mutableStateOf(false) }
    var muniSearch by remember { mutableStateOf("") }
    ScrollPage {
        TextButton(onClick = onBack) { Text("← Zurück zur Anmeldung") }
        SectionTitle("Privatkonto erstellen", "Mit deiner Schweizer Gemeinde verbinden")
        OutlinedTextField(name,{name=it},modifier=Modifier.fillMaxWidth(),label={Text("Vor- und Nachname")})
        OutlinedTextField(email,{email=it},modifier=Modifier.fillMaxWidth(),
            label={Text("E-Mail")},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Email))
        OutlinedTextField(password,{password=it},modifier=Modifier.fillMaxWidth(),
            label={Text("Passwort (mindestens 10 Zeichen)")},
            visualTransformation=PasswordVisualTransformation())
        OutlinedTextField(repeated,{repeated=it},modifier=Modifier.fillMaxWidth(),
            label={Text("Passwort wiederholen")},visualTransformation=PasswordVisualTransformation())
        Text("Kanton",fontWeight=FontWeight.Bold)
        Box {
            OutlinedButton(onClick={cantonMenu=true},modifier=Modifier.fillMaxWidth()) {
                Text(canton?.name ?: "Kanton auswählen")
            }
            DropdownMenu(expanded=cantonMenu,onDismissRequest={cantonMenu=false}) {
                repo.regions.forEach { region ->
                    DropdownMenuItem(text={Text(region.name+" ("+region.code+")")},onClick={
                        canton=region;municipality=null;muniSearch="";cantonMenu=false
                    })
                }
            }
        }
        if(canton != null) {
            Text("Gemeinde",fontWeight=FontWeight.Bold)
            OutlinedTextField(muniSearch,{muniSearch=it;muniMenu=true},
                modifier=Modifier.fillMaxWidth(),label={Text("Gemeinde suchen")})
            Box {
                OutlinedButton(onClick={muniMenu=true},modifier=Modifier.fillMaxWidth()) {
                    Text(municipality?.name ?: "Gemeinde auswählen")
                }
                DropdownMenu(expanded=muniMenu,onDismissRequest={muniMenu=false}) {
                    (canton?.municipalities ?: emptyList()).filter {
                        it.name.contains(muniSearch,ignoreCase=true)
                    }.take(60).forEach { choice ->
                        DropdownMenuItem(text={Text(choice.name)},onClick={
                            municipality=choice;muniSearch=choice.name;muniMenu=false
                        })
                    }
                }
            }
        }
        Text("Mit der Registrierung bestätigst du, dass du die geltenden Quartinaut-Regeln akzeptierst.",
            style=MaterialTheme.typography.bodySmall)
        Button(onClick={repo.registerResident(name,email,password,repeated,canton,municipality)},
            modifier=Modifier.fillMaxWidth(),enabled=!repo.busy && repo.regions.isNotEmpty()) {
            Text("Konto erstellen & E-Mail bestätigen")
        }
        if(repo.regions.isEmpty()) Text("Das Gemeindeverzeichnis wird geladen. Für die Registrierung wird eine Internetverbindung benötigt.")
    }
}

@Composable
private fun ScrollPage(content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(13.dp), content = content)
}

@Composable
private fun SectionTitle(title: String, subtitle: String = "") {
    Column {
        Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        if (subtitle.isNotBlank()) Text(subtitle, color = Color.DarkGray, style = MaterialTheme.typography.bodyMedium)
    }
}
@Composable
private fun Panel(title: String, body: String, foot: String = "", onClick: (() -> Unit)? = null) {
    Card(modifier = Modifier.fillMaxWidth().then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(1.dp)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(title, fontWeight = FontWeight.Bold, color = Forest, style = MaterialTheme.typography.titleMedium)
            if (body.isNotBlank()) Text(body, style = MaterialTheme.typography.bodyMedium)
            if (foot.isNotBlank()) Text(foot, style = MaterialTheme.typography.labelSmall, color = Color.Gray)
        }
    }
}
@Composable
private fun Feature(label: String, explanation: String, icon: @Composable () -> Unit, action: () -> Unit) {
    Surface(Modifier.fillMaxWidth().clickable(onClick = action), shape = RoundedCornerShape(14.dp),
        color = Color.White, shadowElevation = 1.dp) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(44.dp).background(SoftGreen, RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center) { icon() }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(label, fontWeight = FontWeight.Bold)
                Text(explanation, style = MaterialTheme.typography.bodySmall, color = Color.Gray)
            }
            Icon(Icons.Default.ChevronRight, null, tint = Forest)
        }
    }
}
@Composable
private fun DashboardPage(repo: QuartinautRepository, go: (String) -> Unit) = ScrollPage {
    SectionTitle("Hoi, " + repo.displayName().substringBefore(" ") + "!",
        repo.area().ifBlank { "Deine Schweizer Nachbarschaft" })
    Card(colors = CardDefaults.cardColors(containerColor = Forest), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(20.dp)) {
            Text("Dein Quartier auf einen Blick", color = Color.White,
                style = MaterialTheme.typography.titleLarge)
            Spacer(Modifier.height(16.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(22.dp)) {
                Metric(repo.requests.count { it.str("status") == "offen" }.toString(),"Anliegen")
                Metric(repo.hubItems.count { DocString(it["status"]) == "published" }.toString(),"Quartier+")
                Metric(repo.chats.size.toString(),"Chats")
            }
        }
    }
    Feature("Schwarzes Brett", "Hilfe suchen oder anbieten", { Icon(Icons.Default.ViewList, null,tint=Forest) }) { go("board") }
    Feature("Quartier+", "Marktplatz, Ausleihe, Vereine", { Icon(Icons.Default.GridView,null,tint=Forest) }) { go("plus") }
    Feature("Schweizkarte", "26 Kantone und alle Gemeinden", { Icon(Icons.Default.Map,null,tint=Forest) }) { go("map") }
    Feature("Gemeinde-Informationen", "Offizielle Hinweise und Alarme",
        { Icon(Icons.Default.Campaign,null,tint=Forest) }) { go("official") }
    SectionTitle("Aktuelle Anliegen")
    repo.requests.filter { it.str("status") == "offen" }.take(3).forEach { doc ->
        Panel(doc.title(), doc.str("text"), doc.str("area") + " · " + doc.str("type")) { go("board") }
    }
    if (repo.requests.isEmpty()) Text("Zurzeit keine veröffentlichten Anliegen geladen.")
}
@Composable
private fun Metric(value: String,label: String) {
    Column {
        Text(value, color=Color.White,style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)
        Text(label,color=Color.White,style=MaterialTheme.typography.labelSmall)
    }
}

@Composable
private fun BulletinPage(repo: QuartinautRepository, go: (String) -> Unit,
    openRequest: (DocumentSnapshot) -> Unit) {
    var query by remember { mutableStateOf("") }
    var showPending by remember { mutableStateOf(false) }
    val rows = repo.requests.filter { doc ->
        (doc.str("status") == "offen" || (showPending && doc.str("uid") == repo.user?.uid))
            && listOf(doc.title(), doc.str("text"), doc.str("category")).joinToString(" ")
                .contains(query, ignoreCase = true)
    }.sortedByDescending { it.str("createdAt") }
    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        SectionTitle("Schwarzes Brett", "Suche oder biete Hilfe in deiner Umgebung.")
        Button(onClick = { go("create-request") }, modifier=Modifier.fillMaxWidth()) {
            Icon(Icons.Default.Add, null); Spacer(Modifier.width(6.dp)); Text("Neues Anliegen")
        }
        OutlinedTextField(query, {query=it}, label={Text("Anliegen durchsuchen")},
            modifier = Modifier.fillMaxWidth(), singleLine = true)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(showPending, onCheckedChange = { showPending=it })
            Text("Meine eingereichten Anliegen einblenden")
        }
        LazyColumn(verticalArrangement=Arrangement.spacedBy(10.dp)) {
            items(rows,key={it.id}) { doc ->
                Column {
                    Panel(doc.title(), doc.str("text"),
                        doc.str("category") + " · " + doc.str("area") + " · " + doc.str("status")) {
                        openRequest(doc)
                    }
                    if (doc.str("uid") != repo.user?.uid && doc.str("status") == "offen") {
                        TextButton(onClick = { repo.openRequestChat(doc) { go("chats") } }) {
                            Icon(Icons.AutoMirrored.Filled.Chat, null)
                            Spacer(Modifier.width(6.dp))
                            Text("Private Nachricht schreiben")
                        }
                    }
                }
            }
            if(rows.isEmpty()) item { Text("Keine passenden Anliegen gefunden.") }
        }
    }
}
private val Categories = listOf("Alltagshilfe","Kinder","Werkzeug","Mobilität","Tiere",
    "Information","Notfall","Gesundheit","Seniorenhilfe","Digitalhilfe","Wohnen",
    "Bildung","Nachhaltigkeit","Firmen / Arbeit")
@Composable
private fun CreateRequestPage(repo: QuartinautRepository, go: (String) -> Unit) = ScrollPage {
    var title by remember { mutableStateOf("") }
    var body by remember { mutableStateOf("") }
    var category by remember { mutableStateOf(Categories.first()) }
    var kind by remember { mutableStateOf("Suche") }
    var urgency by remember { mutableStateOf("Diese Woche") }
    var categoryExpanded by remember { mutableStateOf(false) }
    SectionTitle("Neues Anliegen", "Einträge werden gemäss deinen Quartinaut-Rechten zur Prüfung eingereicht.")
    OutlinedTextField(title, {title=it}, modifier=Modifier.fillMaxWidth(),label={Text("Titel")})
    OutlinedTextField(body, {body=it}, modifier=Modifier.fillMaxWidth(),minLines=4,label={Text("Beschreibung")})
    Text("Art", fontWeight = FontWeight.Bold)
    Row { listOf("Suche","Biete").forEach { option ->
        FilterChip(selected=kind==option,onClick={kind=option},label={Text(option)},
            modifier=Modifier.padding(end=8.dp))
    } }
    Text("Kategorie",fontWeight=FontWeight.Bold)
    Box {
        OutlinedButton(onClick={categoryExpanded=true},modifier=Modifier.fillMaxWidth()) { Text(category) }
        DropdownMenu(expanded=categoryExpanded,onDismissRequest={categoryExpanded=false}) {
            Categories.forEach { option ->
                DropdownMenuItem(text={Text(option)},onClick={category=option;categoryExpanded=false})
            }
        }
    }
    Text("Dringlichkeit",fontWeight=FontWeight.Bold)
    listOf("Heute","Morgen","Diese Woche","Nicht dringend").forEach { option ->
        Row(verticalAlignment=Alignment.CenterVertically) {
            RadioButton(selected=urgency==option,onClick={urgency=option})
            Text(option)
        }
    }
    Button(onClick={repo.createRequest(title,body,category,kind,urgency);go("board")},
        modifier=Modifier.fillMaxWidth(),enabled=!repo.busy) { Text("Anliegen einreichen") }
}

@Composable
private fun HubPage(repo: QuartinautRepository, go:(String)->Unit) = ScrollPage {
    SectionTitle("Quartier+", "Alles für deine Gemeinde – auf einer Plattform.")
    Feature("Marktplatz","Verkaufen, verschenken und tauschen",
        {Icon(Icons.Default.Storefront,null,tint=Forest)}) { go("market") }
    Feature("Leihbörse","Werkzeuge und andere Dinge ausleihen",
        {Icon(Icons.Default.Handyman,null,tint=Forest)}) { go("lend") }
    Feature("Vereine & Gruppen","Entdecke deine Gemeinschaft",
        {Icon(Icons.Default.Groups,null,tint=Forest)}) { go("group") }
    Feature("Gemeindekalender","Termine und Entsorgung",
        {Icon(Icons.Default.Event,null,tint=Forest)}) { go("calendar") }
    Feature("Schweizkarte","Kantone und Gemeinden erkunden",
        {Icon(Icons.Default.Map,null,tint=Forest)}) { go("map") }
    Feature("Reservationsverwaltung","Marktplatz-Reservierungen",
        {Icon(Icons.Default.EventAvailable,null,tint=Forest)}) { go("v50market") }
    Feature("Ausleih-Kalender","Anfragen und Rückgaben",
        {Icon(Icons.Default.CalendarToday,null,tint=Forest)}) { go("v50loans") }
    Feature("Vereinsanmeldungen","Teilnahmen und Wartelisten",
        {Icon(Icons.Default.HowToReg,null,tint=Forest)}) { go("v50associations") }
    Feature("Verloren & Gefunden","Vermisste und gefundene Gegenstände",
        {Icon(Icons.Default.Search,null,tint=Forest)}) { go("lost") }
    Feature("Quartieraktionen","Aktionen und Freiwilligenarbeit",
        {Icon(Icons.Default.VolunteerActivism,null,tint=Forest)}) { go("project") }
    Feature("Mängel melden","Probleme in deiner Gemeinde dokumentieren",
        {Icon(Icons.Default.ReportProblem,null,tint=Forest)}) { go("issue") }
    Feature("Gemeinde-Alarme","Wichtige Warnungen",
        {Icon(Icons.Default.Warning,null,tint=Forest)}) { go("alerts") }
    Feature("Offizielle Mitteilungen","Nachrichten aus deiner Gemeinde",
        {Icon(Icons.Default.Campaign,null,tint=Forest)}) { go("official") }
    OutlinedButton(onClick=repo::loadHub,modifier=Modifier.fillMaxWidth()) { Text("Quartier+ aktualisieren") }
}
@Composable
private fun HubItemsPage(repo:QuartinautRepository,kind:String,go:(String)->Unit,
    openItem:(Map<String,Any?>)->Unit) {
    val labels = mapOf("market" to "Marktplatz","lend" to "Leihbörse","group" to "Vereine & Gruppen","calendar" to "Gemeindekalender")
    var query by remember(kind) { mutableStateOf("") }
    val rows=repo.hubItems.filter { DocString(it["kind"]) == kind && DocString(it["status"]) == "published"
        && (DocString(it["title"]) + DocString(it["description"])).contains(query,ignoreCase=true)}
    Column(Modifier.padding(16.dp), verticalArrangement=Arrangement.spacedBy(10.dp)) {
        SectionTitle(labels[kind] ?: "Quartier+", "Veröffentlichte Einträge aus dem Quartinaut-Backend")
        OutlinedTextField(query,{query=it},label={Text("Suchen")},singleLine=true,modifier=Modifier.fillMaxWidth())
        if(kind=="market") OutlinedButton(onClick={go("v50market")}) { Text("Meine Reservierungen") }
        if(kind=="lend") OutlinedButton(onClick={go("v50loans")}) { Text("Meine Ausleihen") }
        if(kind=="group") OutlinedButton(onClick={go("v50associations")}) { Text("Meine Anmeldungen") }
        LazyColumn(verticalArrangement=Arrangement.spacedBy(10.dp)) {
            items(rows) { item ->
                val price=if(item["priceChf"] != null) " · CHF " + DocString(item["priceChf"]) else ""
                Panel(DocString(item["title"]),
                    DocString(item["description"]),
                    DocString(item["area"])+price) { openItem(item) }
            }
            if(rows.isEmpty()) item { Text("Keine passenden Einträge gefunden.") }
        }
    }
}
@Composable
private fun DocumentsPage(repo: QuartinautRepository, header:String, rows:List<DocumentSnapshot>) {
    Column(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
        SectionTitle(header)
        LazyColumn(verticalArrangement=Arrangement.spacedBy(10.dp)) {
            items(rows,key={it.id}) { doc ->
                Panel(doc.title(), doc.str("text").ifBlank { doc.str("description") },
                    doc.str("area") + " · " + doc.str("createdAt").take(10))
            }
            if(rows.isEmpty()) item { Text("Zurzeit keine Mitteilungen verfügbar.") }
        }
    }
}
@Composable
private fun ChatsPage(repo: QuartinautRepository) {
    var input by remember(repo.chatId) { mutableStateOf("") }
    if(repo.chatId.isNotBlank()) {
        Column(Modifier.fillMaxSize().padding(14.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
            TextButton(onClick=repo::closeChat) { Text("← Zur Chatübersicht") }
            val active=repo.chats.find{it.id==repo.chatId}
            Text(active?.str("requestTitle") ?: "Privater Chat",style=MaterialTheme.typography.titleLarge)
            LazyColumn(modifier=Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                items(repo.messages,key={it.id}) { doc ->
                    val mine=doc.str("senderUid") == repo.user?.uid
                    Surface(color=if(mine) SoftGreen else Color.White,
                        shape=RoundedCornerShape(12.dp), modifier=Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(12.dp)) {
                            Text(doc.str("text"))
                            Text(if(mine) "Du" else "Nachricht",style=MaterialTheme.typography.labelSmall,color=Color.Gray)
                        }
                    }
                }
            }
            Row(verticalAlignment=Alignment.CenterVertically) {
                OutlinedTextField(input,{input=it.take(500)}, modifier=Modifier.weight(1f),
                    label={Text("Nachricht")}, maxLines=3)
                IconButton(onClick={repo.sendChat(input);input=""},enabled=input.isNotBlank()) {
                    Icon(Icons.Default.Send,"Senden",tint=Forest)
                }
            }
        }
    } else {
        Column(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
            SectionTitle("Private Chats","Nur die beiden Teilnehmenden haben Zugriff.")
            LazyColumn(verticalArrangement=Arrangement.spacedBy(10.dp)) {
                items(repo.chats,key={it.id}) { chat ->
                    Panel(chat.str("requestTitle").ifBlank{"Unterhaltung"},chat.str("lastMessagePreview"),
                        chat.str("lastMessageAt").take(10)) {repo.openChat(chat)}
                }
                if(repo.chats.isEmpty()) item {Text("Noch keine privaten Chats vorhanden.")}
            }
        }
    }
}
@Composable
private fun ProfilePage(repo: QuartinautRepository, go:(String)->Unit) = ScrollPage {
    SectionTitle(repo.displayName(), "Dein Quartinaut-Konto")
    Panel("Meine Gemeinde",repo.area(), "Kanton " + repo.canton())
    Panel("Konto",repo.user?.email.orEmpty(),"Status: " + DocString(repo.profile["accountStatus"]))
    Panel("Verifizierung", if (repo.profile["verified"] == true) "Verifiziert" else "Noch nicht verifiziert",
        "Rolle: " + DocString(repo.profile["role"]))
    Feature("Schweiz entdecken","Kantone und Gemeinden",
        { Icon(Icons.Default.Map,null,tint=Forest) }) { go("map") }
    Feature("Einstellungen","Startseite, Themen und Design",
        { Icon(Icons.Default.Settings,null,tint=Forest) }) { go("settings") }
    Feature("Hilfe & Datenschutz","Funktionen und Sicherheit",
        { Icon(Icons.Default.HelpOutline,null,tint=Forest) }) { go("help") }
    if(repo.isAdmin()) Feature("Verwaltung","Quartier+-Freigaben",
        { Icon(Icons.Default.AdminPanelSettings,null,tint=Forest) }) { go("admin") }
    OutlinedButton(onClick=repo::refreshUser,modifier=Modifier.fillMaxWidth()) { Text("Profil aktualisieren") }
    Button(onClick=repo::logout,modifier=Modifier.fillMaxWidth()) { Text("Abmelden") }
}
@Composable
private fun RegionPage(repo: QuartinautRepository) {
    var selectedCode by remember { mutableStateOf("") }
    var selectedMunicipality by remember { mutableStateOf<Municipality?>(null) }
    var search by remember { mutableStateOf("") }
    val canton = repo.regions.firstOrNull { it.code == selectedCode }
    val matches = if (selectedCode.isBlank()) repo.regions.filter {
        (it.name+" "+it.code).contains(search,ignoreCase=true)
            || it.municipalities.any { m->m.name.contains(search,ignoreCase=true) }
    } else canton?.municipalities?.filter { it.name.contains(search, ignoreCase=true) } ?: emptyList()
    Column(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
        SectionTitle(if(canton==null) "Schweiz entdecken" else canton.name,
            if(canton==null) "26 Kantone · 2'110 Gemeinden" else "Kanton " + canton.code + " · " + canton.municipalities.size + " Gemeinden")
        if (canton == null) {
            NativeCantonMap(selectedCode) { selectedCode=it;selectedMunicipality=null;search="" }
        } else {
            NativeMunicipalityMap(canton,selectedMunicipality) { selectedMunicipality=it }
        }
        if(canton != null) {
            TextButton(onClick={selectedCode="";selectedMunicipality=null;search=""}) { Text("← Alle Kantone") }
            selectedMunicipality?.let { m ->
                Panel(m.name,"Kanton " + canton.code + " · Schweiz",
                    "Amtliche BFS-Nummer: " + m.bfs)
                val ctx=LocalContext.current
                TextButton(onClick={
                    ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(
                        "https://www.agvchapp.bfs.admin.ch/de/communes/results?BfsNr="+m.bfs)))
                }) { Text("Offizieller Gemeindesteckbrief") }
            }
        }
        OutlinedTextField(search,{search=it},modifier=Modifier.fillMaxWidth(),singleLine=true,
            label={Text(if(canton==null) "Kanton suchen" else "Gemeinde suchen")})
        LazyColumn(verticalArrangement=Arrangement.spacedBy(5.dp)) {
            if(canton==null) {
                items(matches.filterIsInstance<Region>()) { region ->
                    Panel(region.name,region.code,region.municipalities.size.toString()+" Gemeinden") {
                        selectedCode=region.code;selectedMunicipality=null;search=""
                    }
                }
            } else {
                items(matches.filterIsInstance<Municipality>()) { m ->
                    Panel(m.name,canton.code,"Gemeindesteckbrief öffnen") { selectedMunicipality=m }
                }
            }
        }
    }
}
@Composable
private fun V50Page(repo: QuartinautRepository, page:String) {
    val action = when(page) { "v50market" -> "market.list";"v50loans" -> "loan.list"; else -> "association.list" }
    LaunchedEffect(page) { repo.loadV50(action) }
    Column(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
        SectionTitle(when(page){"v50market"->"Marktplatz-Reservierungen";"v50loans"->"Ausleih-Kalender";else->"Vereinsanmeldungen"})
        OutlinedButton(onClick={repo.loadV50(action)},modifier=Modifier.fillMaxWidth()) { Text("Aktualisieren") }
        LazyColumn(verticalArrangement=Arrangement.spacedBy(10.dp)) {
            items(repo.v50Items) { entry ->
                val title=DocString(entry["title"]).ifBlank {
                    DocString(entry["listingId"]).ifBlank {DocString(entry["eventId"])}
                }
                Card(colors=CardDefaults.cardColors(containerColor=Color.White)) {
                    Column(Modifier.fillMaxWidth().padding(14.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                        Text(title,fontWeight=FontWeight.Bold)
                        Text("Status: " + DocString(entry["status"]))
                        val id=DocString(entry["id"])
                        val listing=DocString(entry["listingId"])
                        val status=DocString(entry["status"])
                        val uid=repo.user?.uid.orEmpty()
                        if(page=="v50market" && status=="requested" && DocString(entry["sellerUid"])==uid) {
                            Row {
                                TextButton(onClick={repo.v50Action("market.accept",mapOf("listingId" to listing))}) { Text("Annehmen") }
                                TextButton(onClick={repo.v50Action("market.decline",mapOf("listingId" to listing))}) { Text("Ablehnen") }
                            }
                        }
                        if(page=="v50loans" && status=="requested" && DocString(entry["ownerUid"])==uid) {
                            TextButton(onClick={repo.v50Action("loan.accept",mapOf("id" to id))}) { Text("Ausleihe bestätigen") }
                        }
                        if(page=="v50associations" && status=="waitlisted" && DocString(entry["organizerUid"])==uid) {
                            TextButton(onClick={repo.v50Action("association.manage",mapOf("id" to id,"decision" to "confirm"))}) { Text("Von Warteliste bestätigen") }
                        }
                    }
                }
            }
            if(repo.v50Items.isEmpty()) item { Text("Keine Einträge geladen.") }
        }
    }
}
@Composable
private fun SearchPage(repo:QuartinautRepository,go:(String)->Unit) {
    var query by remember {mutableStateOf("")}
    val entries=repo.requests.filter {it.str("status")=="offen"
        && (it.title()+" "+it.str("text")).contains(query,ignoreCase=true)}
    val hubs=repo.hubItems.filter{(DocString(it["title"])+DocString(it["description"])).contains(query,ignoreCase=true)}
    Column(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
        SectionTitle("Quartinaut durchsuchen")
        OutlinedTextField(query,{query=it},modifier=Modifier.fillMaxWidth(),singleLine=true,label={Text("Suchbegriff")})
        LazyColumn(verticalArrangement=Arrangement.spacedBy(10.dp)) {
            items(entries) { doc->Panel(doc.title(),doc.str("text"),"Schwarzes Brett") {go("board")} }
            items(hubs) { m->Panel(DocString(m["title"]),DocString(m["description"]),"Quartier+") {
                go(when(DocString(m["kind"])){"market"->"market";"lend"->"lend";"group"->"group";else->"plus"})
            } }
        }
    }
}
