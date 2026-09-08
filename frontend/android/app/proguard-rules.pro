# ContextVault Production ProGuard Rules

# 1. React Native Core & JavaScript Engine
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters
-keep,allowobfuscation @interface com.facebook.common.internal.DoNotStrip

# Do not strip any method/class annotated with @DoNotStrip
-keep @com.facebook.proguard.annotations.DoNotStrip class * { *; }
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
}

-keepclassmembers class * {
    @com.facebook.proguard.annotations.KeepGettersAndSetters *;
}

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# 2. Hermes Engine
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# 3. React Native SQLite Storage
-keep class org.pgsqlite.** { *; }
-keepclassmembers class org.pgsqlite.** { *; }

# 4. React Native Vector Icons
-keep class com.oblador.vectoricons.** { *; }

# 5. OkHttp3 & Networking
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

# 6. React Native Reanimated
-keep class com.swmansion.reanimated.** { *; }
-keepclassmembers class com.swmansion.reanimated.** { *; }

# 7. MMKV / AsyncStorage
-keep class com.tencent.mmkv.** { *; }
-keep class com.reactnativecommunity.asyncstorage.** { *; }
