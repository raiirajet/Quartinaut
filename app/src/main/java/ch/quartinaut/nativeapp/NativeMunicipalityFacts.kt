package ch.quartinaut.nativeapp

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.graphics.drawable.toBitmap
import coil.ImageLoader
import coil.compose.AsyncImage
import coil.decode.SvgDecoder
import coil.request.ImageRequest
import coil.request.SuccessResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.text.NumberFormat
import java.util.Locale

/**
 * Gemeindefakten werden an der amtlichen BFS-Nummer verknüpft, nicht an
 * mehrdeutigen Ortsnamen. Wikidata ist eine Drittquelle: Jahresangaben werden
 * sichtbar ausgewiesen, fehlende Werte bleiben bewusst leer.
 */
internal data class MunicipalityFacts(
    val coat: String? = null,
    val population: Long? = null,
    val populationYear: String? = null,
    val area: Double? = null,
    val altitude: Double? = null,
    val postalCode: String? = null,
    val website: String? = null
)

private val municipalityFactCache=java.util.concurrent.ConcurrentHashMap<String,MunicipalityFacts>()
private fun bfsLiteral(bfs: String): String = bfs.toIntOrNull()?.toString() ?: ""

private fun readWikidataQuery(query: String): JSONObject? {
    val requestUrl="https://query.wikidata.org/sparql?format=json&query=" +
        URLEncoder.encode(query,"UTF-8")
    val connection=(URL(requestUrl).openConnection() as HttpURLConnection).apply {
        connectTimeout=7000;readTimeout=13000
        setRequestProperty("Accept","application/sparql-results+json")
        setRequestProperty("User-Agent","Quartinaut/5.5 (Swiss municipality reference; app)")
    }
    return try {
        if(connection.responseCode!=200)return null
        JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
    } catch (_: Exception) { null } finally { connection.disconnect() }
}

private fun binding(row: JSONObject, key: String): String? =
    row.optJSONObject(key)?.optString("value")?.takeIf { it.isNotBlank() }

/** Commons file URL returned by Wikidata P94. Limit to known hosts. */
internal fun safeWappenUrl(input: String?): String? {
    if(input.isNullOrBlank())return null
    val uri=runCatching { Uri.parse(input.replace("http://", "https://")) }.getOrNull()
        ?: return null
    if(uri.scheme!="https" || uri.host !in setOf("commons.wikimedia.org","upload.wikimedia.org")) return null
    return uri.toString()
}

internal fun queryMunicipalityFacts(bfs: String): MunicipalityFacts? {
    val code=bfsLiteral(bfs)
    if(code.isEmpty())return null
    municipalityFactCache[code]?.let { return it }
    val query="""
        SELECT ?coat ?population ?date ?area ?altitude ?postcode ?website WHERE {
          ?municipality wdt:P771 "$code" .
          OPTIONAL { ?municipality wdt:P94 ?coat. }
          OPTIONAL { ?municipality wdt:P2046 ?area. }
          OPTIONAL { ?municipality wdt:P2044 ?altitude. }
          OPTIONAL { ?municipality wdt:P281 ?postcode. }
          OPTIONAL { ?municipality wdt:P856 ?website. }
          OPTIONAL {
            ?municipality p:P1082 ?statement.
            ?statement ps:P1082 ?population.
            OPTIONAL { ?statement pq:P585 ?date. }
          }
        } ORDER BY DESC(?date) LIMIT 1
    """.trimIndent()
    val rows=readWikidataQuery(query)?.optJSONObject("results")
        ?.optJSONArray("bindings") ?: return null
    val row=rows.optJSONObject(0) ?: return null
    val fact=MunicipalityFacts(
        coat=safeWappenUrl(binding(row,"coat")),
        population=binding(row,"population")?.toDoubleOrNull()?.toLong(),
        populationYear=binding(row,"date")?.take(4),
        area=binding(row,"area")?.toDoubleOrNull(),
        altitude=binding(row,"altitude")?.toDoubleOrNull(),
        postalCode=binding(row,"postcode")?.takeIf {it.length in 4..12},
        website=binding(row,"website")?.takeIf { it.startsWith("https://") }
    )
    municipalityFactCache[code]=fact
    return fact
}

/** One SPARQL request per canton; failures leave the normal map functional. */
internal fun queryCantonWappen(canton: Region): Map<String,String> {
    val codes=canton.municipalities.mapNotNull { bfsLiteral(it.bfs).takeIf(String::isNotBlank) }
    if(codes.isEmpty())return emptyMap()
    val literals=codes.joinToString(" ") { "\"$it\"" }
    val query="""
        SELECT ?bfs ?coat WHERE {
          VALUES ?bfs { $literals }
          ?municipality wdt:P771 ?bfs ; wdt:P94 ?coat.
        }
    """.trimIndent()
    val rows=readWikidataQuery(query)?.optJSONObject("results")
        ?.optJSONArray("bindings") ?: return emptyMap()
    val coats=mutableMapOf<String,String>()
    for(i in 0 until rows.length()) {
        val row=rows.optJSONObject(i) ?: continue
        val bfs=binding(row,"bfs") ?: continue
        val image=safeWappenUrl(binding(row,"coat")) ?: continue
        coats[bfs]=image
    }
    return coats
}

internal fun wappenLoader(context: Context): ImageLoader = ImageLoader.Builder(context)
    .components { add(SvgDecoder.Factory()) }
    .build()

internal suspend fun wappenBitmap(context: Context, loader: ImageLoader, url: String): Bitmap? =
    withContext(Dispatchers.IO) {
        runCatching {
            val request=ImageRequest.Builder(context)
                .data(url).size(96,116).allowHardware(false).build()
            val drawable=(loader.execute(request) as? SuccessResult)?.drawable
            drawable?.toBitmap(width=96,height=116)
        }.getOrNull()
    }

@Composable
internal fun NativeMunicipalityFactCard(municipality: Municipality, canton: Region) {
    val facts by produceState<MunicipalityFacts?>(initialValue=null,municipality.bfs) {
        value=withContext(Dispatchers.IO) { queryMunicipalityFacts(municipality.bfs) }
    }
    Card(colors=CardDefaults.cardColors(containerColor=MaterialTheme.colorScheme.surface),
        shape=RoundedCornerShape(18.dp)) {
        Row(Modifier.fillMaxWidth().padding(14.dp),verticalAlignment=Alignment.Top,
            horizontalArrangement=Arrangement.spacedBy(14.dp)) {
            val wappen=facts?.coat
            if(wappen!=null) {
                val context=LocalContext.current
                val loader=remember(context) { wappenLoader(context) }
                AsyncImage(model=wappen,imageLoader=loader,
                    contentDescription="Wappen ${municipality.name}",
                    modifier=Modifier.size(width=62.dp,height=80.dp))
            } else {
                Text("🇨🇭",style=MaterialTheme.typography.headlineMedium)
            }
            Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(5.dp)) {
                Text(municipality.name,fontWeight=FontWeight.Bold,
                    style=MaterialTheme.typography.titleLarge)
                Text("Kanton ${canton.code} · BFS-Nr. ${municipality.bfs}",
                    style=MaterialTheme.typography.bodySmall)
                if(facts==null) {
                    Text("Weitere Kennzahlen werden geladen oder sind nicht verfügbar.",
                        style=MaterialTheme.typography.bodySmall)
                } else {
                    facts?.population?.let { inhabitants ->
                        Text("Einwohner: ${NumberFormat.getIntegerInstance(Locale.forLanguageTag("de-CH")).format(inhabitants)}"+
                            (facts?.populationYear?.let { " (Stand $it)" } ?: " (Jahr unbekannt)"))
                    }
                    facts?.area?.let { area ->
                        Text("Fläche: ${"%.2f".format(Locale.GERMAN,area)} km²")
                    }
                    facts?.altitude?.let {altitude ->
                        Text("Höhenlage: "+altitude.toInt()+" m ü. M. (Wikidata)")
                    }
                    facts?.postalCode?.let {postal ->
                        Text("Postleitzahl: "+postal+" (Wikidata)")
                    }
                    facts?.website?.let { website ->
                        val context=LocalContext.current
                        TextButton(onClick={
                            runCatching {
                                context.startActivity(android.content.Intent(
                                    android.content.Intent.ACTION_VIEW,Uri.parse(website)))
                            }
                        }) {Text("Gemeindewebsite öffnen")}
                    }
                    if(facts?.population==null)Text("Keine zuverlässig zuordenbare Einwohnerzahl verfügbar.",
                        style=MaterialTheme.typography.bodySmall)
                    Text("Wappen/Kennzahlen: Wikidata und Wikimedia Commons · nicht amtlich. " +
                        "Aktuelle amtliche Bevölkerungsstatistik: BFS STATPOP (2025).",
                        style=MaterialTheme.typography.labelSmall,
                        color=MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}