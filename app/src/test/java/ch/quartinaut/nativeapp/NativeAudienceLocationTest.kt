package ch.quartinaut.nativeapp

import org.junit.Assert.*
import org.junit.Test

class NativeAudienceLocationTest {
    @Test fun streetLookupNeverNeedsAnAddressLineOrHouseNumber() {
        assertEquals("Bahnhofstrasse", streetWithoutHouseNumber("Bahnhofstrasse"))
        assertEquals("Bahnhofstrasse", streetWithoutHouseNumber("Bahnhofstrasse 12a"))
        assertEquals("Hauptstrasse", streetWithoutHouseNumber("Hauptstrasse 12–14"))
        assertEquals("Rue Principale", streetWithoutHouseNumber("Rue Principale 12bis"))
        assertNull(streetWithoutHouseNumber(null))
        assertNull(streetWithoutHouseNumber("   "))
    }
    @Test fun oldOrImpreciseFixesAreNotReportedAsCurrentLocations() {
        assertTrue(usableAudienceFix(60_000, 100f))
        assertFalse(usableAudienceFix(120_001, 10f))
        assertFalse(usableAudienceFix(-1, 10f))
        assertFalse(usableAudienceFix(1000, Float.NaN))
        assertFalse(usableAudienceFix(1000, 5000f))
    }
    @Test fun requestRadiusNeedsAValidFixAndSupportedDistance() {
        assertTrue(canPublishAudience("radius",5,47.0,8.0,true))
        assertFalse(canPublishAudience("radius",5,null,null,true))
        assertFalse(canPublishAudience("radius",500,47.0,8.0,true))
        assertFalse(canPublishAudience("radius",5,Double.NaN,8.0,true))
    }
    @Test fun onlyTheVerifiedRequestServiceEnablesAdditionalScopes() {
        assertTrue(canPublishAudience("municipality",10,null,null,true))
        assertTrue(canPublishAudience("country",10,null,null,true))
        assertFalse(canPublishAudience("municipality",10,null,null,false))
        assertFalse(canPublishAudience("country",10,null,null,false))
        assertTrue(canPublishAudience("canton",10,null,null,false))
    }
}
