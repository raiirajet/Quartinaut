package ch.quartinaut.nativeapp

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

private data class QuartinautSource(
    val title:String, val role:String, val details:String, val url:String
)

/**
 * Links are transparent provenance records, not a claim that every linked
 * site granted rehosting permission. Historical fusions are intentionally not
 * used as current BFS assignments without individual verification.
 */
@Composable
fun NativeSourceReferencesScreen() {
    val context=LocalContext.current
    val sources=listOf(
        QuartinautSource(
            "Bundesamt für Statistik (BFS)",
            "Amtliches Gemeindeverzeichnis",
            "Gemeindenamen, BFS-Nummern und die Zuordnung zur aktuellen Schweizkarte. " +
                "Für den amtlichen Gemeindestand sind die BFS-Daten massgebend.",
            "https://www.bfs.admin.ch/bfs/de/home/grundlagen/agvch.html"
        ),
        QuartinautSource(
            "Swiss Flags – Yann Lerjen",
            "Fest gespeicherte Wappen aller 26 Kantone (MIT)",
            "Die Kantonswappen sind als SVG-Dateien direkt in der APK enthalten. " +
                "Quelle: swiss-flags von Yann Lerjen, MIT-Lizenz (2019). " +
                "Die vollständige Lizenz liegt in den App-Ressourcen unter " +
                "wappen/cantons/LICENSE-MIT.txt. Die Darstellung erfordert keine Internetverbindung.",
            "https://github.com/ylerjen/swiss-flags"
        ),
        QuartinautSource(
            "Wikidata",
            "BFS-Zuordnung und Wappenreferenzen",
            "Quartinaut sucht Wappen über die BFS-Gemeindenummer (P771) und " +
                "die Wappenbild-Eigenschaft P94. Diese Angaben sind gemeinschaftlich gepflegt, nicht amtlich.",
            "https://www.wikidata.org/wiki/Property:P771"
        ),
        QuartinautSource(
            "Wikimedia Commons",
            "Tatsächlich verwendete Bilddateien",
            "Gemeindewappen werden nur mit einer zugeordneten aktuellen BFS-Nummer " +
                "aus Wikidata/Commons übernommen. Einzelne Bilder sind beim Build " +
                "offline eingebunden, andere brauchen noch eine Verbindung. " +
                "Die Lizenz ist je Originaldatei zu prüfen.",
            "https://commons.wikimedia.org/wiki/Category:Coats_of_arms_of_municipalities_of_Switzerland"
        ),
        QuartinautSource(
            "Stiftung Schweizer Wappen und Fahnen",
            "Ergänzende historische Quelle – Fusionswappen",
            "Die verlinkte Sammlung behandelt neue und historische Fusionswappen. " +
                "Sie ist als Recherchehinweis aufgenommen; die Originalseite konnte " +
                "bei der letzten Prüfung nicht zuverlässig abgerufen werden. " +
                "Ein direkter Bildimport von dieser Seite ist daher nicht erfolgt. " +
                "Historische Wappen dürfen nicht automatisch aktuellen Gemeinden zugeordnet werden.",
            "http://www.stiftungswf.ch/Neue%20Fusions-Wappen.htm"
        ),
        QuartinautSource(
            "Wikimedia Commons – Fusionswappen",
            "Ergänzendes öffentliches Bildarchiv",
            "Einzelne Commons-Dateien geben die Stiftung als ursprüngliche Quelle an. " +
                "Datei, Gemeindeidentität und Nutzungsstatus sind einzeln nachvollziehbar.",
            "https://commons.wikimedia.org/wiki/Category:Fusionswappen"
        ),
        QuartinautSource(
            "Eidgenössisches Institut für Geistiges Eigentum",
            "Wappenschutz und rechtliche Grundlagen",
            "Gemeindewappen sind öffentliche Zeichen. Ein Quellenverweis allein " +
                "ersetzt keine Prüfung der gesetzlichen Nutzungsbedingungen oder " +
                "gegebenenfalls der Rechte einer bestimmten Bilddatei.",
            "https://www.ige.ch/de/etwas-schuetzen/herkunftsangaben/grundlegendes/swissness/schweizerwappen"
        )
    )
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())
        .padding(horizontal=16.dp,vertical=14.dp),
        verticalArrangement=Arrangement.spacedBy(13.dp)) {
        Text("Quellenverweise",style=MaterialTheme.typography.headlineSmall,
            fontWeight=FontWeight.Bold)
        Text("Woher kommen Wappen, Karten und Gemeindedaten?",
            style=MaterialTheme.typography.titleMedium)
        Text("Diese Übersicht trennt tatsächlich verwendete Datenquellen " +
            "von ergänzenden historischen Nachschlagewerken.",
            color=MaterialTheme.colorScheme.onSurfaceVariant)
        Surface(modifier=Modifier.fillMaxWidth(),shape=RoundedCornerShape(16.dp),
            color=MaterialTheme.colorScheme.surfaceVariant) {
            Row(Modifier.padding(14.dp),horizontalArrangement=Arrangement.spacedBy(10.dp)) {
                Icon(Icons.Default.Info,contentDescription=null,
                    tint=MaterialTheme.colorScheme.primary)
                Text("Die angezeigten Wappen sind keine amtlichen Beglaubigungen. " +
                    "Bei Gemeindefusionen gilt die aktuelle BFS-Zuordnung; historische " +
                    "Wappen sind nur als solche gekennzeichnet.",
                    style=MaterialTheme.typography.bodySmall)
            }
        }
        sources.forEach { source ->
            Surface(onClick={
                runCatching {
                    context.startActivity(Intent(Intent.ACTION_VIEW,
                        Uri.parse(source.url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                }
            },modifier=Modifier.fillMaxWidth(),
                shape=RoundedCornerShape(17.dp),
                color=MaterialTheme.colorScheme.surface,
                border=BorderStroke(1.dp,MaterialTheme.colorScheme.outlineVariant)) {
                Row(Modifier.padding(14.dp),
                    horizontalArrangement=Arrangement.spacedBy(11.dp),
                    verticalAlignment=Alignment.Top) {
                    Icon(Icons.Default.MenuBook,contentDescription=null,
                        tint=MaterialTheme.colorScheme.primary,
                        modifier=Modifier.size(24.dp))
                    Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(6.dp)) {
                        Text(source.title,fontWeight=FontWeight.SemiBold,
                            style=MaterialTheme.typography.titleMedium)
                        Text(source.role,style=MaterialTheme.typography.labelMedium,
                            color=MaterialTheme.colorScheme.primary)
                        Text(source.details,style=MaterialTheme.typography.bodySmall,
                            color=MaterialTheme.colorScheme.onSurfaceVariant)
                        Text("Originalquelle im Browser öffnen",
                            style=MaterialTheme.typography.labelMedium,
                            color=MaterialTheme.colorScheme.primary)
                    }
                    Icon(Icons.Default.OpenInNew,contentDescription="Quelle öffnen",
                        tint=MaterialTheme.colorScheme.primary,
                        modifier=Modifier.size(19.dp))
                }
            }
        }
        Text("Stand der Quellenhinweise: November 2026 · Quartinaut ist kein " +
            "amtliches Angebot des Bundes, der Kantone oder der Gemeinden.",
            style=MaterialTheme.typography.labelSmall,
            color=MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(20.dp))
    }
}
