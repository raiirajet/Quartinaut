package ch.quartinaut.nativeapp

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.font.FontWeight

/** Optional one-time guide, available again from Settings. */
@Composable
fun NativeWelcomeTour(
    userId: String,
    forceShow: Boolean = false,
    onDismiss: () -> Unit = {}
) {
    val context=LocalContext.current
    val prefs=remember(context) {
        context.getSharedPreferences("quartinaut_welcome_v2",android.content.Context.MODE_PRIVATE)
    }
    val key="seen_"+userId
    var shown by remember(userId,forceShow) {
        mutableStateOf(userId.isNotBlank() && (forceShow || !prefs.getBoolean(key,false)))
    }
    var step by remember(userId,forceShow) { mutableIntStateOf(0) }
    val slides=listOf(
        Triple("Dein Quartier auf einen Blick",
            "Auf der Startseite findest du Neuigkeiten aus deiner Gemeinde, deine Aktivitäten und persönliche Schnellzugriffe.",
            Icons.Default.Dashboard),
        Triple("Einträge und Kontakte",
            "Über «Neu» erstellst du Inserate und Hilfegesuche. «Meine Beiträge» zeigt den Bearbeitungsstatus. Unter «Chats» findest du private Nachrichten.",
            Icons.Default.EditNote),
        Triple("Die Schweiz entdecken",
            "In Quartier+ findest du Gemeinden, Karten, offizielle Termine und die Suche. Wappen und Kartenumrisse sind offline verfügbar.",
            Icons.Default.Map)
    )
    fun close() {
        prefs.edit().putBoolean(key,true).apply()
        shown=false
        onDismiss()
    }
    if(!shown) return
    val slide=slides[step]
    AlertDialog(
        onDismissRequest={close()},
        icon={Icon(slide.third,null,tint=MaterialTheme.colorScheme.primary,
            modifier=Modifier.size(36.dp))},
        title={Text(slide.first,fontWeight=FontWeight.Bold)},
        text={
            Column(verticalArrangement=Arrangement.spacedBy(12.dp)) {
                Text(slide.second)
                LinearProgressIndicator(progress={(step+1)/slides.size.toFloat()},
                    modifier=Modifier.fillMaxWidth())
                Text((step+1).toString()+" von "+slides.size,
                    style=MaterialTheme.typography.labelSmall,
                    color=MaterialTheme.colorScheme.onSurfaceVariant)
            }
        },
        confirmButton={TextButton(onClick={
            if(step==slides.lastIndex)close() else step+=1
        }){Text(if(step==slides.lastIndex)"Loslegen" else "Weiter")}},
        dismissButton={TextButton(onClick={close()}){Text("Überspringen")}}
    )
}
