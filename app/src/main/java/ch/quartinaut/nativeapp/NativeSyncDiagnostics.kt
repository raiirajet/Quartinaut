package ch.quartinaut.nativeapp

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.WarningAmber
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

/**
 * Permission errors should not interrupt access to public content.
 * This view identifies which exact Firestore feed was rejected without
 * exposing user IDs or changing production security rules.
 */
@Composable
fun NativeSyncDiagnostics(repo: QuartinautRepository) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())
        .padding(18.dp), verticalArrangement=Arrangement.spacedBy(14.dp)) {
        Text("Verbindungsdiagnose",style=MaterialTheme.typography.headlineSmall,
            fontWeight=FontWeight.Bold)
        Text("Quartinaut überprüft jeden Datenbereich separat. Verweigerte Abfragen werden hier angezeigt, ohne die Startseite zu blockieren.")
        Text("Projekt: quartinaut  ·  Region: europe-west6",
            style=MaterialTheme.typography.bodySmall)
        Text("Erweiterungsdienst: "+when {
            repo.enhancementLoading -> "Prüfung läuft"
            repo.enhancementReady -> "Erreichbar"
            repo.enhancementError.isNotBlank() -> "Nicht erreichbar"
            else -> "Noch nicht geprüft"
        },style=MaterialTheme.typography.bodySmall)
        val issues=repo.syncIssues
        if(issues.isEmpty()) {
            Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Default.CheckCircle,null,tint=Color(0xFF2F8754))
                Text("Keine aktuellen Fehler bei den bisher geprüften Diensten. Nicht geprüfte Dienste sind damit nicht bestätigt.")
            }
        } else {
            issues.forEach { (source, detail) ->
                Card(colors=CardDefaults.cardColors(
                    containerColor=MaterialTheme.colorScheme.surfaceVariant)) {
                    Column(Modifier.fillMaxWidth().padding(14.dp),
                        verticalArrangement=Arrangement.spacedBy(8.dp)) {
                        Row {
                            Icon(Icons.Default.WarningAmber,null,
                                tint=MaterialTheme.colorScheme.error)
                            Spacer(Modifier.width(9.dp))
                            Text(source,fontWeight=FontWeight.SemiBold)
                        }
                        Text(detail,style=MaterialTheme.typography.bodySmall)
                        if(detail.contains("PERMISSION_DENIED",ignoreCase=true) ||
                           detail.contains("permission",ignoreCase=true)) {
                            Text("Firebase hat diese Abfrage zurückgewiesen. Prüfe Kontorolle, serverseitige Claims und die bestehenden Firestore-Regeln. Keine Regeln pauschal öffnen.",
                                style=MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
        }
        Text("Fehlermeldungen bleiben bestehen, bis der betroffene Dienst erfolgreich antwortet.",
            style=MaterialTheme.typography.bodySmall)
        Button(onClick=repo::retryFeeds,enabled=!repo.busy,
            modifier=Modifier.fillMaxWidth()) { Text("Datenbereiche erneut laden") }
        Text("Ein Fehler in einem optionalen Bereich muss nicht bedeuten, dass dein Konto gesperrt ist.",
            style=MaterialTheme.typography.bodySmall)
    }
}
