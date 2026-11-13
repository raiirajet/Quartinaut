package ch.quartinaut.nativeapp

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlin.math.min

private val Night = Color(0xFF101F19)
private val NightCard = Color(0xFF1C342A)
private val PanelLine = Color(0xFF456C58)
private val Quiet = Color(0xFFB5C6B8)
private val Lime = Color(0xFFB4E3BF)

data class HomeLink(val id: String, val title: String, val subtitle: String,
                    val emoji: String, val route: String)
private val links = listOf(
    HomeLink("need","Hilfe suchen","Unterstützung finden","✋","create-request"),
    HomeLink("offer","Hilfe anbieten","Nachbarn unterstützen","♡","create-offer"),
    HomeLink("market","Marktplatz","Kaufen & verschenken","🛍️","market"),
    HomeLink("group","Vereine","Gemeinsam aktiv","👥","group"),
    HomeLink("loans","Leihbörse","Gegenstände ausleihen","🧰","lend"),
    HomeLink("calendar","Gemeindekalender","Termine & Entsorgung","📅","calendar"),
    HomeLink("events","Veranstaltungen","Lokale Anlässe","🎉","calendar"),
    HomeLink("bulletin","Schwarzes Brett","Gesuche & Angebote","📋","board"),
    HomeLink("inbox","Mitteilungen","Neues und Anfragen","🔔","official"),
    HomeLink("chats","Chats","Privat austauschen","💬","chats"),
    HomeLink("saved","Favoriten","Gespeicherte Beiträge","⭐","profile"),
    HomeLink("map","Quartierkarte","Deine Umgebung","📍","map"),
    HomeLink("swissmap","Schweizkarte","Kantone & Gemeinden","🇨🇭","map")
)
private val defaultQuick = listOf("need","offer","market","group")
private val priorityCatalog = listOf(
    HomeLink("inbox","Mitteilungen & Anfragen","Neue Mitteilungen und Anfragen","🔔","official"),
    HomeLink("events","Termine & Veranstaltungen","Termine aus deiner Umgebung","📅","calendar"),
    HomeLink("loans","Ausleihen & Reservierungen","Deine laufenden Ausleihen","🧰","v50loans"),
    HomeLink("bulletin","Meine Anliegen","Deine eingereichten Beiträge","🤝","board"),
    HomeLink("saved","Meine Favoriten","Gespeicherte Beiträge","♡","profile"),
    HomeLink("map","Quartierkarte","Kantone und Gemeinden","📍","map")
)
private val defaultPriorities=priorityCatalog.map { it.id }

private fun userDashboard(repo: QuartinautRepository): Map<*, *> =
    repo.profile["dashboard"] as? Map<*, *> ?: emptyMap<String,Any>()
private fun quickIds(repo: QuartinautRepository): List<String> {
    val set = (userDashboard(repo)["quickLinks"] as? List<*>)
        ?.filterIsInstance<String>()?.distinct()?.filter { key -> links.any { it.id==key } }
        ?: emptyList()
    return if(set.size in 2..8) set else defaultQuick
}
private fun priorities(repo: QuartinautRepository): List<String> {
    val saved=(userDashboard(repo)["priorityOrder"] as? List<*>)
        ?.filterIsInstance<String>()?.distinct()?.filter { it in defaultPriorities }
        ?: emptyList()
    return saved + defaultPriorities.filterNot { it in saved }
}

/**
 * The first screen is deliberately composed like the original web 5.4 home:
 * large image-first greeting, search, editable quick links, personal overview,
 * optional further sections. It is 100% native Compose, not an HTML renderer.
 */
@Composable
fun NativeOriginalHome(repo: QuartinautRepository, navigate: (String) -> Unit) {
    val chosen=quickIds(repo)
    val ordered=priorities(repo)
    var showShortcuts by remember { mutableStateOf(false) }
    var showPriorities by remember { mutableStateOf(false) }
    var showOther by remember { mutableStateOf(false) }
    val firstName=repo.displayName().trim().substringBefore(" ").ifBlank { "Nachbar" }
    Column(Modifier.fillMaxSize().background(Night).verticalScroll(rememberScrollState())
        .padding(horizontal=14.dp, vertical=16.dp),
        verticalArrangement=Arrangement.spacedBy(22.dp)) {

        HomeHero(repo,firstName,navigate)

        HomeSection("SCHNELLZUGRIFFE","Direkt loslegen","Anpassen",{showShortcuts=true})
        Column(verticalArrangement=Arrangement.spacedBy(9.dp)) {
            chosen.chunked(2).forEach { row ->
                Row(horizontalArrangement=Arrangement.spacedBy(9.dp)) {
                    row.forEach { id ->
                        val card=links.firstOrNull { it.id==id } ?: return@forEach
                        HomeShortcut(card,Modifier.weight(1f)) {
                            navigate(card.route)
                        }
                    }
                    if(row.size==1) Spacer(Modifier.weight(1f))
                }
            }
        }

        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(25.dp))
            .background(NightCard).border(1.dp,PanelLine,RoundedCornerShape(25.dp))
            .padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
            HomeSection("PERSÖNLICHER ÜBERBLICK","Für dich wichtig","Sortieren",{showPriorities=true})
            ordered.take(4).chunked(2).forEach { row ->
                Row(horizontalArrangement=Arrangement.spacedBy(9.dp)) {
                    row.forEach { id ->
                        val card=priorityCatalog.firstOrNull { it.id==id } ?: return@forEach
                        HomePriority(card,repo,Modifier.weight(1f)) { navigate(card.route) }
                    }
                    if(row.size==1) Spacer(Modifier.weight(1f))
                }
            }
            if(ordered.size>4) {
                TextButton(onClick={showPriorities=true}) {
                    Text("Weitere Bereiche und Reihenfolge anpassen",color=Lime)
                }
            }
        }

        if(repo.syncIssues.isNotEmpty()) {
            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(15.dp))
                .background(Color(0xFF342A1D))
                .clickable { navigate("diagnostics") }.padding(13.dp),
                verticalAlignment=Alignment.CenterVertically) {
                Icon(Icons.Default.Info,contentDescription=null,tint=Color(0xFFFFD184))
                Spacer(Modifier.width(9.dp))
                Text("Einige Bereiche konnten nicht geladen werden. Details ansehen",
                    color=Color(0xFFFFE1A1),style=MaterialTheme.typography.bodySmall,
                    modifier=Modifier.weight(1f))
                Icon(Icons.Default.ChevronRight,contentDescription=null,tint=Color(0xFFFFE1A1))
            }
        }

        HomeSection("DEINE NACHBARSCHAFT","Aktuelles aus deiner Nähe","Alle ansehen",{navigate("board")})
        val latest=repo.requests.filter { it.str("status")=="offen" }.take(3)
        if(latest.isEmpty()) {
            Text("Noch keine veröffentlichten Anliegen in deiner Umgebung.",
                color=Quiet,style=MaterialTheme.typography.bodyMedium)
        } else {
            latest.forEach { doc ->
                Surface(shape=RoundedCornerShape(18.dp),color=NightCard,
                    border=androidx.compose.foundation.BorderStroke(1.dp,PanelLine),
                    onClick={navigate("board")},modifier=Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(6.dp)) {
                        Text(doc.title(),fontWeight=FontWeight.SemiBold,color=Color.White,
                            maxLines=2,overflow=TextOverflow.Ellipsis)
                        Text(doc.str("category")+" · "+doc.str("area"),
                            color=Quiet,style=MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }

        Surface(shape=RoundedCornerShape(20.dp),color=NightCard,
            border=androidx.compose.foundation.BorderStroke(1.dp,PanelLine),
            onClick={navigate("map")},modifier=Modifier.fillMaxWidth()) {
            Row(Modifier.padding(15.dp),verticalAlignment=Alignment.CenterVertically) {
                Text("🇨🇭",style=MaterialTheme.typography.headlineSmall)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text("Schweizkarte",color=Color.White,fontWeight=FontWeight.SemiBold)
                    Text("26 Kantone · 2'110 Gemeinden",color=Quiet,
                        style=MaterialTheme.typography.bodySmall)
                }
                Icon(Icons.Default.ArrowForward,null,tint=Lime)
            }
        }

        TextButton(onClick={showOther=!showOther},modifier=Modifier.fillMaxWidth()) {
            Text(if(showOther) "Weitere Bereiche einklappen" else "Weitere Bereiche anzeigen",
                color=Lime)
            Icon(if(showOther) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                null,tint=Lime)
        }
        if(showOther) {
            listOf(
                HomeLink("board","Schwarzes Brett","Hilfe suchen und anbieten","🤝","board"),
                HomeLink("plus","Quartier+","Alle Bereiche entdecken","🏘️","plus"),
                HomeLink("settings","Dashboard-Hintergrund","Dein Foto festlegen","🖼️","settings"),
                HomeLink("alerts","Gemeinde-Alarme","Wichtige Nachrichten","🔔","alerts")
            ).forEach { card ->
                HomeShortcut(card,Modifier.fillMaxWidth()) { navigate(card.route) }
            }
            NativeCantonMap(selected=repo.canton(),counts=repo.cantonCounts) { navigate("map") }
        }
        Spacer(Modifier.height(10.dp))
    }
    if(showShortcuts) {
        val edit=remember(showShortcuts) { mutableStateListOf<String>().also{it.addAll(chosen)} }
        AlertDialog(onDismissRequest={showShortcuts=false},
            title={Text("Schnellzugriffe anpassen")},
            text={
                Column(Modifier.heightIn(max=440.dp).verticalScroll(rememberScrollState())) {
                    Text("Wähle 2 bis 8 Funktionen. Die Auswahl wird in deinem Quartinaut-Profil gespeichert.",
                        style=MaterialTheme.typography.bodySmall)
                    links.forEach { item ->
                        Row(Modifier.fillMaxWidth().clickable {
                            if(item.id in edit) {if(edit.size>2) edit.remove(item.id)}
                            else if(edit.size<8)edit.add(item.id)
                        },verticalAlignment=Alignment.CenterVertically) {
                            Checkbox(checked=item.id in edit,onCheckedChange={ yes ->
                                if(yes&&item.id !in edit&&edit.size<8) edit.add(item.id)
                                if(!yes&&edit.size>2) edit.remove(item.id)
                            })
                            Text(item.emoji+" "+item.title)
                        }
                    }
                }
            },
            confirmButton={
                TextButton(onClick={
                    repo.saveDashboardLayout(edit.toList(),ordered)
                    showShortcuts=false
                },enabled=edit.size in 2..8) {Text("Speichern")}
            },
            dismissButton={TextButton(onClick={showShortcuts=false}){Text("Abbrechen")}})
    }
    if(showPriorities) {
        val edit=remember(showPriorities) {
            mutableStateListOf<String>().also { it.addAll(ordered) }
        }
        AlertDialog(onDismissRequest={showPriorities=false},
            title={Text("Persönliche Übersicht sortieren")},
            text={
                Column(Modifier.heightIn(max=425.dp).verticalScroll(rememberScrollState())) {
                    edit.toList().forEachIndexed { index,id ->
                        val meta=priorityCatalog.first { it.id==id }
                        Row(verticalAlignment=Alignment.CenterVertically) {
                            Text(meta.emoji+" "+meta.title,modifier=Modifier.weight(1f))
                            IconButton(onClick={
                                if(index>0){edit.removeAt(index);edit.add(index-1,id)}
                            },enabled=index>0) {
                                Icon(Icons.Default.ArrowUpward,"Nach oben")
                            }
                            IconButton(onClick={
                                if(index<edit.lastIndex){edit.removeAt(index);edit.add(index+1,id)}
                            },enabled=index<edit.lastIndex) {
                                Icon(Icons.Default.ArrowDownward,"Nach unten")
                            }
                        }
                    }
                }
            },
            confirmButton={TextButton(onClick={
                repo.saveDashboardLayout(chosen,edit.toList())
                showPriorities=false
            }){Text("Speichern")}},
            dismissButton={TextButton(onClick={showPriorities=false}){Text("Abbrechen")}})
    }
}

@Composable
private fun HomeHero(repo: QuartinautRepository, firstName: String,
                     navigate:(String)->Unit) {
    val shape=RoundedCornerShape(28.dp)
    Box(Modifier.fillMaxWidth().height(304.dp).clip(shape)
        .border(1.dp,PanelLine,shape)) {
        val bitmap=repo.dashboardBackground
        if(bitmap==null) {
            Canvas(Modifier.fillMaxSize()) {
                drawRect(Brush.verticalGradient(listOf(
                    Color(0xFF102C33),Color(0xFF0E2124),Color(0xFF183425))))
                // Calm night-sky lines and a subtle town silhouette. No stock
                // asset, network image or WebView is needed.
                for(i in 0..25) {
                    val x=(i*61%300)/300f*size.width
                    val y=(i*43%145)/230f*size.height
                    drawLine(Color.White.copy(alpha=0.055f),
                        start=Offset(x,y),end=Offset(x+17f,y+30f),strokeWidth=1.4f)
                }
                val hills=Path().apply {
                    moveTo(0f,size.height*0.84f)
                    lineTo(size.width*0.10f,size.height*0.76f)
                    lineTo(size.width*0.26f,size.height*0.86f)
                    lineTo(size.width*0.49f,size.height*0.70f)
                    lineTo(size.width*0.66f,size.height*0.82f)
                    lineTo(size.width*0.86f,size.height*0.72f)
                    lineTo(size.width,size.height*0.79f)
                    lineTo(size.width,size.height)
                    lineTo(0f,size.height)
                    close()
                }
                drawPath(hills,Color(0xFF0B221A))
            }
        } else {
            Image(bitmap.asImageBitmap(),
                contentDescription="Dein persönlicher Quartinaut-Hintergrund",
                modifier=Modifier.fillMaxSize(),contentScale=ContentScale.Crop)
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(
                listOf(Color(0xB9001814),Color(0x99001713),Color(0xBB0B251A)))))
        }
        Column(Modifier.fillMaxSize().padding(19.dp),
            verticalArrangement=Arrangement.SpaceBetween) {
            Row(verticalAlignment=Alignment.CenterVertically) {
                Surface(shape=RoundedCornerShape(40.dp),
                    color=Color(0xBB103528),
                    border=androidx.compose.foundation.BorderStroke(1.dp,PanelLine)) {
                    Row(Modifier.padding(horizontal=12.dp,vertical=9.dp),
                        verticalAlignment=Alignment.CenterVertically) {
                        Icon(Icons.Default.LocationOn,null,tint=Color.White,
                            modifier=Modifier.size(16.dp))
                        Spacer(Modifier.width(5.dp))
                        Text(repo.area().ifBlank{"Deine Gemeinde"}+
                            (if(repo.canton().isNotBlank())" ("+repo.canton()+")" else ""),
                            color=Color.White,style=MaterialTheme.typography.bodySmall,
                            maxLines=1,overflow=TextOverflow.Ellipsis)
                    }
                }
                Spacer(Modifier.weight(1f))
                IconButton(onClick={navigate("official")}) {
                    Icon(Icons.Default.Notifications,contentDescription="Mitteilungen",
                        tint=Color(0xFFFFC34A))
                }
            }
            Column(verticalArrangement=Arrangement.spacedBy(8.dp)) {
                Text("Q U A R T I N A U T  ·  D E I N E  G E M E I N D E",
                    color=Color(0xFFD4E6DB),style=MaterialTheme.typography.labelSmall)
                Text("Grüezi, "+firstName+"!",color=Color.White,
                    style=MaterialTheme.typography.headlineMedium,
                    fontWeight=FontWeight.Medium,maxLines=1,
                    overflow=TextOverflow.Ellipsis)
                Text("Was möchtest du heute machen?",color=Color.White,
                    style=MaterialTheme.typography.bodyLarge)
                Spacer(Modifier.height(7.dp))
                Surface(onClick={navigate("search")},shape=RoundedCornerShape(21.dp),
                    color=Color.White,modifier=Modifier.fillMaxWidth().height(61.dp)) {
                    Row(Modifier.padding(horizontal=16.dp),
                        verticalAlignment=Alignment.CenterVertically) {
                        Icon(Icons.Default.Search,null,tint=Color(0xFF47645B))
                        Spacer(Modifier.width(10.dp))
                        Text("Beiträge, Vereine, Angebote suchen",
                            style=MaterialTheme.typography.bodyMedium,
                            color=Color(0xFF47645B),maxLines=1,
                            overflow=TextOverflow.Ellipsis,modifier=Modifier.weight(1f))
                        Icon(Icons.Default.ArrowForward,null,tint=Color(0xFF47645B))
                    }
                }
            }
        }
    }
}

@Composable
private fun HomeSection(kicker:String,title:String,button:String,onClick:()->Unit) {
    Row(verticalAlignment=Alignment.Bottom,modifier=Modifier.fillMaxWidth()) {
        Column(Modifier.weight(1f)) {
            Text(kicker,color=Quiet,style=MaterialTheme.typography.labelMedium)
            Spacer(Modifier.height(3.dp))
            Text(title,color=Color.White,style=MaterialTheme.typography.titleLarge)
        }
        TextButton(onClick=onClick) {
            Text(button,color=Lime,style=MaterialTheme.typography.bodyMedium)
        }
    }
}
@Composable
private fun HomeShortcut(card:HomeLink,modifier:Modifier,onClick:()->Unit) {
    Surface(onClick=onClick,modifier=modifier.heightIn(min=112.dp),
        color=NightCard,shape=RoundedCornerShape(22.dp),
        border=androidx.compose.foundation.BorderStroke(1.dp,PanelLine)) {
        Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(5.dp)) {
            Text(card.emoji,style=MaterialTheme.typography.headlineSmall)
            Spacer(Modifier.height(3.dp))
            Text(card.title,color=Color.White,
                style=MaterialTheme.typography.titleMedium,maxLines=1)
            Text(card.subtitle,color=Quiet,
                style=MaterialTheme.typography.bodySmall,maxLines=2)
        }
    }
}
@Composable
private fun HomePriority(card:HomeLink,repo:QuartinautRepository,
                         modifier:Modifier,onClick:()->Unit) {
    Surface(onClick=onClick,modifier=modifier.heightIn(min=105.dp),
        color=Color(0xFF294638),shape=RoundedCornerShape(18.dp),
        border=androidx.compose.foundation.BorderStroke(1.dp,PanelLine)) {
        Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(7.dp)) {
            Row(verticalAlignment=Alignment.CenterVertically) {
                Text(card.emoji,style=MaterialTheme.typography.titleLarge)
                Spacer(Modifier.weight(1f))
                val number=when(card.id) {
                    "bulletin" -> repo.requests.count {it.str("uid")==repo.user?.uid}
                    "inbox" -> repo.notices.size
                    "events" -> repo.hubItems.count {it["kind"]=="calendar"}
                    else -> 0
                }
                if(number>0) Text(number.toString(),color=Lime,fontWeight=FontWeight.Bold)
            }
            Text(card.title,color=Color.White,maxLines=2,
                style=MaterialTheme.typography.bodyMedium)
        }
    }
}
