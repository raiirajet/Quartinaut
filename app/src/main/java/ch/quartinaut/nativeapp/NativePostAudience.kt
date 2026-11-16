package ch.quartinaut.nativeapp

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/**
 * Requests use an authenticated, isolated regional service. Other community
 * features retain their existing canton scope until their matching rollout.
 */
internal const val AUDIENCE_BACKEND_READY = false
internal const val REQUEST_AUDIENCE_BACKEND_READY = true
internal val AudienceScopes = linkedMapOf(
    "radius" to "Umkreis",
    "municipality" to "Gemeinde",
    "canton" to "Kanton",
    "country" to "Schweizweit"
)
internal val AudienceRadiiKm = listOf(5,10,25,50)

internal fun canPublishAudience(scope: String, radiusKm: Int, lat: Double?, lon: Double?, backendReady: Boolean = AUDIENCE_BACKEND_READY): Boolean {
    if(scope !in AudienceScopes.keys) return false
    if(scope=="radius" && (radiusKm !in AudienceRadiiKm || lat==null || lon==null ||
       !lat.isFinite() || !lon.isFinite() || lat !in 45.0..48.0 || lon !in 5.0..11.0)) return false
    return backendReady || scope=="canton"
}
internal fun audienceLabel(scope: String, radiusKm: Int) =
    if(scope=="radius") "Umkreis von $radiusKm km" else AudienceScopes[scope] ?: "Kanton"

@Composable
internal fun PublicationAudiencePicker(
    scope: String,
    radiusKm: Int,
    latitude: Double?,
    longitude: Double?,
    onScope: (String) -> Unit,
    onRadius: (Int) -> Unit,
    onCoordinates: (Double,Double) -> Unit,
    backendReady: Boolean = AUDIENCE_BACKEND_READY
) {
    LaunchedEffect(backendReady) {
        if(!backendReady && scope!="canton")onScope("canton")
    }
    Column(verticalArrangement=Arrangement.spacedBy(9.dp)) {
        Text("Wer soll deinen Beitrag sehen?",style=MaterialTheme.typography.titleMedium)
        Text("Wähle die Reichweite deines Beitrags.",style=MaterialTheme.typography.bodySmall)
        AudienceScopes.forEach { (key,label) ->
            FilterChip(selected=scope==key,onClick={onScope(key)},
                enabled=backendReady||key=="canton",
                label={Text(label)},modifier=Modifier.fillMaxWidth())
        }
        if(scope=="radius") {
            Text("Entfernung ab ungefährem Standort")
            Row(horizontalArrangement=Arrangement.spacedBy(5.dp),modifier=Modifier.fillMaxWidth()) {
                AudienceRadiiKm.forEach { value ->
                    FilterChip(selected=radiusKm==value,onClick={onRadius(value)},
                        label={Text("$value km")},modifier=Modifier.weight(1f))
                }
            }
            AudienceLocationControl(latitude,longitude,onCoordinates)
        }
        if(!backendReady)Text("Für diesen Bereich ist zurzeit die Kantons-Reichweite verfügbar.",
            style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
internal fun AudienceLocationControl(latitude:Double?,longitude:Double?,onCoordinates:(Double,Double)->Unit) {
    val context=LocalContext.current
    val coroutineScope=rememberCoroutineScope()
    var locationInfo by rememberSaveable { mutableStateOf("") }
    var locating by remember { mutableStateOf(false) }
    var street by rememberSaveable { mutableStateOf("") }
    var approximateStreet by rememberSaveable { mutableStateOf(false) }
    fun locate() {
        if(locating)return
        locating=true
        street=""
        locationInfo="Standort wird ermittelt …"
        coroutineScope.launch {
            try {
                val location=determineAudienceLocation(context)
                if(location==null) {
                    locationInfo="Kein aktueller Standort empfangen. Standortdienst prüfen und erneut versuchen."
                } else {
                    val la=(location.latitude*100).roundToInt()/100.0
                    val lo=(location.longitude*100).roundToInt()/100.0
                    if(la in 45.0..48.0 && lo in 5.0..11.0) {
                        approximateStreet=location.accuracy>100f
                        onCoordinates(la,lo)
                        locationInfo="Standort ermittelt. Straße wird gesucht …"
                        street=determineStreet(context,location.latitude,location.longitude).orEmpty()
                        locationInfo=if(street.isBlank())
                            "Standort ermittelt. Ein Straßenname ist hier nicht verfügbar."
                        else "Straße ermittelt – ohne Hausnummer."
                    } else locationInfo="Der Mittelpunkt muss in der Schweiz liegen."
                }
            } finally { locating=false }
        }
    }
    val requestPermission=rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { result ->
        if(result.values.any {it}) locate()
        else locationInfo="Ohne Standortfreigabe kann kein Umkreis verwendet werden."
    }
    Column(verticalArrangement=Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick={
                val fine=ContextCompat.checkSelfPermission(context,Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED
                val coarse=ContextCompat.checkSelfPermission(context,Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED
                if(fine||coarse) locate()
                else requestPermission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION))
            },enabled=!locating) { Text(if(locating) "Standort wird ermittelt …" else "Standort einmalig bestimmen") }
            if(locating)LinearProgressIndicator(modifier=Modifier.fillMaxWidth())
            if(street.isNotBlank())Text((if(approximateStreet) "Straße in Standortnähe: " else "Ermittelte Straße: ")+street,
                style=MaterialTheme.typography.bodyMedium)
            if(street.isNotBlank()&&approximateStreet)Text("Android meldet einen ungefähren Standort. Der Straßenname kann deshalb abweichen.",
                style=MaterialTheme.typography.bodySmall)
            if(approximateStreet && !locating && ContextCompat.checkSelfPermission(
                context,Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED
            )TextButton(onClick={requestPermission.launch(arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION))}) {
                Text("Genauen Standort für die Straßenanzeige erlauben")
            }
            Text(if(latitude!=null && longitude!=null)
                "Mittelpunkt gespeichert (auf ca. 1 km gerundet)." else "Noch kein Standort festgelegt.",
                style=MaterialTheme.typography.bodySmall)
            if(locationInfo.isNotBlank())Text(locationInfo,
                style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant)
            if(!locating && locationInfo.startsWith("Kein aktueller"))TextButton(onClick={
                runCatching {context.startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))}
            }) {Text("Android-Standortdienst öffnen")}
            Text("Der Straßenname erscheint nur hier. Keine Hausnummer und keine genaue Position werden veröffentlicht.",
                style=MaterialTheme.typography.bodySmall)
    }
}

@Composable
internal fun NativeNearbyRequestsLocation(repo:QuartinautRepository) {
    var expanded by rememberSaveable { mutableStateOf(false) }
    var lat by rememberSaveable { mutableStateOf<Double?>(null) }
    var lon by rememberSaveable { mutableStateOf<Double?>(null) }
    OutlinedButton(onClick={expanded=!expanded},modifier=Modifier.fillMaxWidth()) {
        Text(if(repo.hasAudienceLocation) "Umkreis-Standort aktualisieren" else "Umkreis-Anliegen in meiner Nähe")
    }
    if(expanded)AudienceLocationControl(lat,lon) { la,lo ->
        lat=la;lon=lo;repo.setAudienceLocation(la,lo)
    }
}
