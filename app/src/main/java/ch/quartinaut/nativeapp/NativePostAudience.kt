package ch.quartinaut.nativeapp

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.Build
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
import kotlin.math.roundToInt

/**
 * UI and validation for the future server-controlled publication audience.
 *
 * Fail closed: current production callable and Firestore rules were not
 * deployed with audience enforcement. Only the existing canton publication
 * can be submitted until a verified backend rollout.
 */
internal const val AUDIENCE_BACKEND_READY = false
internal val AudienceScopes = linkedMapOf(
    "radius" to "Umkreis",
    "municipality" to "Gemeinde",
    "canton" to "Kanton",
    "country" to "Schweizweit"
)
internal val AudienceRadiiKm = listOf(5,10,25,50)

internal fun canPublishAudience(scope: String, radiusKm: Int, lat: Double?, lon: Double?): Boolean {
    if(scope !in AudienceScopes.keys) return false
    if(scope=="radius" && (radiusKm !in AudienceRadiiKm || lat==null || lon==null ||
       !lat.isFinite() || !lon.isFinite() || lat !in 45.0..48.0 || lon !in 5.0..11.0)) return false
    return AUDIENCE_BACKEND_READY || scope=="canton"
}
internal fun audienceLabel(scope: String, radiusKm: Int) =
    if(scope=="radius") "Umkreis von $radiusKm km" else AudienceScopes[scope] ?: "Kanton"

/** Called only after an explicit user tap; the app never tracks location in the background. */
@SuppressLint("MissingPermission")
private fun locateForAudience(context: Context, callback: (Location?) -> Unit) {
    val manager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
    if(manager==null) { callback(null);return }
    val providers=listOf(LocationManager.GPS_PROVIDER,LocationManager.NETWORK_PROVIDER)
    val selected=providers.firstOrNull { provider ->
        runCatching {manager.isProviderEnabled(provider)}.getOrDefault(false)
    }
    if(selected==null) { callback(null);return }
    try {
        if(Build.VERSION.SDK_INT>=30) {
            manager.getCurrentLocation(selected,null,context.mainExecutor) { location ->
                callback(location)
            }
        } else {
            callback(manager.getLastKnownLocation(selected))
        }
    } catch (_: SecurityException) { callback(null) }
      catch (_: Exception) { callback(null) }
}

@Composable
internal fun PublicationAudiencePicker(
    scope: String,
    radiusKm: Int,
    latitude: Double?,
    longitude: Double?,
    onScope: (String) -> Unit,
    onRadius: (Int) -> Unit,
    onCoordinates: (Double,Double) -> Unit
) {
    val context=LocalContext.current
    var locationInfo by rememberSaveable { mutableStateOf("") }
    val applyLocation: (Location?) -> Unit = { location ->
        if(location==null) locationInfo="Standort nicht verfügbar. GPS einschalten und erneut versuchen."
        else {
            // Coarse publication centre (~1 km), not the device's exact address.
            val la=(location.latitude*100).roundToInt()/100.0
            val lo=(location.longitude*100).roundToInt()/100.0
            if(la in 45.0..48.0 && lo in 5.0..11.0) {
                onCoordinates(la,lo)
                locationInfo="Ungefährer Standort bestimmt. Keine genaue Adresse veröffentlicht."
            } else locationInfo="Der Mittelpunkt muss in der Schweiz liegen."
        }
    }
    val requestPermission=rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { result ->
        if(result.values.any {it}) locateForAudience(context,applyLocation)
        else locationInfo="Ohne Standortfreigabe kann kein Umkreis verwendet werden."
    }
    Column(verticalArrangement=Arrangement.spacedBy(9.dp)) {
        Text("Wer soll deinen Beitrag sehen?",style=MaterialTheme.typography.titleMedium)
        Text("Wähle die geplante Reichweite. Die Standortbestimmung erfolgt nur mit deiner Zustimmung.",
            style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant)
        AudienceScopes.forEach { (key,label) ->
            FilterChip(selected=scope==key,onClick={onScope(key)},
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
            OutlinedButton(onClick={
                val fine=ContextCompat.checkSelfPermission(context,Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED
                val coarse=ContextCompat.checkSelfPermission(context,Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED
                if(fine||coarse) locateForAudience(context,applyLocation)
                else requestPermission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION))
            }) { Text("Standort einmalig bestimmen") }
            Text(if(latitude!=null && longitude!=null)
                "Mittelpunkt gespeichert (auf ca. 1 km gerundet)." else "Noch kein Standort festgelegt.",
                style=MaterialTheme.typography.bodySmall)
            if(locationInfo.isNotBlank())Text(locationInfo,
                style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant)
        }
        if(!AUDIENCE_BACKEND_READY && scope!="canton") {
            Text("Diese Reichweite ist vorbereitet, aber noch nicht aktiv: Das Firebase-Backend muss die Sichtbarkeit zuerst verbindlich durchsetzen. Bis dahin ist nur die bestehende Kantons-Reichweite veröffentlichbar.",
                color=MaterialTheme.colorScheme.error,style=MaterialTheme.typography.bodySmall)
        }
    }
}
