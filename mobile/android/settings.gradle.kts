pluginManagement {
    val flutterSdkPath =
        run {
            val properties = java.util.Properties()
            file("local.properties").inputStream().use { properties.load(it) }
            val flutterSdkPath = properties.getProperty("flutter.sdk")
            require(flutterSdkPath != null) { "flutter.sdk not set in local.properties" }
            flutterSdkPath
        }

    includeBuild("$flutterSdkPath/packages/flutter_tools/gradle")

    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

plugins {
    id("dev.flutter.flutter-plugin-loader") version "1.0.0"
    // Fixado abaixo do padrao gerado pelo `flutter create` (9.1.0) -
    // flutter_inappwebview_android 1.1.3 (ultima versao publicada) ainda
    // usa getDefaultProguardFile('proguard-android.txt'), removido de vez
    // no AGP 9 (nao so descontinuado). 8.11.1 e o minimo exigido por essa
    // versao do Flutter E ainda aceita essa chamada (janela estreita entre
    // o minimo do Flutter e o AGP 9) - build confirmado funcionando nessa
    // versao (OS-MOBILE-12). Flutter ja avisa que vai parar de suportar
    // AGP < 9.0.1 em versoes futuras - revisitar quando o plugin publicar
    // uma versao compativel com AGP 9.
    id("com.android.application") version "8.11.1" apply false
    id("org.jetbrains.kotlin.android") version "2.4.0" apply false
}

include(":app")
