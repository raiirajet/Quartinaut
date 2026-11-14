package ch.quartinaut.nativeapp

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.coroutines.coroutineContext

private val ChatBackground: Color @Composable get() = MaterialTheme.colorScheme.background
private val MyBubble: Color @Composable get() = MaterialTheme.colorScheme.primaryContainer
private val OtherBubble: Color @Composable get() = MaterialTheme.colorScheme.surfaceVariant
private val ChatMuted: Color @Composable get() = MaterialTheme.colorScheme.onSurfaceVariant

@Composable
fun NativePrivateChatsPage(repo: QuartinautRepository) {
    var filter by remember {mutableStateOf("")}
    var draft by remember(repo.chatId) {mutableStateOf("")}
    var menuOpen by remember {mutableStateOf(false)}
    var confirmBlock by remember {mutableStateOf(false)}
    var reportOpen by remember {mutableStateOf(false)}
    var reportReason by remember {mutableStateOf("harassment")}
    var reportNote by remember {mutableStateOf("")}
    val context=LocalContext.current
    val scope=rememberCoroutineScope()
    val server=repo.serverChatReady
    val uid=repo.user?.uid.orEmpty()
    val records:List<Map<String,Any?>> = if(server) repo.serverChats else emptyList()
    val visible=records.filter {
        (DocString(it["requestTitle"])+DocString(it["lastMessagePreview"]))
            .contains(filter,ignoreCase=true)
    }.sortedByDescending {DocString(it["lastMessageAt"])}
    val current=records.firstOrNull {DocString(it["id"])==repo.chatId}
    val mutedBy=(current?.get("mutedBy") as? List<*>)?.map(::DocString).orEmpty()
    val blockedBy=(current?.get("blockedBy") as? List<*>)?.map(::DocString).orEmpty()
    val muted=uid in mutedBy
    val blockedByMe=uid in blockedBy
    val blocked=blockedBy.isNotEmpty()
    val imagePicker=rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) {uri ->
        if(uri!=null&&repo.serverChatActive&&!blocked)scope.launch {
            runCatching {prepareDashboardImage(context,uri)}
                .onSuccess {bytes->repo.sendServerChatImage(bytes,draft){draft=""}}
                .onFailure {repo.showMessage(it.localizedMessage ?: "Foto konnte nicht vorbereitet werden.")}
        }
    }

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
            Row(verticalAlignment=Alignment.CenterVertically) {
                IconButton(onClick=repo::closeChat,modifier=Modifier.size(44.dp)) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription="Zur Chatliste",tint=MaterialTheme.colorScheme.onSurface)
                }
                Column(Modifier.weight(1f)) {
                    Text(DocString(current?.get("requestTitle")).ifBlank{"Privater Chat"},
                        color=MaterialTheme.colorScheme.onSurface,fontWeight=FontWeight.SemiBold,
                        maxLines=1,overflow=TextOverflow.Ellipsis)
                    Text("Nur die beiden Teilnehmenden",color=ChatMuted,
                        style=MaterialTheme.typography.labelSmall)
                }
                IconButton(onClick={
                    if(repo.serverChatActive)repo.refreshServerMessages() else repo.retryFeeds()
                }) {Icon(Icons.Default.Refresh,"Nachrichten aktualisieren",tint=MaterialTheme.colorScheme.onSurface)}
                Box {
                    IconButton(onClick={menuOpen=true}) {
                        Icon(Icons.Default.MoreVert,"Chatoptionen",tint=MaterialTheme.colorScheme.onSurface)
                    }
                    DropdownMenu(expanded=menuOpen,onDismissRequest={menuOpen=false}) {
                        DropdownMenuItem(
                            text={Text(if(muted)"Push aktivieren" else "Push stummschalten")},
                            leadingIcon={Icon(if(muted)Icons.Default.Notifications else Icons.Default.NotificationsOff,null)},
                            enabled=repo.serverChatActive&&!repo.busy,
                            onClick={menuOpen=false;repo.setServerChatMuted(!muted)})
                        DropdownMenuItem(
                            text={Text(if(blockedByMe)"Blockierung aufheben" else "Person blockieren")},
                            leadingIcon={Icon(Icons.Default.Block,null)},
                            enabled=repo.serverChatActive&&!repo.busy,
                            onClick={menuOpen=false;confirmBlock=true})
                        DropdownMenuItem(
                            text={Text("Chat melden")},leadingIcon={Icon(Icons.Default.Report,null)},
                            enabled=repo.serverChatActive&&!repo.busy,
                            onClick={menuOpen=false;reportOpen=true})
                    }
                }
            }
            HorizontalDivider(color=Color(0xFF375445))
            val messageRecords:List<Map<String,Any?>> = repo.serverMessages.map { row ->
                mapOf("id" to DocString(row["id"]),
                    "sender" to DocString(row["senderUid"]),
                    "text" to DocString(row["text"]),
                    "createdAt" to DocString(row["createdAt"]),
                    "messageType" to DocString(row["messageType"]),
                    "mediaPath" to DocString((row["media"] as? Map<*,*>)?.get("storagePath")))
            }
            LazyColumn(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(11.dp),
                contentPadding=PaddingValues(top=6.dp,bottom=10.dp)) {
                items(messageRecords,key={DocString(it["id"])}) { msg ->
                    val mine=DocString(msg["sender"])==uid
                    Row(Modifier.fillMaxWidth(),
                        horizontalArrangement=if(mine) Arrangement.End else Arrangement.Start) {
                        Surface(modifier=Modifier.widthIn(min=100.dp,max=290.dp),
                            color=if(mine) MyBubble else OtherBubble,
                            shape=RoundedCornerShape(topStart=18.dp,topEnd=18.dp,
                                bottomStart=if(mine)18.dp else 5.dp,
                                bottomEnd=if(mine)5.dp else 18.dp)) {
                            Column(Modifier.padding(horizontal=14.dp,vertical=11.dp),
                                verticalArrangement=Arrangement.spacedBy(5.dp)) {
                                val mediaPath=DocString(msg["mediaPath"])
                                if(mediaPath.isNotBlank())ChatMediaPreview(repo,mediaPath)
                                val text=DocString(msg["text"])
                                if(text.isNotBlank())Text(text,color=MaterialTheme.colorScheme.onSurface)
                                Text((if(mine)"Du · " else "")+
                                    DocString(msg["createdAt"]).replace('T',' ').take(16),
                                    color=ChatMuted,style=MaterialTheme.typography.labelSmall)
                            }
                        }
                    }
                }
                if(messageRecords.isEmpty())item {
                    Text("Noch keine Nachrichten. Beginne mit einer freundlichen Begrüssung.",
                        color=ChatMuted,style=MaterialTheme.typography.bodyMedium)
                }
            }
            if(blocked) {
                Surface(color=Color(0xFF402D2D),shape=RoundedCornerShape(14.dp)) {
                    Text(if(blockedByMe)"Du hast diese Person blockiert. Neue Nachrichten und Bilder sind deaktiviert."
                        else "Diese Unterhaltung ist blockiert.",color=MaterialTheme.colorScheme.onSurface,
                        modifier=Modifier.fillMaxWidth().padding(12.dp))
                }
            } else Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.Bottom,
                horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                IconButton(onClick={imagePicker.launch("image/*")},
                    enabled=repo.serverChatActive&&!repo.busy) {
                    Icon(Icons.Default.AddPhotoAlternate,"Sicheres Foto senden",tint=MaterialTheme.colorScheme.onSurface)
                }
                OutlinedTextField(draft,{draft=it.take(500)},modifier=Modifier.weight(1f),
                    placeholder={Text("Nachricht schreiben")},label={Text("Nachricht")},
                    minLines=1,maxLines=4,shape=RoundedCornerShape(18.dp))
                Button(onClick={
                    repo.sendServerChat(draft){draft=""}
                },enabled=draft.isNotBlank()&&repo.serverChatActive&&!repo.busy,
                    modifier=Modifier.height(56.dp).width(60.dp),
                    contentPadding=PaddingValues(0.dp),shape=RoundedCornerShape(18.dp)) {
                    Icon(Icons.AutoMirrored.Filled.Send,"Senden")
                }
            }
            if(repo.chatMediaLoading)LinearProgressIndicator(Modifier.fillMaxWidth())
        }
    } else {
        Column(Modifier.fillMaxSize().background(ChatBackground).padding(16.dp),
            verticalArrangement=Arrangement.spacedBy(14.dp)) {
            Row(verticalAlignment=Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Nachrichten",style=MaterialTheme.typography.headlineSmall,
                        fontWeight=FontWeight.Bold,color=MaterialTheme.colorScheme.onSurface)
                    Text("Deine vertraulichen Unterhaltungen",color=ChatMuted,
                        style=MaterialTheme.typography.bodySmall)
                }
                IconButton(onClick={
                    repo.loadServerChats()
                }) {Icon(Icons.Default.Refresh,"Nachrichten aktualisieren",tint=MaterialTheme.colorScheme.onSurface)}
            }
            OutlinedTextField(filter,{filter=it},modifier=Modifier.fillMaxWidth(),
                leadingIcon={Icon(Icons.Default.Search,null)},
                label={Text("Unterhaltungen durchsuchen")},singleLine=true,
                shape=RoundedCornerShape(18.dp))
            if(repo.serverChatLoading)LinearProgressIndicator(Modifier.fillMaxWidth())
            if(!server && "Privater Chat-Dienst" in repo.syncIssues) {
                Card(colors=CardDefaults.cardColors(containerColor=Color(0xFF2C3A2D))) {
                    Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                        Text("Chatliste aktuell nicht verfügbar",color=Color(0xFFFFE2AF),
                            fontWeight=FontWeight.SemiBold)
                        Text(repo.syncIssues["Privater Chat-Dienst"]
                            ?:"Der geschützte Chat-Dienst ist noch nicht erreichbar. Bitte erneut versuchen.",
                            color=MaterialTheme.colorScheme.onSurface,style=MaterialTheme.typography.bodySmall)
                        OutlinedButton(onClick=repo::loadServerChats) {
                            Text("Geschützten Chat-Abruf versuchen")
                        }
                    }
                }
            }
            LazyColumn(verticalArrangement=Arrangement.spacedBy(10.dp)) {
                items(visible,key={DocString(it["id"])}) {chat->
                    val last=DocString(chat["lastMessageAt"])
                    val read=(chat["readBy"] as? Map<*,*>)?.get(uid)?.toString().orEmpty()
                    val unread=last.isNotBlank()&&read.isNotBlank()&&last>read&&
                        DocString(chat["lastSenderUid"])!=uid
                    Surface(modifier=Modifier.fillMaxWidth(),color=OtherBubble,
                        shape=RoundedCornerShape(20.dp),
                        border=BorderStroke(1.dp,if(unread)Color(0xFF84CF9D)else Color(0xFF436353)),
                        onClick={
                            val id=DocString(chat["id"])
                            if(server)repo.openServerChat(id)
                        }) {
                        Row(Modifier.padding(16.dp),verticalAlignment=Alignment.CenterVertically) {
                            Box(Modifier.size(45.dp).background(MyBubble,RoundedCornerShape(15.dp)),
                                contentAlignment=Alignment.Center) {
                                Icon(Icons.Default.Forum,null,tint=MaterialTheme.colorScheme.onSurface)
                            }
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(4.dp)) {
                                Text(DocString(chat["requestTitle"]).ifBlank{"Unterhaltung"},
                                    color=MaterialTheme.colorScheme.onSurface,fontWeight=FontWeight.SemiBold,
                                    maxLines=1,overflow=TextOverflow.Ellipsis)
                                Text(DocString(chat["lastMessagePreview"]).ifBlank{"Noch keine Nachrichten"},
                                    color=ChatMuted,maxLines=2,style=MaterialTheme.typography.bodySmall)
                            }
                            if(unread)Box(Modifier.size(9.dp)
                                .background(Color(0xFF84CF9D),RoundedCornerShape(99.dp)))
                            Icon(Icons.Default.ChevronRight,null,tint=ChatMuted)
                        }
                    }
                }
                if(visible.isEmpty()&&!repo.serverChatLoading&&(repo.syncIssues.isEmpty()||server))item {
                    Text("Noch keine Nachrichten. Öffne ein Anliegen und tippe auf «Nachricht schreiben».",
                        color=ChatMuted,style=MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }

    if(confirmBlock)AlertDialog(onDismissRequest={confirmBlock=false},
        title={Text(if(blockedByMe)"Blockierung aufheben?" else "Person blockieren?")},
        text={Text(if(blockedByMe)"Danach können wieder Nachrichten gesendet werden."
            else "Beide Seiten können in diesem Chat keine neuen Nachrichten oder Bilder senden.")},
        confirmButton={TextButton(onClick={
            confirmBlock=false;repo.setServerChatBlocked(!blockedByMe)
        }){Text(if(blockedByMe)"Aufheben" else "Blockieren")}},
        dismissButton={TextButton(onClick={confirmBlock=false}){Text("Abbrechen")}})
    if(reportOpen)AlertDialog(onDismissRequest={reportOpen=false},
        title={Text("Privaten Chat melden")},
        text={Column(verticalArrangement=Arrangement.spacedBy(8.dp)) {
            listOf("harassment" to "Belästigung","spam" to "Spam",
                "fraud" to "Betrug","unsafe" to "Unsicherer Inhalt","other" to "Anderer Grund")
                .forEach {(value,label)->Row(verticalAlignment=Alignment.CenterVertically) {
                    RadioButton(reportReason==value,{reportReason=value});Text(label)
                }}
            OutlinedTextField(reportNote,{reportNote=it.take(500)},
                label={Text("Hinweis (optional)")},minLines=2,maxLines=4)
        }},
        confirmButton={Button(onClick={repo.reportServerChat(reportReason,reportNote){
            reportOpen=false;reportNote=""
        }},enabled=!repo.busy){Text("Sicher melden")}},
        dismissButton={TextButton(onClick={reportOpen=false}){Text("Abbrechen")}})
}

@Composable
private fun ChatMediaPreview(repo:QuartinautRepository,path:String) {
    var bitmap by remember(path){mutableStateOf<android.graphics.Bitmap?>(null)}
    var requested by remember(path){mutableStateOf(false)}
    var failed by remember(path){mutableStateOf(false)}
    when {
        bitmap!=null -> Image(bitmap!!.asImageBitmap(),"Privates Chatfoto",
            modifier=Modifier.fillMaxWidth().heightIn(max=260.dp),contentScale=ContentScale.Fit)
        failed -> Text("Foto konnte nicht geladen werden.",color=ChatMuted,
            style=MaterialTheme.typography.bodySmall)
        requested -> LinearProgressIndicator(Modifier.fillMaxWidth())
        else -> OutlinedButton(onClick={requested=true;repo.loadChatImage(path){image->
            bitmap=image;failed=image==null
        }}) {
            Icon(Icons.Default.Image,null);Spacer(Modifier.width(6.dp));Text("Privates Foto laden")
        }
    }
}