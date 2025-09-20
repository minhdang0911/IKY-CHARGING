# ===== React Native =====
-keep class com.facebook.react.** { *; }
-keepclassmembers class * extends com.facebook.react.bridge.JavaScriptModule { *; }
-keepclassmembers class * extends com.facebook.react.bridge.NativeModule { *; }
-keepclassmembers class * extends com.facebook.react.uimanager.ViewManager { *; }
-keepclassmembers class * implements com.facebook.react.bridge.JavaScriptModule { *; }
-keepclassmembers class * implements com.facebook.react.bridge.NativeModule { *; }
-keepclassmembers class * implements com.facebook.react.uimanager.ViewManager { *; }
-dontwarn com.facebook.react.**

# Hermes (nếu xài)
-keep class com.facebook.hermes.** { *; }
-dontwarn com.facebook.hermes.**

# ===== Firebase / Google Play Services =====
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# ===== React Native Vector Icons =====
-keep class com.oblador.vectoricons.** { *; }
-dontwarn com.oblador.vectoricons.**

# ===== OkHttp (nếu dùng fetch/axios) =====
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep class okio.** { *; }

# ===== Gson (nếu có xài) =====
-keep class com.google.gson.** { *; }
-dontwarn com.google.gson.**

# ===== General =====
-keep class * extends java.util.ListResourceBundle {
    protected Object[][] getContents();
}
-keep public class com.google.android.gms.common.internal.safeparcel.SafeParcelable {
    public static final *** NULL;
}
-keepnames @com.google.android.gms.common.annotation.KeepName class *
-keepclassmembers class * {
   @com.google.android.gms.common.annotation.KeepName *;
}
