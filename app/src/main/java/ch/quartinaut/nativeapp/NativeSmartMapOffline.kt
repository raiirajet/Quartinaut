package ch.quartinaut.nativeapp

import android.content.ClipboardManager
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.net.Uri
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

private val NBackground=Color(0xFF111F19)
private val NSurface=Color(0xFF213A2D)
private val NAccent=Color(0xFFA3E3B5)
private val NSub=Color(0xFFCADECF)
private val NLine=Color(0xFF456853)

private val localRules=listOf(
    "Velos & Verkehr" to listOf("velo","fahrrad","e-bike","reifen","bike"),
    "Werkzeug" to listOf("bohrmaschine","akkuschrauber","säge","leiter","werkzeug","hammer"),
    "Garten" to listOf("rasenmäher","pflanzen","heckenschere","blumen","garten"),
    "Kinder" to listOf("kinderwagen","baby","kindersitz","spielzeug","kinder"),
    "Haushalt" to listOf("staubsauger","geschirr","tisch","stuhl","schrank","sofa"),
    "Freizeit" to listOf("ski","skier","wandern","camping","zelt","sport")
)
private fun suggestGroup(input:String):String {
    val normalized=input.trim().lowercase()
    return localRules.firstOrNull{rule->rule.second.any{normalized.contains(it)}}?.first
        ?: "Sonstiges"
}

@Composable
fun NativeSmartListing(repo:QuartinautRepository,navigate:(String)->Unit) {
    val context=LocalContext.current
    var input by remember{mutableStateOf("")}
    var kind by remember{mutableStateOf("market")}
    val suggested=remember(input){suggestGroup(input)}
    val hints=remember(input,kind){
        if(input.trim().length<4)emptyList() else listOf(
            "Titel: "+input.trim().replaceFirstChar{it.titlecase()},
            "Kategorie: "+suggested,
            if(kind=="market")"Beschreibe Zustand, Preis und Abholung."
            else "Beschreibe Nutzungsdauer, Zustand und Rückgabe.",
            "Sicher: Keine privaten Telefonnummern oder Wohnungsnummern veröffentlichen."
        )
    }
    Column(Modifier.fillMaxSize().background(NBackground)
        .verticalScroll(rememberScrollState()).padding(17.dp),
        verticalArrangement=Arrangement.spacedBy(12.dp)) {
        Text("Inserat-Assistent",style=MaterialTheme.typography.headlineSmall,
            color=Color.White,fontWeight=FontWeight.Bold)
        Text("Schnelle Vorschläge für Titel und Kategorie – lokal auf dem Handy. Es werden dafür keine Inhalte an einen KI-Dienst geschickt.",
            color=NSub,style=MaterialTheme.typography.bodySmall)
        Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
            FilterChip(kind=="market",{kind="market"},label={Text("Verkaufen")})
            FilterChip(kind=="lend",{kind="lend"},label={Text("Ausleihen")})
        }
        OutlinedTextField(input,{input=it.take(140)},modifier=Modifier.fillMaxWidth(),
            label={Text("Was möchtest du anbieten?")},
            placeholder={Text("z. B. Akkuschrauber Bosch")},
            minLines=2)
        Surface(color=NSurface,shape=RoundedCornerShape(18.dp),
            border=BorderStroke(1.dp,NLine)) {
            Column(Modifier.padding(15.dp),verticalArrangement=Arrangement.spacedBy(9.dp)) {
                Text("Empfohlene Angaben",color=Color.White,
                    style=MaterialTheme.typography.titleMedium)
                hints.forEach { Text("• "+it,color=NSub) }
                if(hints.isEmpty()) Text("Beschreibe deinen Artikel, dann erscheinen Vorschläge.",
                    color=NSub)
            }
        }
        Button(onClick={
            val clip=context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            clip.setPrimaryClip(ClipData.newPlainText("Quartinaut Titel",input.trim()))
            navigate("hub-create:"+kind)
        },enabled=input.trim().length>=5,
            modifier=Modifier.fillMaxWidth().height(48.dp)) {
            Text("Neues Inserat mit diesem Titel erstellen")
        }
        Text("Hinweis: Die vorgeschlagene Kategorie wird nicht automatisch als amtliche Einordnung übernommen. Du kannst sie im nächsten Formular prüfen und ändern.",
            color=NSub,style=MaterialTheme.typography.bodySmall)
    }
}

@Composable
fun NativeOfflineScreen(repo:QuartinautRepository,navigate:(String)->Unit) {
    val canton=repo.regions.firstOrNull{it.code==repo.canton()}
    var query by remember{mutableStateOf("")}
    val matches=canton?.municipalities?.filter{it.name.contains(query,ignoreCase=true)}
        ?.take(80) ?: emptyList()
    Column(Modifier.fillMaxSize().background(NBackground).padding(16.dp),
        verticalArrangement=Arrangement.spacedBy(11.dp)) {
        Text("Offline-Modus",color=Color.White,
            style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)
        Text("Das amtliche Verzeichnis mit 26 Kantonen und 2'110 Gemeinden ist fest in der APK gespeichert. Öffentliche Beiträge werden nach erfolgreichem Laden für 72 Stunden zwischengespeichert.",
            color=NSub,style=MaterialTheme.typography.bodySmall)
        Text("Letzte Aktualisierung: "+
            repo.offlineCacheDate.replace('T',' ').take(16).ifBlank{"Noch keine"},
            color=NAccent,style=MaterialTheme.typography.bodySmall)
        Text("Private Chats und Benutzerfotos werden nicht in einem unverschlüsselten Offline-Archiv abgelegt.",
            color=NSub,style=MaterialTheme.typography.labelSmall)
        OutlinedTextField(query,{query=it},modifier=Modifier.fillMaxWidth(),
            label={Text("Gemeinde suchen")},
            leadingIcon={Icon(Icons.Default.Search,null)},
            singleLine=true)
        Text("Gemeinden in "+repo.canton(),color=NAccent)
        LazyColumn(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(8.dp)) {
            items(matches){m->
                Surface(color=NSurface,shape=RoundedCornerShape(13.dp),
                    modifier=Modifier.fillMaxWidth()) {
                    Row(Modifier.padding(12.dp)) {
                        Text(m.name,modifier=Modifier.weight(1f),color=Color.White)
                        Text("BFS "+m.bfs,color=NSub)
                    }
                }
            }
            item {
                Text("Gespeicherte öffentliche Quartier+-Beiträge ("+
                    repo.offlineHubItems.size+")",
                    color=NAccent,style=MaterialTheme.typography.titleMedium)
            }
            items(repo.offlineHubItems.filter{row->
                DocString(row["title"]).contains(query,ignoreCase=true) || query.isBlank()
            }.take(50)){row->
                Surface(color=NSurface,shape=RoundedCornerShape(14.dp),
                    modifier=Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(12.dp)) {
                        Text(DocString(row["title"]),color=Color.White,
                            fontWeight=FontWeight.SemiBold)
                        Text(DocString(row["description"]),color=NSub)
                        Text(DocString(row["area"])+" · Gespeicherter Stand",
                            color=NAccent,style=MaterialTheme.typography.labelSmall)
                    }
                }
            }
        }
        OutlinedButton(onClick={navigate("map")},modifier=Modifier.fillMaxWidth()) {
            Text("Zur Schweizkarte")
        }
    }
}
@Composable
fun NativeMapPlus(repo:QuartinautRepository,navigate:(String)->Unit) {
    val context=LocalContext.current
    Column(Modifier.fillMaxSize().background(NBackground)
        .verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement=Arrangement.spacedBy(13.dp)) {
        Text("Schweizkarte+",color=Color.White,
            style=MaterialTheme.typography.headlineSmall,fontWeight=FontWeight.Bold)
        Text("Kantone, Gemeinden und Steckbriefe aus dem amtlichen Schweizer Gemeindeverzeichnis.",
            color=NSub)
        Surface(color=NSurface,shape=RoundedCornerShape(18.dp),
            border=BorderStroke(1.dp,NLine)) {
            Column(Modifier.padding(13.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                Text("Schweiz",style=MaterialTheme.typography.titleMedium,color=Color.White)
                NativeCantonMap(selected=repo.canton(),counts=repo.cantonCounts){
                    navigate("map")
                }
                Text("26 Kantone · 2'110 Gemeinden (BFS 01.01.2026)",
                    color=NAccent,style=MaterialTheme.typography.bodySmall)
            }
        }
        Button(onClick={navigate("map")},modifier=Modifier.fillMaxWidth()) {
            Text("Interaktive Gemeinde-Steckbriefe öffnen")
        }
        Text("Gemeindegrenzen",color=Color.White,
            fontWeight=FontWeight.SemiBold)
        Text("Das aktuelle Gemeindeverzeichnis stammt von 2026. Die detaillierte Geometrie der bisherigen Kartenimplementierung stammt dagegen noch aus 2025. Eine automatische Ersetzung ohne geprüfte BFS-Zuordnung würde Gemeinden falsch darstellen.",
            color=NSub,style=MaterialTheme.typography.bodySmall)
        OutlinedButton(onClick={
            val intent=Intent(Intent.ACTION_VIEW,Uri.parse(
                "https://www.swisstopo.admin.ch/de/landschaftsmodell-swissboundaries3d"))
            runCatching{context.startActivity(intent)}
        }) {
            Icon(Icons.Default.OpenInNew,null)
            Spacer(Modifier.width(8.dp))
            Text("Offizielle 2026er Grenzdaten (swisstopo)")
        }
        OutlinedButton(onClick={
            val intent=Intent(Intent.ACTION_VIEW,Uri.parse(
                "https://www.agvchapp.bfs.admin.ch/de"))
            runCatching{context.startActivity(intent)}
        }) {
            Text("Amtliches BFS-Gemeindeverzeichnis")
        }
        Text("Gemeindewappen werden erst angezeigt, wenn ihre Quelle und Nutzungsrechte verifiziert sind. Es werden keine erfundenen Wappen verwendet.",
            color=NSub,style=MaterialTheme.typography.labelSmall)
    }
}
