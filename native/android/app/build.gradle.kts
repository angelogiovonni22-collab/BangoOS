plugins {
    id("com.android.application")
    kotlin("android")
}

android {
    namespace = "com.bango.bos"
    compileSdk = 35

    defaultConfig {
        applicationId = providers.gradleProperty("BOS_ANDROID_APPLICATION_ID").orElse("com.bango.bos.dev").get()
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
}

repositories {
    google()
    mavenCentral()
}

dependencies {
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("androidx.core:core-ktx:1.15.0")
}
