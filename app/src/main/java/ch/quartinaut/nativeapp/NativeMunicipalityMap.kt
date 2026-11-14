package ch.quartinaut.nativeapp

import android.graphics.Region as AndroidRegion
import android.graphics.Bitmap
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.isActive
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.joinAll
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.asAndroidPath
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.PI

/**
 * Genuine native municipality map, not a web map.
 *
 * Municipality names and BFS numbers always come from the bundled
 * 05.11.2026 Swiss register. Boundary polygons come from the public
 * simplified 01.01.2025 GeoJSON (same source as Quartinaut web 5.4).
 * Historic boundary mismatches are called out in the UI; no fake data.
 */
private const val GEO_URL =
    "https://cdn.jsdelivr.net/gh/samkhavandi/Swiss_Geography_Look_Ups@main/geometries/municipality_2025.geojson"
private const val GEO_BACKUP =
    "https://raw.githubusercontent.com/samkhavandi/Swiss_Geography_Look_Ups/main/geometries/municipality_2025.geojson"
private const val VW = 960f
private const val VH = 600f

private data class RawFeature(val bfs: String, val rings: List<List<Offset>>)
private data class MapMunicipality(val bfs: String, val path: Path)

private fun readRings(geometry: JSONObject): List<List<Offset>> {
    val all = mutableListOf<List<Offset>>()
    val type = geometry.optString("type")
    val coords = geometry.optJSONArray("coordinates") ?: return emptyList()
    val polygons: List<JSONArray> = when(type) {
        "Polygon" -> listOf(coords)
        "MultiPolygon" -> (0 until coords.length()).mapNotNull { coords.optJSONArray(it) }
        else -> return emptyList()
    }
    for (polygon in polygons) {
        for (i in 0 until polygon.length()) {
            val ring = polygon.optJSONArray(i) ?: continue
            val vertices = mutableListOf<Offset>()
            for (j in 0 until ring.length()) {
                val coordinate = ring.optJSONArray(j) ?: continue
                if (coordinate.length() < 2) continue
                val longitude = coordinate.optDouble(0, Double.NaN)
                val latitude = coordinate.optDouble(1, Double.NaN)
                if (longitude.isFinite() && latitude.isFinite()) {
                    vertices.add(Offset(longitude.toFloat(),latitude.toFloat()))
                }
            }
            if(vertices.size >= 3) all.add(vertices)
        }
    }
    return all
}
private fun selectGeoId(feature: JSONObject): String {
    val props = feature.optJSONObject("properties") ?: JSONObject()
    val keys = listOf("bfs_nr","BFS_NR","BFS_Nummer","bfsCode")
    for(key in keys) {
        val value = props.optString(key).removeSuffix(".0")
        if(value.isNotBlank() && value != "null") return value
    }
    return feature.optString("id").removeSuffix(".0")
}
private fun loadFeatures(canton: Region): List<MapMunicipality> {
    val ids = canton.municipalities.map { it.bfs }.toSet()
    var json: JSONObject? = null
    for(url in listOf(GEO_URL,GEO_BACKUP)) {
        try {
            val conn = URL(url).openConnection() as HttpURLConnection
            conn.connectTimeout=9000;conn.readTimeout=12000
            try {
                val text=conn.inputStream.bufferedReader().use { it.readText() }
                val candidate = JSONObject(text)
                if(candidate.optString("type")=="FeatureCollection" &&
                   (candidate.optJSONArray("features")?.length() ?: 0) > 1900) {
                    json=candidate;break
                }
            } finally { conn.disconnect() }
        } catch (_: Exception) { /* Try alternate source */ }
    }
    val collection = json?.optJSONArray("features") ?: return emptyList()
    val selected = mutableListOf<RawFeature>()
    for(i in 0 until collection.length()) {
        val feature=collection.optJSONObject(i) ?: continue
        val id=selectGeoId(feature)
        if(id !in ids) continue
        val geometry=feature.optJSONObject("geometry") ?: continue
        val rings=readRings(geometry)
        if(rings.isNotEmpty()) selected.add(RawFeature(id,rings))
    }
    if(selected.isEmpty()) return emptyList()
    var count=0; var latSum=0.0
    for(feature in selected) for(ring in feature.rings) for(p in ring) {
        latSum+=p.y;count++
    }
    val cosLat=cos(latSum/count.coerceAtLeast(1)*PI/180.0).toFloat()
    var minX=Float.POSITIVE_INFINITY;var minY=Float.POSITIVE_INFINITY
    var maxX=Float.NEGATIVE_INFINITY;var maxY=Float.NEGATIVE_INFINITY
    for(feature in selected) for(ring in feature.rings) for(p in ring) {
        val x=p.x*cosLat; val y=-p.y
        minX=minOf(minX,x);maxX=maxOf(maxX,x)
        minY=minOf(minY,y);maxY=maxOf(maxY,y)
    }
    val spanX=(maxX-minX).coerceAtLeast(0.0001f)
    val spanY=(maxY-minY).coerceAtLeast(0.0001f)
    val scale=min((VW-48f)/spanX,(VH-48f)/spanY)
    val ox=(VW-spanX*scale)/2
    val oy=(VH-spanY*scale)/2
    return selected.map { feature ->
        val path=Path().apply { fillType=PathFillType.EvenOdd }
        for(ring in feature.rings) {
            ring.forEachIndexed { index,p ->
                val x=ox+(p.x*cosLat-minX)*scale
                val y=oy+(-p.y-minY)*scale
                if(index==0)path.moveTo(x,y) else path.lineTo(x,y)
            }
            path.close()
        }
        MapMunicipality(feature.bfs,path)
    }
}
@Composable
fun NativeMunicipalityMap(
    canton: Region, selected: Municipality?,
    onSelect: (Municipality) -> Unit
) {
    val context=LocalContext.current
    val imageLoader=remember(context) { wappenLoader(context) }
    var wappenLoading by remember(canton.code) { mutableStateOf(false) }
    var zoom by remember(canton.code) { mutableFloatStateOf(1f) }
    val coats by produceState<Map<String,Bitmap>>(initialValue=emptyMap(),canton.code) {
        wappenLoading=true
        val urls=withContext(Dispatchers.IO) { queryCantonWappen(canton,context) }
        // Progressive loading: keep the map usable while the coats arrive.
        val semaphore=Semaphore(6)
        coroutineScope {
            urls.map { (bfs,url) ->
                launch {
                    semaphore.withPermit {
                        wappenBitmap(context,imageLoader,url)?.let { image ->
                            value=value+(bfs to image)
                        }
                    }
                }
            }.joinAll()
        }
        wappenLoading=false
    }
    val regions by produceState<List<MapMunicipality>?>(initialValue=null,canton.code) {
        value=withContext(Dispatchers.IO) { loadFeatures(canton) }
    }
    when {
        regions == null -> Box(
            Modifier.fillMaxWidth().height(240.dp)
                .background(MaterialTheme.colorScheme.surfaceVariant,RoundedCornerShape(14.dp)),
            contentAlignment=Alignment.Center
        ) {
            Column(horizontalAlignment=Alignment.CenterHorizontally) {
                CircularProgressIndicator()
                Spacer(Modifier.height(9.dp))
                Text("Gemeindegrenzen werden geladen …")
            }
        }
        regions!!.isEmpty() -> {
            Text("Gemeindegrenzen sind momentan nicht erreichbar. Die vollständige Gemeindenliste und Steckbriefe bleiben verfügbar.",
                style=MaterialTheme.typography.bodySmall)
        }
        else -> {
            val features=regions!!
            val index=remember(canton.code) { canton.municipalities.associateBy { it.bfs } }
            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(9.dp),
                verticalAlignment=Alignment.CenterVertically) {
                Text("Kartenzoom",modifier=Modifier.weight(1f),
                    style=MaterialTheme.typography.labelMedium)
                listOf(1f,1.6f,2.5f).forEach {factor->
                    FilterChip(selected=zoom==factor,onClick={zoom=factor},
                        label={Text(when(factor){1f->"1×";1.6f->"1,6×";else->"2,5×"})})
                }
            }
            Canvas(
                Modifier.fillMaxWidth().height(260.dp)
                    .background(MaterialTheme.colorScheme.surfaceVariant,RoundedCornerShape(14.dp))
                    .pointerInput(features) {
                        detectTapGestures { tap ->
                            val scale=min(size.width/VW,size.height/VH)
                            val left=(size.width-VW*scale)/2
                            val top=(size.height-VH*scale)/2
                            val scaledX=(tap.x-size.width/2f)/zoom+size.width/2f
                            val scaledY=(tap.y-size.height/2f)/zoom+size.height/2f
                            val px=((scaledX-left)/scale).toInt()
                            val py=((scaledY-top)/scale).toInt()
                            features.firstOrNull { feature ->
                                val reg=AndroidRegion()
                                reg.setPath(feature.path.asAndroidPath(),
                                    AndroidRegion(0,0,VW.toInt()+2,VH.toInt()+2))
                                reg.contains(px,py)
                            }?.let { hit -> index[hit.bfs]?.let(onSelect) }
                        }
                    }
            ) {
                val scale=min(size.width/VW,size.height/VH)
                val left=(size.width-VW*scale)/2
                val top=(size.height-VH*scale)/2
                withTransform({
                    translate(size.width/2f,size.height/2f)
                    scale(zoom,zoom,pivot=Offset.Zero)
                    translate(-size.width/2f,-size.height/2f)
                    translate(left,top)
                    scale(scale,scale,pivot=Offset.Zero)
                }) {
                    features.forEach { feature ->
                        val active=feature.bfs==selected?.bfs
                        drawPath(feature.path,if(active)Color(0xFFDBAA39) else Color(0xFF95C7A7))
                        coats[feature.bfs]?.let { bitmap ->
                            val bounds=feature.path.getBounds()
                            if(bounds.width>8f && bounds.height>8f) {
                                drawIntoCanvas { canvas ->
                                    val native=canvas.nativeCanvas
                                    val saved=native.save()
                                    native.clipPath(feature.path.asAndroidPath())
                                    native.drawBitmap(bitmap,null,android.graphics.RectF(
                                        bounds.left,bounds.top,bounds.right,bounds.bottom),null)
                                    native.restoreToCount(saved)
                                }
                            }
                        }
                        drawPath(feature.path,
                            if(active) Color(0xFFFFCD57) else Color.White,
                            style=Stroke(if(active)2.5f else 1.25f))
                    }
                }
            }
            Text("Gemeindegrenzen 2025 · BFS-Verzeichnis 2026 · Wappen: Wikimedia Commons" +
                " · "+coats.size+"/"+features.size+" Wappen geladen" +
                (if(wappenLoading) " (weitere werden geladen …)" else
                    if(coats.size<features.size) " (fehlende online nicht verfügbar oder nicht zugeordnet)" else ""),
                style=MaterialTheme.typography.labelSmall,
                color=MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}