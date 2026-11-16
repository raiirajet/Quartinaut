package ch.quartinaut.nativeapp

import android.annotation.SuppressLint
import android.content.Context
import android.location.Geocoder
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.os.CancellationSignal
import android.os.SystemClock
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import java.util.Locale
import java.util.concurrent.Executors
import kotlin.coroutines.resume

/** Never use an address line or subThoroughfare: those can contain a house number. */
internal fun streetWithoutHouseNumber(thoroughfare: String?): String? = thoroughfare
    ?.replace(Regex("[\\r\\n\\t]"), " ")?.trim()
    ?.replace(Regex("[\\s,]+[0-9]+\\s*(?:[A-Za-z]{1,4})?(?:\\s*[-/–]\\s*[0-9]+\\s*(?:[A-Za-z]{1,4})?)?$"), "")
    ?.trim()?.take(140)?.takeIf { it.isNotBlank() }

internal fun usableAudienceFix(ageMillis: Long, accuracyMeters: Float): Boolean =
    ageMillis in 0..120_000 && accuracyMeters.isFinite() && accuracyMeters in 0f..2500f

/** Queries enabled GPS/network providers together and always cancels remaining requests. */
@SuppressLint("MissingPermission")
internal suspend fun determineAudienceLocation(context: Context): Location? {
    val manager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return null
    if (!LocationManagerCompat.isLocationEnabled(manager)) return null
    val providers = listOf(LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER).filter {
        runCatching { manager.isProviderEnabled(it) }.getOrDefault(false)
    }
    if (providers.isEmpty()) return null
    fun usable(location: Location): Boolean = usableAudienceFix(
        SystemClock.elapsedRealtime() - location.elapsedRealtimeNanos / 1_000_000,
        if (location.hasAccuracy()) location.accuracy else Float.POSITIVE_INFINITY
    )
    val cached = providers.mapNotNull {
        runCatching { manager.getLastKnownLocation(it) }.getOrNull()
    }.filter(::usable).minByOrNull { it.accuracy }
    if (cached != null) return cached
    val signals = mutableListOf<CancellationSignal>()
    return try {
        withTimeoutOrNull(20_000) {
            suspendCancellableCoroutine { continuation ->
                var remaining = providers.size
                fun receive(location: Location?) {
                    if (!continuation.isActive) return
                    remaining--
                    if (location != null && usable(location)) continuation.resume(location)
                    else if (remaining == 0) continuation.resume(null)
                }
                continuation.invokeOnCancellation { signals.forEach { it.cancel() } }
                providers.forEach { provider ->
                    val signal = CancellationSignal()
                    signals.add(signal)
                    try {
                        LocationManagerCompat.getCurrentLocation(manager, provider, signal,
                            ContextCompat.getMainExecutor(context)) { receive(it) }
                    } catch (_: Exception) { receive(null) }
                }
            }
        }
    } finally { signals.forEach { it.cancel() } }
}

/** Precise coordinates are used transiently for street lookup; only a street name leaves this method. */
internal suspend fun determineStreet(context: Context, latitude: Double, longitude: Double): String? {
    if (!Geocoder.isPresent()) return null
    val geocoder = Geocoder(context.applicationContext, Locale("de", "CH"))
    return withTimeoutOrNull(6_000) {
        suspendCancellableCoroutine { continuation ->
            fun complete(street: String?) {
                if (continuation.isActive) continuation.resume(streetWithoutHouseNumber(street))
            }
            if (Build.VERSION.SDK_INT >= 33) {
                try {
                    geocoder.getFromLocation(latitude, longitude, 1, object : Geocoder.GeocodeListener {
                        override fun onGeocode(addresses: MutableList<android.location.Address>) {
                            complete(addresses.firstOrNull()?.thoroughfare)
                        }
                        override fun onError(errorMessage: String?) { complete(null) }
                    })
                } catch (_: Exception) { complete(null) }
            } else {
                // Legacy Geocoder can block. Keep its worker outside the UI coroutine and cancel on timeout.
                val worker = Executors.newSingleThreadExecutor { task ->
                    Thread(task, "Quartinaut street lookup").apply { isDaemon = true }
                }
                val future = worker.submit {
                    try {
                        @Suppress("DEPRECATION")
                        val address = geocoder.getFromLocation(latitude, longitude, 1)?.firstOrNull()
                        complete(address?.thoroughfare)
                    } catch (_: Exception) { complete(null) }
                    finally { worker.shutdown() }
                }
                continuation.invokeOnCancellation { future.cancel(true); worker.shutdownNow() }
            }
        }
    }
}
