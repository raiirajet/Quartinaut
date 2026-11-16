package ch.quartinaut.nativeapp

import android.Manifest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NativePermissionsTest {
    @Test fun android12DoesNotRequestAndroid13NotificationPermission() {
        val permissions = missingRuntimePermissions(32, true) { false }
        assertFalse(Manifest.permission.POST_NOTIFICATIONS in permissions)
        assertTrue(Manifest.permission.CAMERA in permissions)
    }

    @Test fun android13RequestsAllSupportedMissingPermissions() {
        assertEquals(setOf(
            Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.CAMERA,
            Manifest.permission.POST_NOTIFICATIONS
        ), missingRuntimePermissions(33, true) { false }.toSet())
    }

    @Test fun approximateLocationIsAcceptedWithoutRequestingAnUpgrade() {
        val permissions = missingRuntimePermissions(35, true) {
            it == Manifest.permission.ACCESS_COARSE_LOCATION
        }
        assertFalse(Manifest.permission.ACCESS_FINE_LOCATION in permissions)
        assertFalse(Manifest.permission.ACCESS_COARSE_LOCATION in permissions)
        assertTrue(Manifest.permission.CAMERA in permissions)
    }

    @Test fun grantedPermissionsNeverProduceAnotherSystemRequest() {
        assertTrue(missingRuntimePermissions(35, true) { true }.isEmpty())
    }

    @Test fun deviceWithoutCameraDoesNotAskForCameraAccess() {
        val permissions = missingRuntimePermissions(35, false) { false }
        assertFalse(Manifest.permission.CAMERA in permissions)
        assertTrue(Manifest.permission.POST_NOTIFICATIONS in permissions)
    }

    @Test fun olderAndroidCanAskForLocationWithoutCameraOrNotificationDialogs() {
        assertEquals(listOf(
            Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.ACCESS_FINE_LOCATION
        ), missingRuntimePermissions(26, false) { false })
    }
}
