package ch.quartinaut.nativeapp

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog

/**
 * Photo paths remain protected by quartinautPhoto callable. Do not attempt
 * insecure Firebase Storage download URLs or direct unrestricted reads.
 * One explicit user action loads at most three pictures per detail screen.
 */
@Composable
fun NativeProtectedGallery(repo: QuartinautRepository, photoPaths: List<String>) {
    val paths = remember(photoPaths) {
        photoPaths.filter { it.startsWith("post-photos/") }.distinct().take(3)
    }
    if (paths.isEmpty()) return
    var revealed by remember(paths) { mutableStateOf(false) }
    var enlarged by remember { mutableStateOf<Bitmap?>(null) }
    val photos = remember(paths) { mutableStateMapOf<String, Bitmap>() }
    var failures by remember(paths) { mutableIntStateOf(0) }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Beitragsfotos ("+paths.size+")",style=MaterialTheme.typography.titleMedium)
        if (!revealed) {
            OutlinedButton(onClick = {
                revealed = true
                paths.forEach { path ->
                    repo.readProtectedPhoto(path) { bitmap ->
                        if(bitmap != null) photos[path]=bitmap else failures++
                    }
                }
            }) {
                Text("Geschützte Bilder anzeigen")
            }
        } else if (photos.isEmpty()) {
            Text(if (failures >= paths.size) "Bilder konnten mit deinen Berechtigungen nicht geladen werden."
                 else "Bilder werden sicher geladen …",
                style=MaterialTheme.typography.bodySmall)
        } else {
            Row(Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement=Arrangement.spacedBy(10.dp)) {
                paths.forEach { path ->
                    val bitmap=photos[path]
                    if(bitmap!=null) {
                        Card(Modifier.width(216.dp).height(172.dp).clickable { enlarged=bitmap },
                             shape=RoundedCornerShape(14.dp)) {
                            Image(bitmap.asImageBitmap(),contentDescription="Beitragsfoto vergrössern",
                                modifier=Modifier.fillMaxSize(),
                                contentScale=ContentScale.Crop)
                        }
                    }
                }
            }
        }
    }
    enlarged?.let { image ->
        Dialog(onDismissRequest={enlarged=null}) {
            Surface(shape=RoundedCornerShape(18.dp)) {
                Column(Modifier.padding(12.dp),
                    horizontalAlignment=Alignment.CenterHorizontally) {
                    Image(image.asImageBitmap(),contentDescription="Vergrössertes Beitragsfoto",
                        modifier=Modifier.fillMaxWidth().heightIn(max=540.dp),
                        contentScale=ContentScale.Fit)
                    TextButton(onClick={enlarged=null}) { Text("Schliessen") }
                }
            }
        }
    }
}
