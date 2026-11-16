package ch.quartinaut.nativeapp

import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.runtime.saveable.SaveableStateHolder

/** Keep scroll and saveable field state when a screen leaves the composition. */
@Composable
internal fun NativeRetainedScreen(account: String, screen: String, holder: SaveableStateHolder? = null, content: @Composable () -> Unit) {
    key(account) {
        val screens = holder ?: rememberSaveableStateHolder()
        screens.SaveableStateProvider(screen, content)
    }
}

/** A late preference response must never replace deliberate or restored navigation. */
internal fun shouldApplyInitialHome(applied: Boolean, page: String, historySize: Int): Boolean =
    !applied && page == "home" && historySize == 0

/** An async result belongs to the screen visit that started it. */
internal data class NavigationOrigin(val screen: String, val generation: Long) {
    fun matches(currentScreen: String, currentGeneration: Long): Boolean =
        screen == currentScreen && generation == currentGeneration
}

/** Private, in-memory results. A failed refresh retains the last successful rows. */
internal class RetainedScreenResults<T> {
    data class Ticket(val screen: String, val epoch: Long, val sequence: Long)
    private var epoch = 0L
    private var sequence = 0L
    private val rows = mutableMapOf<String, List<T>>()
    private val pending = mutableMapOf<String, Ticket>()
    fun items(screen: String): List<T> = rows[screen].orEmpty()
    fun loaded(screen: String): Boolean = rows.containsKey(screen)
    fun loading(screen: String): Boolean = pending.containsKey(screen)
    fun begin(screen: String, replace: Boolean = false): Ticket? {
        if (loading(screen) && !replace) return null
        return Ticket(screen, epoch, ++sequence).also { pending[screen] = it }
    }
    fun complete(ticket: Ticket, result: List<T>): Boolean {
        if (ticket.epoch != epoch || pending[ticket.screen] != ticket) return false
        pending.remove(ticket.screen)
        rows[ticket.screen] = result
        return true
    }
    fun fail(ticket: Ticket): Boolean {
        if (ticket.epoch != epoch || pending[ticket.screen] != ticket) return false
        pending.remove(ticket.screen)
        return true
    }
    fun clear() { epoch++; rows.clear(); pending.clear() }
}

/** Back-stack entries include the public identifiers needed to reopen that view. */
internal data class NativeBackEntry(
    val page:String, val canton:String="", val municipality:String="",
    val hubId:String="", val requestId:String=""
) {
    fun save():String = listOf(page,canton,municipality,hubId,requestId).joinToString("|") {
        java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(it.toByteArray(Charsets.UTF_8))
    }
    companion object {
        fun restore(saved:String):NativeBackEntry {
            if('|' !in saved)return NativeBackEntry(saved)
            return runCatching {
                val parts=saved.split('|').map {String(java.util.Base64.getUrlDecoder().decode(it),Charsets.UTF_8)}
                require(parts.size==5)
                NativeBackEntry(parts[0],parts[1],parts[2],parts[3],parts[4])
            }.getOrElse {NativeBackEntry("home")}
        }
    }
}
