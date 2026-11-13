package ch.quartinaut.nativeapp

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlin.coroutines.coroutineContext

private val ChatBackground=Color(0xFF111F19)
private val MyBubble=Color(0xFF24583D)
private val OtherBubble=Color(0xFF283B31)
private val ChatMuted=Color(0xFFBED2C3)

@Composable
fun NativePrivateChatsPage(repo: QuartinautRepository) {
    var filter by remember {mutableStateOf("")}
    var draft by remember(repo.chatId) {mutableStateOf("")}
    val server=repo.serverChatReady
    val uid=repo.user?.uid.orEmpty()
    val records:List<Map<String,Any?>> = if(server) repo.serverChats else
        repo.chats.map { doc ->
            mapOf("id" to doc.id,"requestTitle" to doc.str("requestTitle"),
                "lastMessageAt" to doc.str("lastMessageAt"),
                "lastMessagePreview" to doc.str("lastMessagePreview"),
                "lastSenderUid" to doc.str("lastSenderUid"),
                "readBy" to doc.get("readBy"))
        }
    val visible=records.filter {
        (DocString(it["requestTitle"])+DocString(it["lastMessagePreview"]))
            .contains(filter,ignoreCase=true)
    }.sortedByDescending {DocString(it["lastMessageAt"])}

    // Callable fallback has no Firestore listener. Poll only while this chat
    // screen is open; never in the background and never on a different account.
    LaunchedEffect(repo.chatId,repo.serverChatActive) {
        if(repo.serverChatActive && repo.chatId.isNotBlank()) {
            while(coroutineContext.isActive) {
                delay(15000)
                repo.refreshServerMessages()
            }
        }
    }

    if(repo.chatId.isNotBlank()) {
        Column(Modifier.fillMaxSize().background(ChatBackground).padding(14.dp),
            verticalArrangement=Arrangement.spacedBy(9.dp)) {
            val current=records.firstOrNull { DocString(it["id"])==repo.chatId }
            Row(verticalAlignment=Alignment.CenterVertically) {
                IconButton(onClick=repo::closeChat,modifier=Modifier.size(44.dp)) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription="Zur Chatliste",tint=Color.White)
                }
                Column(Modifier.weight(1f)) {
                    Text(DocString(current?.get("requestTitle")).ifBlank{"Privater Chat"},
                        color=Color.White,fontWeight=FontWeight.SemiBold,
                        maxLines=1,overflow=TextOverflow.Ellipsis)
                    Text("Nur die beiden Teilnehmenden",color=ChatMuted,
                        style=MaterialTheme.typography.labelSmall)
                }
                IconButton(onClick={
                    if(repo.serverChatActive)repo.refreshServerMessages()
                    else repo.retryFeeds()
                }) {Icon(Icons.Default.Refresh,"Nachrichten aktualisieren",tint=Color.White)}
            }
            HorizontalDivider(color=Color(0xFF375445))
            val records:List<Map<String,String>> =
                if(repo.serverChatActive) repo.serverMessages.map { row ->
                    mapOf("id" to DocString(row["id"]),
                        "sender" to DocString(row["senderUid"]),
                        "text" to DocString(row["text"]),
                        "createdAt" to DocString(row["createdAt"]))
                } else repo.messages.map { msg ->
                    mapOf("id" to msg.id,"sender" to msg.str("senderUid"),
                        "text" to msg.str("text"),"createdAt" to msg.str("createdAt"))
                }
            LazyColumn(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(11.dp),
                contentPadding=PaddingValues(top=6.dp,bottom=10.dp)) {
                items(records,key={it["id"].orEmpty()}) { msg ->
                    val mine=msg["sender"]==uid
                    Row(Modifier.fillMaxWidth(),
                        horizontalArrangement=if(mine) Arrangement.End else Arrangement.Start) {
                        Surface(
                            modifier=Modifier.widthIn(min=100.dp,max=290.dp),
                            color=if(mine) MyBubble else OtherBubble,
                            shape=RoundedCornerShape(
                                topStart=18.dp,topEnd=18.dp,
                                bottomStart=if(mine)18.dp else 5.dp,
                                bottomEnd=if(mine)5.dp else 18.dp
                            )) {
                            Column(Modifier.padding(horizontal=14.dp,vertical=11.dp),
                                verticalArrangement=Arrangement.spacedBy(5.dp)) {
                                Text(msg["text"].orEmpty(),color=Color.White)
                                Text(
                                    (if(mine)"Du · " else "") +
                                    msg["createdAt"].orEmpty().replace('T',' ').take(16),
                                    color=ChatMuted,
                                    style=MaterialTheme.typography.labelSmall
                                )
                            }
                        }
                    }
                }
                if(records.isEmpty())item {
                    Text("Noch keine Nachrichten. Beginne mit einer freundlichen Begrüssung.",
                        color=ChatMuted,style=MaterialTheme.typography.bodyMedium)
                }
            }
            Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.Bottom,
                horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(draft,{draft=it.take(500)},
                    modifier=Modifier.weight(1f),
                    placeholder={Text("Nachricht schreiben")},
                    label={Text("Nachricht")},
                    minLines=1,maxLines=4,
                    shape=RoundedCornerShape(18.dp))
                Button(onClick={
                    if(repo.serverChatActive)repo.sendServerChat(draft){draft=""}
                    else repo.sendChat(draft){draft=""}
                },enabled=draft.isNotBlank()&&!repo.busy,
                    modifier=Modifier.height(56.dp).width(60.dp),
                    contentPadding=PaddingValues(0.dp),
                    shape=RoundedCornerShape(18.dp)) {
                    Icon(Icons.AutoMirrored.Filled.Send,"Senden")
                }
            }
        }
    } else {
        Column(Modifier.fillMaxSize().background(ChatBackground).padding(16.dp),
            verticalArrangement=Arrangement.spacedBy(14.dp)) {
            Row(verticalAlignment=Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Private Chats",style=MaterialTheme.typography.headlineSmall,
                        fontWeight=FontWeight.Bold,color=Color.White)
                    Text("Deine vertraulichen Unterhaltungen",color=ChatMuted,
                        style=MaterialTheme.typography.bodySmall)
                }
                IconButton(onClick={
                    if(server||"Private Chats" in repo.syncIssues)repo.loadServerChats()
                    else repo.retryFeeds()
                }) { Icon(Icons.Default.Refresh,"Chats aktualisieren",tint=Color.White) }
            }
            OutlinedTextField(filter,{filter=it},modifier=Modifier.fillMaxWidth(),
                leadingIcon={Icon(Icons.Default.Search,null)},
                label={Text("Unterhaltungen durchsuchen")},
                singleLine=true,shape=RoundedCornerShape(18.dp))
            if(repo.serverChatLoading) LinearProgressIndicator(Modifier.fillMaxWidth())
            if(!server && "Private Chats" in repo.syncIssues) {
                Card(colors=CardDefaults.cardColors(containerColor=Color(0xFF2C3A2D))) {
                    Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                        Text("Chatliste aktuell nicht verfügbar",color=Color(0xFFFFE2AF),
                            fontWeight=FontWeight.SemiBold)
                        Text(repo.syncIssues["Privater Chat-Dienst"]
                            ?: "Firebase verweigert die direkte Chat-Abfrage. Ein geschützter Serverkanal wird geprüft.",
                            color=Color.White,style=MaterialTheme.typography.bodySmall)
                        OutlinedButton(onClick=repo::loadServerChats) {
                            Text("Geschützten Chat-Abruf versuchen")
                        }
                    }
                }
            }
            LazyColumn(verticalArrangement=Arrangement.spacedBy(10.dp)) {
                items(visible,key={DocString(it["id"])}) { chat ->
                    val last=DocString(chat["lastMessageAt"])
                    val read=(chat["readBy"] as? Map<*,*>)?.get(uid)?.toString().orEmpty()
                    val unread=last.isNotBlank() && read.isNotBlank() &&
                        last>read && DocString(chat["lastSenderUid"])!=uid
                    Surface(
                        modifier=Modifier.fillMaxWidth(),
                        color=OtherBubble,
                        shape=RoundedCornerShape(20.dp),
                        border=androidx.compose.foundation.BorderStroke(
                            1.dp,if(unread) Color(0xFF84CF9D) else Color(0xFF436353)),
                        onClick={
                            val id=DocString(chat["id"])
                            if(server) repo.openServerChat(id)
                            else repo.chats.firstOrNull { it.id==id }?.let(repo::openChat)
                        }
                    ) {
                        Row(Modifier.padding(16.dp),verticalAlignment=Alignment.CenterVertically) {
                            Box(Modifier.size(45.dp)
                                .background(MyBubble,RoundedCornerShape(15.dp)),
                                contentAlignment=Alignment.Center) {
                                Icon(Icons.Default.Forum,null,tint=Color.White)
                            }
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f),
                                verticalArrangement=Arrangement.spacedBy(4.dp)) {
                                Text(DocString(chat["requestTitle"]).ifBlank{"Unterhaltung"},
                                    color=Color.White,fontWeight=FontWeight.SemiBold,
                                    maxLines=1,overflow=TextOverflow.Ellipsis)
                                Text(DocString(chat["lastMessagePreview"])
                                    .ifBlank{"Noch keine Nachrichten"},
                                    color=ChatMuted,maxLines=2,
                                    style=MaterialTheme.typography.bodySmall)
                            }
                            if(unread) Box(Modifier.size(9.dp)
                                .background(Color(0xFF84CF9D),RoundedCornerShape(99.dp)))
                            Icon(Icons.Default.ChevronRight,null,tint=ChatMuted)
                        }
                    }
                }
                if(visible.isEmpty() && !repo.serverChatLoading &&
                    (repo.syncIssues.isEmpty() || server))item {
                    Text("Noch keine privaten Chats. Öffne ein Anliegen und tippe auf «Nachricht schreiben».",
                        color=ChatMuted,style=MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }
}
