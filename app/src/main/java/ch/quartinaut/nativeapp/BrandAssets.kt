package ch.quartinaut.nativeapp

import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocationCity
import androidx.compose.material3.Icon
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp

/**
 * Shows the original image files from Quartinaut 5.4 within real Compose views.
 * No WebView and no remote HTML is rendered. The signed APK bundles images
 * via scripts/sync-original-assets.sh. A native fallback is always available.
 */
@Composable
fun QuartinautLogo(modifier: Modifier = Modifier, contentScale: ContentScale = ContentScale.Fit) {
    OriginalImage("icon-512.png",modifier,contentScale)
}
@Composable
fun OriginalNavigationIcon(name: String, modifier: Modifier = Modifier) {
    OriginalImage("navigation/$name.png",modifier,tint=Color(0xFF19834B))
}
@Composable
private fun OriginalImage(path: String, modifier: Modifier,
                          scale: ContentScale = ContentScale.Fit,tint: Color? = null) {
    val context = LocalContext.current
    val bitmap = remember(path) {
        runCatching {
            context.assets.open("q-original/$path").use { BitmapFactory.decodeStream(it) }
        }.getOrNull()
    }
    if (bitmap != null) {
        Image(bitmap.asImageBitmap(),contentDescription = null,modifier=modifier,
            contentScale=scale,colorFilter=tint?.let { ColorFilter.tint(it) })
    } else {
        Box(modifier, contentAlignment=Alignment.Center) {
            Icon(Icons.Default.LocationCity,contentDescription=null,modifier=Modifier.size(30.dp),
                tint=tint ?: androidx.compose.material3.LocalContentColor.current)
        }
    }
}