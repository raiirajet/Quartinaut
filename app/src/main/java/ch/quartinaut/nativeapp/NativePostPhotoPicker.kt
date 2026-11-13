package ch.quartinaut.nativeapp

import android.net.Uri
import android.util.Base64
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddPhotoAlternate
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

/** Native photo picker; backend JPEG re-encoding removes EXIF/GPS. */
@Composable
fun NativePostPhotoPicker(
    repo: QuartinautRepository,
    namespace: String,
    token: String,
    paths: List<String>,
    onChange: (List<String>) -> Unit
) {
    val context=LocalContext.current
    val scope=rememberCoroutineScope()
    var error by remember {mutableStateOf("")}
    var uploading by remember {mutableStateOf(false)}
    LaunchedEffect(repo.enhancementLoading,repo.enhancementError) {
        if(uploading && !repo.enhancementLoading && repo.enhancementError.isNotBlank()) {
            uploading=false
            error=repo.enhancementError
        }
    }
    val picker=rememberLauncherForActivityResult(
        ActivityResultContracts.GetMultipleContents()
    ) { selected ->
        if(selected.isEmpty())return@rememberLauncherForActivityResult
        error=""
        if(selected.size>3-paths.size) {
            error="Maximal 3 Fotos pro Beitrag erlaubt."
            return@rememberLauncherForActivityResult
        }
        uploading=true
        fun send(remaining:List<Uri>,saved:List<String>) {
            if(remaining.isEmpty()) {
                uploading=false
                onChange(paths+saved)
                return
            }
            val used=(paths+saved).mapNotNull {
                it.substringAfterLast('/').removeSuffix(".jpg").toIntOrNull()
            }.toSet()
            val index=(0..2).firstOrNull{it !in used}
            if(index==null){uploading=false;error="Bildlimit erreicht.";return}
            scope.launch {
                try {
                    val bytes=prepareDashboardImage(context,remaining.first())
                    val encoded=Base64.encodeToString(bytes,Base64.NO_WRAP)
                    repo.uploadPostPhoto(namespace,token,index,encoded) { path ->
                        send(remaining.drop(1),saved+path)
                    }
                } catch(e:Exception) {
                    uploading=false
                    error=e.localizedMessage ?: "Foto konnte nicht vorbereitet werden."
                }
            }
        }
        send(selected,emptyList())
    }
    Column(verticalArrangement=Arrangement.spacedBy(9.dp)) {
        Text("Beitragsfotos",style=MaterialTheme.typography.titleMedium)
        Text("Bis zu 3 Bilder · Fotos werden verkleinert und privat gespeichert.",
            style=MaterialTheme.typography.bodySmall)
        paths.forEachIndexed { index,path ->
            var preview by remember(path) {mutableStateOf<android.graphics.Bitmap?>(null)}
            LaunchedEffect(path) { repo.readProtectedPhoto(path) {preview=it} }
            Surface(color=MaterialTheme.colorScheme.surfaceVariant,
                shape=RoundedCornerShape(12.dp)) {
                Row(Modifier.fillMaxWidth().padding(horizontal=10.dp,vertical=8.dp),
                    verticalAlignment=Alignment.CenterVertically) {
                    if(preview!=null) Image(
                        bitmap=preview!!.asImageBitmap(),contentDescription="Foto "+(index+1)+" Vorschau",
                        modifier=Modifier.size(46.dp).clip(RoundedCornerShape(9.dp)),
                        contentScale=ContentScale.Crop)
                    else Icon(Icons.Default.AddPhotoAlternate,contentDescription=null,
                        modifier=Modifier.size(32.dp))
                    Spacer(Modifier.width(7.dp))
                    Text("Foto "+(index+1),modifier=Modifier.weight(1f),
                        style=MaterialTheme.typography.bodySmall)
                    IconButton(onClick={
                        if(index>0) {
                            val changed=paths.toMutableList()
                            val entry=changed.removeAt(index);changed.add(index-1,entry)
                            onChange(changed)
                        }
                    },enabled=index>0) {Icon(Icons.Default.ArrowUpward,"Foto nach oben")}
                    IconButton(onClick={
                        if(index<paths.lastIndex) {
                            val changed=paths.toMutableList()
                            val entry=changed.removeAt(index);changed.add(index+1,entry)
                            onChange(changed)
                        }
                    },enabled=index<paths.lastIndex) {Icon(Icons.Default.ArrowDownward,"Foto nach unten")}
                    IconButton(onClick={
                        val photoIndex=path.substringAfterLast('/')
                            .removeSuffix(".jpg").toIntOrNull() ?: return@IconButton
                        repo.enhancement("photo.remove",mapOf(
                            "namespace" to namespace,"token" to token,"index" to photoIndex
                        )) {onChange(paths.filter{it!=path})}
                    }) {Icon(Icons.Default.DeleteOutline,"Foto entfernen")}
                }
            }
        }
        OutlinedButton(onClick={picker.launch("image/*")},
            enabled=paths.size<3 && !uploading && !repo.enhancementLoading,
            modifier=Modifier.fillMaxWidth()) {
            Icon(Icons.Default.AddPhotoAlternate,null)
            Spacer(Modifier.width(7.dp))
            Text(if(uploading)"Fotos werden verarbeitet …"
                else "Fotos auswählen (" + paths.size + "/3)")
        }
        if(uploading)LinearProgressIndicator(Modifier.fillMaxWidth())
        if(error.isNotBlank())Text(error,color=MaterialTheme.colorScheme.error,
            style=MaterialTheme.typography.bodySmall)
    }
}
