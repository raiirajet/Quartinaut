package ch.quartinaut.nativeapp

import org.junit.Assert.*
import org.junit.Test

class NativeNavigationStateTest {
    @Test fun lateHomeCannotReplaceNavigationOrRestoredBackstack() {
        assertTrue(shouldApplyInitialHome(false,"home",0))
        assertFalse(shouldApplyInitialHome(true,"home",0))
        assertFalse(shouldApplyInitialHome(false,"settings",0))
        assertFalse(shouldApplyInitialHome(false,"home",2))
    }
    @Test fun completingAnOldRequestCannotNavigateAwayFromTheCurrentMenu() {
        val started=NavigationOrigin("create-request",7)
        assertFalse(started.matches("settings",8))
        assertFalse(started.matches("create-request",9))
        assertTrue(started.matches("create-request",7))
    }
    @Test fun mapOrChatBackNavigationInvalidatesOlderCallbacksOnTheSamePage() {
        val started=NavigationOrigin("map",2)
        assertFalse(started.matches("map",3))
        assertFalse(NavigationOrigin("chats",4).matches("chats",5))
    }
    @Test fun backEntriesRetainTheOriginalPostAndMapContext() {
        val entry=NativeBackEntry("request-detail","SG","3424","hub-a","request-a")
        assertEquals(entry,NativeBackEntry.restore(entry.save()))
        assertEquals(NativeBackEntry("home"),NativeBackEntry.restore(NativeBackEntry("home").save()))
    }
    @Test fun oldBackEntriesStillOpenAndInvalidSavedEntriesFailSafely() {
        assertEquals(NativeBackEntry("settings"),NativeBackEntry.restore("settings"))
        assertEquals(NativeBackEntry("home"),NativeBackEntry.restore("%%%|bad|data"))
    }
    @Test fun refreshKeepsRowsAndFailureDoesNotEraseThem() {
        val store=RetainedScreenResults<String>()
        val first=store.begin("loans")!!
        assertTrue(store.complete(first,listOf("accepted")))
        val refresh=store.begin("loans")!!
        assertEquals(listOf("accepted"),store.items("loans"))
        assertTrue(store.fail(refresh))
        assertEquals(listOf("accepted"),store.items("loans"))
        assertTrue(store.loaded("loans"))
    }
    @Test fun simultaneousScreensNeverReplaceEachOthersRows() {
        val store=RetainedScreenResults<String>()
        val loans=store.begin("loans")!!;val calendar=store.begin("calendar")!!
        assertNull(store.begin("loans"))
        store.complete(calendar,listOf("event"));store.complete(loans,listOf("loan"))
        assertEquals(listOf("event"),store.items("calendar"))
        assertEquals(listOf("loan"),store.items("loans"))
        assertTrue(store.items("clubs").isEmpty())
    }
    @Test fun aReadStartedBeforeAWriteCannotOverwriteTheRefreshedStatus() {
        val store=RetainedScreenResults<String>();val old=store.begin("loans")!!
        val fresh=store.begin("loans",replace=true)!!
        assertTrue(store.complete(fresh,listOf("returned")))
        assertFalse(store.complete(old,listOf("accepted")))
        assertEquals(listOf("returned"),store.items("loans"))
    }
    @Test fun lateResponsesCannotRepopulateAnAccountAfterLogout() {
        val store=RetainedScreenResults<String>();val old=store.begin("loans")!!
        store.clear();val next=store.begin("loans")!!
        assertFalse(store.complete(old,listOf("private old account")))
        assertTrue(store.complete(next,listOf("new account")))
        assertFalse(store.fail(old));assertEquals(listOf("new account"),store.items("loans"))
    }
}
