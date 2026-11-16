package ch.quartinaut.nativeapp

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.Source
import com.google.android.gms.tasks.Tasks
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.storage.FirebaseStorage
import com.google.firebase.storage.StorageMetadata
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
    private val appContext = context.applicationContext
    private val firebase: FirebaseApp
    val auth: FirebaseAuth
    private val db: FirebaseFirestore
    private val functions: FirebaseFunctions
    private val storage: FirebaseStorage
    private val subscriptions = mutableListOf<ListenerRegistration>()
    private val feedSubscriptions = mutableListOf<ListenerRegistration>()
    private var verifiedAdminClaim by mutableStateOf(false)
    var syncIssues by mutableStateOf<Map<String,String>>(emptyMap())
        private set
    private var activeChatListener: ListenerRegistration? = null
    private val registrationPrefs = context.getSharedPreferences("quartinaut_native_pending", Context.MODE_PRIVATE)
    private val offlinePrefs=context.getSharedPreferences("quartinaut_public_cache",Context.MODE_PRIVATE)
    var offlineHubItems by mutableStateOf<List<Map<String,Any?>>>(emptyList())
        private set
    var offlineCacheDate by mutableStateOf("")
        private set
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
    var chatMediaLoading by mutableStateOf(false)
        private set
    var messages by mutableStateOf<List<DocumentSnapshot>>(emptyList())
        private set
    var hubItems by mutableStateOf<List<Map<String,Any?>>>(emptyList())
        private set
    var enhancedItems by mutableStateOf<List<Map<String,Any?>>>(emptyList())
        private set
    var myPostsItems by mutableStateOf<List<Map<String,Any?>>>(emptyList())
        private set
    var myPostsLoaded by mutableStateOf(false)
        private set
    var myPostsLoading by mutableStateOf(false)
        private set
    var myPostsBusyIds by mutableStateOf<Set<String>>(emptySet())
        private set
    private var myPostsRequestSequence=0L
    private var scopedRequestSequence=0L
    var hasAudienceLocation by mutableStateOf(false)
        private set
    var enhancementLoading by mutableStateOf(false)
        private set
    var enhancementError by mutableStateOf("")
        private set
    var enhancementReady by mutableStateOf(false)
        private set
    var communitySettings by mutableStateOf<Map<String,Any?>>(emptyMap())
        private set
    var v50Items by mutableStateOf<List<Map<String,Any?>>>(emptyList())
        private set
    var v50Error by mutableStateOf("")
        private set
    var v50Loading by mutableStateOf(false)
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
        // QuartinautApplication initializes the dedicated Android Firebase app
        // from app/google-services.json before repositories use any SDK.
        firebase = FirebaseApp.getInstance()
        auth = FirebaseAuth.getInstance(firebase)
        db = FirebaseFirestore.getInstance(firebase)
        functions = FirebaseFunctions.getInstance(firebase, "europe-west6")
        storage = FirebaseStorage.getInstance(firebase)
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
                hubItems = emptyList(); v50Items = emptyList(); v50Error = ""; v50Loading=false
                offlineHubItems=emptyList();offlineCacheDate=""
                enhancedItems=emptyList();enhancementLoading=false;enhancementError="";enhancementReady=false
                myPostsItems=emptyList();myPostsLoaded=false;myPostsLoading=false
                myPostsBusyIds=emptySet();myPostsRequestSequence++
                hasAudienceLocation=false;scopedRequestSequence++
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
    fun showMessage(text:String) { message=text }

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
    fun logout() {
        PushTokenRegistrar.deactivate(appContext) { auth.signOut() }
    }

    fun enablePush() {
        busy = true
        PushTokenRegistrar.sync(appContext) { result ->
            busy = false
            message = result.fold(
                onSuccess = { "Android-Pushmeldungen sind auf diesem Gerät aktiviert." },
                onFailure = { it.localizedMessage ?: "Pushregistrierung fehlgeschlagen." }
            )
        }
    }
    private fun loadProfile(uid: String) {
        subscriptions.add(db.collection("users").document(uid).addSnapshotListener { snapshot, err ->
            if (auth.currentUser?.uid != uid) return@addSnapshotListener
            if (err != null) { message = "Profil: " + err.localizedMessage; return@addSnapshotListener }
            if (snapshot == null || !snapshot.exists()) {
                if (auth.currentUser?.isEmailVerified == true) finishPendingRegistration(uid)
                return@addSnapshotListener
            }
            val wasEmpty = profile.isEmpty()
            val scopeChanged=!wasEmpty && (profile["areaKey"]!=snapshot.get("areaKey") ||
                profile["cantonCode"]!=snapshot.get("cantonCode"))
            profile = snapshot.data ?: emptyMap()
            if(scopeChanged) {
                requests=requests.filterNot {it.id.startsWith("arq_")}
                hasAudienceLocation=false;scopedRequestSequence++
                if(active())startListening(uid)
            }
            if (wasEmpty && active()) {
                PushTokenRegistrar.sync(appContext)
                restorePublicCache(uid)
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
                return@addSnapshotListener
            }
            if(label in syncIssues) syncIssues = syncIssues - label
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
            observe("Alle Anliegen (Admin)", req.orderBy("createdAt", Query.Direction.DESCENDING)) {
                requests = (requests.filter { doc -> doc.id.startsWith("arq_") } + it).distinctBy { doc -> doc.id }
            }
        } else {
            observe("Öffentliche Anliegen", req.whereEqualTo("cantonCode", canton).whereEqualTo("status", "offen")
                .orderBy("createdAt", Query.Direction.DESCENDING)) { publicItems ->
                requests = (requests.filter { doc -> doc.id.startsWith("arq_") || doc.str("uid") == uid } + publicItems).distinctBy { doc -> doc.id }
            }
            observe("Eigene Anliegen", req.whereEqualTo("uid", uid).orderBy("createdAt", Query.Direction.DESCENDING)) { own ->
                requests = (requests.filter { doc -> doc.id.startsWith("arq_") || doc.str("uid") != uid } + own).distinctBy { doc -> doc.id }
            }
        }
        observe("Gemeinde-Alarme", db.collection("alerts").orderBy("createdAt", Query.Direction.DESCENDING)) { alerts = it }
        if (isAdmin()) {
            observe("Alle Mitteilungen (Admin)", db.collection("officialNotices").orderBy("createdAt", Query.Direction.DESCENDING)) { notices = it }
        } else {
            observe("Gemeindemitteilungen", db.collection("officialNotices").whereEqualTo("cantonCode", canton)
                .whereEqualTo("status", "online").orderBy("createdAt", Query.Direction.DESCENDING)) { notices = it }
        }
        // Chat metadata is fetched through quartinautPrivateChats, not via a
        // direct Firestore list query blocked by the production security rules.
        loadServerChats()
        loadScopedRequests()
        loadHub()
    }
    fun loadScopedRequests() {
        val uid=user?.uid ?:return
        if(!active())return
        val ticket=++scopedRequestSequence
        functions.getHttpsCallable("quartinautAudience").call(mapOf("action" to "feed"))
            .addOnCompleteListener { task ->
                if(user?.uid!=uid||ticket!=scopedRequestSequence)return@addOnCompleteListener
                if(!task.isSuccessful) {
                    syncIssues=syncIssues+("Regionale Anliegen" to callableDiagnostic(task.exception,"Regionale Anliegen nicht erreichbar."))
                    return@addOnCompleteListener
                }
                val data=task.result.data as? Map<*,*> ?:emptyMap<String,Any?>()
                hasAudienceLocation=data["hasLocation"]==true
                val ids=(data["ids"] as? List<*>)?.filterIsInstance<String>()
                    ?.filter {it.matches(Regex("arq_[a-f0-9]{32}"))}?.take(200) ?:emptyList()
                val reads=ids.map { id -> db.collection("quartinautAudienceFeeds").document(uid)
                    .collection("items").document(id).get(Source.SERVER) }
                Tasks.whenAllSuccess<DocumentSnapshot>(reads).addOnCompleteListener { loaded ->
                    if(user?.uid!=uid||ticket!=scopedRequestSequence)return@addOnCompleteListener
                    if(loaded.isSuccessful) {
                        requests=(requests.filterNot {it.id.startsWith("arq_")}+
                            loaded.result.filter {it.exists()}).distinctBy {it.id}
                        syncIssues=syncIssues-"Regionale Anliegen"
                    } else syncIssues=syncIssues+("Regionale Anliegen" to
                        callableDiagnostic(loaded.exception,"Regionale Anliegen konnten nicht geladen werden."))
                }
            }
    }
    fun setAudienceLocation(latitude:Double,longitude:Double) {
        val uid=user?.uid ?:return
        functions.getHttpsCallable("quartinautAudience").call(mapOf(
            "action" to "location.set","center" to mapOf("lat" to latitude,"lng" to longitude)
        )).addOnCompleteListener { task ->
            if(user?.uid!=uid)return@addOnCompleteListener
            if(task.isSuccessful) {hasAudienceLocation=true;loadScopedRequests()}
            else showMessage(callableDiagnostic(task.exception,"Der Umkreis-Standort konnte nicht gespeichert werden."))
        }
    }
    fun moderateScopedRequest(id:String,approve:Boolean) {
        if(busy)return
        busy=true
        functions.getHttpsCallable("quartinautAudience").call(mapOf(
            "action" to if(approve) "approve" else "reject","id" to id
        )).addOnCompleteListener { task ->
            busy=false
            if(task.isSuccessful) {message="Anliegen geprüft.";loadScopedRequests()}
            else message=callableDiagnostic(task.exception,"Anliegen konnte nicht geprüft werden.")
        }
    }
    fun loadHub() {
        if (user == null || !active()) return
        val startMs=android.os.SystemClock.elapsedRealtime()
        functions.getHttpsCallable("quartinautHub").call(mapOf("action" to "list"))
            .addOnSuccessListener { result ->
                val raw = (result.data as? Map<*, *>)?.get("items") as? List<*> ?: emptyList<Any>()
                hubItems = raw.mapNotNull { item ->
                    (item as? Map<*, *>)?.entries?.associate { DocString(it.key) to it.value }
                }
                cachePublicHubItems()
                NativePerformanceMetrics.record(appContext,"hub",
                    android.os.SystemClock.elapsedRealtime()-startMs,true)
                syncIssues=syncIssues-"Quartier+"
            }.addOnFailureListener { e ->
                NativePerformanceMetrics.record(appContext,"hub",
                    android.os.SystemClock.elapsedRealtime()-startMs,false)
                syncIssues = syncIssues + ("Quartier+" to
                    (e.localizedMessage ?: "Quartier+ nicht erreichbar"))
            }
    }
    fun loadV50(action: String) {
        if (user == null || !active()) return
        val startedMs=android.os.SystemClock.elapsedRealtime()
        v50Items = emptyList()
        v50Error = ""
        v50Loading = true
        functions.getHttpsCallable("quartinautV50").call(mapOf("action" to action))
            .addOnSuccessListener { result ->
                NativePerformanceMetrics.record(appContext,"bookings",
                    android.os.SystemClock.elapsedRealtime()-startedMs,true)
                v50Loading=false
                val raw = result.data as? Map<*, *>
                val items = (raw?.get("entries") ?: raw?.get("items")) as? List<*> ?: emptyList<Any>()
                v50Items = items.mapNotNull { (it as? Map<*, *>)?.entries?.associate { e ->
                    DocString(e.key) to e.value
                } }
            }.addOnFailureListener { e ->
                NativePerformanceMetrics.record(appContext,"bookings",
                    android.os.SystemClock.elapsedRealtime()-startedMs,false)
                v50Loading=false
                v50Error = callableDiagnostic(e, "Der Buchungsdienst konnte nicht geladen werden.")
                syncIssues = syncIssues + ("Ausleih-/Reservationsdienst" to v50Error)
            }
    }
    fun v50Action(action: String, data: Map<String, Any?>, onSuccess: () -> Unit = {}) {
        if(busy)return
        busy = true
        v50Error = ""
        functions.getHttpsCallable("quartinautV50").call(data + ("action" to action))
            .addOnCompleteListener {
                busy = false
                if (!it.isSuccessful) {
                    v50Error = callableDiagnostic(it.exception, "Aktion fehlgeschlagen.")
                    message = "Die Buchung wurde nicht gespeichert: " + v50Error
                    syncIssues = syncIssues + ("Ausleih-/Reservationsdienst" to v50Error)
                } else {
                    message = if(action=="loan.request")
                        "Ausleihanfrage gesendet. Die andere Person muss sie bestätigen."
                    else "Aktion gespeichert."
                    syncIssues=syncIssues-"Ausleih-/Reservationsdienst"
                    val kind = action.substringBefore(".")
                    loadV50(when(kind) { "loan" -> "loan.list"; "market" -> "market.list"; "association" -> "association.list"; else -> "calendar.list" })
                    onSuccess()
                }
            }
    }
    fun createRequest(title: String, description: String, category: String, kind: String,
                      urgency: String, onCreated: () -> Unit = {},
                      photoPaths: List<String> = emptyList(),
                      operationId: String = "",
                      audienceLevel: String = "canton",
                      audienceRadiusKm: Int = 10,
                      audienceLatitude: Double? = null,
                      audienceLongitude: Double? = null) {
        val uid = user?.uid ?: return
        if(!canPublishAudience(audienceLevel,audienceRadiusKm,audienceLatitude,audienceLongitude,REQUEST_AUDIENCE_BACKEND_READY)) {
            message="Bitte Reichweite und Umkreis-Standort prüfen."; return
        }
        if (title.trim().length < 4 || description.trim().length < 5) {
            message = "Bitte Titel und Beschreibung ausfüllen."; return
        }
        val now = isoNow()
        val hours = when (urgency) { "Heute" -> 24L; "Morgen" -> 48L; "Diese Woche" -> 168L; else -> 336L }
        val id = operationId.takeIf {it.matches(Regex("req_[0-9a-f]{32}"))}
            ?: "req_" + UUID.randomUUID().toString().replace("-", "")
        if(audienceLevel!="canton") {
            busy=true
            functions.getHttpsCallable("quartinautAudience").call(mapOf(
                "action" to "create","opId" to id,
                "item" to mapOf("title" to title.trim(),"text" to description.trim(),
                    "category" to category,"type" to kind,"urgency" to urgency,
                    "audienceLevel" to audienceLevel,"radiusKm" to audienceRadiusKm,
                    "center" to if(audienceLevel=="radius")mapOf("lat" to audienceLatitude,"lng" to audienceLongitude) else null,
                    "photoPaths" to photoPaths)
            )).addOnCompleteListener { task ->
                if(user?.uid!=uid)return@addOnCompleteListener
                busy=false
                if(task.isSuccessful) {
                    val status=(task.result.data as? Map<*,*>)?.get("status")
                    message=if(status=="offen") "Eintrag gespeichert – veröffentlicht." else "Eintrag gespeichert – wartet auf Freigabe."
                    loadScopedRequests();onCreated()
                } else message=callableDiagnostic(task.exception,"Anliegen konnte nicht gespeichert werden.")
            }
            return
        }
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
            "status" to status, "anonymousOffer" to false,
            "audienceLevel" to audienceLevel,
            "radiusKm" to (if(audienceLevel=="radius") audienceRadiusKm else 15),
            "createdAt" to now, "submittedAt" to now,
            "expiresAt" to Instant.now().plusSeconds(hours * 3600).toString(),
            "reports" to 0, "recurringMode" to "einmalig", "escalationLevel" to "keine",
            "photoPaths" to photoPaths)
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
        // Never fall back to direct client-side chat creation: that bypasses
        // the server's validation path and triggers production permission errors.
        startServerRequestChat(request,onOpen)
    }
    fun closeChat() {
        activeChatListener?.remove()
        activeChatListener = null
        chatId = ""
        messages = emptyList()
        serverMessages=emptyList()
        serverChatActive=false
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

    /**
     * Social actions have their own completion callback and do not occupy
     * the app-wide busy state. Different likes, lists and drafts must not
     * inadvertently block unrelated screens.
     */
    fun reactionAction(action: String, kind: String, id: String,
                       values: Map<String,Any?> = emptyMap(),
                       success: ((Map<String,Any?>) -> Unit)? = null,
                       failure: ((String) -> Unit)? = null) {
        if(user==null || !active()) {
            failure?.invoke("Bitte anmelden, um zu reagieren.")
            return
        }
        val scoped=id.startsWith("arq_")&&kind=="request"
        functions.getHttpsCallable(if(scoped) "quartinautAudience" else "quartinautSocial")
            .call(values + mapOf("action" to if(scoped) "social.$action" else action,"kind" to kind,"id" to id,
                "opId" to UUID.randomUUID().toString()))
            .addOnCompleteListener { task ->
                if(!task.isSuccessful) {
                    val error=task.exception?.localizedMessage
                        ?: "Kommentar oder Reaktion konnte nicht geladen werden."
                    message=error
                    failure?.invoke(error)
                } else {
                    val entries=(task.result?.data as? Map<*, *>)?.entries ?: emptySet()
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
        val scopedPhoto=requests.any { it.id.startsWith("arq_") &&
            (it.get("photoPaths") as? List<*>)?.contains(path)==true }
        functions.getHttpsCallable(if(scopedPhoto) "quartinautAudience" else "quartinautPhoto")
            .call(mapOf("action" to if(scopedPhoto) "photo.read" else "read", "path" to path))
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
        // Do not erase unresolved errors before the corresponding service succeeds.
        val retryEnhancements=("Erweiterungen" in syncIssues || enhancementError.isNotBlank())
        current.getIdToken(true).addOnCompleteListener { task ->
            if(user?.uid!=current.uid)return@addOnCompleteListener
            if(task.isSuccessful) {
                val claims=task.result.claims
                val role=claims["role"] as? String ?: ""
                verifiedAdminClaim=role!="area_admin" &&
                    (role=="admin" || claims["admin"]==true)
                startListening(current.uid)
                loadCommunitySettings()
                if(retryEnhancements) enhancement("posts.mine")
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
    private fun callableDiagnostic(error: Exception?, fallback: String): String {
        val code=(error as? com.google.firebase.functions.FirebaseFunctionsException)?.code?.name
        val detail=error?.localizedMessage?.takeIf { it.isNotBlank() } ?: fallback
        return if(code!=null) "Firebase $code: $detail" else detail
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
                        callableDiagnostic(result.exception, "Der geschützte Chat-Dienst ist noch nicht auf Firebase veröffentlicht.")
                    else callableDiagnostic(result.exception, "Chat-Dienst nicht erreichbar.")
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
        markServerChatRead()
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
                    markServerChatRead()
                } else {
                    syncIssues=syncIssues + ("Chatnachrichten" to
                        callableDiagnostic(task.exception, "Nachrichten nicht erreichbar."))
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
            "messageType" to "text",
            "operationId" to UUID.randomUUID().toString().replace("-","")
        )).addOnCompleteListener { task ->
            if(user?.uid!=uid)return@addOnCompleteListener
            busy=false
            if(task.isSuccessful) {
                onSent()
                refreshServerMessages()
                loadServerChats()
            } else {
                message=callableDiagnostic(task.exception, "Nachricht konnte nicht gesendet werden.")
                syncIssues=syncIssues + ("Private Chats" to message)
            }
        }
    }

    fun sendServerChatImage(bytes:ByteArray,caption:String,onSent:()->Unit) {
        val uid=user?.uid ?:return
        val requestedChat=chatId
        if(!serverChatActive||requestedChat.isBlank()||bytes.isEmpty()||bytes.size>2_500_000)return
        val operationId=UUID.randomUUID().toString().replace("-","")
        val messageId="msg_${uid}_$operationId"
        val path="chat-media/$requestedChat/$uid/$messageId.jpg"
        val metadata=StorageMetadata.Builder()
            .setContentType("image/jpeg")
            .setCustomMetadata("chatId",requestedChat)
            .setCustomMetadata("senderUid",uid)
            .setCustomMetadata("messageId",messageId)
            .build()
        busy=true;chatMediaLoading=true
        val objectRef=storage.reference.child(path)
        objectRef.putBytes(bytes,metadata).continueWithTask { upload ->
            if(!upload.isSuccessful)throw upload.exception ?: IllegalStateException("Bild-Upload fehlgeschlagen.")
            functions.getHttpsCallable("quartinautPrivateChats").call(mapOf(
                "action" to "send","chatId" to requestedChat,
                "text" to caption.trim().take(500),"messageType" to "image",
                "operationId" to operationId,
                "media" to mapOf("storagePath" to path,"contentType" to "image/jpeg","size" to bytes.size)
            ))
        }.addOnCompleteListener { task ->
            if(user?.uid!=uid)return@addOnCompleteListener
            busy=false;chatMediaLoading=false
            if(task.isSuccessful) {
                onSent();refreshServerMessages();loadServerChats()
            } else {
                objectRef.delete()
                message=callableDiagnostic(task.exception, "Chatbild konnte nicht gesendet werden.")
                syncIssues=syncIssues + ("Private Chats" to message)
            }
        }
    }

    fun loadChatImage(path:String,onReady:(android.graphics.Bitmap?)->Unit) {
        if(!path.startsWith("chat-media/")||path.length>700) {onReady(null);return}
        storage.reference.child(path).getBytes(2_500_000)
            .addOnSuccessListener { bytes ->
                onReady(android.graphics.BitmapFactory.decodeByteArray(bytes,0,bytes.size))
            }.addOnFailureListener {onReady(null)}
    }

    fun setServerChatMuted(muted:Boolean) = chatControl("mute",mapOf("muted" to muted))
    fun setServerChatBlocked(blocked:Boolean) = chatControl("block",mapOf("blocked" to blocked))

    private fun chatControl(action:String,args:Map<String,Any?>) {
        val uid=user?.uid ?:return
        val requestedChat=chatId
        if(!serverChatActive||requestedChat.isBlank()||busy)return
        busy=true
        functions.getHttpsCallable("quartinautPrivateChats").call(
            mapOf("action" to action,"chatId" to requestedChat)+args
        ).addOnCompleteListener { task ->
            if(user?.uid!=uid)return@addOnCompleteListener
            busy=false
            if(task.isSuccessful) {loadServerChats();refreshServerMessages()}
            else {
                message=callableDiagnostic(task.exception, "Chat-Einstellung konnte nicht gespeichert werden.")
                syncIssues=syncIssues + ("Private Chats" to message)
            }
        }
    }

    fun reportServerChat(reason:String,note:String,onDone:()->Unit) {
        val uid=user?.uid ?:return
        val requestedChat=chatId
        if(!serverChatActive||requestedChat.isBlank()||busy)return
        busy=true
        functions.getHttpsCallable("quartinautPrivateChats").call(mapOf(
            "action" to "report","chatId" to requestedChat,"reason" to reason,
            "note" to note.trim().take(500),
            "operationId" to UUID.randomUUID().toString().replace("-","")
        )).addOnCompleteListener { task ->
            if(user?.uid!=uid)return@addOnCompleteListener
            busy=false
            if(task.isSuccessful) {message="Meldung wurde sicher übermittelt.";onDone()}
            else {
                message=callableDiagnostic(task.exception, "Meldung konnte nicht übermittelt werden.")
                syncIssues=syncIssues + ("Private Chats" to message)
            }
        }
    }

    private fun markServerChatRead() {
        val uid=user?.uid ?:return
        val requestedChat=chatId
        if(!serverChatActive||requestedChat.isBlank())return
        functions.getHttpsCallable("quartinautPrivateChats")
            .call(mapOf("action" to "read","chatId" to requestedChat))
            .addOnSuccessListener {if(user?.uid==uid)loadServerChats()}
            .addOnFailureListener { e ->
                if(user?.uid==uid)syncIssues=syncIssues + ("Chat-Lesestatus" to
                    callableDiagnostic(e, "Lesestatus konnte nicht aktualisiert werden."))
            }
    }
    fun startServerRequestChat(request:DocumentSnapshot,onOpen:()->Unit) {
        val uid=user?.uid ?:return
        busy=true
        val scoped=request.id.startsWith("arq_")
        functions.getHttpsCallable(if(scoped) "quartinautAudience" else "quartinautPrivateChats").call(mapOf(
            "action" to if(scoped) "chat.start" else "start","requestId" to request.id,"id" to request.id
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
                message=callableDiagnostic(result.exception, "Chat konnte nicht eröffnet werden.")
                syncIssues=syncIssues + ("Private Chats" to message)
            }
        }
    }


    /**
     * Additional functionality is accessible only via a separate Firebase
     * callable. We do not introduce permissive Firestore collection rules.
     */
    fun enhancement(
        action: String, args: Map<String,Any?> = emptyMap(),
        onError: (String) -> Unit = {},
        onDone: (Map<String,Any?>) -> Unit = {}
    ) {
        val uid=user?.uid
        if(uid==null || !active()) {
            onError("Bitte anmelden.")
            return
        }
        enhancementLoading=true
        enhancementError=""
        // A parallel read must not temporarily revoke already-confirmed
        // write permissions for a completely unrelated post.
        val scoped=DocString(args["id"]).startsWith("arq_")
        val aggregate=action in listOf("posts.mine","favorites.list","radar.list")
        functions.getHttpsCallable(if(scoped) "quartinautAudience" else "quartinautEnhancements")
            .call(args + ("action" to action))
            .addOnCompleteListener { task ->
                if(user?.uid!=uid)return@addOnCompleteListener
                enhancementLoading=false
                if(!task.isSuccessful) {
                    val error=task.exception
                    val diagnostic=if(
                        error is com.google.firebase.functions.FirebaseFunctionsException &&
                        error.code==com.google.firebase.functions.FirebaseFunctionsException.Code.NOT_FOUND
                    ) "Firebase NOT_FOUND: Erweiterungsdienst noch nicht veröffentlicht."
                    else callableDiagnostic(error,"Erweiterung derzeit nicht verfügbar.")
                    enhancementError=diagnostic
                    syncIssues=syncIssues + ("Erweiterungen" to diagnostic)
                    onError(diagnostic)
                } else {
                    enhancementReady=true
                    syncIssues=syncIssues - "Erweiterungen"
                    val payload=task.result?.data as? Map<*,*> ?: emptyMap<String,Any?>()
                    val original=payload.entries.associate { DocString(it.key) to it.value }
                    if(aggregate) {
                        functions.getHttpsCallable("quartinautAudience").call(args+("action" to action))
                            .addOnCompleteListener { extra ->
                                if(user?.uid!=uid)return@addOnCompleteListener
                                if(extra.isSuccessful) {
                                    val additional=(extra.result.data as? Map<*,*>)?.get("items") as? List<*> ?: emptyList<Any>()
                                    val old=original["items"] as? List<*> ?: emptyList<Any>()
                                    onDone(original+("items" to (old+additional)))
                                } else {
                                    syncIssues=syncIssues+("Regionale Anliegen" to callableDiagnostic(extra.exception,"Regionale Anliegen nicht erreichbar."))
                                    onDone(original)
                                }
                            }
                    } else onDone(original)
                }
            }
    }
    fun loadEnhancementList(action: String, params: Map<String,Any?> = emptyMap()) {
        val startedMs=android.os.SystemClock.elapsedRealtime()
        val metric=if(action=="posts.mine")"posts" else "extras"
        val isPosts=action=="posts.mine"
        val ticket=if(isPosts) ++myPostsRequestSequence else 0L
        if(isPosts) myPostsLoading=true
        // Preserve the last successful result while another request is running.
        enhancement(action,params,onDone={ result ->
            NativePerformanceMetrics.record(appContext,metric,
                android.os.SystemClock.elapsedRealtime()-startedMs,true)
            val entries=result["items"] as? List<*> ?: emptyList<Any>()
            val fresh=entries.mapNotNull { row ->
                (row as? Map<*,*>)?.entries?.associate { DocString(it.key) to it.value }
            }
            if(isPosts) {
                if(ticket==myPostsRequestSequence) {
                    myPostsItems=fresh
                    myPostsLoaded=true
                    myPostsLoading=false
                }
            } else enhancedItems=fresh
        },onError={
            NativePerformanceMetrics.record(appContext,metric,
                android.os.SystemClock.elapsedRealtime()-startedMs,false)
            if(isPosts && ticket==myPostsRequestSequence) {
                myPostsLoading=false
                // Keep existing cards; the retry action remains accessible.
            }
        })
    }
    fun updateMyPost(collection:String,id:String,action:String,
                     args:Map<String,Any?> = emptyMap(),
                     completed:()->Unit = {},
                     failed:(String)->Unit = {}) {
        if(!enhancementReady || id in myPostsBusyIds) {
            val reason="Beitragsverwaltung nicht bereit. Bitte erneut versuchen."
            message=reason;failed(reason);return
        }
        val previous=myPostsItems
        val oldLoaded=myPostsLoaded
        // Ignore responses from reads started before this write; they contain
        // stale pre-edit values and used to reset the UI unexpectedly.
        myPostsRequestSequence++
        myPostsLoading=false
        val kind=if(collection=="requests")"request" else ""
        myPostsLoaded=true
        myPostsBusyIds=myPostsBusyIds+id
        myPostsItems=myPostsItems.mapNotNull { row ->
            val matches=DocString(row["id"])==id &&
                (kind.isBlank() || DocString(row["kind"])==kind)
            if(!matches)row else when(action) {
                "post.delete" -> null
                "post.status" -> row + ("status" to args["status"])
                "post.edit" -> row + mapOf(
                    "title" to args["title"],
                    "description" to args["description"])
                else -> row
            }
        }
        // The server is authoritative. Roll back if its validation fails.
        enhancement(action,args + mapOf("collection" to collection,"id" to id),
            onDone={
                myPostsBusyIds=myPostsBusyIds-id
                message=if(action=="post.delete")"Beitrag entfernt."
                    else "Beitrag aktualisiert."
                completed()
                // Refresh only the owner's lightweight list, not every
                // map, marketplace, calendar and community collection.
                loadEnhancementList("posts.mine")
            },
            onError={ reason ->
                myPostsBusyIds=myPostsBusyIds-id
                myPostsItems=previous
                myPostsLoaded=oldLoaded
                message=reason
                failed(reason)
            })
    }
    fun uploadPostPhoto(
        namespace:String,token:String,index:Int,base64:String,
        completed:(String)->Unit
    ) {
        enhancement("photo.put",mapOf(
            "namespace" to namespace,"token" to token,
            "index" to index,"jpegBase64" to base64
        )) { response ->
            val path=DocString(response["path"])
            if(path.isNotBlank())completed(path)
        }
    }

    /**
     * Public-only offline snapshot: no UIDs, chats, owner data, media paths or
     * reservations. Scoped to logged-in UID+canton; expires after 72 hours.
     */
    private fun cachePublicHubItems() {
        val uid=user?.uid ?: return
        val canton=canton()
        if(canton.isBlank())return
        val safe=hubItems.filter {
            it["status"]=="published" && DocString(it["cantonCode"])==canton &&
                it["kind"]!="issue"
        }.take(100).map{ item ->
            mapOf(
                "id" to DocString(item["id"]).take(150),
                "title" to DocString(item["title"]).take(100),
                "description" to DocString(item["description"]).take(220),
                "kind" to DocString(item["kind"]).take(20),
                "category" to DocString(item["category"]).take(60),
                "area" to DocString(item["area"]).take(140),
                "cantonCode" to canton,
                "status" to "published"
            )
        }
        val arr=org.json.JSONArray()
        safe.forEach { arr.put(org.json.JSONObject(it)) }
        val key="cache_"+uid+"_"+canton
        offlinePrefs.edit()
            .putString(key,arr.toString())
            .putLong("saved_"+uid+"_"+canton,System.currentTimeMillis())
            .apply()
        offlineHubItems=safe
        offlineCacheDate=java.time.Instant.now().toString()
    }
    private fun restorePublicCache(uid:String) {
        val canton=canton()
        val saved=offlinePrefs.getLong("saved_"+uid+"_"+canton,0L)
        if(saved==0L || System.currentTimeMillis()-saved>72L*3600L*1000L) {
            offlineHubItems=emptyList();offlineCacheDate="";return
        }
        val json=offlinePrefs.getString("cache_"+uid+"_"+canton,"[]") ?: "[]"
        val arr=runCatching {org.json.JSONArray(json)}.getOrNull()
        val output=mutableListOf<Map<String,Any?>>()
        if(arr!=null){
            for(i in 0 until minOf(arr.length(),100)) {
                val obj=arr.optJSONObject(i) ?:continue
                if(obj.optString("cantonCode")!=canton)continue
                output.add(mapOf(
                    "id" to obj.optString("id"),
                    "title" to obj.optString("title"),
                    "description" to obj.optString("description"),
                    "kind" to obj.optString("kind"),
                    "category" to obj.optString("category"),
                    "area" to obj.optString("area"),
                    "cantonCode" to canton,
                    "status" to "published"
                ))
            }
        }
        offlineHubItems=output
        offlineCacheDate=java.time.Instant.ofEpochMilli(saved).toString()
    }

}
