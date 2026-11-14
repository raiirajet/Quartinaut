package ch.quartinaut.nativeapp

import android.graphics.Region as AndroidRegion
import android.graphics.Bitmap
import android.util.JsonReader
import android.util.JsonToken
import android.util.JsonWriter
import java.io.StringWriter
import java.io.InputStreamReader
import java.util.concurrent.ConcurrentHashMap
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
private val geometryCache = ConcurrentHashMap<String,List<MapMunicipality>>()

/**
 * Copy one JSON value at a time, rather than materialising all 2,000+
 * municipality polygons (and their coordinates) in a single JSONObject.
 */
private fun copyJson(reader:JsonReader,writer:JsonWriter,depth:Int=0) {
    require(depth<30) { "GeoJSON nesting too deep" }
    when(reader.peek()) {
        JsonToken.BEGIN_OBJECT -> {
            reader.beginObject();writer.beginObject()
            while(reader.hasNext()){
                writer.name(reader.nextName())
                copyJson(reader,writer,depth+1)
            }
            reader.endObject();writer.endObject()
        }
        JsonToken.BEGIN_ARRAY -> {
            reader.beginArray();writer.beginArray()
            while(reader.hasNext()) copyJson(reader,writer,depth+1)
            reader.endArray();writer.endArray()
        }
        JsonToken.STRING -> writer.value(reader.nextString())
        JsonToken.NUMBER -> writer.value(reader.nextString().toDoubleOrNull() ?: 0.0)
        JsonToken.BOOLEAN -> writer.value(reader.nextBoolean())
        JsonToken.NULL -> {reader.nextNull();writer.nullValue()}
        else -> reader.skipValue()
    }
}
private fun readCantonFeatures(connection:HttpURLConnection,ids:Set<String>):List<RawFeature> {
    val selected=ArrayList<RawFeature>()
    JsonReader(InputStreamReader(connection.inputStream,Charsets.UTF_8)).use { reader ->
        reader.isLenient=false
        reader.beginObject()
        while(reader.hasNext()) {
            if(reader.nextName()!="features") {
                reader.skipValue()
                continue
            }
            reader.beginArray()
            while(reader.hasNext()) {
                val buffer=StringWriter()
                JsonWriter(buffer).use { writer -> copyJson(reader,writer) }
                val feature=JSONObject(buffer.toString())
                val id=selectGeoId(feature)
                if(id in ids) {
                    val geometry=feature.optJSONObject("geometry")
                    if(geometry!=null) {
                        val rings=readRings(geometry)
                        if(rings.isNotEmpty()) selected.add(RawFeature(id,rings))
                    }
                }
            }
            reader.endArray()
        }
        reader.endObject()
    }
    return selected
}

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
                // The original shapes are far more detailed than a phone canvas.
                // Preserve the closing point; reduce path/clip complexity.
                if(j % 3 != 0 && j != ring.length()-1) continue
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
    geometryCache[canton.code]?.let { return it }
    val ids=canton.municipalities.map { it.bfs }.toSet()
    var selected=emptyList<RawFeature>()
    for(url in listOf(GEO_URL,GEO_BACKUP)) {
        var conn:HttpURLConnection?=null
        try {
            conn=(URL(url).openConnection() as HttpURLConnection).apply {
                connectTimeout=6500
                readTimeout=12000
                setRequestProperty("Accept","application/geo+json,application/json")
            }
            selected=readCantonFeatures(conn,ids)
            if(selected.isNotEmpty())break
        } catch (_:Exception) {
            // Network and malformed upstream geometry must not crash a map screen.
        } finally {
            conn?.disconnect()
        }
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
    val result=selected.map { feature ->
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
    if(result.isNotEmpty())geometryCache[canton.code]=result
    return result
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
        val displayed=java.util.Collections.synchronizedMap(mutableMapOf<String,Bitmap>())
        val priority=canton.municipalities.sortedBy {
            if(it.bfs==selected?.bfs) 0 else 1
        }
        try {
            // Offline SVGs are used immediately, before any potentially slow
            // Wikidata/SPARQL call. The map stays usable if the network fails.
            withContext(Dispatchers.IO) {
                for(municipality in priority) {
                    val packaged=bundledWappenAsset(context,municipality.bfs)
                        ?: continue
                    val bitmap=runCatching {
                        wappenBitmap(context,imageLoader,packaged)
                    }.getOrNull() ?: continue
                    displayed[municipality.bfs]=bitmap
                    if(displayed.size<=3 || displayed.size%6==0) value=displayed.toMap()
                }
            }
            value=displayed.toMap()
            val urls=withContext(Dispatchers.IO) {
                queryCantonWappen(canton,context)
            }
            val semaphore=Semaphore(3)
            coroutineScope {
                priority.filter {
                    it.bfs !in displayed && it.bfs in urls
                }.map { municipality ->
                    launch {
                        semaphore.withPermit {
                            val url=urls[municipality.bfs] ?: return@withPermit
                            val bitmap=runCatching {
                                wappenBitmap(context,imageLoader,url)
                            }.getOrNull()
                            if(bitmap!=null) {
                                displayed[municipality.bfs]=bitmap
                                if(displayed.size<=3 || displayed.size%6==0)
                                    value=displayed.toMap()
                            }
                        }
                    }
                }.joinAll()
            }
            value=displayed.toMap()
        } catch (_:Exception) {
            value=displayed.toMap()
        } finally {
            wappenLoading=false
        }
    }
    val regions by produceState<List<MapMunicipality>?>(initialValue=null,canton.code) {
        value=withContext(Dispatchers.IO) {
            runCatching { loadFeatures(canton) }.getOrDefault(emptyList())
        }
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
                        // Keep armorial proportions. The previous implementation
                        // stretched the image across the whole municipality,
                        // producing oversized, distorted emblems on the map.
                        coats[feature.bfs]?.let { bitmap ->
                            val bounds=feature.path.getBounds()
                            if(bounds.width>11f && bounds.height>12f) {
                                drawIntoCanvas { canvas ->
                                    val native=canvas.nativeCanvas
                                    val maxW=kotlin.math.min(19f,bounds.width*0.65f)
                                    val maxH=kotlin.math.min(23f,bounds.height*0.65f)
                                    val bitmapRatio=bitmap.width.toFloat()/
                                        bitmap.height.coerceAtLeast(1)
                                    val width=kotlin.math.min(maxW,maxH*bitmapRatio)
                                    val height=width/bitmapRatio
                                    val centerX=bounds.left+bounds.width/2f
                                    val centerY=bounds.top+bounds.height/2f
                                    native.drawBitmap(bitmap,null,android.graphics.RectF(
                                        centerX-width/2f,centerY-height/2f,
                                        centerX+width/2f,centerY+height/2f),null)
                                }
                            }
                        }
                        drawPath(feature.path,
                            if(active) Color(0xFFFFCD57) else Color.White,
                            style=Stroke(if(active)2.5f else 1.25f))
                    }
                }
            }
            Text("Gemeindegrenzen 2025 · BFS-Verzeichnis 2026 · Wappen: Wikimedia Commons / Haute-Ajoie: offizielles Gemeindelogo" +
                " · "+coats.size+"/"+features.size+" Wappen geladen" +
                (if(wappenLoading) " (weitere werden geladen …)" else
                    if(coats.size<features.size) " (fehlende online nicht verfügbar oder nicht zugeordnet)" else ""),
                style=MaterialTheme.typography.labelSmall,
                color=MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}