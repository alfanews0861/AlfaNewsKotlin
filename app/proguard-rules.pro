# Add project specific ProGuard rules here.
-keepattributes Signature, *Annotation*, EnclosingMethod, InnerClasses, Exceptions

# Optimization and Obfuscation
-repackageclasses ''
-allowaccessmodification
# -dontoptimize # 🚀 Removed to allow R8 optimizations

# Models - Necessary for Firebase and Gson serialization
-keep public class com.alfanews.telugu.models.** {
    <fields>;
    <methods>;
}

# General Kotlin & Coroutines rules
-keep class kotlin.coroutines.jvm.internal.SuspendLambda { *; }
-keepclassmembers class kotlin.coroutines.jvm.internal.BaseContinuationImpl {
    <init>(kotlin.coroutines.Continuation);
}
-dontwarn kotlin.coroutines.jvm.internal.*
-keepclassmembers class kotlin.Metadata {
    <methods>;
}
-keepclassmembers,allowobfuscation class * {
    @kotlin.jvm.JvmField <fields>;
}

# Firebase
-keep class com.google.firebase.provider.FirebaseInitProvider
-keep class com.google.android.gms.common.api.internal.TaskApiCall { *; }
-keep class com.google.android.gms.common.api.internal.IStatusCallback { *; }
-keepnames class com.google.android.gms.tasks.SuccessContinuation
-keepnames class com.google.android.gms.tasks.OnFailureListener
-keepnames class com.google.android.gms.tasks.OnSuccessListener
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**
-keep class com.google.firebase.** { *; }

# Coil 3 / OkHttp / Okio
-if class okhttp3.OkHttpClient
-keep,allowobfuscation class okhttp3.** { *; }
-keep,allowobfuscation class okio.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class org.conscrypt.** { *; }

# gRPC - Workaround for R8 ArrayIndexOutOfBoundsException
-keep,allowobfuscation class io.grpc.okhttp.OkHttpClientTransport { *; }
-keep class io.grpc.** { *; }
-dontwarn io.grpc.**

# Gson
-keep class com.google.gson.stream.** { *; }
-keep class com.google.gson.Gson
-keep class com.google.gson.reflect.TypeToken
-keep class * extends com.google.gson.TypeAdapter

# Application classes
-keep public class * extends android.app.Activity
-keep public class * extends android.app.Application
-keep public class * extends android.app.Service
-keep public class * extends android.content.BroadcastReceiver
-keep public class * extends android.content.ContentProvider
-keep public class * extends androidx.fragment.app.Fragment
-keep public class * extends androidx.lifecycle.ViewModel

# Keep custom views
-keep public class * extends android.view.View {
    public <init>(android.content.Context);
    public <init>(android.content.Context, android.util.AttributeSet);
    public void set*(...);
}

-keepclasseswithmembers class * {
    public <init>(android.content.Context, android.util.AttributeSet);
}

-keepclasseswithmembers class * {
    public <init>(android.content.Context, android.util.AttributeSet, int);
}

-keepclassmembers class * implements android.os.Parcelable {
  public static final android.os.Parcelable$Creator CREATOR;
}

-keepclassmembers class **.R$* {
    public static <fields>;
}

# For Jetpack Compose
-keepclassmembers class * {
    @androidx.compose.runtime.Composable <methods>;
}
-keepclassmembers class * implements androidx.compose.ui.tooling.preview.PreviewParameterProvider {
    public <init>();
    public kotlin.sequences.Sequence getValues();
}

# Fix missing classes in minified builds
-dontwarn javax.annotation.**
-dontwarn org.codehaus.mojo.animal_sniffer.IgnoreJRERequirement
-dontwarn sun.misc.Unsafe

# Workaround for duplicate classes
-keep class kotlinx.coroutines.** { *; }

-keep class com.alfanews.telugu.AlfaNewsApplication { *; }
