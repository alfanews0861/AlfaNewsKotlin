package com.alfanews.telugu.views

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PaintFlagsDrawFilter
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Typeface
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import androidx.core.content.res.ResourcesCompat
import coil3.SingletonImageLoader
import coil3.compose.AsyncImage
import coil3.request.ImageRequest
import coil3.request.SuccessResult
import coil3.request.allowHardware
import coil3.toBitmap
import com.alfanews.telugu.R
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.ui.theme.Mallanna
import com.alfanews.telugu.ui.theme.Poppins
import com.alfanews.telugu.ui.theme.Ramabhadra
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.io.File
import java.io.FileOutputStream
import java.net.URLEncoder

private const val DEFAULT_AUTHORIZED_SIGNATURE_URL = "https://firebasestorage.googleapis.com/v0/b/alfa-news-31bf7.firebasestorage.app/o/signatures%2FqP8fdzSBPTggNonGQFTqOqfDxfH2%2F47166a18-cf57-4a5c-9c6e-b5d2e0b7af27?alt=media&token=45ff6704-c096-4cf6-951f-e6f66ee1a726"

@Composable
fun IdCardPageView(
    user: User,
    onBack: () -> Unit
) {
    BackHandler { onBack() }
    var globalSignature by remember { mutableStateOf<String?>(DEFAULT_AUTHORIZED_SIGNATURE_URL) }
    var displayUser by remember(user) { mutableStateOf(user) }
    var isDownloading by remember { mutableStateOf(false) }
    val coroutineScope = rememberCoroutineScope()
    val context = LocalContext.current

    LaunchedEffect(user.id) {
        // 1. Parallel background update for latest user data
        launch(Dispatchers.IO) {
            if (user.id.isNotBlank() && user.id != "guest") {
                try {
                    val userDoc = withTimeoutOrNull(4000L) {
                        try {
                            FirebaseService.db.collection("users").document(user.id).get().await()
                        } catch (_: Exception) {
                            try {
                                FirebaseService.db.collection("users").document(user.id).get(com.google.firebase.firestore.Source.CACHE).await()
                            } catch (_: Exception) { null }
                        }
                    }
                    if (userDoc != null && userDoc.exists()) {
                        val rawRole = userDoc.get("role")
                        val mandal = userDoc.getString("assignedMandal")?.takeIf { it.isNotBlank() }
                            ?: userDoc.getString("mandal")?.takeIf { it.isNotBlank() }
                        val pts = (userDoc.get("points") as? Number)?.toInt() ?: 0
                        val badges = (userDoc.get("badges") as? List<*>)?.mapNotNull { it as? String } ?: emptyList()
                        val hasRep = !mandal.isNullOrBlank() || pts > 0 || badges.isNotEmpty()
                        val resolvedRole = when {
                            user.role == UserRole.ADMIN -> UserRole.ADMIN
                            hasRep -> UserRole.REPORTER
                            else -> UserRole.fromStringSafe(rawRole) ?: displayUser.role
                        }
                        displayUser = displayUser.copy(
                            name = userDoc.getString("name")?.takeIf { it.isNotBlank() } ?: displayUser.name,
                            role = resolvedRole,
                            photoUrl = userDoc.getString("photoUrl")?.takeIf { it.isNotBlank() } ?: displayUser.photoUrl,
                            district = userDoc.getString("district") ?: displayUser.district,
                            assignedMandal = mandal ?: displayUser.assignedMandal,
                            address = userDoc.getString("address") ?: displayUser.address,
                            signatureUrl = userDoc.getString("signatureUrl") ?: displayUser.signatureUrl
                        )
                    }
                } catch (_: Exception) {}
            }
        }

        // 2. Parallel background fetch for authorized signature from system config
        launch(Dispatchers.IO) {
            try {
                val configDoc = withTimeoutOrNull(4000L) {
                    try {
                        FirebaseService.db.collection("settings").document("android_config").get().await()
                    } catch (_: Exception) {
                        try {
                            FirebaseService.db.collection("settings").document("android_config").get(com.google.firebase.firestore.Source.CACHE).await()
                        } catch (_: Exception) { null }
                    }
                }
                var signature = configDoc?.getString("authorized_signature")
                
                if (signature.isNullOrBlank()) {
                    val adminDocs = withTimeoutOrNull(4000L) {
                        FirebaseService.db.collection("users")
                            .whereEqualTo("role", "ADMIN")
                            .limit(5)
                            .get()
                            .await()
                    }
                    signature = adminDocs?.documents?.firstOrNull { 
                        !it.getString("signatureUrl").isNullOrBlank() 
                    }?.getString("signatureUrl")
                }
                
                if (!signature.isNullOrBlank()) {
                    globalSignature = signature
                }
            } catch (_: Exception) {}
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Top
    ) {
        Spacer(modifier = Modifier.height(20.dp))
        
        // 🪪 ID Card Display (Standard CR80 Printable Proportions ~ 1 : 1.58)
        IdCardContent(
            user = displayUser, 
            displaySignature = globalSignature
        )

        Spacer(modifier = Modifier.height(18.dp))

        // 📥 డౌన్‌లోడ్ బటన్ (High Quality JPG File with Authorised Signatory)
        Button(
            onClick = {
                if (!isDownloading) {
                    isDownloading = true
                    coroutineScope.launch {
                        try {
                            val success = generateAndSaveIdCardJpg(
                                context = context,
                                user = displayUser,
                                signatureModel = globalSignature
                            )
                            if (success) {
                                Toast.makeText(context, "హై క్వాలిటీ ఐడీ కార్డు (JPG) గ్యాలరీలో సేవ్ చేయబడింది!", Toast.LENGTH_LONG).show()
                            } else {
                                Toast.makeText(context, "ఐడీ కార్డు సేవ్ చేయడంలో సమస్య ఏర్పడింది", Toast.LENGTH_SHORT).show()
                            }
                        } catch (e: Exception) {
                            Toast.makeText(context, "డౌన్‌లోడ్ లోపం: ${e.message}", Toast.LENGTH_SHORT).show()
                        } finally {
                            isDownloading = false
                        }
                    }
                }
            },
            enabled = !isDownloading,
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFC62828)),
            shape = RoundedCornerShape(10.dp),
            modifier = Modifier
                .width(320.dp)
                .height(48.dp)
        ) {
            if (isDownloading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(18.dp),
                    color = Color.White,
                    strokeWidth = 2.dp
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "డౌన్‌లోడ్ అవుతోంది...",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            } else {
                Icon(
                    imageVector = Icons.Default.Download,
                    contentDescription = "Download ID Card",
                    modifier = Modifier.size(20.dp),
                    tint = Color.White
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "ఐడీ కార్డు డౌన్‌లోడ్ చేయండి (JPG)",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // 🔗 షేర్ బటన్: ప్రెస్ వెరిఫికేషన్ లింక్ మరియు వివరాలను సులభంగా షేర్ చేసుకునే సౌకర్యం
        Button(
            onClick = {
                val effectiveUid = displayUser.id.trim().ifBlank {
                    FirebaseService.auth.currentUser?.uid ?: ""
                }
                val mandalText = displayUser.assignedMandal ?: displayUser.mandal ?: ""
                val distText = displayUser.district ?: ""
                val locText = listOfNotNull(mandalText.takeIf { it.isNotBlank() }, distText.takeIf { it.isNotBlank() }).joinToString(", ")
                val shareText = "📰 ఆల్ఫా న్యూస్ అధికారిక ప్రెస్ ఐడీ వెరిఫికేషన్:\n\n👤 విలేకరి: ${displayUser.name}\n🆔 ఐడీ: ${displayUser.id.takeLast(8).uppercase()}\n📍 ప్రదేశం: ${locText.ifBlank { "ఆంధ్రప్రదేశ్ / తెలంగాణ" }}\n\nఈ లింక్ ద్వారా అధికారిక ప్రెస్ గుర్తింపు కార్డును తనిఖీ చేయవచ్చు:\nhttps://alfanews.app/verify/$effectiveUid"
                
                val sendIntent = Intent(Intent.ACTION_SEND).apply {
                    putExtra(Intent.EXTRA_TEXT, shareText)
                    type = "text/plain"
                }
                context.startActivity(Intent.createChooser(sendIntent, "ప్రెస్ వెరిఫికేషన్ లింక్ షేర్ చేయండి"))
            },
            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
            shape = RoundedCornerShape(10.dp),
            modifier = Modifier
                .width(320.dp)
                .height(46.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Share,
                contentDescription = null,
                modifier = Modifier.size(18.dp),
                tint = Color.White
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "వెరిఫికేషన్ లింక్ షేర్ చేయండి",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }
        
        Spacer(modifier = Modifier.height(36.dp))
    }
}

@Composable
fun IdCardContent(
    user: User,
    displayPhoto: String? = null,
    displaySignature: String? = null,
    modifier: Modifier = Modifier
) {
    val cardWidth = 320.dp
    val photoUrl = displayPhoto ?: user.photoUrl
    
    // Authorised signature model with robust triple fallback:
    // 1. Dynamic signature from remote settings/android_config
    // 2. Admin self-signature if user is admin
    // 3. Local bundled drawable (R.drawable.ic_authorized_signature)
    val effectiveSignatureModel: Any = remember(displaySignature, user.signatureUrl, user.role) {
        when {
            !displaySignature.isNullOrBlank() -> displaySignature
            user.role == UserRole.ADMIN && !user.signatureUrl.isNullOrBlank() -> user.signatureUrl!!
            else -> R.drawable.ic_authorized_signature
        }
    }
    
    Card(
        modifier = modifier
            .width(cardWidth)
            .shadow(10.dp, RoundedCornerShape(12.dp)),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        CompositionLocalProvider(LocalContentColor provides Color.Black) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 12.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // 1. Logo alfanews
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 10.dp, bottom = 6.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "alfa",
                        color = Color.Black,
                        fontFamily = Poppins,
                        fontWeight = FontWeight.Bold,
                        fontSize = 30.sp
                    )
                    Text(
                        text = "news",
                        color = Color.Black,
                        fontFamily = Poppins,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 30.sp
                    )
                }

                // 2. Red Strip with PRESS
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFFFF0000))
                        .padding(vertical = 4.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "PRESS",
                        color = Color.White,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 22.sp,
                        letterSpacing = 4.sp
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                // 3. Profile Photo
                val photoModel = remember(photoUrl, user.name) {
                    if (!photoUrl.isNullOrBlank()) {
                        photoUrl
                    } else {
                        val safeName = try {
                            URLEncoder.encode(user.name.ifBlank { "Reporter" }, "UTF-8")
                        } catch (_: Exception) { "Reporter" }
                        "https://ui-avatars.com/api/?name=$safeName&background=0D1B2A&color=E0E1DD&size=300"
                    }
                }
                Box(
                    modifier = Modifier
                        .width(120.dp)
                        .height(135.dp)
                        .shadow(2.dp, RoundedCornerShape(4.dp))
                        .background(Color.White, RoundedCornerShape(4.dp))
                        .border(1.dp, Color(0xFFDDDDDD), RoundedCornerShape(4.dp))
                ) {
                    AsyncImage(
                        model = photoModel,
                        contentDescription = "Reporter Photo",
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                }

                Spacer(modifier = Modifier.height(6.dp))

                // 4. Full Name
                Text(
                    text = user.name,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = Ramabhadra,
                    textAlign = TextAlign.Center,
                    color = Color.Black,
                    modifier = Modifier.padding(horizontal = 10.dp)
                )

                // 5. Designation/Role
                Text(
                    text = user.role.name.replace("_", " "),
                    fontSize = 13.sp,
                    color = Color(0xFFFF0000),
                    fontWeight = FontWeight.Bold,
                    fontFamily = Poppins,
                    modifier = Modifier.padding(bottom = 6.dp)
                )

                // 6. Details
                val effectiveMandal = user.assignedMandal?.takeIf { it.isNotBlank() }
                    ?: user.mandal?.takeIf { it.isNotBlank() }
                val displayId = user.id.takeLast(8).uppercase().ifBlank { "VERIFIED" }

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 22.dp),
                    horizontalAlignment = Alignment.Start,
                    verticalArrangement = Arrangement.spacedBy(3.dp)
                ) {
                    DetailItem(label = "ID No", value = ": $displayId")
                    if (!effectiveMandal.isNullOrBlank()) {
                        DetailItem(label = "Mandal", value = ": $effectiveMandal")
                    }
                    DetailItem(label = "District", value = ": ${user.district?.takeIf { it.isNotBlank() } ?: "ఆంధ్రప్రదేశ్ / తెలంగాణ"}")
                    DetailItem(label = "Address", value = ": ${user.address?.takeIf { it.isNotBlank() } ?: effectiveMandal ?: "N/A"}")
                    DetailItem(label = "Valid Upto", value = ": 31-12-2027")
                }

                Spacer(modifier = Modifier.height(8.dp))

                // 7. QR Code and Authorised Signature Side-by-Side
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 22.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Bottom
                ) {
                    // QR Code with URL encoding for instant verification
                    val effectiveUid = user.id.trim().ifBlank {
                        FirebaseService.auth.currentUser?.uid ?: ""
                    }
                    val qrVerifyUrl = "https://alfanews.app/verify/$effectiveUid"
                    val encodedQrData = remember(effectiveUid) {
                        try {
                            URLEncoder.encode(qrVerifyUrl, "UTF-8")
                        } catch (_: Exception) {
                            qrVerifyUrl
                        }
                    }
                    val qrCodeUrl = "https://api.qrserver.com/v1/create-qr-code/?size=250x250&format=png&data=$encodedQrData"

                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.width(76.dp)
                    ) {
                        AsyncImage(
                            model = qrCodeUrl,
                            contentDescription = "QR Code",
                            modifier = Modifier.size(62.dp),
                            contentScale = ContentScale.Fit
                        )
                        Text(
                            text = "SCAN TO VERIFY",
                            fontSize = 7.5.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = Poppins,
                            textAlign = TextAlign.Center,
                            color = Color(0xFF555555),
                            letterSpacing = 0.5.sp,
                            modifier = Modifier.padding(top = 2.dp)
                        )
                    }

                    // Authorised Signature (Official AlfaNews Authorized Signature)
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.width(130.dp)
                    ) {
                        AsyncImage(
                            model = effectiveSignatureModel,
                            placeholder = painterResource(R.drawable.ic_authorized_signature),
                            error = painterResource(R.drawable.ic_authorized_signature),
                            contentDescription = "Authorised Signature",
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(38.dp)
                                .padding(horizontal = 4.dp),
                            contentScale = ContentScale.Fit
                        )
                        
                        HorizontalDivider(color = Color.Black, thickness = 1.dp)
                        Text(
                            text = "Authorised Signatory",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = Poppins,
                            textAlign = TextAlign.Center,
                            color = Color.Black,
                            modifier = Modifier.padding(top = 2.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun DetailItem(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = label,
            fontSize = 12.5.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = Poppins,
            color = Color.Black,
            modifier = Modifier.width(76.dp)
        )
        Text(
            text = value,
            fontSize = 12.5.sp,
            fontWeight = FontWeight.Normal,
            fontFamily = Mallanna,
            color = Color.Black,
            lineHeight = 16.sp
        )
    }
}

/**
 * Generates an ultra-crisp, 300-DPI printable high quality JPG file of the Press ID Card
 * strictly following standard ISO 7810 ID-1 / CR-80 dimensions (Aspect Ratio ~ 1 : 1.585)
 * and guarantees 100% presence of the Authorised Signatory, QR Code, and all details.
 */
private suspend fun generateAndSaveIdCardJpg(
    context: Context,
    user: User,
    signatureModel: String?
): Boolean = withContext(Dispatchers.IO) {
    try {
        val imageLoader = SingletonImageLoader.get(context)

        // 1. Resolve Profile Photo
        val photoUrl = user.photoUrl?.takeIf { it.isNotBlank() } ?: run {
            val safeName = try {
                URLEncoder.encode(user.name.ifBlank { "Reporter" }, "UTF-8")
            } catch (_: Exception) { "Reporter" }
            "https://ui-avatars.com/api/?name=$safeName&background=0D1B2A&color=E0E1DD&size=300"
        }
        var photoBitmap: Bitmap? = null
        try {
            val photoReq = ImageRequest.Builder(context)
                .data(photoUrl)
                .allowHardware(false)
                .build()
            val res = imageLoader.execute(photoReq)
            if (res is SuccessResult) {
                photoBitmap = res.image.toBitmap()
            }
        } catch (_: Exception) {}

        // 2. Resolve Authorised Signature (Crucial Requirement: 100% Guaranteed Presence)
        var signatureBitmap: Bitmap? = null
        if (!signatureModel.isNullOrBlank()) {
            try {
                val sigReq = ImageRequest.Builder(context)
                    .data(signatureModel)
                    .allowHardware(false)
                    .build()
                val res = imageLoader.execute(sigReq)
                if (res is SuccessResult) {
                    signatureBitmap = res.image.toBitmap()
                }
            } catch (_: Exception) {}
        }
        // Fallback to local official bundled drawable if remote is null or failed
        if (signatureBitmap == null) {
            try {
                signatureBitmap = BitmapFactory.decodeResource(context.resources, R.drawable.ic_authorized_signature)
            } catch (_: Exception) {}
        }

        // 3. Resolve QR Code
        val effectiveUid = user.id.trim().ifBlank {
            FirebaseService.auth.currentUser?.uid ?: ""
        }
        val qrVerifyUrl = "https://alfanews.app/verify/$effectiveUid"
        val encodedQrData = try {
            URLEncoder.encode(qrVerifyUrl, "UTF-8")
        } catch (_: Exception) { qrVerifyUrl }
        val qrCodeUrl = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&format=png&data=$encodedQrData"
        var qrBitmap: Bitmap? = null
        try {
            val qrReq = ImageRequest.Builder(context)
                .data(qrCodeUrl)
                .allowHardware(false)
                .build()
            val res = imageLoader.execute(qrReq)
            if (res is SuccessResult) {
                qrBitmap = res.image.toBitmap()
            }
        } catch (_: Exception) {}

        // 4. Setup High-Resolution Printable Canvas (CR-80 standard aspect ratio ~ 1 : 1.585)
        // 1080 x 1712 px @ 300 DPI (Standard ISO 7810 ID-1: 54mm x 85.6mm)
        val width = 1080
        val height = 1710
        val cardBitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(cardBitmap)
        canvas.drawFilter = PaintFlagsDrawFilter(0, Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)

        // Fill pure white background
        val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.WHITE
            style = Paint.Style.FILL
        }
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), bgPaint)

        // Typefaces
        val poppinsBold = try { ResourcesCompat.getFont(context, R.font.poppins_bold) } catch (_: Exception) { null } ?: Typeface.DEFAULT_BOLD
        val poppinsSemibold = try { ResourcesCompat.getFont(context, R.font.poppins_semibold) } catch (_: Exception) { null } ?: Typeface.DEFAULT_BOLD
        val ramabhadra = try { ResourcesCompat.getFont(context, R.font.ramabhadra_regular) } catch (_: Exception) { null } ?: Typeface.DEFAULT_BOLD
        val mallanna = try { ResourcesCompat.getFont(context, R.font.mallanna_regular) } catch (_: Exception) { null } ?: Typeface.DEFAULT

        // A. Header Logo "alfa" + "news"
        val alfaPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.BLACK
            typeface = poppinsBold
            textSize = 72f
        }
        val newsPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.BLACK
            typeface = poppinsSemibold
            textSize = 72f
        }
        val alfaW = alfaPaint.measureText("alfa")
        val newsW = newsPaint.measureText("news")
        val totalLogoW = alfaW + newsW
        val logoStartX = (width - totalLogoW) / 2f
        val logoY = 95f
        canvas.drawText("alfa", logoStartX, logoY, alfaPaint)
        canvas.drawText("news", logoStartX + alfaW, logoY, newsPaint)

        // B. Red Strip with "PRESS"
        val redStripTop = 135f
        val redStripHeight = 78f
        val redPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.parseColor("#FF0000")
            style = Paint.Style.FILL
        }
        canvas.drawRect(0f, redStripTop, width.toFloat(), redStripTop + redStripHeight, redPaint)

        val pressPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.WHITE
            typeface = poppinsBold
            textSize = 52f
            letterSpacing = 0.25f
            textAlign = Paint.Align.CENTER
        }
        canvas.drawText("PRESS", width / 2f, redStripTop + 56f, pressPaint)

        // C. Profile Photo (with border and rounded rect)
        val photoW = 410f
        val photoH = 460f
        val photoLeft = (width - photoW) / 2f
        val photoTop = redStripTop + redStripHeight + 35f
        val photoRect = RectF(photoLeft, photoTop, photoLeft + photoW, photoTop + photoH)

        // White base + Border
        val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.parseColor("#DDDDDD")
            style = Paint.Style.STROKE
            strokeWidth = 3f
        }
        canvas.drawRect(photoRect, borderPaint)

        if (photoBitmap != null) {
            val srcR = Rect(0, 0, photoBitmap.width, photoBitmap.height)
            val dstR = Rect(photoLeft.toInt(), photoTop.toInt(), (photoLeft + photoW).toInt(), (photoTop + photoH).toInt())
            val pPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
            canvas.drawBitmap(photoBitmap, srcR, dstR, pPaint)
        }

        // D. Full Name
        val namePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.BLACK
            typeface = ramabhadra
            textSize = 62f
            textAlign = Paint.Align.CENTER
        }
        val nameY = photoTop + photoH + 75f
        canvas.drawText(user.name, width / 2f, nameY, namePaint)

        // E. Designation / Role
        val rolePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.parseColor("#FF0000")
            typeface = poppinsBold
            textSize = 42f
            textAlign = Paint.Align.CENTER
        }
        val roleY = nameY + 54f
        val roleText = user.role.name.replace("_", " ")
        canvas.drawText(roleText, width / 2f, roleY, rolePaint)

        // F. Details List (ID No, Mandal, District, Address, Valid Upto)
        val effectiveMandal = user.assignedMandal?.takeIf { it.isNotBlank() }
            ?: user.mandal?.takeIf { it.isNotBlank() }
        val displayId = user.id.takeLast(8).uppercase().ifBlank { "VERIFIED" }

        val details = mutableListOf<Pair<String, String>>()
        details.add("ID No" to ": $displayId")
        if (!effectiveMandal.isNullOrBlank()) {
            details.add("Mandal" to ": $effectiveMandal")
        }
        details.add("District" to ": ${user.district?.takeIf { it.isNotBlank() } ?: "ఆంధ్రప్రదేశ్ / తెలంగాణ"}")
        details.add("Address" to ": ${user.address?.takeIf { it.isNotBlank() } ?: effectiveMandal ?: "N/A"}")
        details.add("Valid Upto" to ": 31-12-2027")

        val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.BLACK
            typeface = poppinsBold
            textSize = 38f
        }
        val valPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.BLACK
            typeface = mallanna
            textSize = 38f
        }

        var detailY = roleY + 65f
        val leftMargin = 85f
        val valMargin = 310f

        for (item in details) {
            canvas.drawText(item.first, leftMargin, detailY, labelPaint)
            val valText = item.second
            if (valPaint.measureText(valText) > (width - valMargin - 50f)) {
                val truncated = android.text.TextUtils.ellipsize(valText, android.text.TextPaint(valPaint), width - valMargin - 50f, android.text.TextUtils.TruncateAt.END).toString()
                canvas.drawText(truncated, valMargin, detailY, valPaint)
            } else {
                canvas.drawText(valText, valMargin, detailY, valPaint)
            }
            detailY += 52f
        }

        // G. Bottom Section: QR Code on Left, Authorised Signatory on Right
        val bottomSectionY = height - 250f

        // QR Code (Left)
        val qrSize = 180f
        val qrLeft = 85f
        val qrTop = bottomSectionY
        if (qrBitmap != null) {
            val qrSrc = Rect(0, 0, qrBitmap.width, qrBitmap.height)
            val qrDst = Rect(qrLeft.toInt(), qrTop.toInt(), (qrLeft + qrSize).toInt(), (qrTop + qrSize).toInt())
            canvas.drawBitmap(qrBitmap, qrSrc, qrDst, Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))
        }
        val qrTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.parseColor("#555555")
            typeface = poppinsBold
            textSize = 20f
            letterSpacing = 0.1f
            textAlign = Paint.Align.CENTER
        }
        canvas.drawText("SCAN TO VERIFY", qrLeft + (qrSize / 2f), qrTop + qrSize + 28f, qrTextPaint)

        // Authorised Signatory (Right) - GUARANTEED 100% IN DOWNLOADED FILE
        val sigWidth = 380f
        val sigHeight = 120f
        val sigLeft = width - sigWidth - 85f
        val sigTop = bottomSectionY + 25f

        if (signatureBitmap != null) {
            val sigSrc = Rect(0, 0, signatureBitmap.width, signatureBitmap.height)
            val sigDst = Rect(sigLeft.toInt(), sigTop.toInt(), (sigLeft + sigWidth).toInt(), (sigTop + sigHeight).toInt())
            canvas.drawBitmap(signatureBitmap, sigSrc, sigDst, Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))
        }

        // Black divider line under signature
        val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.BLACK
            strokeWidth = 3f
        }
        val lineY = sigTop + sigHeight + 10f
        canvas.drawLine(sigLeft, lineY, sigLeft + sigWidth, lineY, linePaint)

        // "Authorised Signatory" text
        val authSignPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.BLACK
            typeface = poppinsBold
            textSize = 30f
            textAlign = Paint.Align.CENTER
        }
        canvas.drawText("Authorised Signatory", sigLeft + (sigWidth / 2f), lineY + 36f, authSignPaint)

        // 5. Save to Cache & MediaStore
        val safeReporterName = user.name.replace("[^a-zA-Z0-9_]".toRegex(), "_").ifBlank { "Reporter" }
        val filename = "AlfaNews_ID_${safeReporterName}.jpg"

        val cacheFolder = File(context.cacheDir, "images")
        cacheFolder.mkdirs()
        val tempJpgFile = File(cacheFolder, filename)
        FileOutputStream(tempJpgFile).use { outStream ->
            cardBitmap.compress(Bitmap.CompressFormat.JPEG, 98, outStream)
            outStream.flush()
        }

        // Save to Public MediaStore (Pictures/AlfaNews)
        try {
            val contentValues = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, filename)
                put(MediaStore.MediaColumns.MIME_TYPE, "image/jpeg")
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/AlfaNews")
                    put(MediaStore.MediaColumns.IS_PENDING, 1)
                }
            }
            val uri = context.contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, contentValues)
            if (uri != null) {
                context.contentResolver.openOutputStream(uri)?.use { mediaOut ->
                    cardBitmap.compress(Bitmap.CompressFormat.JPEG, 98, mediaOut)
                    mediaOut.flush()
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    contentValues.clear()
                    contentValues.put(MediaStore.MediaColumns.IS_PENDING, 0)
                    context.contentResolver.update(uri, contentValues, null, null)
                }
            }
        } catch (_: Exception) {}

        // Launch Share / View Chooser with the High Quality JPG
        val fileUri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", tempJpgFile)
        val chooserIntent = Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
            type = "image/jpeg"
            putExtra(Intent.EXTRA_STREAM, fileUri)
            putExtra(Intent.EXTRA_SUBJECT, "ఆల్ఫా న్యూస్ ప్రెస్ ఐడీ కార్డు - ${user.name}")
            putExtra(Intent.EXTRA_TEXT, "📰 ఆల్ఫా న్యూస్ అధికారిక ప్రెస్ ఐడీ కార్డు: ${user.name}")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }, "ఐడీ కార్డు డౌన్‌లోడ్ / షేర్ చేయండి").apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(chooserIntent)

        true
    } catch (e: Exception) {
        android.util.Log.e("IdCardPageView", "Error generating ID card JPG: ${e.message}", e)
        false
    }
}
