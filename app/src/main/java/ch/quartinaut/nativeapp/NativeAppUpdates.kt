package ch.quartinaut.nativeapp

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.SystemUpdate
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import java.net.URI
import java.net.URL
import javax.net.ssl.HttpsURLConnection

/**
 * Public GitHub Release check while the app is open.
 * No private tokens, unknown hosts, silent downloads or silent installs.
 */
private const val RELEASES_API =
    "https://api.github.com/repos/raiirajet/Quartinaut/releases?per_page=15"
private const val RELEASES_PAGE =
    "https://github.com/raiirajet/Quartinaut/releases"
private val RELEASE_TAG = Regex("^android-v([1-9][0-9]{0,8})-(preview|stable)$")

private data class QuartinautUpdateRelease(
    val code:Long,
    val version:String,
    val tag:String,
    val downloadUrl:String,
    val notes:String,
    val isPreview:Boolean
)
private fun versionCodeInstalled(context:Context):Long=runCatching {
    val info=context.packageManager.getPackageInfo(context.packageName,0)
    if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.P)info.longVersionCode
    else {
        @Suppress("DEPRECATION")
        info.versionCode.toLong()
    }
}.getOrDefault(0L)
private fun versionNameInstalled(context:Context):String=runCatching {
    context.packageManager.getPackageInfo(context.packageName,0).versionName.orEmpty()
}.getOrDefault("Quartinaut")
private fun trustedApk(url:String,tag:String):Boolean=runCatching {
    val uri=URI(url)
    uri.scheme=="https" && uri.host=="github.com" && uri.port == -1 &&
        uri.rawUserInfo==null &&
        uri.path.startsWith("/raiirajet/Quartinaut/releases/download/"+tag+"/") &&
        uri.path.endsWith(".apk")
}.getOrDefault(false)
private fun fetchUpdate(installedCode:Long):Result<QuartinautUpdateRelease?> = runCatching {
    val conn=URL(RELEASES_API).openConnection() as HttpsURLConnection
    conn.connectTimeout=4500
    conn.readTimeout=4500
    conn.instanceFollowRedirects=false
    conn.setRequestProperty("Accept","application/vnd.github+json")
    conn.setRequestProperty("User-Agent","Quartinaut-Android-Updates")
    try {
        if(conn.responseCode!=200)error("GitHub: HTTP "+conn.responseCode)
        val root=JSONArray(conn.inputStream.bufferedReader(Charsets.UTF_8).use{it.readText()})
        var newest:QuartinautUpdateRelease?=null
        for(i in 0 until root.length()) {
            val release=root.optJSONObject(i) ?:continue
            if(release.optBoolean("draft",false))continue
            val tag=release.optString("tag_name")
            val match=RELEASE_TAG.matchEntire(tag) ?:continue
            val code=match.groupValues[1].toLongOrNull() ?:continue
            if(code<=installedCode)continue
            val preview=match.groupValues[2]=="preview"
            val assets=release.optJSONArray("assets") ?:continue
            for(j in 0 until assets.length()) {
                val asset=assets.optJSONObject(j) ?:continue
                val name=asset.optString("name")
                val url=asset.optString("browser_download_url")
                if(!name.startsWith("Quartinaut-Android-") || !name.endsWith(".apk") ||
                   !trustedApk(url,tag))continue
                val item=QuartinautUpdateRelease(
                    code=code,
                    version=release.optString("name",tag).take(90),
                    tag=tag,
                    downloadUrl=url,
                    notes=release.optString("body").take(350),
                    isPreview=preview
                )
                val previous=newest
                if(previous==null || item.code>previous.code ||
                   (item.code==previous.code && !item.isPreview))newest=item
                break
            }
        }
        newest
    } finally {conn.disconnect()}
}
private fun openOfficialApk(context:Context,release:QuartinautUpdateRelease):Boolean {
    if(!trustedApk(release.downloadUrl,release.tag))return false
    return runCatching {
        context.startActivity(
            Intent(Intent.ACTION_VIEW,Uri.parse(release.downloadUrl))
                .addCategory(Intent.CATEGORY_BROWSABLE)
        )
    }.isSuccess
}

@Composable
fun NativeAppUpdateArea(compact:Boolean) {
    val context=LocalContext.current
    val installedCode=remember(context){versionCodeInstalled(context)}
    val currentVersion=remember(context){versionNameInstalled(context)}
    val scope=rememberCoroutineScope()
    var checked by remember{mutableStateOf(false)}
    var checking by remember{mutableStateOf(false)}
    var error by remember{mutableStateOf("")}
    var update by remember{mutableStateOf<QuartinautUpdateRelease?>(null)}
    var showDialog by remember{mutableStateOf(false)}
    var openFailed by remember{mutableStateOf(false)}
    suspend fun checkUpdates() {
        checking=true;error=""
        val result=withContext(Dispatchers.IO){fetchUpdate(installedCode)}
        result.onSuccess{update=it}
            .onFailure{error="GitHub konnte nicht geprüft werden. Später erneut versuchen."}
        checked=true;checking=false
    }
    LaunchedEffect(Unit){checkUpdates()}

    if(showDialog && update!=null) {
        val release=update!!
        AlertDialog(
            onDismissRequest={showDialog=false},
            title={Text("Update verfügbar")},
            text={
                Column(verticalArrangement=Arrangement.spacedBy(10.dp)) {
                    Text("Neue Version: "+release.version,fontWeight=FontWeight.SemiBold)
                    Text("Installiert: "+currentVersion+" (Build "+installedCode+")",
                        style=MaterialTheme.typography.bodySmall)
                    if(release.notes.isNotBlank())Text(release.notes.take(300),
                        style=MaterialTheme.typography.bodySmall)
                    if(release.isPreview)Text(
                        "Dies ist eine Testversion. Ohne dauerhaft gleichen Signaturschlüssel " +
                        "kann Android die bisherige App möglicherweise nicht aktualisieren. " +
                        "Eine Deinstallation löscht lokale Appdaten und Entwürfe.",
                        style=MaterialTheme.typography.bodySmall,
                        color=MaterialTheme.colorScheme.error
                    )
                    Text("Die APK kommt aus den offiziellen Quartinaut-GitHub-Releases. " +
                        "Android fragt vor der Installation um deine Zustimmung.",
                        style=MaterialTheme.typography.bodySmall)
                }
            },
            confirmButton={
                Button(onClick={
                    if(openOfficialApk(context,release))showDialog=false
                    else openFailed=true
                }){Text("APK auf GitHub öffnen")}
            },
            dismissButton={TextButton(onClick={showDialog=false}){Text("Später")}}
        )
    }
    if(openFailed)AlertDialog(
        onDismissRequest={openFailed=false},title={Text("Download nicht geöffnet")},
        text={Text("Öffne GitHub Releases im Browser: "+RELEASES_PAGE)},
        confirmButton={TextButton(onClick={openFailed=false}){Text("Schliessen")}}
    )

    if(compact) {
        val release=update
        if(release!=null)Surface(
            modifier=Modifier.fillMaxWidth().clickable{showDialog=true},
            color=MaterialTheme.colorScheme.primaryContainer,tonalElevation=3.dp
        ) {
            Row(Modifier.fillMaxWidth().padding(horizontal=14.dp,vertical=9.dp),
                verticalAlignment=Alignment.CenterVertically) {
                Icon(Icons.Default.SystemUpdate,contentDescription=null,
                    tint=MaterialTheme.colorScheme.onPrimaryContainer)
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text("Update verfügbar",fontWeight=FontWeight.Bold,
                        color=MaterialTheme.colorScheme.onPrimaryContainer)
                    Text(release.version,style=MaterialTheme.typography.labelSmall,
                        color=MaterialTheme.colorScheme.onPrimaryContainer)
                }
                Text("Ansehen",color=MaterialTheme.colorScheme.onPrimaryContainer,
                    style=MaterialTheme.typography.labelLarge)
            }
        }
    } else {
        Column(verticalArrangement=Arrangement.spacedBy(9.dp)) {
            Text("App-Version & Updates",style=MaterialTheme.typography.titleMedium,
                fontWeight=FontWeight.Bold)
            Text("Installiert: "+currentVersion+" · Build "+installedCode,
                style=MaterialTheme.typography.bodySmall)
            when {
                update!=null -> {
                    Text("Update verfügbar: "+update!!.version,
                        color=MaterialTheme.colorScheme.primary,
                        fontWeight=FontWeight.SemiBold)
                    Button(onClick={showDialog=true},modifier=Modifier.fillMaxWidth()) {
                        Text("Update ansehen")
                    }
                }
                checking -> LinearProgressIndicator(Modifier.fillMaxWidth())
                checked&&error.isBlank() ->
                    Text("Keine neuere GitHub-Version gefunden.",
                        style=MaterialTheme.typography.bodySmall)
                error.isNotBlank() ->
                    Text(error,color=MaterialTheme.colorScheme.error,
                        style=MaterialTheme.typography.bodySmall)
            }
            OutlinedButton(onClick={scope.launch{checkUpdates()}},
                enabled=!checking,modifier=Modifier.fillMaxWidth()){
                Text(if(checking)"Prüfe GitHub…" else "Jetzt auf Updates prüfen")
            }
            Text("Quartinaut prüft nur bei geöffneter App. Die Installation ist " +
                "niemals automatisch; nahtlose Updates benötigen einen " +
                "dauerhaft gleichen Signaturschlüssel.",
                style=MaterialTheme.typography.bodySmall,
                color=MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
