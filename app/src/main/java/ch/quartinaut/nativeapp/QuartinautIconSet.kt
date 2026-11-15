package ch.quartinaut.nativeapp

import androidx.compose.foundation.Canvas
import android.content.Context
import android.graphics.BitmapFactory
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.graphics.FilterQuality
import kotlin.math.roundToInt
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp

/**
 * Quartinaut raised 3D icon treatment. The original six photo-realistic 3D
 * navigation illustrations are used where a semantic match exists. Other
 * catalog symbols are displayed over a shaded, bevelled and specular tile,
 * not on the previous flat backgrounds. Dark uses monochrome grayscale.
 */
@Composable
internal fun QuartinautIcon(key: String, modifier: Modifier = Modifier) {
    val monochrome = MaterialTheme.colorScheme.background.luminance() < 0.018f

    val context = LocalContext.current
    val atlas = remember(context) { QuartinautAtlasCache.load(context) }
    if (atlas != null) {
        val index = quartinaut3DTile(key)
        val monoFilter = remember(monochrome) {
            if (monochrome) ColorFilter.colorMatrix(
                ColorMatrix().apply { setToSaturation(0f) }
            ) else null
        }
        Canvas(modifier) {
            drawImage(
                image = atlas,
                srcOffset = IntOffset((index % 6) * 96, (index / 6) * 96),
                srcSize = IntSize(96, 96),
                dstOffset = IntOffset.Zero,
                dstSize = IntSize(
                    size.width.roundToInt().coerceAtLeast(1),
                    size.height.roundToInt().coerceAtLeast(1)
                ),
                colorFilter = monoFilter,
                filterQuality = FilterQuality.High
            )
        }
        return
    }

    val original = when (key) {
        "home", "navigation_home", "navigation_startseite", "start" -> R.drawable.qt_community
        "entdecken", "discover", "plus", "quartier", "navigation_entdecken",
        "navigation_plus", "navigation_gemeinde" -> R.drawable.qt_discover
        "erstellen", "create", "neu", "navigation_erstellen", "navigation_create",
        "aktion_hinzufuegen" -> R.drawable.qt_create
        "meine", "activity", "profile", "profil", "navigation_meine",
        "navigation_profile", "personal-center", "saved" -> R.drawable.qt_activity
        "gemeinde", "community", "group", "community-pulse" -> R.drawable.qt_community
        "sicherheit", "security", "safety-center", "enh-trust" -> R.drawable.qt_security
        "messages", "chats", "navigation_messages" -> R.drawable.qt_messages
        else -> null
    }
    val grayscale = remember(monochrome) {
        if (monochrome) ColorFilter.colorMatrix(
            ColorMatrix().apply { setToSaturation(0f) }
        ) else null
    }
    if (original != null) {
        Image(
            painter = painterResource(original),
            contentDescription = null,
            modifier = modifier,
            contentScale = ContentScale.Fit,
            colorFilter = grayscale
        )
    } else {
        val radius = RoundedCornerShape(16.dp)
        Box(
            modifier = modifier.shadow(6.dp, radius).clip(radius),
            contentAlignment = Alignment.Center
        ) {
            Canvas(Modifier.fillMaxSize()) {
                val corner = CornerRadius(size.minDimension * 0.28f)
                val main = if (monochrome)
                    listOf(Color(0xFFF3F3F3), Color(0xFF858585), Color(0xFF2A2A2A))
                else listOf(Color(0xFF6FE8B2), Color(0xFF087650), Color(0xFF073828))
                drawRoundRect(
                    brush = Brush.linearGradient(
                        colors = main,
                        start = Offset.Zero, end = Offset(size.width, size.height)
                    ),
                    cornerRadius = corner
                )
                drawRoundRect(
                    brush = Brush.verticalGradient(
                        listOf(
                            Color.White.copy(alpha = 0.43f),
                            Color.White.copy(alpha = 0.10f),
                            Color.Transparent
                        ),
                        endY = size.height * 0.63f
                    ),
                    topLeft = Offset(size.width * 0.07f, size.height * 0.05f),
                    size = Size(size.width * 0.86f, size.height * 0.50f),
                    cornerRadius = CornerRadius(size.minDimension * 0.24f)
                )
                drawRoundRect(
                    brush = Brush.verticalGradient(
                        listOf(Color.Transparent, Color.Black.copy(alpha = 0.28f)),
                        startY = size.height * 0.63f
                    ),
                    topLeft = Offset(size.width * 0.06f, size.height * 0.69f),
                    size = Size(size.width * 0.88f, size.height * 0.25f),
                    cornerRadius = corner
                )
                drawRoundRect(
                    color = Color.White.copy(alpha = 0.36f),
                    topLeft = Offset(size.width * 0.035f, size.height * 0.035f),
                    size = Size(size.width * 0.93f, size.height * 0.93f),
                    cornerRadius = corner,
                    style = androidx.compose.ui.graphics.drawscope.Stroke(
                        width = size.minDimension * 0.025f
                    )
                )
            }
            Image(
                painter = painterResource(iconRes(key, true)),
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Fit
            )
        }
    }
}

private fun iconRes(key:String,monochrome:Boolean):Int = when(key) {
        "activity" -> if (monochrome) R.drawable.qt_mono_activity else R.drawable.qt_custom_activity
        "admin" -> if (monochrome) R.drawable.qt_mono_admin else R.drawable.qt_custom_admin
        "aktion_abbrechen" -> if (monochrome) R.drawable.qt_mono_aktion_abbrechen else R.drawable.qt_custom_aktion_abbrechen
        "aktion_aktualisieren" -> if (monochrome) R.drawable.qt_mono_aktion_aktualisieren else R.drawable.qt_custom_aktion_aktualisieren
        "aktion_ausloggen" -> if (monochrome) R.drawable.qt_mono_aktion_ausloggen else R.drawable.qt_custom_aktion_ausloggen
        "aktion_auswaehlen" -> if (monochrome) R.drawable.qt_mono_aktion_auswaehlen else R.drawable.qt_custom_aktion_auswaehlen
        "aktion_bearbeiten" -> if (monochrome) R.drawable.qt_mono_aktion_bearbeiten else R.drawable.qt_custom_aktion_bearbeiten
        "aktion_bestaetigen" -> if (monochrome) R.drawable.qt_mono_aktion_bestaetigen else R.drawable.qt_custom_aktion_bestaetigen
        "aktion_filtern" -> if (monochrome) R.drawable.qt_mono_aktion_filtern else R.drawable.qt_custom_aktion_filtern
        "aktion_freigeben" -> if (monochrome) R.drawable.qt_mono_aktion_freigeben else R.drawable.qt_custom_aktion_freigeben
        "aktion_herunterladen" -> if (monochrome) R.drawable.qt_mono_aktion_herunterladen else R.drawable.qt_custom_aktion_herunterladen
        "aktion_hinzufuegen" -> if (monochrome) R.drawable.qt_mono_aktion_hinzufuegen else R.drawable.qt_custom_aktion_hinzufuegen
        "aktion_hochladen" -> if (monochrome) R.drawable.qt_mono_aktion_hochladen else R.drawable.qt_custom_aktion_hochladen
        "aktion_information" -> if (monochrome) R.drawable.qt_mono_aktion_information else R.drawable.qt_custom_aktion_information
        "aktion_kopieren" -> if (monochrome) R.drawable.qt_mono_aktion_kopieren else R.drawable.qt_custom_aktion_kopieren
        "aktion_loeschen" -> if (monochrome) R.drawable.qt_mono_aktion_loeschen else R.drawable.qt_custom_aktion_loeschen
        "aktion_melden" -> if (monochrome) R.drawable.qt_mono_aktion_melden else R.drawable.qt_custom_aktion_melden
        "aktion_sortieren" -> if (monochrome) R.drawable.qt_mono_aktion_sortieren else R.drawable.qt_custom_aktion_sortieren
        "aktion_speichern" -> if (monochrome) R.drawable.qt_mono_aktion_speichern else R.drawable.qt_custom_aktion_speichern
        "aktion_sperren" -> if (monochrome) R.drawable.qt_mono_aktion_sperren else R.drawable.qt_custom_aktion_sperren
        "aktion_versenden" -> if (monochrome) R.drawable.qt_mono_aktion_versenden else R.drawable.qt_custom_aktion_versenden
        "aktion_weiter" -> if (monochrome) R.drawable.qt_mono_aktion_weiter else R.drawable.qt_custom_aktion_weiter
        "aktion_zurueck" -> if (monochrome) R.drawable.qt_mono_aktion_zurueck else R.drawable.qt_custom_aktion_zurueck
        "alerts" -> if (monochrome) R.drawable.qt_mono_alerts else R.drawable.qt_custom_alerts
        "board" -> if (monochrome) R.drawable.qt_mono_board else R.drawable.qt_custom_board
        "bulletin" -> if (monochrome) R.drawable.qt_mono_bulletin else R.drawable.qt_custom_bulletin
        "calendar" -> if (monochrome) R.drawable.qt_mono_calendar else R.drawable.qt_custom_calendar
        "calendar-planner" -> if (monochrome) R.drawable.qt_mono_calendar_planner else R.drawable.qt_custom_calendar_planner
        "chats" -> if (monochrome) R.drawable.qt_mono_chats else R.drawable.qt_custom_chats
        "community" -> if (monochrome) R.drawable.qt_mono_community else R.drawable.qt_custom_community
        "community-pulse" -> if (monochrome) R.drawable.qt_mono_community_pulse else R.drawable.qt_custom_community_pulse
        "create" -> if (monochrome) R.drawable.qt_mono_create else R.drawable.qt_custom_create
        "create-offer" -> if (monochrome) R.drawable.qt_mono_create_offer else R.drawable.qt_custom_create_offer
        "create-request" -> if (monochrome) R.drawable.qt_mono_create_request else R.drawable.qt_custom_create_request
        "createNav" -> if (monochrome) R.drawable.qt_mono_create_av else R.drawable.qt_custom_create_av
        "diagnostics" -> if (monochrome) R.drawable.qt_mono_diagnostics else R.drawable.qt_custom_diagnostics
        "discover" -> if (monochrome) R.drawable.qt_mono_discover else R.drawable.qt_custom_discover
        "enh-assist" -> if (monochrome) R.drawable.qt_mono_enh_assist else R.drawable.qt_custom_enh_assist
        "enh-calendar" -> if (monochrome) R.drawable.qt_mono_enh_calendar else R.drawable.qt_custom_enh_calendar
        "enh-clubs" -> if (monochrome) R.drawable.qt_mono_enh_clubs else R.drawable.qt_custom_enh_clubs
        "enh-favorites" -> if (monochrome) R.drawable.qt_mono_enh_favorites else R.drawable.qt_custom_enh_favorites
        "enh-loans" -> if (monochrome) R.drawable.qt_mono_enh_loans else R.drawable.qt_custom_enh_loans
        "enh-map" -> if (monochrome) R.drawable.qt_mono_enh_map else R.drawable.qt_custom_enh_map
        "enh-offline" -> if (monochrome) R.drawable.qt_mono_enh_offline else R.drawable.qt_custom_enh_offline
        "enh-posts" -> if (monochrome) R.drawable.qt_mono_enh_posts else R.drawable.qt_custom_enh_posts
        "enh-qr" -> if (monochrome) R.drawable.qt_mono_enh_qr else R.drawable.qt_custom_enh_qr
        "enh-radar" -> if (monochrome) R.drawable.qt_mono_enh_radar else R.drawable.qt_custom_enh_radar
        "enh-trust" -> if (monochrome) R.drawable.qt_mono_enh_trust else R.drawable.qt_custom_enh_trust
        "enhancements" -> if (monochrome) R.drawable.qt_mono_enhancements else R.drawable.qt_custom_enhancements
        "entdecken" -> if (monochrome) R.drawable.qt_mono_entdecken else R.drawable.qt_custom_entdecken
        "erstellen" -> if (monochrome) R.drawable.qt_mono_erstellen else R.drawable.qt_custom_erstellen
        "events" -> if (monochrome) R.drawable.qt_mono_events else R.drawable.qt_custom_events
        "gemeinde" -> if (monochrome) R.drawable.qt_mono_gemeinde else R.drawable.qt_custom_gemeinde
        "group" -> if (monochrome) R.drawable.qt_mono_group else R.drawable.qt_custom_group
        "groupNav" -> if (monochrome) R.drawable.qt_mono_group_av else R.drawable.qt_custom_group_av
        "help" -> if (monochrome) R.drawable.qt_mono_help else R.drawable.qt_custom_help
        "home" -> if (monochrome) R.drawable.qt_mono_home else R.drawable.qt_custom_home
        "hub-create:calendar" -> if (monochrome) R.drawable.qt_mono_hub_create_calendar else R.drawable.qt_custom_hub_create_calendar
        "hub-create:group" -> if (monochrome) R.drawable.qt_mono_hub_create_group else R.drawable.qt_custom_hub_create_group
        "hub-create:issue" -> if (monochrome) R.drawable.qt_mono_hub_create_issue else R.drawable.qt_custom_hub_create_issue
        "hub-create:lend" -> if (monochrome) R.drawable.qt_mono_hub_create_lend else R.drawable.qt_custom_hub_create_lend
        "hub-create:lost" -> if (monochrome) R.drawable.qt_mono_hub_create_lost else R.drawable.qt_custom_hub_create_lost
        "hub-create:market" -> if (monochrome) R.drawable.qt_mono_hub_create_market else R.drawable.qt_custom_hub_create_market
        "hub-create:project" -> if (monochrome) R.drawable.qt_mono_hub_create_project else R.drawable.qt_custom_hub_create_project
        "inbox" -> if (monochrome) R.drawable.qt_mono_inbox else R.drawable.qt_custom_inbox
        "issue" -> if (monochrome) R.drawable.qt_mono_issue else R.drawable.qt_custom_issue
        "lend" -> if (monochrome) R.drawable.qt_mono_lend else R.drawable.qt_custom_lend
        "loans" -> if (monochrome) R.drawable.qt_mono_loans else R.drawable.qt_custom_loans
        "lost" -> if (monochrome) R.drawable.qt_mono_lost else R.drawable.qt_custom_lost
        "map" -> if (monochrome) R.drawable.qt_mono_map else R.drawable.qt_custom_map
        "market" -> if (monochrome) R.drawable.qt_mono_market else R.drawable.qt_custom_market
        "meine" -> if (monochrome) R.drawable.qt_mono_meine else R.drawable.qt_custom_meine
        "messages" -> if (monochrome) R.drawable.qt_mono_messages else R.drawable.qt_custom_messages
        "municipal-compare" -> if (monochrome) R.drawable.qt_mono_municipal_compare else R.drawable.qt_custom_municipal_compare
        "navigation_admin" -> if (monochrome) R.drawable.qt_mono_navigation_admin else R.drawable.qt_custom_navigation_admin
        "navigation_entdecken" -> if (monochrome) R.drawable.qt_mono_navigation_entdecken else R.drawable.qt_custom_navigation_entdecken
        "navigation_erstellen" -> if (monochrome) R.drawable.qt_mono_navigation_erstellen else R.drawable.qt_custom_navigation_erstellen
        "navigation_gemeinde" -> if (monochrome) R.drawable.qt_mono_navigation_gemeinde else R.drawable.qt_custom_navigation_gemeinde
        "navigation_home" -> if (monochrome) R.drawable.qt_mono_navigation_home else R.drawable.qt_custom_navigation_home
        "navigation_meine" -> if (monochrome) R.drawable.qt_mono_navigation_meine else R.drawable.qt_custom_navigation_meine
        "navigation_messages" -> if (monochrome) R.drawable.qt_mono_navigation_messages else R.drawable.qt_custom_navigation_messages
        "navigation_plus" -> if (monochrome) R.drawable.qt_mono_navigation_plus else R.drawable.qt_custom_navigation_plus
        "navigation_profile" -> if (monochrome) R.drawable.qt_mono_navigation_profile else R.drawable.qt_custom_navigation_profile
        "navigation_sicherheit" -> if (monochrome) R.drawable.qt_mono_navigation_sicherheit else R.drawable.qt_custom_navigation_sicherheit
        "navigation_startseite" -> if (monochrome) R.drawable.qt_mono_navigation_startseite else R.drawable.qt_custom_navigation_startseite
        "need" -> if (monochrome) R.drawable.qt_mono_need else R.drawable.qt_custom_need
        "neu" -> if (monochrome) R.drawable.qt_mono_neu else R.drawable.qt_custom_neu
        "offer" -> if (monochrome) R.drawable.qt_mono_offer else R.drawable.qt_custom_offer
        "official" -> if (monochrome) R.drawable.qt_mono_official else R.drawable.qt_custom_official
        "official-calendar" -> if (monochrome) R.drawable.qt_mono_official_calendar else R.drawable.qt_custom_official_calendar
        "personal-center" -> if (monochrome) R.drawable.qt_mono_personal_center else R.drawable.qt_custom_personal_center
        "plus" -> if (monochrome) R.drawable.qt_mono_plus else R.drawable.qt_custom_plus
        "profil" -> if (monochrome) R.drawable.qt_mono_profil else R.drawable.qt_custom_profil
        "profile" -> if (monochrome) R.drawable.qt_mono_profile else R.drawable.qt_custom_profile
        "project" -> if (monochrome) R.drawable.qt_mono_project else R.drawable.qt_custom_project
        "quartier" -> if (monochrome) R.drawable.qt_mono_quartier else R.drawable.qt_custom_quartier
        "safety-center" -> if (monochrome) R.drawable.qt_mono_safety_center else R.drawable.qt_custom_safety_center
        "saved" -> if (monochrome) R.drawable.qt_mono_saved else R.drawable.qt_custom_saved
        "search" -> if (monochrome) R.drawable.qt_mono_search else R.drawable.qt_custom_search
        "security" -> if (monochrome) R.drawable.qt_mono_security else R.drawable.qt_custom_security
        "settings" -> if (monochrome) R.drawable.qt_mono_settings else R.drawable.qt_custom_settings
        "sicherheit" -> if (monochrome) R.drawable.qt_mono_sicherheit else R.drawable.qt_custom_sicherheit
        "sources" -> if (monochrome) R.drawable.qt_mono_sources else R.drawable.qt_custom_sources
        "start" -> if (monochrome) R.drawable.qt_mono_start else R.drawable.qt_custom_start
        "swissmap" -> if (monochrome) R.drawable.qt_mono_swissmap else R.drawable.qt_custom_swissmap
        "v50associations" -> if (monochrome) R.drawable.qt_mono_v50associations else R.drawable.qt_custom_v50associations
        "v50loans" -> if (monochrome) R.drawable.qt_mono_v50loans else R.drawable.qt_custom_v50loans
        "v50market" -> if (monochrome) R.drawable.qt_mono_v50market else R.drawable.qt_custom_v50market
        else -> if(monochrome)R.drawable.qt_mono_plus else R.drawable.qt_custom_plus
}


/** 36 original glossy 3D motifs, in the order of the bundled 6 × 6 image sheet. */
private fun quartinaut3DTile(key: String): Int = when (key) {
        "home", "start", "navigation_home", "navigation_startseite" -> 0
        "discover", "entdecken", "plus", "quartier", "navigation_entdecken", "navigation_plus", "enhancements", "aktion_weiter", "aktion_zurueck" -> 1
        "create", "erstellen", "neu", "createNav", "navigation_erstellen", "aktion_hinzufuegen" -> 2
        "saved", "aktion_speichern" -> 3
        "gemeinde", "community", "community-pulse", "navigation_gemeinde", "enh-clubs" -> 4
        "sicherheit", "security", "safety-center", "enh-trust", "navigation_sicherheit", "aktion_bestaetigen", "aktion_auswaehlen" -> 5
        "chats", "messages", "navigation_messages", "aktion_versenden" -> 6
        "board", "bulletin" -> 7
        "market", "hub-create:market" -> 8
        "lend", "loans", "v50loans", "enh-loans", "hub-create:lend" -> 9
        "lost", "hub-create:lost" -> 10
        "enh-radar" -> 11
        "map", "swissmap" -> 12
        "enh-map" -> 13
        "municipal-compare" -> 14
        "need", "create-request" -> 15
        "offer", "create-offer", "aktion_freigeben" -> 16
        "group", "groupNav", "hub-create:group", "v50associations" -> 17
        "calendar", "enh-calendar", "official-calendar", "calendar-planner", "hub-create:calendar" -> 18
        "events" -> 19
        "official" -> 20
        "issue", "hub-create:issue", "aktion_melden", "aktion_abbrechen", "aktion_loeschen" -> 21
        "alerts" -> 22
        "project", "hub-create:project" -> 23
        "enh-posts", "enh-assist", "aktion_bearbeiten", "aktion_kopieren", "aktion_herunterladen", "aktion_hochladen" -> 24
        "enh-favorites" -> 25
        "v50market" -> 26
        "enh-qr" -> 27
        "search", "aktion_filtern" -> 28
        "inbox" -> 29
        "profile", "profil", "personal-center", "activity", "meine", "navigation_meine", "navigation_profile", "aktion_ausloggen" -> 30
        "settings", "admin", "navigation_admin" -> 31
        "enh-offline" -> 32
        "aktion_sperren" -> 33
        "sources", "help", "aktion_information" -> 34
        "diagnostics", "aktion_aktualisieren", "aktion_sortieren" -> 35
    else -> 1
}

private object QuartinautAtlasCache {
    @Volatile private var cached: ImageBitmap? = null
    @Synchronized fun load(context: Context): ImageBitmap? {
        cached?.let { return it }
        return runCatching {
            context.applicationContext.assets.open("qt3d_atlas.webp").use { input ->
                BitmapFactory.decodeStream(input)?.asImageBitmap()
            }
        }.getOrNull()?.also { cached = it }
    }
}
