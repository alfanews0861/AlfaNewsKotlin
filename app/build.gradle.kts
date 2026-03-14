import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.gms.google-services")
}

android {
    namespace = "com.alfanews.telugu"
    compileSdk = 35
    ndkVersion = "27.1.12297006"

    defaultConfig {
        applicationId = "com.alfanews.telugu"
        minSdk = 24
        targetSdk = 35
        versionCode = 560 // వర్షన్ పెంచాను
        versionName = "Sree_4.4"
        multiDexEnabled = true

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    buildFeatures {
        buildConfig = true
        compose = true
    }

   signingConfigs {
        create("release") {
            // YAML env నుండి వచ్చే వేరియబుల్స్ ఇక్కడ వాడుతున్నాము
            val keystoreFile = System.getenv("RELEASE_STORE_FILE") ?: "release.jks"
            storeFile = file(keystoreFile)
            storePassword = System.getenv("RELEASE_STORE_PASSWORD")
            keyAlias = System.getenv("RELEASE_KEY_ALIAS")
            keyPassword = System.getenv("RELEASE_KEY_PASSWORD")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            signingConfig = signingConfigs.getByName("release")
            
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    packaging {
        jniLibs {
            // 16 KB సపోర్ట్ కోసం ఇది చాలా ముఖ్యం
            useLegacyPackaging = true
        }
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

// dependencies సెక్షన్ మీ పాత ఫైల్ లో ఉన్నట్లే ఉంచండి (మార్చవద్దు)
dependencies {
    // ... మీ పాత dependencies కోడ్ ఇక్కడ ఉంటుంది ...
}
