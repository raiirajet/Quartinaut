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
    private val feedSubscriptions = mutableListOf<ListenerRegistration>()
    private var verifiedAdminClaim by mutableStateOf(false)
    var syncIssues by mutableStateOf<Map<String,String>>(emptyMap())
        private set
    private var activeChatListener: ListenerRegistration? = null
    private val registrationPrefs = context.getSharedPreferences("quartinaut_native_pending", Context.MODE_PRIVATE)
    private var finishingRegistration = false
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
    // Optional authenticated Cloud Functions fallback for restrictive live
    // Firestore chat-list rules. It never changes security rules.
    var serverChats by mutableStateOf<List<Map<String,Any?>>>(emptyList())
        private set
    var serverMessages by mutableStateOf<List<Map<String,Any?>>>(emptyList())
        private set
    var serverChatReady by mutableStateOf(false)
        private set
    var serverChatLoading by mutableStateOf(false)
        private set
    var serverChatActive by mutableStateOf(false)
        private set
    var messages by mutableStateOf<List<DocumentSnapshot>>(emptyList())
        private set
    var hubItems by mutableStateOf<List<Map<String,Any?>>>(emptyList())
        private set
    var communitySettings by mutableStateOf<Map<String,Any?>>(emptyMap())
        private set
    var v50Items by mutableStateOf<List<Map<String,Any?>>>(emptyList())
        private set
    var regions by mutableStateOf<List<Region>>(emptyList())
        private set
    var cantonCounts by mutableStateOf<Map<String,Int>>(emptyMap())
        private set
    var chatId by mutableStateOf("")
        private set

    // Private personal dashboard photo is not a Firestore image field.
    // The callable returns image bytes only to the authenticated owner.
    var dashboardBackground by mutableStateOf<android.graphics.Bitmap?>(null)
        private set
    var dashboardBackgroundStatus by mutableStateOf("checking")
        private set
    var backgroundBusy by mutableStateOf(false)
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
        functions = FirebaseFunctions.getInstance(firebase, "europe-west6")
        auth.addAuthStateListener {
            val next = it.currentUser
            if (user?.uid != next?.uid) {
                subscriptions.forEach { sub -> sub.remove() }
                subscriptions.clear()
                feedSubscriptions.forEach { sub -> sub.remove() }
                feedSubscriptions.clear()
                verifiedAdminClaim = false
                syncIssues = emptyMap()
                activeChatListener?.remove()
                activeChatListener = null
                user = next
                profile = emptyMap()
                requests = emptyList(); alerts = emptyList(); notices = emptyList()
                chats = emptyList(); messages = emptyList()
                serverChats = emptyList(); serverMessages = emptyList()
                serverChatReady = false; serverChatLoading = false; serverChatActive = false
                hubItems = emptyList(); v50Items = emptyList()
                chatId = ""
                dashboardBackground = null
                dashboardBackgroundStatus = "checking"
                backgroundBusy = false
                if (next != null) {
                    loadProfile(next.uid)
                    // Force a fresh JWT so newly assigned server-side role claims
                    // match the active Firestore security rules after login.
                    next.getIdToken(true).addOnSuccessListener { token ->
                        if (user?.uid != next.uid) return@addOnSuccessListener
                        val claims=token.claims
                        val role=claims["role"] as? String ?: ""
                        val allowed=role!="area_admin" &&
                            (role=="admin" || claims["admin"] == true)
                        if (verifiedAdminClaim != allowed) {
                            verifiedAdminClaim=allowed
                            if(profile.isNotEmpty() && active()) startListening(next.uid)
                        }
                    }.addOnFailureListener { err ->
                        if(user?.uid==next.uid) {
                            syncIssues = syncIssues + ("Administratorrechte" to
                                (err.localizedMessage ?: "Token konnte nicht geprüft werden."))
                        }
                    }
                }
            }
        }
        Thread {
            try {
                val text = try {
                    // Packaged original BFS snapshot, usable without internet.
                    context.assets.open("q-original/ch-locations-2026.json")
                        .bufferedReader().use { it.readText() }
                } catch (_: Exception) {
                    val connection = URL("https://quartinaut.web.app/assets/data/ch-locations-2026.json")
                        .openConnection() as HttpURLConnection
                    connection.connectTimeout = 8000; connection.readTimeout = 8000
                    try { connection.inputStream.bufferedReader().use { it.readText() } }
                    finally { connection.disconnect() }
                }
                val json = JSONObject(text)
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
    // Security rules require Firebase Auth custom claims, not a self-reported profile role.
    fun isAdmin(): Boolean = verifiedAdminClaim
    fun active(): Boolean = DocString(profile["accountStatus"]).ifBlank { "active" } == "active"
    private fun fail(e: Exception) { busy = false; message = e.localizedMessage ?: "Ein Fehler ist aufgetreten." }
    fun registerResident(name: String, email: String, password: String,
                         passwordRepeat: String, region: Region?, municipality: Municipality?) {
        val display = name.trim()
        val address = email.trim().lowercase()
        if (display.length < 2 || !address.contains("@")) { message = "Bitte Name und gültige E-Mail eingeben."; return }
        if (password.length < 10 || password != passwordRepeat) {
            message = "Passwort mindestens 10 Zeichen und zweimal identisch eingeben."; return
        }
        if (region == null || municipality == null || municipality !in region.municipalities) {
            message = "Bitte Kanton und Gemeinde auswählen."; return
        }
        val record = JSONObject().put("name",display).put("email",address)
            .put("cantonCode",region.code).put("cantonBfs",region.bfs)
            .put("cantonName",region.name).put("municipalityBfs",municipality.bfs)
            .put("municipality",municipality.name).put("createdAt",System.currentTimeMillis())
        registrationPrefs.edit().putString("pending",record.toString()).apply()
        busy = true
        auth.createUserWithEmailAndPassword(address,password).addOnCompleteListener {
            busy = false
            if (it.isSuccessful) {
                it.result?.user?.sendEmailVerification()?.addOnCompleteListener { sent ->
                    message = if (sent.isSuccessful) "Bestätigungs-E-Mail verschickt."
                        else sent.exception?.localizedMessage ?: "Bestätigungslink konnte nicht gesendet werden."
                }
            } else {
                registrationPrefs.edit().remove("pending").apply()
                message = it.exception?.localizedMessage ?: "Registrierung fehlgeschlagen."
            }
        }
    }
    private fun finishPendingRegistration(uid: String) {
        if (finishingRegistration) return
        val pending = registrationPrefs.getString("pending",null) ?: return
        val record = try { JSONObject(pending) } catch (_: Exception) { return }
        if (record.optString("email") != auth.currentUser?.email?.lowercase()) return
        if (System.currentTimeMillis() - record.optLong("createdAt") > 12L * 3600 * 1000) return
        if (auth.currentUser?.isEmailVerified != true) return
        finishingRegistration = true
        val code = record.optString("cantonCode")
        val municipality = record.optString("municipality")
        val area = municipality + " (" + code + ")"
        val now = isoNow()
        val display = record.optString("name")
        val initials = display.split(" ").filter { it.isNotBlank() }.take(2)
            .joinToString("") { it.take(1).uppercase() }
        val location = mapOf(
            "cantonCode" to code, "cantonName" to record.optString("cantonName"),
            "cantonBfsCode" to record.optString("cantonBfs"),
            "municipalityBfsCode" to record.optString("municipalityBfs"),
            "municipalityName" to municipality)
        val data = mapOf<String,Any>(
            "uid" to uid, "email" to record.optString("email"),
            "displayName" to display, "initials" to initials,
            "area" to area, "areaKey" to area.trim().lowercase(),
            "cantonCode" to code, "location" to location,
            "role" to "resident", "accountType" to "resident", "accountStatus" to "active",
            "companyName" to "", "companyPurpose" to "", "companyStatus" to "none",
            "municipalityName" to "", "municipalityDepartment" to "", "municipalityWebsite" to "",
            "municipalityStatus" to "none", "adminScopeArea" to "",
            "verified" to false, "verificationStatus" to "none", "verificationLabel" to "",
            "titleVisible" to true, "titlePreset" to "auto",
            "titleGrants" to emptyList<String>(),
            "dashboard" to mapOf("version" to 2,"order" to emptyList<String>(),
                "hidden" to emptyList<String>(),"collapsed" to emptyList<String>()),
            "onboarding" to mapOf("version" to 0,"completed" to false,"skipped" to false,
                "checklist" to emptyMap<String,String>()),
            "locale" to "de", "notifications" to false, "passkeyReady" to false,
            "createdAt" to now, "updatedAt" to now, "lastLoginAt" to now
        )
        db.collection("users").document(uid).set(data).addOnCompleteListener {
            finishingRegistration = false
            if (it.isSuccessful) {
                registrationPrefs.edit().remove("pending").apply()
                val prefs = mapOf<String,Any>(
                    "uid" to uid, "tenantId" to "quartinaut", "enabled" to false,
                    "area" to area,"areaKey" to area.lowercase().replace(Regex("\\s+")," "),
                    "cantonCode" to code,"criticalAlerts" to true,
                    "alerts" to mapOf("enabled" to true,"severities" to listOf("warn","info")),
                    "officialNotices" to mapOf("enabled" to true,"priorities" to listOf("wichtig"),
                        "categories" to emptyList<String>()),
                    "bulletin" to mapOf("enabled" to false,"types" to emptyList<String>(),
                        "categories" to emptyList<String>()),
                    "chats" to mapOf("enabled" to true),"keywordRules" to emptyList<String>(),
                    "quietHours" to mapOf("enabled" to false,"start" to "22:00",
                        "end" to "07:00","timezone" to "Europe/Zurich"),
                    "createdAt" to now,"updatedAt" to now
                )
                db.collection("notificationPreferences").document(uid).set(prefs)
                    .addOnFailureListener { e ->
                        message = "Profil erstellt; Benachrichtigungseinstellungen: " + e.localizedMessage
                    }
                message = "Dein Quartinaut-Konto ist eingerichtet."
            } else message = it.exception?.localizedMessage ?: "Profil konnte nicht erstellt werden."
        }
    }
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
            if (it.isSuccessful) auth.currentUser?.uid?.let { uid ->
                if (auth.currentUser?.isEmailVerified == true) finishPendingRegistration(uid)
            }
            else message = it.exception?.localizedMessage ?: "Aktualisieren fehlgeschlagen."
        }
    }
    fun logout() { auth.signOut() }
    private fun loadProfile(uid: String) {
        subscriptions.add(db.collection("users").document(uid).addSnapshotListener { snapshot, err ->
            if (auth.currentUser?.uid != uid) return@addSnapshotListener
            if (err != null) { message = "Profil: " + err.localizedMessage; return@addSnapshotListener }
            if (snapshot == null || !snapshot.exists()) {
                if (auth.currentUser?.isEmailVerified == true) finishPendingRegistration(uid)
                return@addSnapshotListener
            }
            val wasEmpty = profile.isEmpty()
            profile = snapshot.data ?: emptyMap()
            if (wasEmpty && active()) {
                startListening(uid)
                loadDashboardBackground()
            }
        })
    }
    private fun observe(label: String, query: Query, onData: (List<DocumentSnapshot>) -> Unit) {
        feedSubscriptions.add(query.limit(250).addSnapshotListener { snaps, e ->
            // An inaccessible optional feed must not block the whole dashboard
            // with a generic PERMISSION_DENIED dialog.
            if (e != null) {
                syncIssues = syncIssues + (label to
                    (e.localizedMessage ?: "Zugriff verweigert."))
                android.util.Log.w("QuartinautSync", "Firestore feed: " + label, e)
                if (label == "Private Chats") {
                    loadServerChats()
                }
                return@addSnapshotListener
            }
            if(label in syncIssues) syncIssues = syncIssues - label
            if(label=="Private Chats") {
                serverChatReady=false; serverChats=emptyList()
            }
            onData(snaps?.documents ?: emptyList())
        })
    }
    private fun startListening(uid: String) {
        feedSubscriptions.forEach { sub -> sub.remove() }
        feedSubscriptions.clear()
        val canton = canton(); val key = areaKey()
        if (!active() || (canton.isBlank() && !isAdmin())) return
        feedSubscriptions.add(db.collection("publicStats").document("cantonRegistrations")
            .addSnapshotListener { snapshot, err ->
                if(err != null) {
                    syncIssues=syncIssues + ("Kantonsstatistik" to
                        (err.localizedMessage ?: "Nicht verfügbar"))
                } else if(snapshot != null) {
                    syncIssues=syncIssues - "Kantonsstatistik"
                    val counts = snapshot.get("cantonCounts") as? Map<*, *>
                    cantonCounts = counts?.entries?.associate { (key,value) ->
                        DocString(key).uppercase() to ((value as? Number)?.toInt() ?: 0)
                    } ?: emptyMap()
                }
            })
        val req = db.collection("requests")
        if (isAdmin()) {
            observe("Alle Anliegen (Admin)", req.orderBy("createdAt", Query.Direction.DESCENDING)) { requests = it }
        } else {
            observe("Öffentliche Anliegen", req.whereEqualTo("cantonCode", canton).whereEqualTo("status", "offen")
                .orderBy("createdAt", Query.Direction.DESCENDING)) { publicItems ->
                requests = (requests.filter { doc -> doc.str("uid") == uid } + publicItems).distinctBy { doc -> doc.id }
            }
            observe("Eigene Anliegen", req.whereEqualTo("uid", uid).orderBy("createdAt", Query.Direction.DESCENDING)) { own ->
                requests = (requests.filter { doc -> doc.str("uid") != uid } + own).distinctBy { doc -> doc.id }
            }
        }
        observe("Gemeinde-Alarme", db.collection("alerts").orderBy("createdAt", Query.Direction.DESCENDING)) { alerts = it }
        if (isAdmin()) {
            observe("Alle Mitteilungen (Admin)", db.collection("officialNotices").orderBy("createdAt", Query.Direction.DESCENDING)) { notices = it }
        } else {
            observe("Gemeindemitteilungen", db.collection("officialNotices").whereEqualTo("cantonCode", canton)
                .whereEqualTo("status", "online").orderBy("createdAt", Query.Direction.DESCENDING)) { notices = it }
        }
        observe("Private Chats", db.collection("chats").whereArrayContains("participants", uid)
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
            }.addOnFailureListener { e ->
                syncIssues = syncIssues + ("Quartier+" to
                    (e.localizedMessage ?: "Quartier+ nicht erreichbar"))
            }
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
    fun createRequest(title: String, description: String, category: String, kind: String,
                      urgency: String, onCreated: () -> Unit = {}) {
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
            if (it.isSuccessful) {
                message = "Eintrag gespeichert – " + (if (status == "offen") "veröffentlicht." else "wartet auf Freigabe.")
                onCreated()
            } else {
                message = it.exception?.localizedMessage ?: "Speichern fehlgeschlagen."
            }
        }
    }
    fun openRequestChat(request: DocumentSnapshot, onOpen: () -> Unit) {
        if(serverChatReady) {
            startServerRequestChat(request,onOpen)
            return
        }
        val current = user?.uid ?: return
        val owner = request.str("uid").ifBlank { request.str("authorId") }
        if (owner.isBlank() || owner == current) {
            message = "Für eigene Anliegen findest du Antworten unter deinen Chats."; return
        }
        val users = listOf(current, owner).sorted()
        fun safe(value: String) = value.replace(Regex("[^a-zA-Z0-9_-]"),"").take(80).ifBlank { "x" }
        val id = "chat_" + safe(request.id) + "_" + users.joinToString("_") { safe(it) }
        val ref = db.collection("chats").document(id)
        ref.get().addOnSuccessListener { existing ->
            if (existing.exists()) {
                openChat(existing);onOpen()
            } else {
                val now = isoNow()
                val payload = mapOf<String, Any>(
                    "id" to id, "requestId" to request.id, "requestTitle" to request.title(),
                    "requestOwnerUid" to owner, "participants" to users,
                    "participantLabels" to mapOf(current to displayName(), owner to
                        request.str("authorName").ifBlank { "Quartiermitglied" }),
                    "mutedBy" to emptyList<String>(), "readBy" to mapOf(current to now),
                    "createdAt" to now, "lastMessageAt" to now,
                    "lastMessagePreview" to "", "lastSenderUid" to ""
                )
                ref.set(payload).addOnSuccessListener {
                    ref.get().addOnSuccessListener { chat ->
                        openChat(chat); onOpen()
                    }.addOnFailureListener(::fail)
                }.addOnFailureListener(::fail)
            }
        }.addOnFailureListener(::fail)
    }
    fun openChat(chat: DocumentSnapshot) {
        serverChatActive=false
        activeChatListener?.remove()
        activeChatListener = null
        chatId = chat.id
        messages = emptyList()
        val uid = user?.uid ?: return
        val openedChatId = chat.id
        activeChatListener = db.collection("chatMessages")
            .whereEqualTo("chatId", openedChatId)
            .orderBy("createdAt", Query.Direction.ASCENDING)
            .limit(250)
            .addSnapshotListener { snapshots, error ->
                if(user?.uid != uid || chatId != openedChatId) return@addSnapshotListener
                if(error != null) {
                    message = error.localizedMessage ?: "Chatnachrichten konnten nicht geladen werden."
                    return@addSnapshotListener
                }
                messages = (snapshots?.documents ?: emptyList()).filter {
                    (it.get("participants") as? List<*>)?.contains(uid) == true
                }
            }
    }
    fun closeChat() {
        activeChatListener?.remove()
        activeChatListener = null
        chatId = ""
        messages = emptyList()
        serverMessages=emptyList()
        serverChatActive=false
    }
    fun sendChat(text: String, onSent: () -> Unit = {}) {
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
            else {
                onSent()
                db.collection("chats").document(chat.id).update(mapOf("lastMessageAt" to now,
                    "lastMessagePreview" to text.take(120), "lastSenderUid" to uid,
                    "readBy." + uid to now)).addOnFailureListener { e ->
                    message = "Nachricht gesendet, aber Vorschau konnte nicht synchronisiert werden: " +
                        (e.localizedMessage ?: "Netzwerkfehler")
                }
            }
        }
    }
    /**
     * Calls existing protected callable APIs. The Android client never writes
     * to protected community Firestore collections directly.
     */
    fun communityAction(
        action: String, values: Map<String, Any?> = emptyMap(),
        refreshOnSuccess: Boolean = true,
        success: ((Map<String, Any?>) -> Unit)? = null
    ) {
        if (user == null || !active()) return
        busy = true
        functions.getHttpsCallable("quartinautHub").call(values + ("action" to action))
            .addOnCompleteListener { task ->
                busy = false
                if (!task.isSuccessful) {
                    message = task.exception?.localizedMessage ?: "Quartier+-Aktion fehlgeschlagen."
                } else {
                    val result = task.result?.data as? Map<*, *> ?: emptyMap<String,Any?>()
                    val map = result.entries.associate { DocString(it.key) to it.value }
                    if(refreshOnSuccess) loadHub()
                    success?.invoke(map)
                }
            }
    }

    fun createCommunityItem(item: Map<String,Any?>, completed: () -> Unit,
                            operationId: String = "android_" + UUID.randomUUID().toString().replace("-","")) {
        communityAction("create",mapOf("item" to item,
            "opId" to operationId),
            refreshOnSuccess=true) { response ->
            message = if(DocString(response["status"])=="published")
                "Quartier+-Beitrag veröffentlicht."
                else "Beitrag eingereicht. Freigabe steht noch aus."
            completed()
        }
    }

    fun reactionAction(action: String, kind: String, id: String,
                       values: Map<String,Any?> = emptyMap(),
                       success: ((Map<String,Any?>) -> Unit)? = null) {
        busy = true
        functions.getHttpsCallable("quartinautSocial")
            .call(values + mapOf("action" to action,"kind" to kind,"id" to id))
            .addOnCompleteListener { task ->
                busy = false
                if (!task.isSuccessful) message = task.exception?.localizedMessage
                    ?: "Kommentar oder Reaktion konnte nicht geladen werden."
                else {
                    val entries = (task.result?.data as? Map<*, *>)?.entries ?: emptySet()
                    success?.invoke(entries.associate { DocString(it.key) to it.value })
                }
            }
    }

    fun readProtectedPhoto(path: String, onResult: (android.graphics.Bitmap?) -> Unit) {
        if (user == null || path.isBlank() ||
            !path.matches(Regex("^post-photos/(requests|community|groups)/[^/]+/[^/]+/[0-2]\\.jpg$"))) {
            onResult(null)
            return
        }
        functions.getHttpsCallable("quartinautPhoto")
            .call(mapOf("action" to "read", "path" to path))
            .addOnCompleteListener { task ->
                if (!task.isSuccessful) {
                    // No direct Firebase Storage URL: protected images need the callable.
                    onResult(null)
                    return@addOnCompleteListener
                }
                val raw = (task.result?.data as? Map<*, *>)?.get("base64") as? String
                if (raw == null) { onResult(null); return@addOnCompleteListener }
                val bmp = runCatching {
                    val bytes = android.util.Base64.decode(raw,android.util.Base64.DEFAULT)
                    android.graphics.BitmapFactory.decodeByteArray(bytes,0,bytes.size)
                }.getOrNull()
                onResult(bmp)
            }
    }

    fun loadCommunitySettings() {
        if(user==null) return
        functions.getHttpsCallable("quartinautHub")
            .call(mapOf("action" to "settings.get"))
            .addOnSuccessListener { result ->
                val data=(result.data as? Map<*, *>)?.get("settings") as? Map<*, *>
                communitySettings=data?.entries?.associate { DocString(it.key) to it.value } ?: emptyMap()
            }.addOnFailureListener { e ->
                syncIssues = syncIssues + ("Startseiteneinstellungen" to
                    (e.localizedMessage ?: "Einstellungen nicht verfügbar"))
            }
    }
    fun saveCommunitySettings(preferences: Map<String,Any?>) {
        communityAction("settings.save",mapOf("settings" to preferences),false) {
            communitySettings=preferences
            message="Deine Einstellungen wurden gespeichert."
        }
    }


    /**
     * The new callable is separately deployable. When not yet deployed,
     * mark it unavailable rather than claiming that an image was uploaded.
     * Never use an unrestricted public Storage URL.
     */
    fun loadDashboardBackground() {
        val uid = user?.uid ?: return
        if (!active() || backgroundBusy) return
        backgroundBusy = true
        functions.getHttpsCallable("quartinautAppearance")
            .call(mapOf("action" to "get"))
            .addOnCompleteListener { task ->
                if (user?.uid != uid) return@addOnCompleteListener
                backgroundBusy = false
                if (!task.isSuccessful) {
                    val e = task.exception
                    dashboardBackgroundStatus = if (
                        e is com.google.firebase.functions.FirebaseFunctionsException &&
                        e.code == com.google.firebase.functions.FirebaseFunctionsException.Code.NOT_FOUND
                    ) "unavailable" else "error"
                    return@addOnCompleteListener
                }
                val data = task.result?.data as? Map<*, *>
                val encoded = data?.get("base64") as? String
                dashboardBackground = if (encoded.isNullOrBlank()) null else runCatching {
                    val bytes = android.util.Base64.decode(encoded,android.util.Base64.DEFAULT)
                    android.graphics.BitmapFactory.decodeByteArray(bytes,0,bytes.size)
                }.getOrNull()
                dashboardBackgroundStatus = "ready"
            }
    }

    fun saveDashboardBackground(base64: String) {
        val uid = user?.uid ?: return
        if (!active() || backgroundBusy || dashboardBackgroundStatus != "ready") return
        backgroundBusy = true
        functions.getHttpsCallable("quartinautAppearance")
            .call(mapOf("action" to "save","base64" to base64))
            .addOnCompleteListener { task ->
                if (user?.uid != uid) return@addOnCompleteListener
                backgroundBusy = false
                if (task.isSuccessful) {
                    message = "Hintergrund serverseitig gespeichert."
                    loadDashboardBackground()
                } else {
                    message = task.exception?.localizedMessage
                        ?: "Das Hintergrundbild konnte nicht gespeichert werden."
                }
            }
    }

    fun removeDashboardBackground() {
        val uid = user?.uid ?: return
        if (!active() || backgroundBusy || dashboardBackground == null) return
        backgroundBusy = true
        functions.getHttpsCallable("quartinautAppearance")
            .call(mapOf("action" to "remove"))
            .addOnCompleteListener { task ->
                if (user?.uid != uid) return@addOnCompleteListener
                backgroundBusy = false
                if (task.isSuccessful) {
                    dashboardBackground = null
                    dashboardBackgroundStatus = "ready"
                    message = "Hintergrund vom Server entfernt."
                } else {
                    message = task.exception?.localizedMessage
                        ?: "Der Hintergrund konnte nicht gelöscht werden."
                }
            }
    }

    fun saveDashboardLayout(quick:List<String>,priority:List<String>) {
        val uid=user?.uid ?: return
        val available=setOf("need","offer","market","group","loans","calendar",
            "events","bulletin","inbox","chats","saved","map","swissmap")
        val allowedPriority=setOf("inbox","events","loans","bulletin","saved","map")
        if(quick.size !in 2..8 || quick.any { it !in available } ||
           quick.size!=quick.distinct().size ||
           priority.size!=6 || priority.toSet()!=allowedPriority) {
            message="Ungültige Dashboard-Auswahl."
            return
        }
        busy=true
        db.collection("users").document(uid).update(mapOf(
            "dashboard.quickLinks" to quick,
            "dashboard.priorityOrder" to priority
        )).addOnCompleteListener { task ->
            if(user?.uid!=uid)return@addOnCompleteListener
            busy=false
            if(task.isSuccessful)message="Deine Startseite wurde gespeichert."
            else message="Dashboard: "+(task.exception?.localizedMessage ?: "Speichern nicht möglich")
        }
    }

    fun retryFeeds() {
        val current=user ?: return
        if(profile.isEmpty() || !active())return
        syncIssues=emptyMap()
        current.getIdToken(true).addOnCompleteListener { task ->
            if(user?.uid!=current.uid)return@addOnCompleteListener
            if(task.isSuccessful) {
                val claims=task.result.claims
                val role=claims["role"] as? String ?: ""
                verifiedAdminClaim=role!="area_admin" &&
                    (role=="admin" || claims["admin"]==true)
                startListening(current.uid)
                loadCommunitySettings()
            } else {
                syncIssues=syncIssues + ("Administratorrechte" to
                    (task.exception?.localizedMessage ?: "Token konnte nicht aktualisiert werden"))
                // Public, non-admin feeds can still be retried.
                verifiedAdminClaim=false
                startListening(current.uid)
            }
        }
    }

    private fun asPlainMaps(raw: Any?): List<Map<String,Any?>> {
        return (raw as? List<*>)?.mapNotNull { value ->
            (value as? Map<*, *>)?.entries?.associate { DocString(it.key) to it.value }
        } ?: emptyList()
    }
    private fun chatApiUnavailable(error: Exception?): Boolean {
        return error is com.google.firebase.functions.FirebaseFunctionsException &&
            (error.code == com.google.firebase.functions.FirebaseFunctionsException.Code.NOT_FOUND ||
             error.code == com.google.firebase.functions.FirebaseFunctionsException.Code.UNIMPLEMENTED)
    }
    /** Only the server can read every user's chat list; responses are UID-scoped. */
    fun loadServerChats() {
        val uid=user?.uid ?:return
        if(serverChatLoading || !active())return
        serverChatLoading=true
        functions.getHttpsCallable("quartinautPrivateChats")
            .call(mapOf("action" to "list"))
            .addOnCompleteListener { result ->
                if(user?.uid!=uid)return@addOnCompleteListener
                serverChatLoading=false
                if(result.isSuccessful) {
                    val payload=result.result?.data as? Map<*,*>
                    serverChats=asPlainMaps(payload?.get("chats"))
                    serverChatReady=true
                    syncIssues=syncIssues-"Private Chats"
                    syncIssues=syncIssues-"Privater Chat-Dienst"
                } else {
                    serverChatReady=false
                    val explanation=if(chatApiUnavailable(result.exception))
                        "Der geschützte Chat-Dienst ist noch nicht auf Firebase veröffentlicht."
                    else result.exception?.localizedMessage
                        ?: "Chat-Dienst nicht erreichbar."
                    syncIssues=syncIssues + ("Privater Chat-Dienst" to explanation)
                }
            }
    }
    fun openServerChat(id:String) {
        if(!serverChatReady)return
        activeChatListener?.remove();activeChatListener=null
        chatId=id;messages=emptyList();serverMessages=emptyList()
        serverChatActive=true
        refreshServerMessages()
    }
    fun refreshServerMessages() {
        val uid=user?.uid ?: return
        val requestedChat=chatId
        if(!serverChatActive || requestedChat.isBlank())return
        functions.getHttpsCallable("quartinautPrivateChats")
            .call(mapOf("action" to "messages","chatId" to requestedChat))
            .addOnCompleteListener { task ->
                if(user?.uid!=uid||chatId!=requestedChat)return@addOnCompleteListener
                if(task.isSuccessful) {
                    serverMessages=asPlainMaps((task.result?.data as? Map<*,*>)?.get("messages"))
                    syncIssues=syncIssues-"Chatnachrichten"
                } else {
                    syncIssues=syncIssues + ("Chatnachrichten" to
                        (task.exception?.localizedMessage ?: "Nachrichten nicht erreichbar."))
                }
            }
    }
    fun sendServerChat(text:String,onSent:()->Unit) {
        val uid=user?.uid ?:return
        val requestedChat=chatId
        if(!serverChatActive || requestedChat.isBlank()||text.trim().isBlank())return
        busy=true
        functions.getHttpsCallable("quartinautPrivateChats").call(mapOf(
            "action" to "send","chatId" to requestedChat,
            "text" to text.trim().take(500),
            "operationId" to UUID.randomUUID().toString().replace("-","")
        )).addOnCompleteListener { task ->
            if(user?.uid!=uid)return@addOnCompleteListener
            busy=false
            if(task.isSuccessful) {
                onSent()
                refreshServerMessages()
                loadServerChats()
            } else {
                message=task.exception?.localizedMessage ?: "Nachricht konnte nicht gesendet werden."
            }
        }
    }
    fun startServerRequestChat(request:DocumentSnapshot,onOpen:()->Unit) {
        val uid=user?.uid ?:return
        busy=true
        functions.getHttpsCallable("quartinautPrivateChats").call(mapOf(
            "action" to "start","requestId" to request.id
        )).addOnCompleteListener { result ->
            if(user?.uid!=uid)return@addOnCompleteListener
            busy=false
            if(result.isSuccessful) {
                val chat=(result.result?.data as? Map<*,*>)?.get("chat") as? Map<*,*>
                val id=DocString(chat?.get("id"))
                if(id.isNotBlank()) {
                    openServerChat(id)
                    onOpen()
                    loadServerChats()
                }
            } else {
                message=result.exception?.localizedMessage ?: "Chat konnte nicht eröffnet werden."
            }
        }
    }

}
