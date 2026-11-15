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


/** Device-only anonymous timings; never upload IDs, content or personal data. */
internal object NativePerformanceMetrics {
    private val names=linkedMapOf(
        "hub" to "Quartier+",
        "posts" to "Meine Beiträge",
        "extras" to "Erweiterungen",
        "bookings" to "Reservationen",
        "map" to "Schweizkarte"
    )
    fun record(context:android.content.Context, key:String, durationMs:Long, ok:Boolean) {
        if(key !in names) return
        val prefs=context.getSharedPreferences("quartinaut_local_performance",
            android.content.Context.MODE_PRIVATE)
        val sample=durationMs.coerceIn(0L,120000L)
        val old=prefs.getString(key+"_samples","").orEmpty().split(",")
            .mapNotNull {it.toLongOrNull()}.takeLast(19)
        val recent=if(ok)old+sample else old
        prefs.edit()
            .putLong(key+"_ms",sample)
            .putBoolean(key+"_ok",ok)
            .putString(key+"_samples",recent.joinToString(","))
            .putInt(key+"_errors",prefs.getInt(key+"_errors",0)+(if(ok)0 else 1))
            .apply()
    }
    fun summary(context:android.content.Context):List<String> {
        val prefs=context.getSharedPreferences("quartinaut_local_performance",
            android.content.Context.MODE_PRIVATE)
        return names.mapNotNull { (key,label) ->
            val millis=prefs.getLong(key+"_ms",-1)
            if(millis<0) null else {
                val samples=prefs.getString(key+"_samples","").orEmpty().split(",")
                    .mapNotNull {it.toLongOrNull()}.sorted()
                val median=if(samples.isEmpty())"" else
                    " · Median "+samples[(samples.size-1)/2]+" ms"
                val p95=if(samples.isEmpty())"" else
                    " · P95 "+samples[(((samples.size*95+99)/100)-1).coerceIn(0,samples.lastIndex)]+" ms"
                val failures=prefs.getInt(key+"_errors",0)
                label+": zuletzt "+millis+" ms"+
                    (if(prefs.getBoolean(key+"_ok",false))" · OK" else " · Fehler")+
                    median+p95+(if(failures>0)" · Fehler total "+failures else "")
            }
        }
    }
}
