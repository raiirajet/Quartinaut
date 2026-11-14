package ch.quartinaut.nativeapp

import android.content.Context
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.google.firebase.firestore.DocumentSnapshot

private val interestOptions=listOf(
    "market" to "Marktplatz","lend" to "Ausleihen",
    "calendar" to "Veranstaltungen","group" to "Vereine",
    "project" to "Quartieraktionen","lost" to "Fundbüro"
)

/** Recommendations use only the signed-in user's already loaded Quartinaut data.
 * Interests remain private on the device. No extra recommendation backend is called.
 */
@Composable
fun NativeHomeInsights(repo:QuartinautRepository, navigate:(String)->Unit,
                       openHub:(Map<String,Any?>)->Unit,
                       openRequest:(DocumentSnapshot)->Unit) {
    val context=LocalContext.current
    val uid=repo.user?.uid.orEmpty()
    val prefs=remember(context) {
        context.getSharedPreferences("quartinaut_home_interests",Context.MODE_PRIVATE)
    }
    val preferenceKey="topics_"+uid
    var interests by remember(uid) {
        val saved=prefs.getString(preferenceKey,null)
        mutableStateOf(saved?.split("|")?.filter { token ->
            interestOptions.any { it.first==token }
        }?.toSet() ?: setOf("market","lend","calendar"))
    }
    var editing by rememberSaveable {mutableStateOf(false)}
    val area=repo.area().substringBefore(" (").trim()
    val canton=repo.canton().trim()
    val areaKey=repo.areaKey()
    fun near(row:Map<String,Any?>):Boolean =
        (areaKey.isNotBlank() && DocString(row["areaKey"])==areaKey) ||
        (area.isNotBlank() && DocString(row["area"]).substringBefore(" (").trim()
            .equals(area,ignoreCase=true))
    val available=repo.hubItems.filter { row ->
        DocString(row["status"])=="published" &&
        DocString(row["kind"]) in interestOptions.map { it.first } &&
        (near(row) || (canton.isNotBlank() &&
            DocString(row["cantonCode"]).equals(canton,ignoreCase=true)))
    }
    val localRequests=repo.requests.filter { doc ->
        doc.str("status")=="offen" &&
        ((areaKey.isNotBlank() && doc.str("areaKey")==areaKey) ||
            (area.isNotBlank() && doc.str("area").substringBefore(" (").trim()
                .equals(area,ignoreCase=true)))
    }
    val suggestions=available.sortedByDescending { row ->
        (if(near(row)) 4 else 0) +
        (if(DocString(row["kind"]) in interests) 3 else 0)
    }.take(3)
    Column(verticalArrangement=Arrangement.spacedBy(11.dp)) {
        Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("IN DEINER GEMEINDE",
                    color=MaterialTheme.colorScheme.primary,
                    style=MaterialTheme.typography.labelMedium)
                Text("Jetzt interessant",
                    style=MaterialTheme.typography.titleLarge,
                    fontWeight=FontWeight.SemiBold)
            }
            TextButton(onClick={navigate("community-pulse")}) {
                Text("Alle ansehen")
                Icon(Icons.Default.ChevronRight,contentDescription=null)
            }
        }
        Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
            HomeStat(localRequests.size.toString(),"Anliegen",Modifier.weight(1f)) {
                navigate("board")
            }
            HomeStat(available.size.toString(),"Angebote",Modifier.weight(1f)) {
                navigate("market")
            }
            HomeStat(repo.notices.size.toString(),"Mitteilungen",Modifier.weight(1f)) {
                navigate("official")
            }
        }
        repo.notices.firstOrNull()?.let { notice ->
            Surface(onClick={navigate("official")},modifier=Modifier.fillMaxWidth(),
                shape=RoundedCornerShape(18.dp),
                color=MaterialTheme.colorScheme.primaryContainer) {
                Row(Modifier.heightIn(min=69.dp).padding(12.dp),
                    verticalAlignment=Alignment.CenterVertically) {
                    Icon(Icons.Default.Campaign,contentDescription=null,
                        tint=MaterialTheme.colorScheme.onPrimaryContainer)
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text("Aktuelle Mitteilung",style=MaterialTheme.typography.labelSmall,
                            color=MaterialTheme.colorScheme.onPrimaryContainer)
                        Text(notice.title(),maxLines=2,overflow=TextOverflow.Ellipsis,
                            color=MaterialTheme.colorScheme.onPrimaryContainer,
                            fontWeight=FontWeight.Medium)
                    }
                    Icon(Icons.Default.ChevronRight,contentDescription="Mitteilung öffnen",
                        tint=MaterialTheme.colorScheme.onPrimaryContainer)
                }
            }
        }
        Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {
            Text("Für dich entdeckt",modifier=Modifier.weight(1f),
                style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.SemiBold)
            TextButton(onClick={editing=true}) {
                Icon(Icons.Default.Tune,contentDescription=null,modifier=Modifier.size(18.dp))
                Spacer(Modifier.width(5.dp))
                Text("Interessen")
            }
        }
        if(suggestions.isNotEmpty()) suggestions.forEach { row ->
            val type=interestOptions.firstOrNull {
                it.first==DocString(row["kind"])
            }?.second ?: "Beitrag"
            Surface(onClick={openHub(row)},modifier=Modifier.fillMaxWidth(),
                shape=RoundedCornerShape(18.dp),
                color=MaterialTheme.colorScheme.surface,
                border=BorderStroke(1.dp,MaterialTheme.colorScheme.outlineVariant)) {
                Row(Modifier.heightIn(min=74.dp).padding(12.dp),
                    verticalAlignment=Alignment.CenterVertically) {
                    Icon(when(DocString(row["kind"])) {
                        "market" -> Icons.Default.Storefront
                        "lend" -> Icons.Default.Handyman
                        "calendar" -> Icons.Default.Event
                        "group" -> Icons.Default.Groups
                        "lost" -> Icons.Default.Search
                        else -> Icons.Default.LocalActivity
                    },contentDescription=null,tint=MaterialTheme.colorScheme.primary,
                        modifier=Modifier.size(28.dp))
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(DocString(row["title"]),fontWeight=FontWeight.SemiBold,
                            maxLines=2,overflow=TextOverflow.Ellipsis)
                        Text(type+" · "+DocString(row["area"]).ifBlank{"Deine Umgebung"},
                            color=MaterialTheme.colorScheme.onSurfaceVariant,
                            style=MaterialTheme.typography.bodySmall)
                    }
                    Icon(Icons.Default.ChevronRight,contentDescription="Eintrag öffnen",
                        tint=MaterialTheme.colorScheme.primary)
                }
            }
        } else {
            Surface(shape=RoundedCornerShape(18.dp),
                color=MaterialTheme.colorScheme.surfaceVariant,
                modifier=Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(7.dp)) {
                    Text("Keine passenden veröffentlichten Angebote geladen",
                        fontWeight=FontWeight.SemiBold)
                    Text("Passe deine Interessen an oder entdecke neue Beiträge.",
                        color=MaterialTheme.colorScheme.onSurfaceVariant,
                        style=MaterialTheme.typography.bodySmall)
                    TextButton(onClick={navigate("plus")}) {Text("Quartier+ entdecken")}
                }
            }
        }
        localRequests.firstOrNull()?.let { latest ->
            Surface(onClick={openRequest(latest)},modifier=Modifier.fillMaxWidth(),
                shape=RoundedCornerShape(16.dp),
                color=MaterialTheme.colorScheme.surfaceVariant) {
                Row(Modifier.padding(12.dp),verticalAlignment=Alignment.CenterVertically) {
                    Icon(Icons.Default.Handshake,contentDescription=null,
                        tint=MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text("Aus deiner Nachbarschaft",
                            style=MaterialTheme.typography.labelSmall,
                            color=MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(latest.title(),maxLines=2,overflow=TextOverflow.Ellipsis)
                    }
                    Icon(Icons.Default.ChevronRight,contentDescription="Anliegen öffnen")
                }
            }
        }
        Text("Quelle: Bereits geladene Quartinaut-Beiträge und Mitteilungen. "+
            "Interessen bleiben auf diesem Gerät.",
            style=MaterialTheme.typography.labelSmall,
            color=MaterialTheme.colorScheme.onSurfaceVariant)
    }
    if(editing) {
        var selected by remember(editing) {mutableStateOf(interests)}
        AlertDialog(onDismissRequest={editing=false},
            title={Text("Deine Interessen")},
            text={
                Column(verticalArrangement=Arrangement.spacedBy(2.dp)) {
                    Text("Wähle Themen für deine Startseite.",
                        style=MaterialTheme.typography.bodySmall)
                    interestOptions.forEach { (id,label) ->
                        Row(Modifier.fillMaxWidth().clickable {
                            selected=if(id in selected)selected-id else selected+id
                        }.heightIn(min=44.dp),verticalAlignment=Alignment.CenterVertically) {
                            Checkbox(checked=id in selected,onCheckedChange={ checked ->
                                selected=if(checked) selected+id else selected-id
                            })
                            Text(label)
                        }
                    }
                }
            },
            confirmButton={TextButton(onClick={
                interests=selected
                prefs.edit().putString(preferenceKey,
                    interestOptions.map { it.first }
                        .filter { it in selected }.joinToString("|")).apply()
                editing=false
            }){Text("Speichern")}},
            dismissButton={TextButton(onClick={editing=false}){Text("Abbrechen")}})
    }
}

@Composable
private fun HomeStat(value:String,label:String,modifier:Modifier,action:()->Unit) {
    Surface(onClick=action,modifier=modifier.heightIn(min=64.dp),
        shape=RoundedCornerShape(15.dp),
        color=MaterialTheme.colorScheme.surface,
        border=BorderStroke(1.dp,MaterialTheme.colorScheme.outlineVariant)) {
        Column(Modifier.padding(11.dp),verticalArrangement=Arrangement.spacedBy(2.dp)) {
            Text(value,style=MaterialTheme.typography.titleLarge,
                fontWeight=FontWeight.Bold,color=MaterialTheme.colorScheme.primary)
            Text(label,style=MaterialTheme.typography.labelSmall,
                color=MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
