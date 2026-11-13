package ch.quartinaut.nativeapp

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat

private val HomeLabels = linkedMapOf(
    "home" to "Übersicht", "hub" to "Quartier+",
    "bulletin" to "Schwarzes Brett", "events" to "Gemeindetermine",
    "inbox" to "Mitteilungen", "chats" to "Chats"
)
private val Topics = linkedMapOf(
    "chats" to "Private Chats","alerts" to "Gemeinde-Alarme",
    "help" to "Nachbarschaftshilfe","events" to "Veranstaltungen",
    "groups" to "Vereine & Gruppen","market" to "Marktplatz",
    "lending" to "Ausleihen","municipality" to "Gemeindenachrichten"
)

@Composable
fun NativeSettingsScreen(repo: QuartinautRepository,dark: Boolean,
                         updateDark: (Boolean) -> Unit, navigate: (String) -> Unit) {
    val context=LocalContext.current
    val notificationPermission=rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if(granted)repo.enablePush()
        else repo.showMessage("Ohne Benachrichtigungsfreigabe kann Android keine Pushmeldungen anzeigen.")
    }
    LaunchedEffect(repo.user?.uid) { repo.loadCommunitySettings() }
    val saved=repo.communitySettings
    var home by remember { mutableStateOf("home") }
    var digest by remember { mutableStateOf("off") }
    var quiet by remember { mutableStateOf(false) }
    val topics=remember { mutableStateListOf("chats","alerts","help") }
    LaunchedEffect(saved) {
        home=DocString(saved["homeView"]).ifBlank{"home"}
        digest=DocString(saved["digest"]).ifBlank{"off"}
        quiet=saved["quietHours"] == true
        val savedTopics=(saved["topics"] as? List<*>)?.filterIsInstance<String>()
        if(savedTopics!=null) {topics.clear();topics.addAll(savedTopics)}
    }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement=Arrangement.spacedBy(13.dp)) {
        Text("Einstellungen",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)
        Text("Darstellung",style=MaterialTheme.typography.titleMedium)
        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,
            verticalAlignment=Alignment.CenterVertically) {
            Column {
                Text("Dunkles Design",fontWeight=FontWeight.Medium)
                Text("Auch für den ganzen Android-Bildschirm",style=MaterialTheme.typography.bodySmall)
            }
            Switch(dark,onCheckedChange=updateDark)
        }
        HorizontalDivider()
        NativeDashboardBackgroundSettings(repo)
        HorizontalDivider()
        Text("Meine Startseite",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold)
        HomeLabels.forEach { (key,label) ->
            Row(Modifier.fillMaxWidth().clickable {home=key},verticalAlignment=Alignment.CenterVertically) {
                RadioButton(selected=home==key,onClick={home=key})
                Text(label)
            }
        }
        HorizontalDivider()
        Text("Benachrichtigungsthemen",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold)
        Topics.forEach { (key,label) ->
            Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {
                Checkbox(checked=key in topics,onCheckedChange={checked->
                    if(checked) { if(key !in topics)topics.add(key) }
                    else topics.remove(key)
                })
                Text(label)
            }
        }
        Text("Zusammenfassung",fontWeight=FontWeight.SemiBold)
        listOf("off" to "Keine","daily" to "Täglich","weekly" to "Wöchentlich").forEach { (key,label) ->
            Row(verticalAlignment=Alignment.CenterVertically) {
                RadioButton(selected=digest==key,onClick={digest=key})
                Text(label)
            }
        }
        Row(verticalAlignment=Alignment.CenterVertically) {
            Switch(checked=quiet,onCheckedChange={quiet=it})
            Spacer(Modifier.width(12.dp))
            Text("Ruhezeiten berücksichtigen")
        }
        Button(onClick={
            repo.saveCommunitySettings(mapOf(
                "homeView" to home,"topics" to topics.toList(),
                "digest" to digest,"quietHours" to quiet))
        },enabled=!repo.busy,modifier=Modifier.fillMaxWidth()) {Text("Einstellungen speichern")}
        OutlinedButton(onClick={
            if(Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(
                    context,Manifest.permission.POST_NOTIFICATIONS
                )==PackageManager.PERMISSION_GRANTED
            ) repo.enablePush()
            else notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        },enabled=!repo.busy,modifier=Modifier.fillMaxWidth()) {
            Text("Pushmeldungen auf diesem Gerät aktivieren")
        }
        Text("Die Freigabe gilt nur für dieses Gerät und kann in Android jederzeit widerrufen werden.",
            style=MaterialTheme.typography.bodySmall)
        TextButton(onClick={navigate("diagnostics")}) {
            Text("Verbindungsdiagnose · Firebase-Zugriff prüfen")
        }
        TextButton(onClick={navigate("help")}) { Text("Hilfe und Datenschutz") }
    }
}
@Composable
fun NativeAdminScreen(repo: QuartinautRepository, navigate: (String) -> Unit) {
    val queue=repo.hubItems.filter { DocString(it["status"])=="pending" }
    Column(Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement=Arrangement.spacedBy(10.dp)) {
        Text("Verwaltung",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)
        Text("Sensible Aktionen werden serverseitig auf deine Administrationsrechte geprüft.")
        Row(horizontalArrangement=Arrangement.spacedBy(9.dp)) {
            AssistChip(onClick=repo::loadHub,label={Text("Quartier+-Warteschlange")})
            AssistChip(onClick={navigate("official")},label={Text("Mitteilungen")})
        }
        Text("Zur Prüfung ("+queue.size+")",fontWeight=FontWeight.SemiBold)
        LazyColumn(verticalArrangement=Arrangement.spacedBy(9.dp)) {
            items(queue) { item ->
                Card(colors=CardDefaults.cardColors(containerColor=MaterialTheme.colorScheme.surface)) {
                    Column(Modifier.fillMaxWidth().padding(14.dp),
                        verticalArrangement=Arrangement.spacedBy(8.dp)) {
                        Text(DocString(item["title"]),fontWeight=FontWeight.Bold)
                        Text(DocString(item["description"]))
                        val id=DocString(item["id"])
                        Row {
                            OutlinedButton(onClick={repo.communityAction("approve",mapOf("id" to id))},
                                enabled=!repo.busy) {Text("Freigeben")}
                            Spacer(Modifier.width(8.dp))
                            TextButton(onClick={repo.communityAction("reject",mapOf("id" to id))},
                                enabled=!repo.busy) {Text("Ablehnen")}
                        }
                    }
                }
            }
            if(queue.isEmpty()) item {
                Text("Keine ausstehenden Quartier+-Einträge in dieser Ansicht.")
            }
        }
    }
}
@Composable
fun NativeHelpScreen() {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement=Arrangement.spacedBy(14.dp)) {
        Text("Hilfe & Informationen",style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)
        Text("Quartinaut verbindet Bewohnerinnen, Bewohner, Vereine und Gemeinden.")
        Text("Nachbarschaftshilfe",fontWeight=FontWeight.Bold)
        Text("Auf dem Schwarzen Brett kannst du Hilfe suchen oder anbieten. Kontakte laufen in privaten Chats.")
        Text("Quartier+",fontWeight=FontWeight.Bold)
        Text("Dinge leihen oder verkaufen, Gruppen beitreten und lokale Aktionen entdecken.")
        Text("Privatsphäre",fontWeight=FontWeight.Bold)
        Text("Fotos und Nachrichten sind durch Firebase-Sicherheitsregeln und geschützte Serverfunktionen begrenzt. Die App zeigt nur Daten, die dein Konto lesen darf.")
        Text("Offizielle Regeln",fontWeight=FontWeight.Bold)
        Text("Nutzungsbedingungen, Datenschutz und Impressum werden im Webprojekt geführt. Vollständige native Rechtstextanzeigen müssen vor einer öffentlichen App-Store-Veröffentlichung ergänzt werden.")
        Text("Quartinaut Native Android · Entwicklung aus dem Webstand 5.4",
            style=MaterialTheme.typography.bodySmall)
    }
}
