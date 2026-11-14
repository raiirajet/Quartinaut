package ch.quartinaut.nativeapp

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream

/**
 * Uses the Android document picker (no broad storage permission), decodes a
 * bounded bitmap and re-encodes it as JPEG without the original metadata.
 * This is also validated and sanitized by the Cloud Function.
 */
suspend fun prepareDashboardImage(context: Context, uri: Uri): ByteArray =
    withContext(Dispatchers.IO) {
        val resolver = context.contentResolver
        // Cloud backend limits: maximum 24 MP and at most 3 MB of JPEG.
        val header = BitmapFactory.Options().apply { inJustDecodeBounds=true }
        resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it,null,header) }
            ?: error("Foto kann nicht geöffnet werden.")
        val width=header.outWidth
        val height=header.outHeight
        if(width<=0 || height<=0 || width.toLong()*height.toLong()>24_000_000L) {
            error("Das Foto darf höchstens 24 Megapixel haben.")
        }
        var sample=1
        while(maxOf(width,height)/sample > 1600) sample*=2
        val options=BitmapFactory.Options().apply {inSampleSize=sample}
        val bitmap=resolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it,null,options)
        } ?: error("Foto ist nicht lesbar.")
        try {
            for(quality in listOf(82,72,60,48)) {
                val output=ByteArrayOutputStream()
                if(!bitmap.compress(Bitmap.CompressFormat.JPEG,quality,output)) {
                    error("Foto konnte nicht komprimiert werden.")
                }
                val data=output.toByteArray()
                if(data.size<=2_400_000) return@withContext data
            }
            error("Bitte ein kleineres Foto auswählen.")
        } finally {bitmap.recycle()}
    }

@Composable
fun NativeDashboardBackgroundSettings(repo: QuartinautRepository) {
    val context=LocalContext.current
    val scope= rememberCoroutineScope()
    var localError by remember {mutableStateOf("")}
    var resetConfirmation by remember {mutableStateOf(false)}
    val picker= rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if(uri!=null) {
            localError=""
            scope.launch {
                try {
                    val bytes=prepareDashboardImage(context,uri)
                    repo.saveDashboardBackground(Base64.encodeToString(bytes,Base64.NO_WRAP))
                } catch(error: Exception) {
                    localError=error.localizedMessage ?: "Bild konnte nicht verarbeitet werden."
                }
            }
        }
    }
    LaunchedEffect(repo.user?.uid) { if(repo.user!=null) repo.loadDashboardBackground() }
    Column(verticalArrangement=Arrangement.spacedBy(10.dp)) {
        Text("Dashboard-Hintergrund",style=MaterialTheme.typography.titleMedium,
            fontWeight=FontWeight.SemiBold)
        Text("Persönliches Foto – serverseitig und nur für dein Konto gespeichert.",
            style=MaterialTheme.typography.bodySmall)
        repo.dashboardBackground?.let {bitmap ->
            Card(shape=RoundedCornerShape(16.dp)) {
                Image(bitmap.asImageBitmap(),contentDescription="Vorschau deines Dashboard-Hintergrunds",
                    modifier=Modifier.fillMaxWidth().height(150.dp),
                    contentScale=ContentScale.Crop)
            }
        }
        when(repo.dashboardBackgroundStatus) {
            "unavailable" -> Text("Der geschützte Serverdienst ist noch nicht veröffentlicht. Speichern wird erst nach dem Backend-Deployment freigeschaltet.",
                style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.error)
            "error" -> Text("Der Hintergrunddienst ist gerade nicht erreichbar.",
                style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.error)
        }
        if(localError.isNotBlank()) Text(localError,color=MaterialTheme.colorScheme.error)
        Row(horizontalArrangement=Arrangement.spacedBy(10.dp)) {
            Button(
                onClick={picker.launch("image/*")},
                enabled=repo.dashboardBackgroundStatus=="ready"&&!repo.backgroundBusy
            ) { Text("Foto auswählen") }
            OutlinedButton(
                onClick={resetConfirmation=true},
                enabled=repo.dashboardBackground!=null&&!repo.backgroundBusy
            ) { Text("Entfernen") }
        }
        if(repo.backgroundBusy) LinearProgressIndicator(Modifier.fillMaxWidth())
        Text("Originalbilder werden auf dem Gerät und nochmals serverseitig verkleinert. Kein öffentlicher Bildlink.",
            style=MaterialTheme.typography.labelSmall)
        TextButton(onClick={repo.loadDashboardBackground()}) { Text("Vom Server aktualisieren") }
    }
    if(resetConfirmation) {
        AlertDialog(onDismissRequest={resetConfirmation=false},
            title={Text("Hintergrund entfernen?")},
            text={Text("Das gespeicherte Foto wird aus deinem privaten Serverspeicher gelöscht.")},
            confirmButton={
                TextButton(onClick={resetConfirmation=false;repo.removeDashboardBackground()}) {
                    Text("Bild löschen")
                }
            },
            dismissButton={TextButton(onClick={resetConfirmation=false}) {Text("Abbrechen")}})
    }
}

@Composable
fun NativeDashboardHero(repo: QuartinautRepository) {
    val photo=repo.dashboardBackground
    Box(Modifier.fillMaxWidth().height(190.dp),
        contentAlignment=Alignment.BottomStart) {
        if(photo != null) {
            Image(photo.asImageBitmap(),contentDescription="Dein persönliches Dashboard-Hintergrundbild",
                modifier=Modifier.fillMaxSize(),contentScale=ContentScale.Crop)
            Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha=0.52f)))
        } else {
            Box(Modifier.fillMaxSize().background(Color(0xFF195A42)))
        }
        Column(Modifier.padding(20.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
            Text("Dein Quartier auf einen Blick",color=Color.White,
                style=MaterialTheme.typography.titleLarge)
            Row(horizontalArrangement=Arrangement.spacedBy(18.dp)) {
                DashboardHeroMetric(repo.requests.count { it.str("status")=="offen" },
                    "Anliegen")
                DashboardHeroMetric(repo.hubItems.count { DocString(it["status"])=="published" },
                    "Quartier+")
                DashboardHeroMetric(repo.chats.size,"Chats")
            }
        }
    }
}
@Composable
private fun DashboardHeroMetric(count:Int,label:String) {
    Column {
        Text(count.toString(),style=MaterialTheme.typography.headlineSmall,
            color=Color.White,fontWeight=FontWeight.Bold)
        Text(label,color=Color.White,style=MaterialTheme.typography.labelSmall)
    }
}
