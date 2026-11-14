package ch.quartinaut.nativeapp

import androidx.compose.foundation.Image
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource

/**
 * Original locally bundled 3D Quartinaut artwork.
 * Transparent, 128px WebP images; never fetched from a network or tinted.
 */
@Composable
internal fun Quartinaut3DIcon(key: String, modifier: Modifier = Modifier) {
    val drawable = when (key) {
        "entdecken", "discover" -> R.drawable.qt_discover
        "erstellen", "create" -> R.drawable.qt_create
        "meine", "activity" -> R.drawable.qt_activity
        "gemeinde", "community" -> R.drawable.qt_community
        "sicherheit", "security" -> R.drawable.qt_security
        "messages", "chats" -> R.drawable.qt_messages
        else -> R.drawable.qt_discover
    }
    Image(
        painter = painterResource(drawable),
        contentDescription = null,
        modifier = modifier,
        contentScale = ContentScale.Fit
    )
}
