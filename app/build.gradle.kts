import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.gms.google-services")
}

// Keep the long-lived signing identity outside source control. Debug builds
// remain available without credentials; release builds fail if any are absent.
val releaseSigningValues = listOf(
    "QUARTINAUT_KEYSTORE_FILE",
    "QUARTINAUT_KEYSTORE_PASSWORD",
    "QUARTINAUT_KEY_ALIAS",
    "QUARTINAUT_KEY_PASSWORD"
).associateWith { providers.environmentVariable(it).orNull }
val releaseSigningReady = releaseSigningValues.values.all { !it.isNullOrBlank() }

android {
    namespace = "ch.quartinaut.nativeapp"
    compileSdk = 35
    defaultConfig {
        applicationId = "ch.quartinaut.nativeapp"
        minSdk = 26
        targetSdk = 35
        versionCode = 31
        versionName = "5.11.2-signed-preview"
    }
    signingConfigs {
        if (releaseSigningReady) {
            create("quartinautRelease") {
                storeFile = file(requireNotNull(releaseSigningValues["QUARTINAUT_KEYSTORE_FILE"]))
                storePassword = releaseSigningValues["QUARTINAUT_KEYSTORE_PASSWORD"]
                keyAlias = releaseSigningValues["QUARTINAUT_KEY_ALIAS"]
                keyPassword = releaseSigningValues["QUARTINAUT_KEY_PASSWORD"]
            }
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            isDebuggable = false
            if (releaseSigningReady) signingConfig = signingConfigs.getByName("quartinautRelease")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures { compose = true }
    packaging { resources.excludes += "/META-INF/{AL2.0,LGPL2.1}" }
}

val requireReleaseSigning = tasks.register("requireReleaseSigning") {
    doLast {
        val missing = releaseSigningValues.filterValues { it.isNullOrBlank() }.keys
        check(missing.isEmpty()) {
            "Release signing is required. Missing environment variables: ${missing.joinToString()}. See ANDROID_SIGNING.md."
        }
        check(file(requireNotNull(releaseSigningValues["QUARTINAUT_KEYSTORE_FILE"])).isFile) {
            "Release keystore does not exist. See ANDROID_SIGNING.md."
        }
    }
}
tasks.matching { it.name == "preReleaseBuild" }.configureEach {
    dependsOn(requireReleaseSigning)
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}
dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.10.01"))
    implementation("androidx.compose.runtime:runtime-saveable")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("io.coil-kt:coil-compose:2.7.0")
    implementation("io.coil-kt:coil-svg:2.7.0")
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")
    implementation("com.google.zxing:core:3.5.3")
    // Bundled image label model: genuine offline ML, no server API key.
    implementation("com.google.mlkit:image-labeling:17.0.9")
    implementation("androidx.compose.material3:material3-window-size-class:1.3.0")
    implementation(platform("com.google.firebase:firebase-bom:35.2.0"))
    implementation("com.google.firebase:firebase-auth")
    implementation("com.google.firebase:firebase-firestore")
    implementation("com.google.firebase:firebase-functions")
    implementation("com.google.firebase:firebase-storage")
    implementation("com.google.firebase:firebase-messaging")
    implementation("com.google.firebase:firebase-appcheck-playintegrity")
    debugImplementation("com.google.firebase:firebase-appcheck-debug")
    implementation("androidx.core:core-ktx:1.15.0")
    debugImplementation("androidx.compose.ui:ui-tooling")
}
