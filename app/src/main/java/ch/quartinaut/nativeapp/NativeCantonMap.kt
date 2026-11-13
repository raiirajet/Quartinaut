package ch.quartinaut.nativeapp

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.asAndroidPath
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.xmlpull.v1.XmlPullParser
import org.xmlpull.v1.XmlPullParserFactory
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.min

private const val MAP_WIDTH = 1052.361f
private const val MAP_HEIGHT = 744.094f

@Composable
val SwissCapitals = mapOf("ZH" to "Zürich","BE" to "Bern","LU" to "Luzern",
    "UR" to "Altdorf","SZ" to "Schwyz","OW" to "Sarnen","NW" to "Stans",
    "GL" to "Glarus","ZG" to "Zug","FR" to "Freiburg / Fribourg",
    "SO" to "Solothurn","BS" to "Basel","BL" to "Liestal",
    "SH" to "Schaffhausen","AR" to "Herisau","AI" to "Appenzell",
    "SG" to "St. Gallen","GR" to "Chur","AG" to "Aarau",
    "TG" to "Frauenfeld","TI" to "Bellinzona","VD" to "Lausanne",
    "VS" to "Sitten / Sion","NE" to "Neuenburg / Neuchâtel",
    "GE" to "Genf / Genève","JU" to "Delsberg / Delémont")

@Composable
fun NativeCantonMap(selected: String, counts: Map<String,Int> = emptyMap(),
                    onSelect: (String) -> Unit) {
    val context = LocalContext.current
    val shapes by produceState<Map<String, Path>>(initialValue = emptyMap()) {
        value = withContext(Dispatchers.IO) {
            try {
                val input = try {
                    context.assets.open("q-original/quartinaut-logo.svg")
                } catch (_: Exception) {
                    val conn = URL("https://quartinaut.web.app/assets/icons/quartinaut-logo.svg").openConnection() as HttpURLConnection
                    conn.connectTimeout = 9000; conn.readTimeout = 9000
                    conn.inputStream
                }
                val parser = XmlPullParserFactory.newInstance().newPullParser()
                parser.setInput(input, "UTF-8")
                val paths = mutableMapOf<String, Path>()
                var event = parser.eventType
                while (event != XmlPullParser.END_DOCUMENT) {
                    if (event == XmlPullParser.START_TAG && parser.name == "path") {
                        val code = parser.getAttributeValue(null,"id") ?: ""
                        val d = parser.getAttributeValue(null,"d")
                        if (code in CANTON_CODES && !d.isNullOrBlank()) {
                            try { paths[code] = PathParser().parsePathString(d).toPath() }
                            catch (_: Exception) { /* Keep other cantons available */ }
                        }
                    }
                    event = parser.next()
                }
                input.close()
                paths
            } catch (_: Exception) { emptyMap() }
        }
    }
    Canvas(
        Modifier.fillMaxWidth().height(256.dp)
            .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(16.dp))
            .pointerInput(shapes) {
                detectTapGestures { tap ->
                    val factor = min(size.width.toFloat() / MAP_WIDTH, size.height.toFloat() / MAP_HEIGHT)
                    val dx = (size.width - MAP_WIDTH * factor) / 2
                    val dy = (size.height - MAP_HEIGHT * factor) / 2
                    val point = Offset((tap.x - dx)/factor, (tap.y - dy)/factor)
                    shapes.entries.firstOrNull { (_, path) ->
                        val region = android.graphics.Region()
                        region.setPath(path.asAndroidPath(), android.graphics.Region(
                            0, 0, MAP_WIDTH.toInt() + 2, MAP_HEIGHT.toInt() + 2))
                        region.contains(point.x.toInt(), point.y.toInt())
                    }?.key?.let(onSelect)
                }
            }
    ) {
        val factor = min(size.width / MAP_WIDTH, size.height / MAP_HEIGHT)
        val dx = (size.width - MAP_WIDTH * factor) / 2
        val dy = (size.height - MAP_HEIGHT * factor) / 2
        withTransform({
            translate(dx,dy)
            scale(factor,factor, pivot = Offset.Zero)
        }) {
            shapes.forEach { (code,path) ->
                val maxCount=(counts.values.maxOrNull() ?: 0).coerceAtLeast(1)
                val strength=((counts[code] ?: 0).toFloat()/maxCount.toFloat()).coerceIn(0f,1f)
                val color = if (code == selected) Color(0xFF18583F)
                    else lerp(Color(0xFFAAD9BA),Color(0xFF1D6849),strength)
                drawPath(path, color)
                drawPath(path, Color.White, style = Stroke(1.6f))
                val bounds=path.getBounds()
                val labelSize = (kotlin.math.min(bounds.width,bounds.height)*0.33f)
                    .coerceIn(12f,36f)
                val paint=android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
                    textAlign=android.graphics.Paint.Align.CENTER
                    color=if(code==selected || (counts[code] ?: 0) > ((counts.values.maxOrNull() ?: 0)/2))
                        android.graphics.Color.WHITE else android.graphics.Color.rgb(20,72,53)
                    textSize=labelSize
                    typeface=android.graphics.Typeface.DEFAULT_BOLD
                }
                drawContext.canvas.nativeCanvas.drawText(
                    code,bounds.center.x,bounds.center.y+labelSize*0.35f,paint)
            }
        }
    }
}
