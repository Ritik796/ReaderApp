# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# React Native core / JNI
-keep class com.facebook.react.** { *; }
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.react.**
-dontwarn com.facebook.jni.**

# Firebase / Google Play services
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# Community libraries used in this app
-dontwarn com.oblador.**
-dontwarn com.reactnativecommunity.**
-dontwarn com.mrousavy.camera.**

# Vector icons / image and map helpers
-dontwarn io.invertase.**
-dontwarn com.airbnb.android.react.maps.**
