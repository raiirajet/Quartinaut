package ch.quartinaut.nativeapp

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Icon
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
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
import coil.compose.SubcomposeAsyncImage
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
private val cantonCoatCache=java.util.concurrent.ConcurrentHashMap<String,Map<String,String>>()
private val individualCoatCache=java.util.concurrent.ConcurrentHashMap<String,String>()
private val coatRetryAfter=java.util.concurrent.ConcurrentHashMap<String,Long>()
private val resolvedWappenCache=java.util.concurrent.ConcurrentHashMap<String,String>()
// Explicitly verified legacy emblem for Flawil, BFS 3402. No guessed arms.
private val verifiedWappenFallbacks=mapOf(
    "3401" to "https://commons.wikimedia.org/wiki/Special:FilePath/CHE%20Degersheim%20COA.svg",
    "3402" to "https://commons.wikimedia.org/wiki/Special:FilePath/CHE%20Flawil%20COA.svg"
)
internal fun verifiedWappenFallback(bfs:String):String?=verifiedWappenFallbacks[bfs]
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

/** Read-only Wikidata/Commons API; check the exact BFS or canton code on each candidate. */
private fun readWikimediaApi(url: String): JSONObject? {
    var connection:HttpURLConnection?=null
    return try {
        connection=(URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout=6500;readTimeout=9000
            setRequestProperty("Accept","application/json")
            setRequestProperty("User-Agent","Quartinaut/5.7.5 (Swiss reference; github.com/raiirajet/Quartinaut)")
        }
        if(connection.responseCode!=200) null
        else JSONObject(connection.inputStream.bufferedReader().use {it.readText()})
    } catch (_:Exception) {null} finally {connection?.disconnect()}
}
private fun wikidataClaim(entity:JSONObject, property:String):List<String> {
    val statements=entity.optJSONObject("claims")?.optJSONArray(property) ?: return emptyList()
    return (0 until statements.length()).mapNotNull {index ->
        val item=statements.optJSONObject(index) ?: return@mapNotNull null
        if(item.optString("rank")=="deprecated")return@mapNotNull null
        item.optJSONObject("mainsnak")?.optJSONObject("datavalue")?.optString("value")
            ?.takeIf(String::isNotBlank)
    }
}
private fun statementCoat(property:String, code:String):String? {
    if(!code.matches(Regex("[0-9]{1,4}|CH-[A-Z]{2}")))return null
    val search="haswbstatement:\"$property=$code\""
    val api="https://www.wikidata.org/w/api.php?action=query&format=json&list=search" +
        "&srnamespace=0&srlimit=4&srsearch="+URLEncoder.encode(search,"UTF-8")
    val rows=readWikimediaApi(api)?.optJSONObject("query")?.optJSONArray("search")
        ?: return null
    for(i in 0 until rows.length()) {
        val id=rows.optJSONObject(i)?.optString("title").orEmpty()
        if(!id.matches(Regex("Q[0-9]+")))continue
        val lookup="https://www.wikidata.org/w/api.php?action=wbgetentities" +
            "&format=json&props=claims&ids="+id
        val entity=readWikimediaApi(lookup)?.optJSONObject("entities")
            ?.optJSONObject(id) ?: continue
        if(code !in wikidataClaim(entity,property))continue
        val file=wikidataClaim(entity,"P94").firstOrNull() ?: continue
        val path="https://commons.wikimedia.org/wiki/Special:FilePath/" +
            URLEncoder.encode(file,"UTF-8").replace("+","%20")
        safeWappenUrl(path)?.let{return it}
    }
    return null
}
internal fun queryWappenByBfs(bfs:String):String? {
    val code=bfsLiteral(bfs)
    if(code.isEmpty())return null
    verifiedWappenFallback(code)?.let{return it}
    individualCoatCache[code]?.let{return it}
    if(System.currentTimeMillis()<(coatRetryAfter["B"+code]?:0L))return null
    val result=statementCoat("P771",code)
    if(result!=null)individualCoatCache[code]=result
    else coatRetryAfter["B"+code]=System.currentTimeMillis()+15L*60*1000
    return result
}
internal fun queryCantonCoat(code:String):String? {
    if(!code.matches(Regex("[A-Z]{2}")))return null
    cantonInsigniaCache[code]?.let{return it}
    if(System.currentTimeMillis()<(coatRetryAfter["C"+code]?:0L))return null
    val result=statementCoat("P300","CH-"+code)
    if(result!=null)cantonInsigniaCache[code]=result
    else coatRetryAfter["C"+code]=System.currentTimeMillis()+15L*60*1000
    return result
}
/** Resolve Commons SVG to a PNG thumbnail with imageinfo before passing to Coil. */
internal fun resolveWappenImage(url:String):String {
    resolvedWappenCache[url]?.let{return it}
    val original=safeWappenUrl(url) ?: return url
    val uri=Uri.parse(original)
    val filename=when {
        uri.host=="commons.wikimedia.org" && uri.path.orEmpty().contains("Special:FilePath/") ->
            Uri.decode(uri.path.orEmpty().substringAfter("Special:FilePath/"))
        uri.host=="commons.wikimedia.org" && uri.path.orEmpty().startsWith("/wiki/File:") ->
            Uri.decode(uri.path.orEmpty().substringAfter("/wiki/File:"))
        else->return original
    }.replace('_',' ')
    val query="https://commons.wikimedia.org/w/api.php?action=query&format=json" +
        "&prop=imageinfo&iiprop=url&iiurlwidth=180&titles="+
        URLEncoder.encode("File:"+filename,"UTF-8")
    val pages=readWikimediaApi(query)?.optJSONObject("query")?.optJSONObject("pages")
        ?: return original
    val page=pages.keys().asSequence().mapNotNull {pages.optJSONObject(it)}.firstOrNull()
    val info=page?.optJSONArray("imageinfo")?.optJSONObject(0)
    val resolved=safeWappenUrl(info?.optString("thumburl"))
        ?: safeWappenUrl(info?.optString("url")) ?: original
    resolvedWappenCache[url]=resolved
    return resolved
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

/**
 * Municipality coats are keyed exclusively by official BFS number. Chunked
 * queries avoid oversized URLs for large cantons; verified fallback names
 * cover a very small known exception without inventing heraldry.
 */
@Synchronized
internal fun queryCantonWappen(canton: Region, context: Context? = null): Map<String,String> {
    cantonCoatCache[canton.code]?.let { return it }
    val preferences=context?.getSharedPreferences("quartinaut_wappen_cache",Context.MODE_PRIVATE)
    val key="bfs_wappen_"+canton.code
    val stored=runCatching {
        val data=JSONObject(preferences?.getString(key,"{}") ?: "{}")
        data.keys().asSequence().mapNotNull { bfs ->
            safeWappenUrl(data.optString(bfs))?.let { bfs to it }
        }.toMap()
    }.getOrDefault(emptyMap())
    val refreshedAt=preferences?.getLong(key+"_checked_at",0L) ?: 0L
    if(refreshedAt>0 && System.currentTimeMillis()-refreshedAt<30L*86400*1000) {
        cantonCoatCache[canton.code]=stored
        return stored
    }
    val codes=canton.municipalities.mapNotNull { bfsLiteral(it.bfs).takeIf(String::isNotBlank) }
    if(codes.isEmpty())return emptyMap()
    val coats=stored.toMutableMap()
    var allChunksLoaded=true
    for(chunk in codes.chunked(40)) {
        val literals=chunk.joinToString(" ") { "\"$it\"" }
        val query="""
            SELECT ?bfs ?coat WHERE {
              VALUES ?bfs { $literals }
              ?municipality wdt:P771 ?bfs ; wdt:P94 ?coat.
            }
        """.trimIndent()
        val rows=readWikidataQuery(query)?.optJSONObject("results")
            ?.optJSONArray("bindings")
        if(rows==null) {allChunksLoaded=false;continue}
        for(i in 0 until rows.length()) {
            val row=rows.optJSONObject(i) ?: continue
            val bfs=binding(row,"bfs") ?: continue
            val image=safeWappenUrl(binding(row,"coat")) ?: continue
            coats[bfs]=image
        }
    }
    for(bfs in codes) {
        if(bfs !in coats) verifiedWappenFallback(bfs)?.let { coats[bfs]=it }
    }
    // Network failures are not cached as empty complete results: retry is
    // possible on the next view. Successful queries are reused by map/list.
    if(allChunksLoaded && coats.size*100 >= codes.size*85) {
        cantonCoatCache[canton.code]=coats
        preferences?.edit()
            ?.putString(key,JSONObject(coats as Map<*,*>).toString())
            ?.putLong(key+"_checked_at",System.currentTimeMillis())
            ?.apply()
    }
    return coats
}

private val cantonInsigniaCache=java.util.concurrent.ConcurrentHashMap<String,String>()
private val cantonKnownWappen=mapOf(
    "SG" to "https://commons.wikimedia.org/wiki/Special:FilePath/Coat%20of%20arms%20of%20canton%20of%20St.%20Gallen.svg"
)
internal fun querySwissCantonWappen(cantons:List<Region>): Map<String,String> {
    val codes=cantons.map {it.code}.filter {it.length==2 && it.all(Char::isLetter)}
    if(codes.isEmpty())return emptyMap()
    if(codes.all { cantonInsigniaCache.containsKey(it) })return codes.mapNotNull {
        cantonInsigniaCache[it]?.let {coat -> it to coat}
    }.toMap()
    val values=codes.joinToString(" ") { "\"CH-$it\"" }
    val query="""
        SELECT ?iso ?coat WHERE {
          VALUES ?iso { $values }
          ?canton wdt:P300 ?iso ; wdt:P94 ?coat.
        }
    """.trimIndent()
    val rows=readWikidataQuery(query)?.optJSONObject("results")?.optJSONArray("bindings")
    if(rows!=null) {
        for(i in 0 until rows.length()) {
            val row=rows.optJSONObject(i) ?: continue
            val code=binding(row,"iso")?.removePrefix("CH-") ?: continue
            val url=safeWappenUrl(binding(row,"coat")) ?: continue
            if(code in codes)cantonInsigniaCache[code]=url
        }
    }
    // This is an explicitly verified file, not a guessed coat of arms.
    for(code in codes) if(!cantonInsigniaCache.containsKey(code)) {
        cantonKnownWappen[code]?.let { cantonInsigniaCache[code]=it }
    }
    return codes.mapNotNull {code ->
        cantonInsigniaCache[code]?.let {code to it}
    }.toMap()
}

/** Emblems must be sourced from an exact official BFS or canton identifier.
 * Never draw a generic grey shield as if it were a municipality's coat. */
@Composable
internal fun MunicipalityCoat(
    url:String?, name:String, modifier:Modifier=Modifier,
    bfs:String?=null, cantonCode:String?=null
) {
    val context=LocalContext.current
    val resolved by produceState<String?>(initialValue=null,url,bfs,cantonCode) {
        value=withContext(Dispatchers.IO) {
            val source=safeWappenUrl(url) ?:
                (bfs?.let(::queryWappenByBfs) ?: cantonCode?.let(::queryCantonCoat))
            source?.let(::resolveWappenImage)
        }
    }
    if(resolved!=null) {
        val loader=remember(context.applicationContext) {wappenLoader(context)}
        SubcomposeAsyncImage(model=resolved,imageLoader=loader,
            contentDescription="Wappen von $name",modifier=modifier,
            contentScale=ContentScale.Fit,
            loading={Box(Modifier.fillMaxSize(),contentAlignment=Alignment.Center) {
                CircularProgressIndicator(Modifier.size(16.dp),strokeWidth=2.dp)
            }},
            error={Spacer(Modifier.fillMaxSize())})
    }
}
@Volatile private var sharedWappenLoader:ImageLoader?=null
@Synchronized
internal fun wappenLoader(context:Context):ImageLoader {
    sharedWappenLoader?.let{return it}
    return ImageLoader.Builder(context.applicationContext)
        .components {add(SvgDecoder.Factory())}
        .build().also {sharedWappenLoader=it}
}
internal suspend fun wappenBitmap(context:Context,loader:ImageLoader,url:String):Bitmap? =
    withContext(Dispatchers.IO) {
        for(address in listOf(resolveWappenImage(url),url).distinct()) {
            val image=runCatching {
                val request=ImageRequest.Builder(context)
                    .data(address).size(96,116).allowHardware(false).build()
                (loader.execute(request) as? SuccessResult)?.drawable
                    ?.toBitmap(width=96,height=116)
            }.getOrNull()
            if(image!=null)return@withContext image
        }
        null
    }

@Composable
internal fun NativeMunicipalityFactCard(municipality:Municipality,canton:Region,
    cachedWappen:String?=null) {
    val facts by produceState<MunicipalityFacts?>(initialValue=null,municipality.bfs) {
        value=withContext(Dispatchers.IO) {queryMunicipalityFacts(municipality.bfs)}
    }
    val coat=facts?.coat ?: cachedWappen ?: verifiedWappenFallback(municipality.bfs)
    Card(colors=CardDefaults.cardColors(containerColor=MaterialTheme.colorScheme.surface),
        shape=RoundedCornerShape(18.dp)) {
        Column(Modifier.fillMaxWidth().padding(16.dp),
            verticalArrangement=Arrangement.spacedBy(7.dp)) {
            Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.Top,
                horizontalArrangement=Arrangement.spacedBy(12.dp)) {
                Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(5.dp)) {
                    Text(municipality.name,fontWeight=FontWeight.Bold,
                        style=MaterialTheme.typography.titleLarge)
                    Text("Kanton "+canton.code+" · BFS-Nr. "+municipality.bfs,
                        style=MaterialTheme.typography.bodySmall)
                }
                MunicipalityCoat(coat,municipality.name,
                    modifier=Modifier.size(width=62.dp,height=78.dp),bfs=municipality.bfs)
            }
            if(facts==null) {
                Text("Weitere Kennzahlen werden geladen oder sind derzeit nicht verfügbar.",
                    style=MaterialTheme.typography.bodySmall)
            } else {
                facts?.population?.let {inhabitants ->
                    Text("Einwohner: "+NumberFormat.getIntegerInstance(
                        Locale.forLanguageTag("de-CH")).format(inhabitants)+
                        (facts?.populationYear?.let {" (Stand "+it+")"} ?: " (Jahr unbekannt)"))
                }
                facts?.area?.let {area ->
                    Text("Fläche: "+"%.2f".format(Locale.GERMAN,area)+" km²")
                }
                facts?.altitude?.let {altitude ->
                    Text("Höhenlage: "+altitude.toInt()+" m ü. M. (Wikidata)")
                }
                facts?.postalCode?.let {postal ->
                    Text("Postleitzahl: "+postal+" (Wikidata)")
                }
                facts?.website?.let {website ->
                    val context=LocalContext.current
                    TextButton(onClick={
                        runCatching {
                            context.startActivity(android.content.Intent(
                                android.content.Intent.ACTION_VIEW,Uri.parse(website)))
                        }
                    },contentPadding=PaddingValues(0.dp)) {Text("Gemeindewebsite öffnen")}
                }
                if(facts?.population==null)Text("Keine zuverlässig zuordenbare Einwohnerzahl verfügbar.",
                    style=MaterialTheme.typography.bodySmall)
                Spacer(Modifier.height(3.dp))
                Text("Wappen/Kennzahlen: Wikidata und Wikimedia Commons · nicht amtlich. "+
                    "Amtliche Bevölkerungsstatistik: BFS STATPOP (2025).",
                    style=MaterialTheme.typography.labelSmall,
                    color=MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
