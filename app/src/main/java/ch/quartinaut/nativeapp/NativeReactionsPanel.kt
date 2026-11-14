package ch.quartinaut.nativeapp

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import java.util.UUID

/** Shared UI for published community entries and neighborhood requests.
 * Changes appear immediately, while the callable remains authoritative.
 */
@Composable
internal fun NativeReactionsPanel(
    repo:QuartinautRepository,
    kind:String,
    id:String,
    initialLikes:Int=0,
    initialLiked:Boolean?=null
) {
    var liked by remember(kind,id) {mutableStateOf(initialLiked)}
    var likeCount by remember(kind,id) {mutableIntStateOf(initialLikes.coerceAtLeast(0))}
    var liking by remember(kind,id) {mutableStateOf(false)}
    var showComments by remember(kind,id) {mutableStateOf(false)}
    var comments by remember(kind,id) {mutableStateOf<List<Map<String,Any?>>>(emptyList())}
    var loading by remember(kind,id) {mutableStateOf(false)}
    var loadError by remember(kind,id) {mutableStateOf("")}
    var text by remember(kind,id) {mutableStateOf("")}
    var submitting by remember(kind,id) {mutableStateOf(false)}

    fun mergeReceived(response:Map<String,Any?>) {
        val rows=(response["comments"] as? List<*>)?.mapNotNull { raw ->
            (raw as? Map<*,*>)?.entries?.associate { DocString(it.key) to it.value }
        } ?: emptyList()
        // Keep submitted comments visible until moderation / listing catches up.
        val pending=comments.filter { local ->
            local["_localId"]!=null && rows.none { server ->
                DocString(server["text"])==DocString(local["text"]) &&
                    (DocString(server["authorUid"])==repo.user?.uid ||
                     DocString(server["authorName"])==repo.displayName())
            }
        }
        comments=rows+pending
        val summary=response["summary"] as? Map<*,*>
        if(summary!=null) {
            if(summary["liked"] is Boolean) liked=summary["liked"]==true
            val count=summary["likes"] as? Number
            if(count!=null && !liking)likeCount=count.toInt().coerceAtLeast(0)
        }
        loading=false
        loadError=""
    }

    fun refresh() {
        loading=true
        repo.reactionAction("comments.list",kind,id,
            success={mergeReceived(it)},
            failure={
                loading=false
                loadError="Kommentare konnten nicht geladen werden."
            })
    }

    Column(verticalArrangement=Arrangement.spacedBy(9.dp)) {
        Text("Reaktionen & Kommentare",style=MaterialTheme.typography.titleMedium,
            fontWeight=FontWeight.SemiBold)
        Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick={
                val wasLiked=liked==true
                val before=likeCount
                liked=!wasLiked
                likeCount=(before+if(wasLiked)-1 else 1).coerceAtLeast(0)
                liking=true
                repo.reactionAction("like.toggle",kind,id,
                    success={response->
                        val summary=response["summary"] as? Map<*,*> ?: response
                        val isLiked=summary["liked"]
                        if(isLiked is Boolean)liked=isLiked
                        val remoteCount=summary["likes"] as? Number
                        if(remoteCount!=null)likeCount=remoteCount.toInt().coerceAtLeast(0)
                        liking=false
                    },
                    failure={
                        liked=if(initialLiked==null && !wasLiked) null else wasLiked
                        likeCount=before
                        liking=false
                    })
            },enabled=!liking,contentPadding=PaddingValues(horizontal=12.dp,vertical=9.dp)) {
                Icon(if(liked==true) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                    contentDescription=null,
                    tint=if(liked==true)MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier=Modifier.size(18.dp))
                Spacer(Modifier.width(5.dp))
                Text(if(likeCount>0) "Gefällt mir ($likeCount)" else "Gefällt mir")
                if(liking) {
                    Spacer(Modifier.width(5.dp))
                    CircularProgressIndicator(Modifier.size(13.dp),strokeWidth=2.dp)
                }
            }
            TextButton(onClick={
                showComments=!showComments
                if(showComments && comments.isEmpty())refresh()
            }) {
                Icon(Icons.Default.Comment,contentDescription=null,
                    modifier=Modifier.size(17.dp))
                Spacer(Modifier.width(5.dp))
                Text(if(showComments)"Schliessen" else "Kommentare")
            }
        }
        if(showComments) {
            if(loading && comments.isEmpty()) {
                LinearProgressIndicator(modifier=Modifier.fillMaxWidth())
                Text("Kommentare werden geladen …",
                    style=MaterialTheme.typography.bodySmall,
                    color=MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if(loadError.isNotBlank()) {
                Row {
                    Text(loadError,modifier=Modifier.weight(1f),
                        style=MaterialTheme.typography.bodySmall,
                        color=MaterialTheme.colorScheme.error)
                    TextButton(onClick={refresh()}) {Text("Erneut")}
                }
            }
            if(!loading && loadError.isBlank() && comments.isEmpty())
                Text("Noch keine sichtbaren Kommentare.",
                    color=MaterialTheme.colorScheme.onSurfaceVariant,
                    style=MaterialTheme.typography.bodySmall)
            comments.forEach { entry ->
                Surface(color=MaterialTheme.colorScheme.surfaceVariant,
                    shape=RoundedCornerShape(14.dp),
                    modifier=Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(12.dp),
                        verticalArrangement=Arrangement.spacedBy(3.dp)) {
                        Text(DocString(entry["authorName"]).ifBlank{"Du"},
                            fontWeight=FontWeight.SemiBold)
                        Text(DocString(entry["text"]))
                        if(entry["_localId"]!=null) Text(
                            if(entry["_submitted"]==true)
                                "Gesendet · wird auf dem Server verarbeitet"
                            else "Wird gesendet …",
                            color=MaterialTheme.colorScheme.onSurfaceVariant,
                            style=MaterialTheme.typography.labelSmall)
                    }
                }
            }
            OutlinedTextField(value=text,onValueChange={text=it.take(400)},
                label={Text("Kommentar schreiben")},
                modifier=Modifier.fillMaxWidth(),minLines=2,maxLines=5)
            Button(onClick={
                val draft=text.trim()
                val localId=UUID.randomUUID().toString()
                comments=comments+mapOf(
                    "_localId" to localId,
                    "_submitted" to false,
                    "authorName" to "Du",
                    "text" to draft
                )
                text=""
                submitting=true
                repo.reactionAction("comment.create",kind,id,
                    values=mapOf("text" to draft),
                    success={
                        comments=comments.map { row ->
                            if(row["_localId"]==localId) row+("_submitted" to true) else row
                        }
                        submitting=false
                        refresh()
                    },
                    failure={
                        comments=comments.filterNot { row -> row["_localId"]==localId }
                        if(text.isBlank())text=draft
                        submitting=false
                    })
            },enabled=!submitting && text.trim().length in 2..400,
                modifier=Modifier.fillMaxWidth()) {
                if(submitting) CircularProgressIndicator(Modifier.size(18.dp),
                    strokeWidth=2.dp)
                else Icon(Icons.Default.Send,contentDescription=null)
                Spacer(Modifier.width(8.dp))
                Text(if(submitting)"Wird gesendet …" else "Kommentar senden")
            }
            TextButton(onClick={refresh()},enabled=!loading,
                modifier=Modifier.fillMaxWidth()) {
                Icon(Icons.Default.Refresh,contentDescription=null)
                Spacer(Modifier.width(6.dp))
                Text("Kommentare aktualisieren")
            }
        }
    }
}
