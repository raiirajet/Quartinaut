package ch.quartinaut.nativeapp

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Query
import com.google.firebase.functions.FirebaseFunctions
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.util.UUID

data class Region(val code: String, val name: String, val bfs: String, val municipalities: List<Municipality>)
data class Municipality(val bfs: String, val name: String)

val CANTON_CODES = listOf("ZH","BE","LU","UR","SZ","OW","NW","GL","ZG","FR","SO","BS","BL","SH","AR","AI","SG","GR","AG","TG","TI","VD","VS","NE","GE","JU")

fun DocumentSnapshot.str(key: String): String = getString(key) ?: ""
fun DocumentSnapshot.title(): String = str("title").ifBlank { str("requestTitle").ifBlank { "Eintrag" } }
fun DocString(any: Any?): String = any?.toString() ?: ""
fun isoNow(): String = Instant.now().toString()

class QuartinautRepository(context: Context) {
    private val firebase: FirebaseApp
    val auth: FirebaseAuth
    private val db: FirebaseFirestore
    private val functions: FirebaseFunctions
    private val subscriptions = mutableListOf<ListenerRegistration>()
    var user by mutableStateOf<FirebaseUser?>(null)
        private set
    var profile by mutableStateOf<Map<String, Any?>>(emptyMap())
        private set
    var busy by mutableStateOf(false)
        private set
    var message by mutableStateOf("")
        private set
    var requests by mutableStateOf<List<DocumentSnapshot>>(emptyList())
        private set
    var notices by mutableStateOf<List<DocumentSnapshot>>(emptyList())
        private set
    var alerts by mutableStateOf<List<DocumentSnapshot>>(emptyList())
        private set
    var chats by mutableStateOf<List<DocumentSnapshot>>(emptyList())
        private set
    var messages by mutableStateOf<List<DocumentSnapshot>>(emptyList())
        private set
    var hubItems by mutableStateOf<List<Map<String,Any?>>>(emptyList())
        private set
    var v50Items by mutableStateOf<List<Map<String,Any?>>>(emptyList())
        private set
    var regions by mutableStateOf<List<Region>>(emptyList())
        private set
    var chatId by mutableStateOf("")
        private set

    init {
        // The web config is a public Firebase project identifier, not a secret.
        // Register a dedicated Android app in Firebase before production distribution.
        val apps = FirebaseApp.getApps(context)
        firebase = apps.firstOrNull { it.name == FirebaseApp.DEFAULT_APP_NAME }
            ?: FirebaseApp.initializeApp(context, FirebaseOptions.Builder()
                .setApplicationId("1:815175119171:web:bf5ffa78acafeee2e23ff6")
                .setApiKey("AIzaSyCHjuUe-QYCMFrrHImL_XEaVo5ifDw9-DM")
                .setProjectId("quartinaut")
                .setStorageBucket("quartinaut.firebasestorage.app")
                .setGcmSenderId("815175119171").build())
        auth = FirebaseAuth.getInstance(firebase)
        db = FirebaseFirestore.getInstance(firebase)
        functions = FirebaseFunctions.getInstance(firebase, "us-central1")
        auth.addAuthStateListener {
            val next = it.currentUser
            if (user?.uid != next?.uid) {
                subscriptions.forEach { sub -> sub.remove() }
                subscriptions.clear()
                user = next
                profile = emptyMap()
                requests = emptyList(); alerts = emptyList(); notices = emptyList()
                chats = emptyList(); messages = emptyList()
                hubItems = emptyList(); v50Items = emptyList()
                chatId = ""
                if (next != null) loadProfile(next.uid)
            }
        }
        Thread {
            try {
                val conn = URL("https://quartinaut.web.app/assets/data/ch-locations-2026.json").openConnection() as HttpURLConnection
                conn.connectTimeout = 8000; conn.readTimeout = 8000
                val json = JSONObject(conn.inputStream.bufferedReader().use { it.readText() })
                val arr = json.getJSONArray("cantons")
                val r = mutableListOf<Region>()
                for (i in 0 until arr.length()) {
                    val c = arr.getJSONObject(i); val municipalities = mutableListOf<Municipality>()
                    val rows = c.getJSONArray("municipalities")
                    for (j in 0 until rows.length()) {
                        val m = rows.getJSONObject(j)
                        municipalities.add(Municipality(m.optString("bfsCode"),m.optString("name")))
                    }
                    r.add(Region(c.optString("code"), c.optString("name"),c.optString("bfsCode"),municipalities))
                }
                android.os.Handler(android.os.Looper.getMainLooper()).post { regions = r }
                conn.disconnect()
            } catch (e: Exception) {
                android.os.Handler(android.os.Looper.getMainLooper()).post {
                    message = "Gemeindeverzeichnis derzeit nicht erreichbar: " + e.localizedMessage
                }
            }
        }.start()
    }
    fun clearMessage() { message = "" }
    fun displayName(): String = DocString(profile["displayName"]).ifBlank { user?.email.orEmpty() }
    fun area(): String = DocString(profile["area"])
    fun canton(): String = DocString(profile["cantonCode"])
    fun areaKey(): String = DocString(profile["areaKey"])
    fun isAdmin(): Boolean = DocString(profile["role"]) == "admin"
    fun active(): Boolean = DocString(profile["accountStatus"]).ifBlank { "active" } == "active"
    private fun fail(e: Exception) { busy = false; message = e.localizedMessage ?: "Ein Fehler ist aufgetreten." }
    fun login(email: String, password: String) {
        if (email.isBlank() || password.isBlank()) { message = "E-Mail und Passwort eingeben."; return }
        busy = true
        auth.signInWithEmailAndPassword(email.trim(), password).addOnCompleteListener {
            busy = false
            if (!it.isSuccessful) message = it.exception?.localizedMessage ?: "Anmeldung fehlgeschlagen."
            else if (auth.currentUser?.isEmailVerified == false) message = "E-Mail bitte zuerst bestätigen."
        }
    }
    fun sendReset(email: String) {
        if (email.isBlank()) { message = "Bitte zuerst die E-Mail eingeben."; return }
        auth.sendPasswordResetEmail(email.trim()).addOnCompleteListener {
            message = if (it.isSuccessful) "Falls das Konto besteht, erhältst du eine E-Mail."
                else it.exception?.localizedMessage ?: "Passwort-Zurücksetzen fehlgeschlagen."
        }
    }
    fun resendVerification() {
        auth.currentUser?.sendEmailVerification()?.addOnCompleteListener {
            message = if (it.isSuccessful) "Bestätigungs-E-Mail verschickt."
                else it.exception?.localizedMessage ?: "Versand fehlgeschlagen."
        }
    }
    fun refreshUser() {
        auth.currentUser?.reload()?.addOnCompleteListener {
            if (it.isSuccessful) auth.currentUser?.uid?.let(::loadProfile)
            else message = it.exception?.localizedMessage ?: "Aktualisieren fehlgeschlagen."
        }
    }
    fun logout() { auth.signOut() }
    private fun loadProfile(uid: String) {
        subscriptions.add(db.collection("users").document(uid).addSnapshotListener { snapshot, err ->
            if (auth.currentUser?.uid != uid) return@addSnapshotListener
            if (err != null) { message = "Profil: " + err.localizedMessage; return@addSnapshotListener }
            if (snapshot == null || !snapshot.exists()) {
                message = "Ein vollständig registriertes Profil fehlt. Bitte schliesse die Registrierung in Quartinaut Web ab."
                return@addSnapshotListener
            }
            val wasEmpty = profile.isEmpty()
            profile = snapshot.data ?: emptyMap()
            if (wasEmpty && active()) startListening(uid)
        })
    }
    private fun observe(query: Query, onData: (List<DocumentSnapshot>) -> Unit) {
        subscriptions.add(query.limit(250).addSnapshotListener { snaps, e ->
            if (e != null) { message = e.localizedMessage ?: "Datenabfrage fehlgeschlagen."; return@addSnapshotListener }
            onData(snaps?.documents ?: emptyList())
        })
    }
    private fun startListening(uid: String) {
        val canton = canton(); val key = areaKey()
        if (!active() || (canton.isBlank() && !isAdmin())) return
        val req = db.collection("requests")
        if (isAdmin()) {
            observe(req.orderBy("createdAt", Query.Direction.DESCENDING)) { requests = it }
        } else {
            observe(req.whereEqualTo("cantonCode", canton).whereEqualTo("status", "offen")
                .orderBy("createdAt", Query.Direction.DESCENDING)) { publicItems ->
                requests = (requests.filter { doc -> doc.str("uid") == uid } + publicItems).distinctBy { doc -> doc.id }
            }
            observe(req.whereEqualTo("uid", uid).orderBy("createdAt", Query.Direction.DESCENDING)) { own ->
                requests = (requests.filter { doc -> doc.str("uid") != uid } + own).distinctBy { doc -> doc.id }
            }
        }
        observe(db.collection("alerts").orderBy("createdAt", Query.Direction.DESCENDING)) { alerts = it }
        if (isAdmin()) {
            observe(db.collection("officialNotices").orderBy("createdAt", Query.Direction.DESCENDING)) { notices = it }
        } else {
            observe(db.collection("officialNotices").whereEqualTo("cantonCode", canton)
                .whereEqualTo("status", "online").orderBy("createdAt", Query.Direction.DESCENDING)) { notices = it }
        }
        observe(db.collection("chats").whereArrayContains("participants", uid)
            .orderBy("lastMessageAt", Query.Direction.DESCENDING)) { chats = it }
        loadHub()
    }
    fun loadHub() {
        if (user == null || !active()) return
        functions.getHttpsCallable("quartinautHub").call(mapOf("action" to "list"))
            .addOnSuccessListener { result ->
                val raw = (result.data as? Map<*, *>)?.get("items") as? List<*> ?: emptyList<Any>()
                hubItems = raw.mapNotNull { item ->
                    (item as? Map<*, *>)?.entries?.associate { DocString(it.key) to it.value }
                }
            }.addOnFailureListener(::fail)
    }
    fun loadV50(action: String) {
        if (user == null || !active()) return
        v50Items = emptyList()
        functions.getHttpsCallable("quartinautV50").call(mapOf("action" to action))
            .addOnSuccessListener { result ->
                val raw = result.data as? Map<*, *>
                val items = (raw?.get("entries") ?: raw?.get("items")) as? List<*> ?: emptyList<Any>()
                v50Items = items.mapNotNull { (it as? Map<*, *>)?.entries?.associate { e ->
                    DocString(e.key) to e.value
                } }
            }.addOnFailureListener(::fail)
    }
    fun v50Action(action: String, data: Map<String, Any?>) {
        busy = true
        functions.getHttpsCallable("quartinautV50").call(data + ("action" to action))
            .addOnCompleteListener {
                busy = false
                if (!it.isSuccessful) message = it.exception?.localizedMessage ?: "Aktion fehlgeschlagen."
                else { message = "Aktion gespeichert."; val kind = action.substringBefore(".")
                    loadV50(when(kind) { "loan" -> "loan.list"; "market" -> "market.list"; "association" -> "association.list"; else -> "calendar.list" })
                }
            }
    }
    fun createRequest(title: String, description: String, category: String, kind: String, urgency: String) {
        val uid = user?.uid ?: return
        if (title.trim().length < 4 || description.trim().length < 5) {
            message = "Bitte Titel und Beschreibung ausfüllen."; return
        }
        val now = isoNow()
        val hours = when (urgency) { "Heute" -> 24L; "Morgen" -> 48L; "Diese Woche" -> 168L; else -> 336L }
        val id = "req_" + UUID.randomUUID().toString().replace("-", "")
        val status = if (isAdmin()) "offen" else "wartet_freigabe"
        val data = hashMapOf<String, Any>(
            "id" to id, "tenantId" to "quartinaut", "uid" to uid,
            "authorId" to uid, "type" to kind, "category" to category,
            "title" to title.trim(), "text" to description.trim(),
            "urgency" to urgency, "area" to area(), "areaKey" to areaKey(),
            "cantonCode" to canton(), "authorName" to displayName(),
            "author" to displayName().take(2).uppercase(),
            "authorRole" to "resident", "authorVerified" to (profile["verified"] == true),
            "authorAccountType" to DocString(profile["accountType"]).ifBlank { "resident" },
            "status" to status, "anonymousOffer" to false, "radiusKm" to 15,
            "createdAt" to now, "submittedAt" to now,
            "expiresAt" to Instant.now().plusSeconds(hours * 3600).toString(),
            "reports" to 0, "recurringMode" to "einmalig", "escalationLevel" to "keine")
        busy = true
        db.collection("requests").document(id).set(data).addOnCompleteListener {
            busy = false
            message = if (it.isSuccessful) "Eintrag gespeichert – " + (if (status=="offen") "veröffentlicht." else "wartet auf Freigabe.")
                else it.exception?.localizedMessage ?: "Speichern fehlgeschlagen."
        }
    }
    fun openChat(chat: DocumentSnapshot) {
        chatId = chat.id
        messages = emptyList()
        val uid = user?.uid ?: return
        observe(db.collection("chatMessages").whereEqualTo("chatId", chat.id)
            .orderBy("createdAt", Query.Direction.ASCENDING)) { docs ->
            messages = docs.filter { it.get("participants") is List<*> && (it.get("participants") as List<*>).contains(uid) }
        }
    }
    fun closeChat() { chatId = ""; messages = emptyList() }
    fun sendChat(text: String) {
        val uid = user?.uid ?: return
        val chat = chats.find { it.id == chatId } ?: return
        if (text.isBlank()) return
        val participants = (chat.get("participants") as? List<*>)?.map { DocString(it) } ?: return
        val recipient = participants.firstOrNull { it != uid } ?: return
        val id = "msg_" + UUID.randomUUID().toString().replace("-", "")
        val now = isoNow()
        val data = hashMapOf<String, Any>(
            "id" to id, "chatId" to chat.id, "requestId" to chat.str("requestId"),
            "requestTitle" to chat.str("requestTitle"), "requestOwnerUid" to chat.str("requestOwnerUid"),
            "senderUid" to uid, "recipientUid" to recipient,
            "participants" to participants, "participantLabels" to (chat.get("participantLabels") ?: emptyMap<String, String>()),
            "text" to text.trim().take(500), "createdAt" to now, "readAt" to "", "deliveryStatus" to "sent")
        db.collection("chatMessages").document(id).set(data).addOnCompleteListener {
            if (!it.isSuccessful) message = it.exception?.localizedMessage ?: "Nachricht fehlgeschlagen."
            else db.collection("chats").document(chat.id).update(mapOf("lastMessageAt" to now,
                "lastMessagePreview" to text.take(120), "lastSenderUid" to uid,
                "readBy." + uid to now))
        }
    }
}
