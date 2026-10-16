package com.alfanews.telugu.views

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
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
import coil3.compose.AsyncImage
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
import kotlinx.coroutines.withTimeoutOrNull
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
        Spacer(modifier = Modifier.height(24.dp))
        
        IdCardContent(
            user = displayUser, 
            displaySignature = globalSignature
        )

        Spacer(modifier = Modifier.height(20.dp))

        // 🔗 షేర్ బటన్: ప్రెస్ వెరిఫికేషన్ లింక్ మరియు వివరాలను సులభంగా షేర్ చేసుకునే సౌకర్యం
        val context = LocalContext.current
        Button(
            onClick = {
                val effectiveUid = displayUser.id.trim().ifBlank {
                    FirebaseService.auth.currentUser?.uid ?: ""
                }
                val mandalText = displayUser.assignedMandal ?: displayUser.mandal ?: ""
                val distText = displayUser.district ?: ""
                val locText = listOfNotNull(mandalText.takeIf { it.isNotBlank() }, distText.takeIf { it.isNotBlank() }).joinToString(", ")
                val shareText = "📰 ఆల్ఫా న్యూస్ అధికారిక ప్రెస్ ఐడీ వెరిఫికేషన్:\n\n👤 విలేకరి: ${displayUser.name}\n🆔 ఐడీ: ${displayUser.id.takeLast(8).uppercase()}\n📍 ప్రదేశం: ${locText.ifBlank { "ఆంధ్రప్రదేశ్ / తెలంగాణ" }}\n\nఈ లింక్ ద్వారా అధికారిక ప్రెస్ గుర్తింపు కార్డును తనిఖీ చేయవచ్చు:\nhttps://alfanews.app/verify/$effectiveUid"
                
                val sendIntent = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
                    putExtra(android.content.Intent.EXTRA_TEXT, shareText)
                    type = "text/plain"
                }
                context.startActivity(android.content.Intent.createChooser(sendIntent, "ప్రెస్ వెరిఫికేషన్ లింక్ షేర్ చేయండి"))
            },
            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
            shape = RoundedCornerShape(10.dp),
            modifier = Modifier
                .width(330.dp)
                .height(48.dp)
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
        
        Spacer(modifier = Modifier.height(48.dp))
    }
}

@Composable
fun IdCardContent(
    user: User,
    displayPhoto: String? = null,
    displaySignature: String? = null,
    modifier: Modifier = Modifier
) {
    val cardWidth = 330.dp
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
            .shadow(12.dp, RoundedCornerShape(12.dp)),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        CompositionLocalProvider(LocalContentColor provides Color.Black) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // 1. Logo alfanews
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 16.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "alfa",
                        color = Color.Black,
                        fontFamily = Poppins,
                        fontWeight = FontWeight.Bold,
                        fontSize = 42.sp
                    )
                    Text(
                        text = "news",
                        color = Color.Black,
                        fontFamily = Poppins,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 42.sp
                    )
                }

                // 2. Red Strip with PRESS
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFFFF0000))
                        .padding(vertical = 6.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "PRESS",
                        color = Color.White,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 32.sp,
                        letterSpacing = 5.sp
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

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
                AsyncImage(
                    model = photoModel,
                    contentDescription = "Reporter Photo",
                    modifier = Modifier
                        .width(190.dp)
                        .height(230.dp)
                        .background(Color.White)
                        .shadow(2.dp),
                    contentScale = ContentScale.Crop
                )

                Spacer(modifier = Modifier.height(16.dp))

                // 4. Full Name
                Text(
                    text = user.name,
                    fontSize = 26.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = Ramabhadra,
                    textAlign = TextAlign.Center,
                    color = Color.Black,
                    modifier = Modifier.padding(horizontal = 12.dp)
                )

                // 5. Designation/Role
                Text(
                    text = user.role.name.replace("_", " "),
                    fontSize = 18.sp,
                    color = Color(0xFFFF0000),
                    fontWeight = FontWeight.Bold,
                    fontFamily = Poppins,
                    modifier = Modifier.padding(bottom = 12.dp)
                )

                // 6. Details
                val effectiveMandal = user.assignedMandal?.takeIf { it.isNotBlank() }
                    ?: user.mandal?.takeIf { it.isNotBlank() }
                val displayId = user.id.takeLast(8).uppercase().ifBlank { "VERIFIED" }

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp),
                    horizontalAlignment = Alignment.Start,
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    DetailItem(label = "ID No", value = ": $displayId")
                    if (!effectiveMandal.isNullOrBlank()) {
                        DetailItem(label = "Mandal", value = ": $effectiveMandal")
                    }
                    DetailItem(label = "District", value = ": ${user.district?.takeIf { it.isNotBlank() } ?: "ఆంధ్రప్రదేశ్ / తెలంగాణ"}")
                    DetailItem(label = "Address", value = ": ${user.address?.takeIf { it.isNotBlank() } ?: effectiveMandal ?: "N/A"}")
                    DetailItem(label = "Valid Upto", value = ": 31-12-2027")
                }

                Spacer(modifier = Modifier.height(20.dp))

                // 7. QR Code and Signature Side-by-Side
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp),
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
                        modifier = Modifier.width(96.dp)
                    ) {
                        AsyncImage(
                            model = qrCodeUrl,
                            contentDescription = "QR Code",
                            modifier = Modifier.size(86.dp),
                            contentScale = ContentScale.Fit
                        )
                        Text(
                            text = "SCAN TO VERIFY",
                            fontSize = 8.sp,
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
                        modifier = Modifier.width(150.dp)
                    ) {
                        AsyncImage(
                            model = effectiveSignatureModel,
                            placeholder = painterResource(R.drawable.ic_authorized_signature),
                            error = painterResource(R.drawable.ic_authorized_signature),
                            contentDescription = "Authorised Signature",
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(56.dp)
                                .padding(horizontal = 4.dp),
                            contentScale = ContentScale.Fit
                        )
                        
                        HorizontalDivider(color = Color.Black, thickness = 1.dp)
                        Text(
                            text = "Authorised Signatory",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = Poppins,
                            textAlign = TextAlign.Center,
                            color = Color.Black,
                            modifier = Modifier.padding(top = 4.dp)
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
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = Poppins,
            color = Color.Black,
            modifier = Modifier.width(85.dp)
        )
        Text(
            text = value,
            fontSize = 15.sp,
            fontWeight = FontWeight.Normal,
            fontFamily = Mallanna,
            color = Color.Black,
            lineHeight = 20.sp
        )
    }
}
