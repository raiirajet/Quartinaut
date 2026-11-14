package ch.quartinaut.nativeapp

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.enableEdgeToEdge
import androidx.activity.SystemBarStyle
import androidx.compose.ui.graphics.toArgb
import androidx.activity.compose.setContent
import androidx.activity.compose.BackHandler
import androidx.activity.compose.LocalOnBackPressedDispatcherOwner
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.core.view.WindowCompat
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.contentDescription
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
    surfaceVariant = SoftGreen, onSurface = Color(0xFF183127),
    onSurfaceVariant = Color(0xFF4A6256),
    outline = Color(0xFFB9C9BF), outlineVariant = Color(0xFFDCE8E0),
    primaryContainer = Color(0xFFE5F3E9), onPrimaryContainer = Forest
)

private val SwissGreenScheme = darkColorScheme(
    primary=Color(0xFF8DDEAC), onPrimary=Color(0xFF103624),
    background=Color(0xFF123525), surface=Color(0xFF1E4733),
    onBackground=Color.White, onSurface=Color.White,
    surfaceVariant=Color(0xFF29533B), onSurfaceVariant=Color(0xFFDBEFE1),
    outlineVariant=Color(0xFF416B51),
    primaryContainer=Color(0xFF29533B), onPrimaryContainer=Color.White
)
private val SwissBlackScheme = darkColorScheme(
    primary=Color(0xFF91E6B4), onPrimary=Color(0xFF04190E),
    background=Color(0xFF030504), surface=Color(0xFF111715),
    onBackground=Color.White, onSurface=Color(0xFFE7F4EA),
    surfaceVariant=Color(0xFF202A24), onSurfaceVariant=Color(0xFFCBDCCF),
    outlineVariant=Color(0xFF324339),
    primaryContainer=Color(0xFF183325), onPrimaryContainer=Color(0xFFE7F4EA)
)
private val SwissRedScheme = lightColorScheme(
    primary=Color(0xFFD52B1E), onPrimary=Color.White,
    background=Color(0xFFFFF7F6), surface=Color.White,
    onBackground=Color(0xFF411E1B), onSurface=Color(0xFF411E1B),
    surfaceVariant=Color(0xFFFCE8E6), onSurfaceVariant=Color(0xFF694A45),
    outlineVariant=Color(0xFFEBD1CE),
    primaryContainer=Color(0xFFFCE8E6), onPrimaryContainer=Color(0xFF75291F)
)
private val SwissDarkScheme = darkColorScheme(
    primary = Color(0xFF87D5AE), onPrimary = Color(0xFF123624),
    background=Color(0xFF101C16), surface=Color(0xFF1D2D24),
    surfaceVariant=Color(0xFF294739), onSurfaceVariant=Color(0xFFD8E6DC),
    outlineVariant=Color(0xFF3A6150),
    primaryContainer=Color(0xFF294739), onPrimaryContainer=Color.White
)
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Android 15/16 draw behind transparent system bars by default.
        // Explicit edge-to-edge plus a dark full-screen Compose underlay
        // prevents the white band and keeps status-bar icons legible.
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(android.graphics.Color.rgb(16,31,25)),
            navigationBarStyle = SystemBarStyle.dark(android.graphics.Color.rgb(16,31,25))
        )
        window.decorView.setBackgroundColor(android.graphics.Color.rgb(16,31,25))
        setContent {
            val repository = remember { QuartinautRepository(applicationContext) }
            val prefs = remember {
                applicationContext.getSharedPreferences("quartinaut_android", MODE_PRIVATE)
            }
            var mode by remember { mutableStateOf(prefs.getString("theme_mode",null)
                ?: if(prefs.getBoolean("dark",false)) "dark" else "light") }
            val displayMode=if(mode=="system") { if(isSystemInDarkTheme()) "dark" else "light" } else mode
            val scheme=when(displayMode) {
                "green" -> SwissGreenScheme
                "dark" -> SwissBlackScheme
                "red" -> SwissRedScheme
                else -> SwissScheme
            }
            val header=when(displayMode) {
                "light" -> Color.White
                "red" -> Color(0xFFD52B1E)
                "dark" -> Color(0xFF030504)
                else -> Color(0xFF173E31)
            }
            val bars=when(displayMode) {
                "light" -> Color.White
                "red" -> Color(0xFFD52B1E)
                "dark" -> Color(0xFF030504)
                else -> Color(0xFF123525)
            }
            SideEffect {
                window.statusBarColor=header.toArgb()
                window.navigationBarColor=bars.toArgb()
                WindowCompat.getInsetsController(window,window.decorView).apply {
                    isAppearanceLightStatusBars=(displayMode=="light")
                    isAppearanceLightNavigationBars=(displayMode=="light")
                }
                window.decorView.setBackgroundColor(bars.toArgb())
            }
            MaterialTheme(
                colorScheme = scheme,
                shapes = Shapes(
                    small = RoundedCornerShape(12.dp),
                    medium = RoundedCornerShape(18.dp),
                    large = RoundedCornerShape(24.dp)
                )
            ) {
                Box(Modifier.fillMaxSize().background(bars)) {
                    QuartinautApp(repository,mode,displayMode) { next ->
                        mode=next
                        prefs.edit().putString("theme_mode",next).apply()
                    }
                }
            }
        }
    }
}

@Composable
private fun QuartinautApp(repo: QuartinautRepository,
    mode: String, displayMode: String, updateMode: (String) -> Unit) {
    var page by remember { mutableStateOf("home") }
    val history=remember { mutableStateListOf<String>() }
    var mapCanton by remember { mutableStateOf("") }
    var mapMunicipality by remember { mutableStateOf("") }
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
            history.clear()
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
    val navContext=LocalContext.current
    val navTo: (String) -> Unit = { target ->
        if(target!=page) {
            if(target=="home") history.clear() else history.add(page)
            if(history.size>40) history.removeAt(0)
            if(target=="map" && page!="map") { mapCanton="";mapMunicipality="" }
            page=target
        }
        if(target=="plus")repo.loadHub()
        recordRecentlyVisited(navContext,repo.user?.uid.orEmpty(),target)
    }
    val goBack: () -> Unit = {
        when {
            page=="chats" && repo.chatId.isNotBlank() -> repo.closeChat()
            page=="map" && mapMunicipality.isNotBlank() -> mapMunicipality=""
            page=="map" && mapCanton.isNotBlank() -> mapCanton=""
            history.isNotEmpty() -> page=history.removeAt(history.lastIndex)
            page!="home" -> page="home"
        }
    }
    BackHandler(enabled=page!="home" || history.isNotEmpty()) { goBack() }
    val dispatcher=LocalOnBackPressedDispatcherOwner.current?.onBackPressedDispatcher
    val backAction: () -> Unit = { if(dispatcher!=null) dispatcher.onBackPressed() else goBack() }
    val openHub: (Map<String,Any?>) -> Unit = { selectedHubItem=it;navTo("hub-detail") }
    val openRequest: (DocumentSnapshot) -> Unit = { selectedRequest=it;navTo("request-detail") }
    val toolbarBackground=when(displayMode) {
        "light" -> Color.White
        "red" -> Color(0xFFD52B1E)
        "dark" -> Color(0xFF030504)
        else -> Color(0xFF173E31)
    }
    val toolbarForeground=if(displayMode=="light") Forest else Color.White
    val bottomBackground=when(displayMode) {
        "light" -> Color.White
        "red" -> Color(0xFFD52B1E)
        "dark" -> Color(0xFF030504)
        else -> Color(0xFF123525)
    }
    val bottomLabel=if(displayMode=="light") Forest else Color.White
    val bottomActive=when(displayMode) {
        "light" -> Color(0xFFE5F4EB)
        "red" -> Color(0xFFFBE8E6)
        "dark" -> Color(0xFF10231A)
        else -> Color(0xFF27533E)
    }
    val title = when(page) {
        "home" -> "Mein Quartier"
        "personal-center" -> "Mein Quartinaut"
        "community-pulse" -> "Gemeinde aktuell"
        "municipal-compare" -> "Gemeinden vergleichen"
        "calendar-planner" -> "Meine Termine"
        "safety-center" -> "Vertrauen & Sicherheit"
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
        "official-calendar" -> "Offizielle Termine"
        "v50market" -> "Reservierungen"
        "v50loans" -> "Ausleih-Kalender"
        "v50associations" -> "Anmeldungen"
        "search" -> "Suche"
        "settings" -> "Einstellungen"
        "admin" -> "Verwaltung"
        "help" -> "Hilfe & Datenschutz"
        "diagnostics" -> "Verbindungsdiagnose"
        "enhancements" -> "Quartinaut Extras"
        "enh-posts" -> "Meine Beiträge"
        "enh-radar" -> "Quartinaut Radar"
        "enh-assist" -> "Inserat-Assistent"
        "enh-loans" -> "Ausleih-Kalender"
        "enh-map" -> "Schweizkarte+"
        "enh-clubs" -> "Vereinszentrale"
        "enh-trust" -> "Vertrauensprofil"
        "enh-calendar" -> "Gemeindekalender+"
        "enh-qr" -> "QR-Übergabe"
        "enh-offline" -> "Offline-Modus"
        "enh-favorites" -> "Favoriten"
        "hub-detail" -> "Quartier+"
        "request-detail" -> "Anliegen"
        "create-request" -> "Anliegen erstellen"
        "create-offer" -> "Hilfe anbieten"
        else -> if(page.startsWith("hub-section:")) quartierSectionTitle(page.substringAfter(":")) else "Quartinaut"
    }
    Scaffold(
        // Android 15/16 enforce edge-to-edge. The previous build let the
        // custom header draw behind the status bar, as seen in the screenshot.
        // Reserve real system insets for BOTH header and bottom navigation.
        modifier=Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing),
        contentWindowInsets=WindowInsets(0,0,0,0),
        containerColor=MaterialTheme.colorScheme.background,
        topBar={
            Surface(color=toolbarBackground,shadowElevation=2.dp) {
                Row(Modifier.fillMaxWidth().height(64.dp).padding(horizontal=12.dp),
                    verticalAlignment=Alignment.CenterVertically) {
                    if(page!="home") {
                        IconButton(onClick=backAction,modifier=Modifier.size(44.dp)) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription="Einen Schritt zurück",tint=toolbarForeground)
                        }
                        Spacer(Modifier.width(5.dp))
                    }
                    QuartinautLogo(modifier=Modifier.size(44.dp))
                    Spacer(Modifier.width(9.dp))
                    Text(if(page=="home") "Quartinaut" else title,
                        color=toolbarForeground,style=MaterialTheme.typography.titleLarge,
                        maxLines=1,overflow=TextOverflow.Ellipsis,
                        modifier=Modifier.weight(1f))
                    if(page=="home") {
                        val context=LocalContext.current
                        IconButton(onClick={
                            context.startActivity(Intent(Intent.ACTION_VIEW,
                                Uri.parse("https://quartinaut.web.app")))
                        },modifier=Modifier.size(48.dp)) {
                            Icon(Icons.Default.DesktopWindows,
                                contentDescription="Website im Browser öffnen",
                                tint=toolbarForeground)
                        }
                        IconButton(onClick={navTo("official")},modifier=Modifier.size(48.dp)) {
                            Icon(Icons.Default.NotificationsNone,
                                contentDescription="Mitteilungen öffnen",tint=toolbarForeground)
                        }
                    } else {
                        IconButton(onClick={navTo("search")},modifier=Modifier.size(48.dp)) {
                            Icon(Icons.Default.Search,contentDescription="Suche",tint=toolbarForeground)
                        }
                    }
                    IconButton(onClick={navTo("profile")},modifier=Modifier.size(48.dp)) {
                        Icon(Icons.Default.PersonOutline,contentDescription="Profil öffnen",
                            tint=toolbarForeground)
                    }
                }
            }
        },
        bottomBar={
            val routes=listOf(
                Triple("home","Start","start"),
                Triple("plus","Quartier+","quartier"),
                Triple("create","Neu","neu"),
                Triple("chats","Chats","chats"),
                Triple("profile","Profil","profil")
            )
            Box(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.background)
                .padding(horizontal=11.dp,vertical=4.dp)) {
                Row(Modifier.fillMaxWidth().height(78.dp)
                    .clip(RoundedCornerShape(28.dp))
                    .background(bottomBackground)
                    .border(1.dp,if(displayMode=="light") Color(0xFFDAE9DD) else Color(0xFF537564),RoundedCornerShape(28.dp))
                    .padding(horizontal=6.dp,vertical=4.dp),
                    verticalAlignment=Alignment.CenterVertically) {
                    routes.forEach { (route,label,asset) ->
                        val active=page==route || (route=="plus" &&
                            page in listOf("board","market","lend","group","calendar","official-calendar",
                                "enhancements","enh-radar","enh-posts","enh-assist","enh-loans",
                                "enh-clubs","enh-trust","enh-calendar","enh-qr","enh-map",
                                "enh-offline","enh-favorites","community-pulse","municipal-compare") ||
                                (route=="plus" && page.startsWith("hub-section:")))
                        val selectedColor=if(active) bottomActive else Color.Transparent
                        Column(Modifier.weight(1f).fillMaxHeight()
                            .padding(horizontal=2.dp)
                            .clip(RoundedCornerShape(22.dp))
                            .background(selectedColor)
                            .then(if(active) Modifier.border(1.dp,
                                Color(0xFF4CA46A),RoundedCornerShape(22.dp))
                                else Modifier)
                            .clickable { navTo(route) }
                            .semantics { selected=active; contentDescription=label },
                            verticalArrangement=Arrangement.Center,
                            horizontalAlignment=Alignment.CenterHorizontally) {
                            Box(Modifier.size(45.dp).clip(RoundedCornerShape(15.dp))
                                .background(if(displayMode=="dark") Color(0xFF10281B)
                                    else Color(0xFFF5FBF7)),contentAlignment=Alignment.Center) {
                                OriginalNavigationIcon(asset,Modifier.size(if(active)42.dp else 39.dp))
                            }
                            Text(label,color=if(active && displayMode=="red") Forest else bottomLabel,
                                style=MaterialTheme.typography.labelSmall,
                                maxLines=1,overflow=TextOverflow.Ellipsis)
                        }
                    }
                }
            }
        }
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            NativeAppUpdateArea(compact=true)
        val edgePixels=with(LocalDensity.current) { 32.dp.toPx() }
        val swipeDistance=with(LocalDensity.current) { 88.dp.toPx() }
        var fromEdge by remember { mutableStateOf(false) }
        var dragged by remember { mutableFloatStateOf(0f) }
        Box(Modifier.weight(1f).fillMaxWidth().pointerInput(page,mapCanton,mapMunicipality) {
            detectHorizontalDragGestures(
                onDragStart={ start -> fromEdge=start.x<=edgePixels;dragged=0f },
                onDragEnd={ if(fromEdge && dragged>swipeDistance && page!="home") backAction() },
                onHorizontalDrag={ change,amount ->
                    if(fromEdge && amount>0f) dragged+=amount
                    if(fromEdge) change.consume()
                }
            )
        }) {
            when(page) {
                "home" -> NativeOriginalHome(repo, navTo,openRequest,openHub)
                "board" -> BulletinPage(repo, navTo, openRequest)
                "plus" -> HubPage(repo, navTo)
                "chats" -> NativePrivateChatsPage(repo)
                "enhancements" -> NativeExtrasDirectory(repo,navTo)
                "hub-section:entdecken", "hub-section:erstellen", "hub-section:meine",
                "hub-section:gemeinde", "hub-section:sicherheit" ->
                    NativeQuartierCategoryPage(page.substringAfter(":"),navTo)
                "enh-posts" -> NativeMyPostsScreen(repo,navTo)
                "enh-radar" -> NativeRadarScreen(repo,navTo)
                "enh-assist" -> NativeSmartListing(repo,navTo)
                "enh-loans" -> NativeLoanPlanner(repo,navTo)
                "enh-map" -> NativeMapPlus(repo,navTo)
                "enh-clubs" -> NativeClubCenter(repo,navTo)
                "enh-trust" -> NativeTrustScreen(repo,navTo)
                "enh-calendar" -> NativeCalendarPlus(repo,navTo)
                "enh-qr" -> NativeQRHandover(repo)
                "enh-offline" -> NativeOfflineScreen(repo,navTo)
                "enh-favorites" -> NativeFavoriteScreen(repo,navTo)
                "profile" -> ProfilePage(repo, navTo)
                "create" -> NativeNewChooser(navTo)
                "create-request" -> NativeRequestComposer(repo,initialKind="Suche") { navTo("board") }
                "create-offer" -> NativeRequestComposer(repo,initialKind="Biete") { navTo("board") }
                "request-detail" -> selectedRequest?.let { doc ->
                    NativeRequestDetail(repo,doc,goBack,{repo.openRequestChat(doc){navTo("chats")}})
                }
                "hub-detail" -> NativeHubDetail(repo,selectedHubItem,goBack,{navTo("enh-loans")},{navTo("enh-posts")})
                "map" -> RegionPage(repo,mapCanton,mapMunicipality,
                    {mapCanton=it;mapMunicipality=""},{mapMunicipality=it},
                    {navTo("municipal-compare")})
                "alerts" -> DocumentsPage(repo, "Alarme", repo.alerts.filter {
                    it.str("cantonCode") == repo.canton() &&
                        (it.str("scopeLevel") == "canton" ||
                         it.str("areaKey") == repo.areaKey())
                })
                "official" -> DocumentsPage(repo, "Offizielle Mitteilungen", repo.notices)
                "market" -> HubItemsPage(repo, "market", navTo, openHub)
                "lend" -> HubItemsPage(repo, "lend", navTo, openHub)
                "group" -> HubItemsPage(repo, "group", navTo, openHub)
                "calendar" -> NativeMunicipalCalendarPage(repo,openHub,{navTo("official-calendar")})
                "official-calendar" -> NativeOfficialCalendarScreen(repo,navTo)
                "lost" -> HubItemsPage(repo, "lost", navTo, openHub)
                "project" -> HubItemsPage(repo, "project", navTo, openHub)
                "issue" -> HubItemsPage(repo, "issue", navTo, openHub)
                "v50market", "v50loans", "v50associations" -> V50Page(repo, page, navTo)
                "search" -> NativeUnifiedSearch(repo,navTo,openRequest,openHub) {code,bfs ->
                    navTo("map");mapCanton=code;mapMunicipality=bfs
                }
                "personal-center" -> NativePersonalCenter(repo,navTo)
                "community-pulse" -> NativeCommunityPulse(repo,navTo,openRequest)
                "municipal-compare" -> NativeMunicipalityComparison(repo,navTo)
                "calendar-planner" -> NativeCalendarPlanner(repo,navTo)
                "safety-center" -> NativeSafetyCenter(repo,navTo)
                "settings" -> NativeSettingsScreen(repo,mode,updateMode,navTo)
                "admin" -> NativeAdminScreen(repo,navTo)
                "help" -> NativeHelpScreen()
                "diagnostics" -> NativeSyncDiagnostics(repo)
                else -> {
                    if(page.startsWith("hub-create:")) {
                        NativeCreateHubPage(repo,page.substringAfter(":")) { navTo("plus") }
                    } else NativeOriginalHome(repo,navTo,openRequest,openHub)
                }
            }
            if (repo.busy) LinearProgressIndicator(Modifier.fillMaxWidth().align(Alignment.TopCenter))
        }
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
    Column(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).verticalScroll(rememberScrollState())
        .padding(horizontal = 24.dp, vertical = 32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Spacer(Modifier.height(26.dp))
        QuartinautLogo(modifier = Modifier.size(118.dp))
        Spacer(Modifier.height(14.dp))
        Text("Quartinaut", style = MaterialTheme.typography.headlineLarge, color = Forest,
            fontWeight = FontWeight.Bold)
        Text("Deine Nachbarschaft. Dein Quartier.")
        Spacer(Modifier.height(26.dp))
        Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(22.dp), color = MaterialTheme.colorScheme.surface, shadowElevation = 4.dp) {
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
        if (subtitle.isNotBlank()) Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
    }
}
@Composable
private fun Panel(title: String, body: String, foot: String = "", onClick: (() -> Unit)? = null) {
    Card(modifier = Modifier.fillMaxWidth().then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(1.dp)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(title, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.titleMedium)
            if (body.isNotBlank()) Text(body, style = MaterialTheme.typography.bodyMedium)
            if (foot.isNotBlank()) Text(foot, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
@Composable
private fun Feature(label: String, explanation: String, icon: @Composable () -> Unit, action: () -> Unit) {
    Surface(
        onClick = action,
        modifier = Modifier.fillMaxWidth().heightIn(min = 78.dp),
        shape = RoundedCornerShape(19.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)
    ) {
        Row(Modifier.padding(horizontal = 13.dp, vertical = 11.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(46.dp)
                .background(MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(13.dp)),
                contentAlignment = Alignment.Center) { icon() }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f), verticalArrangement=Arrangement.spacedBy(3.dp)) {
                Text(label, fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    style = MaterialTheme.typography.titleMedium)
                Text(explanation, style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            Spacer(Modifier.width(6.dp))
            Icon(Icons.Default.ChevronRight, contentDescription = "Öffnen",
                tint = MaterialTheme.colorScheme.primary)
        }
    }
}
@Composable
private fun DashboardPage(repo: QuartinautRepository, go: (String) -> Unit) = ScrollPage {
    SectionTitle("Hoi, " + repo.displayName().substringBefore(" ") + "!",
        repo.area().ifBlank { "Deine Schweizer Nachbarschaft" })
    NativeDashboardHero(repo)
    Feature("Schwarzes Brett", "Hilfe suchen oder anbieten", { Icon(Icons.Default.ViewList, null,tint=Forest) }) { go("board") }
    Feature("Quartier+", "Marktplatz, Ausleihe, Vereine", { Icon(Icons.Default.GridView,null,tint=Forest) }) { go("plus") }
    Feature("Schweizkarte", "26 Kantone und alle Gemeinden", { Icon(Icons.Default.Map,null,tint=Forest) }) { go("map") }
    Feature("Dashboard-Hintergrund", "Persönliches Foto auswählen und privat speichern",
        { Icon(Icons.Default.Wallpaper,null,tint=Forest) }) { go("settings") }
    Feature("Gemeinde-Informationen", "Offizielle Hinweise und Alarme",
        { Icon(Icons.Default.Campaign,null,tint=Forest) }) { go("official") }
    SectionTitle("Schweizkarte","Registrierungen nach Kanton")
    NativeCantonMap(selected=repo.canton(),counts=repo.cantonCounts) { go("map") }
    OutlinedButton(onClick={go("map")},modifier=Modifier.fillMaxWidth()) {
        Text("26 Kantone und 2'110 Gemeinden entdecken")
    }
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
private fun CreateRequestPage(repo: QuartinautRepository, go: (String) -> Unit,
    initialKind:String = "Suche") = ScrollPage {
    var title by remember { mutableStateOf("") }
    var body by remember { mutableStateOf("") }
    var category by remember { mutableStateOf(Categories.first()) }
    var kind by remember(initialKind) { mutableStateOf(initialKind) }
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
    Button(onClick={repo.createRequest(title,body,category,kind,urgency, onCreated={ go("board") })},
        modifier=Modifier.fillMaxWidth(),enabled=!repo.busy) { Text("Anliegen einreichen") }
}

@Composable
private fun HubPage(repo: QuartinautRepository, go:(String)->Unit) {
    NativeQuartierOverview(repo,go)
}
@Composable
private fun HubItemsPage(repo:QuartinautRepository,kind:String,go:(String)->Unit,
    openItem:(Map<String,Any?>)->Unit) {
    val labels = mapOf("market" to "Marktplatz","lend" to "Leihbörse",
        "group" to "Vereine & Gruppen","calendar" to "Gemeindekalender",
        "lost" to "Verloren & Gefunden","project" to "Quartieraktionen","issue" to "Mängel melden")
    var query by remember(kind) { mutableStateOf("") }
    val rows=repo.hubItems.filter {
        DocString(it["kind"]) == kind &&
            (DocString(it["status"]) == "published" || it["isMine"] == true || it["isModerator"] == true) &&
            (DocString(it["title"]) + DocString(it["description"])).contains(query,ignoreCase=true)
    }
    Column(Modifier.padding(16.dp), verticalArrangement=Arrangement.spacedBy(10.dp)) {
        SectionTitle(labels[kind] ?: "Quartier+", "Veröffentlichte Einträge aus dem Quartinaut-Backend")
        OutlinedTextField(query,{query=it},label={Text("Suchen")},singleLine=true,modifier=Modifier.fillMaxWidth())
        if(kind=="calendar") OutlinedButton(onClick={go("official-calendar")},
            modifier=Modifier.fillMaxWidth()) {Text("🇨🇭 Offizielle Schweizer Termine & Feiertage")}
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
private fun ProfilePage(repo: QuartinautRepository, go:(String)->Unit) = ScrollPage {
    SectionTitle(repo.displayName(), "Dein Quartinaut-Konto")
    Panel("Meine Gemeinde",repo.area(), "Kanton " + repo.canton())
    Panel("Konto",repo.user?.email.orEmpty(),"Status: " + DocString(repo.profile["accountStatus"]))
    Panel("Verifizierung", if (repo.profile["verified"] == true) "Verifiziert" else "Noch nicht verifiziert",
        "Rolle: " + DocString(repo.profile["role"]))
    Feature("Alle Erweiterungen","Radar, Kalender, Vereinszentrale, QR und Offline",
        {Icon(Icons.Default.Widgets,null,tint=Forest)}) {go("enhancements")}
    Feature("Meine Beiträge","Bearbeiten, pausieren, archivieren",
        {Icon(Icons.Default.EditNote,null,tint=Forest)}) {go("enh-posts")}
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
private fun RegionPage(repo: QuartinautRepository, selectedCode: String,selectedBfs: String,
    selectCanton: (String)->Unit, selectMunicipality: (String)->Unit,
    navigateComparison: ()->Unit) {
    var search by remember(selectedCode) { mutableStateOf("") }
    val screenContext=LocalContext.current
    val canton=repo.regions.firstOrNull { it.code==selectedCode }
    val selected=canton?.municipalities?.firstOrNull { it.bfs==selectedBfs }
    val cantonCoatByCode by produceState<Map<String,String>>(initialValue=emptyMap(),repo.regions) {
        value=kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            querySwissCantonWappen(repo.regions)
        }
    }
    val coatByBfs by produceState<Map<String,String>>(initialValue=emptyMap(),canton?.code) {
        value=if(canton==null) emptyMap() else
            kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                queryCantonWappen(canton,screenContext)
            }
    }
    val ownCanton=repo.regions.firstOrNull {it.code==repo.canton()}
    val ownMunicipality=ownCanton?.municipalities?.firstOrNull {
        it.name.equals(repo.area().substringBefore("(").trim(),ignoreCase=true)
    }
    val filteredCantons=repo.regions.filter { region ->
        (region.name+" "+region.code).contains(search,ignoreCase=true)
            || region.municipalities.any { it.name.contains(search,ignoreCase=true) }
    }
    val filteredMunicipalities=canton?.municipalities?.filter {
        it.name.contains(search,ignoreCase=true)
    } ?: emptyList()
    LazyColumn(Modifier.fillMaxSize(), contentPadding=PaddingValues(16.dp),
        verticalArrangement=Arrangement.spacedBy(10.dp)) {
        item {
            Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically,
                horizontalArrangement=Arrangement.spacedBy(10.dp)) {
                Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(2.dp)) {
                    SectionTitle(if(canton==null) "Schweiz entdecken" else canton.name,
                        if(canton==null) "26 Kantone · 2'110 Gemeinden"
                        else canton.code+" · "+canton.municipalities.size+" Gemeinden")
                }
                if(canton!=null) MunicipalityCoat(cantonCoatByCode[canton.code],
                    canton.name,Modifier.size(width=34.dp,height=43.dp),
                    cantonCode=canton.code)
            }
        }
        item {
            Column(verticalArrangement=Arrangement.spacedBy(7.dp)) {
                Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick={
                        if(ownCanton!=null && ownMunicipality!=null) {
                            selectCanton(ownCanton.code)
                            selectMunicipality(ownMunicipality.bfs)
                        }
                    },enabled=ownCanton!=null&&ownMunicipality!=null,
                        modifier=Modifier.weight(1f)) {Text("Meine Gemeinde",maxLines=1)}
                    OutlinedButton(onClick={selectCanton("")},
                        modifier=Modifier.weight(1f)) {Text("Schweiz")}
                }
                Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically,
                    horizontalArrangement=Arrangement.spacedBy(7.dp)) {
                    OutlinedButton(onClick=navigateComparison,modifier=Modifier.weight(1f)) {
                        Text("Gemeinden vergleichen",maxLines=1)
                    }
                    if(canton!=null) TextButton(onClick={selectCanton("")}) {
                        Text("← Alle Kantone",maxLines=1)
                    }
                }
            }
        }
        if(canton!=null) {
            if(selected!=null) {
                item { NativeMunicipalityFactCard(selected,canton,coatByBfs[selected.bfs]) }
            }
            item {
                NativeMunicipalityMap(canton,selected) { selectMunicipality(it.bfs) }
            }
            item {
                Panel("Kanton ${canton.code}",
                    "Hauptort: ${SwissCapitals[canton.code] ?: "Nicht hinterlegt"}",
                    "${canton.municipalities.size} Gemeinden · BFS-Kantonnummer ${canton.bfs}")
            }
            if(selected!=null) {
                item {
                    val context=LocalContext.current
                    TextButton(onClick={
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(
                            "https://www.agvchapp.bfs.admin.ch/de/communes/query")))
                    }) { Text("Amtliches BFS-Gemeindeverzeichnis öffnen") }
                }
            }
        } else {
            item {
                NativeCantonMap(selectedCode,repo.cantonCounts) { selectCanton(it) }
            }
        }
        item {
            OutlinedTextField(search,{search=it},modifier=Modifier.fillMaxWidth(),
                singleLine=true,label={Text(if(canton==null)"Kanton oder Gemeinde suchen"
                    else "Gemeinde suchen")})
        }
        if(canton==null) {
            items(filteredCantons,key={it.code}) { region ->
                Surface(onClick={selectCanton(region.code)},
                    shape=RoundedCornerShape(14.dp),
                    color=MaterialTheme.colorScheme.surface) {
                    Row(Modifier.fillMaxWidth().padding(10.dp),
                        verticalAlignment=Alignment.CenterVertically,
                        horizontalArrangement=Arrangement.spacedBy(12.dp)) {
                        MunicipalityCoat(cantonCoatByCode[region.code],
                            region.name,Modifier.size(width=34.dp,height=45.dp),
                            cantonCode=region.code)
                        Column(Modifier.weight(1f)) {
                            Text(region.name,fontWeight=FontWeight.SemiBold)
                            Text("${region.code} · ${region.municipalities.size} Gemeinden",
                                style=MaterialTheme.typography.labelSmall)
                        }
                        Icon(Icons.Default.ChevronRight,contentDescription="Kanton öffnen")
                    }
                }
            }
        } else {
            items(filteredMunicipalities,key={it.bfs}) { municipality ->
                Surface(onClick={selectMunicipality(municipality.bfs)},
                    modifier=Modifier.fillMaxWidth(),
                    shape=RoundedCornerShape(14.dp),
                    color=MaterialTheme.colorScheme.surface) {
                    Row(Modifier.fillMaxWidth().padding(11.dp),
                        verticalAlignment=Alignment.CenterVertically,
                        horizontalArrangement=Arrangement.spacedBy(13.dp)) {
                        MunicipalityCoat(coatByBfs[municipality.bfs] ?:
                            verifiedWappenFallback(municipality.bfs),
                            municipality.name,Modifier.size(width=38.dp,height=48.dp),
                            bfs=municipality.bfs)
                        Column(Modifier.weight(1f)) {
                            Text(municipality.name,fontWeight=FontWeight.SemiBold)
                            Text("Kanton ${canton.code} · Wappen/Steckbrief",
                                style=MaterialTheme.typography.labelSmall)
                        }
                        Icon(Icons.Default.ChevronRight,contentDescription="Steckbrief öffnen")
                    }
                }
            }
        }
    }
}
@Composable
private fun V50Page(repo: QuartinautRepository, page:String,go:(String)->Unit) {
    val action = when(page) { "v50market" -> "market.list";"v50loans" -> "loan.list"; else -> "association.list" }
    LaunchedEffect(page) { repo.loadV50(action) }
    Column(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
        SectionTitle(when(page){"v50market"->"Marktplatz-Reservierungen";"v50loans"->"Ausleih-Kalender";else->"Vereinsanmeldungen"})
        OutlinedButton(onClick={repo.loadV50(action)},modifier=Modifier.fillMaxWidth()) { Text("Aktualisieren") }
        if(page=="v50loans") {
            Text("Hier findest du Buchungsanfragen und bestätigte Ausleihen. " +
                "Ein selbst veröffentlichtes Leihangebot erzeugt noch keine Buchung.",
                style=MaterialTheme.typography.bodySmall,
                color=MaterialTheme.colorScheme.onSurfaceVariant)
            OutlinedButton(onClick={go("lend")},modifier=Modifier.fillMaxWidth()) {
                Text("Leihangebote entdecken und Ausleihe anfragen")
            }
        }
        if(repo.v50Loading) LinearProgressIndicator(Modifier.fillMaxWidth())
        if(repo.v50Error.isNotBlank()) {
            Text("Buchungsdienst nicht erreichbar: "+repo.v50Error,
                style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.error)
        }
        LazyColumn(verticalArrangement=Arrangement.spacedBy(10.dp)) {
            items(repo.v50Items) { entry ->
                val title=DocString(entry["title"]).ifBlank {
                    DocString(entry["listingId"]).ifBlank {DocString(entry["eventId"])}
                }
                Card(colors=CardDefaults.cardColors(containerColor=MaterialTheme.colorScheme.surface)) {
                    Column(Modifier.fillMaxWidth().padding(14.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                        Text(title,fontWeight=FontWeight.Bold)
                        val readableStatus=when(DocString(entry["status"])) {
                            "requested" -> "Angefragt"
                            "accepted" -> "Angenommen"
                            "returned" -> "Zurückgegeben"
                            "declined" -> "Abgelehnt"
                            "cancelled" -> "Storniert"
                            "waitlisted" -> "Warteliste"
                            "confirmed" -> "Bestätigt"
                            else -> DocString(entry["status"]).ifBlank{"Unbekannt"}
                        }
                        Text("Status: "+readableStatus)
                        if(page=="v50loans") {
                            Text("Zeitraum: "+loanTimeZurich(DocString(entry["from"]))+
                                " – "+loanTimeZurich(DocString(entry["to"])),
                                style=MaterialTheme.typography.bodySmall)
                        }
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
                        if(page=="v50loans") {
                            val owner=DocString(entry["ownerUid"])==uid
                            val borrower=DocString(entry["borrowerUid"])==uid
                            if(owner&&status=="requested") {
                                Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                                    OutlinedButton(onClick={repo.v50Action("loan.decline",mapOf("id" to id))},
                                        enabled=!repo.busy) {Text("Ablehnen")}
                                    Button(onClick={repo.v50Action("loan.accept",mapOf("id" to id))},
                                        enabled=!repo.busy) {Text("Ausleihe bestätigen")}
                                }
                            }
                            if(borrower&&status=="requested") {
                                OutlinedButton(onClick={repo.v50Action("loan.cancel",mapOf("id" to id))},
                                    enabled=!repo.busy) {Text("Anfrage stornieren")}
                            }
                            if(owner&&status=="accepted") {
                                Button(onClick={repo.v50Action("loan.return",mapOf("id" to id))},
                                    enabled=!repo.busy) {Text("Rückgabe bestätigen")}
                            }
                            if(status=="accepted"&&(owner||borrower)) {
                                OutlinedButton(onClick={go("enh-qr")}) {Text("QR-Übergabe öffnen")}
                            }
                        }
                        if(page=="v50associations" && status=="waitlisted" && DocString(entry["organizerUid"])==uid) {
                            TextButton(onClick={repo.v50Action("association.manage",mapOf("id" to id,"decision" to "confirm"))}) { Text("Von Warteliste bestätigen") }
                        }
                    }
                }
            }
            if(repo.v50Items.isEmpty() && !repo.v50Loading) item {
                Text(when {
                    repo.v50Error.isNotBlank() -> "Die Buchungen konnten nicht geladen werden."
                    page=="v50loans" -> "Noch keine Ausleihanfragen. Öffne einen fremden Leihartikel und sende eine Anfrage."
                    else -> "Noch keine Einträge vorhanden."
                })
            }
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