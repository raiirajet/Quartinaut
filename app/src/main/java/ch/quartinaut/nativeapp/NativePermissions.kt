package ch.quartinaut.nativeapp

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner

internal const val STARTUP_PERMISSIONS_COMPLETED = "startup_permissions_completed_v1"
private const val STARTUP_PERMISSIONS_ATTEMPTED = "startup_permissions_attempted_v1"

/** Approximate location is sufficient; never re-request precision as a requirement. */
internal fun missingRuntimePermissions(
    sdk: Int,
    cameraAvailable: Boolean,
    granted: (String) -> Boolean
): List<String> = buildList {
    if (!granted(Manifest.permission.ACCESS_COARSE_LOCATION) &&
        !granted(Manifest.permission.ACCESS_FINE_LOCATION)) {
        // Android 12+ requires the pair when precise location is offered.
        add(Manifest.permission.ACCESS_COARSE_LOCATION)
        add(Manifest.permission.ACCESS_FINE_LOCATION)
    }
    if (cameraAvailable && !granted(Manifest.permission.CAMERA)) {
        add(Manifest.permission.CAMERA)
    }
    if (sdk >= 33 && !granted(Manifest.permission.POST_NOTIFICATIONS)) {
        add(Manifest.permission.POST_NOTIFICATIONS)
    }
}

private data class PermissionStatus(
    val fineLocation: Boolean,
    val coarseLocation: Boolean,
    val camera: Boolean,
    val cameraAvailable: Boolean,
    val notificationsEnabled: Boolean,
    val locationEnabled: Boolean
)

private fun readPermissionStatus(context: Context): PermissionStatus {
    fun granted(permission: String) = ContextCompat.checkSelfPermission(
        context, permission
    ) == PackageManager.PERMISSION_GRANTED
    val location = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
    val locationEnabled = runCatching {
        if (Build.VERSION.SDK_INT >= 28) location?.isLocationEnabled == true
        else location?.isProviderEnabled(LocationManager.GPS_PROVIDER) == true ||
            location?.isProviderEnabled(LocationManager.NETWORK_PROVIDER) == true
    }.getOrDefault(false)
    return PermissionStatus(
        fineLocation = granted(Manifest.permission.ACCESS_FINE_LOCATION),
        coarseLocation = granted(Manifest.permission.ACCESS_COARSE_LOCATION),
        camera = granted(Manifest.permission.CAMERA),
        cameraAvailable = context.packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY),
        notificationsEnabled = NotificationManagerCompat.from(context).areNotificationsEnabled(),
        locationEnabled = locationEnabled
    )
}

/** Device setup runs before login and the welcome tour, so dialogs cannot overlap. */
@Composable
internal fun NativePermissionSetup(
    autoRequest: Boolean = true,
    onFinish: () -> Unit
) {
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val preferences = remember(context) {
        context.getSharedPreferences("quartinaut_android", Context.MODE_PRIVATE)
    }
    var status by remember { mutableStateOf(readPermissionStatus(context)) }
    var requesting by remember { mutableStateOf(false) }
    var settingsError by remember { mutableStateOf("") }
    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {
        requesting = false
        status = readPermissionStatus(context)
    }
    fun missing(): List<String> = missingRuntimePermissions(
        Build.VERSION.SDK_INT, status.cameraAvailable
    ) { permission ->
        ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
    }
    fun requestMissing() {
        val permissions = missing()
        // Persist before launch: denial or process death must not create a prompt loop.
        preferences.edit().putBoolean(STARTUP_PERMISSIONS_ATTEMPTED, true).apply()
        if (permissions.isNotEmpty() && !requesting) {
            requesting = true
            launcher.launch(permissions.toTypedArray())
        }
    }
    fun openSettings(intent: Intent) {
        runCatching { context.startActivity(intent) }.onFailure {
            settingsError = "Öffne Android-Einstellungen → Apps → Quartinaut → Berechtigungen."
        }
    }
    DisposableEffect(lifecycle, context) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                status = readPermissionStatus(context)
            }
        }
        lifecycle.addObserver(observer)
        onDispose { lifecycle.removeObserver(observer) }
    }
    LaunchedEffect(autoRequest) {
        if (autoRequest && !preferences.getBoolean(STARTUP_PERMISSIONS_ATTEMPTED, false)) {
            requestMissing()
        }
    }
    BackHandler(enabled = !requesting, onBack = onFinish)

    Column(
        Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)
            .safeDrawingPadding().verticalScroll(rememberScrollState()).padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Text("Berechtigungen für Quartinaut", style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold)
        Text("Android fragt die benötigten Freigaben direkt ab. Du kannst jede ablehnen und Quartinaut trotzdem nutzen.")
        PermissionStatusCard("Standort", when {
            status.fineLocation -> "Genauer Standort erlaubt"
            status.coarseLocation -> "Ungefährer Standort erlaubt"
            else -> "Noch nicht erlaubt"
        }, "Für die einmalige Standortbestimmung beim Wählen eines Umkreises. Ein ungefährer Standort reicht aus.")
        PermissionStatusCard("Kamera", when {
            !status.cameraAvailable -> "Auf diesem Gerät nicht verfügbar"
            status.camera -> "Erlaubt"
            else -> "Noch nicht erlaubt"
        }, "Zum Scannen von QR-Codes, etwa bei einer Übergabe.")
        PermissionStatusCard("Benachrichtigungen",
            if (status.notificationsEnabled) "Erlaubt" else "In Android deaktiviert",
            "Für Hinweise zu Chats und lokalen Neuigkeiten. Ab Android 13 ist eine eigene Freigabe nötig.")
        Text("Internetzugriff ist automatisch erlaubt. Fotos wählst du über die Android-Dateiauswahl aus.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (!status.locationEnabled) {
            Text("Der Standortdienst ist ausgeschaltet. Zur Standortbestimmung muss er zusätzlich eingeschaltet sein.",
                style = MaterialTheme.typography.bodySmall)
            OutlinedButton(onClick = {
                openSettings(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
            }, enabled = !requesting, modifier = Modifier.fillMaxWidth()) {
                Text("Standortdienst öffnen")
            }
        }
        if (requesting) {
            LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
            Text("Bitte die Android-Abfragen beantworten.")
        } else if (missing().isNotEmpty()) {
            OutlinedButton(onClick = { requestMissing() }, modifier = Modifier.fillMaxWidth()) {
                Text("Fehlende Berechtigungen anfragen")
            }
        }
        OutlinedButton(onClick = {
            openSettings(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:${context.packageName}")))
        }, enabled = !requesting, modifier = Modifier.fillMaxWidth()) {
            Text("In Android verwalten")
        }
        Text("Bereits erlaubte Freigaben werden nicht erneut abgefragt. Dauerhaft abgelehnte Freigaben kannst du in Android verwalten.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (settingsError.isNotEmpty()) {
            Text(settingsError, color = MaterialTheme.colorScheme.error)
        }
        Button(onClick = onFinish, enabled = !requesting, modifier = Modifier.fillMaxWidth()) {
            Text("Weiter zu Quartinaut")
        }
    }
}

@Composable
private fun PermissionStatusCard(title: String, status: String, description: String) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Text(status, color = MaterialTheme.colorScheme.primary)
            Text(description, style = MaterialTheme.typography.bodySmall)
        }
    }
}
