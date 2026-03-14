package com.alfanews.telugu.views

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.ui.theme.Poppins
import com.alfanews.telugu.ui.theme.Ramabhadra
import com.alfanews.telugu.ui.theme.Mallanna
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.tasks.await

@Composable
fun IdCardPageView(
    user: User,
    onBack: () -> Unit
) {
    var globalSignature by remember { mutableStateOf<String?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    
    LaunchedEffect(Unit) {
        try {
            val doc = FirebaseService.db.collection("settings").document("android_config").get().await()
            var signature = doc.getString("authorized_signature")
            
            // ఒకవేళ గ్లోబల్ సంతకం లేకపోతే, ఏదైనా అడ్మిన్ సంతకం కోసం వెతకడం (Fallback)
            if (signature.isNullOrBlank()) {
                val adminDocs = FirebaseService.db.collection("users")
                    .whereEqualTo("role", "ADMIN")
                    .limit(5)
                    .get()
                    .await()
                
                signature = adminDocs.documents.firstOrNull { 
                    !it.getString("signatureUrl").isNullOrBlank() 
                }?.getString("signatureUrl")
            }
            
            globalSignature = signature
        } catch (_: Exception) {
            // Fallback handled in IdCardContent
        } finally {
            isLoading = false
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFEEEEEE))
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Top
    ) {
        Spacer(modifier = Modifier.height(24.dp))
        
        if (isLoading) {
            Box(modifier = Modifier.height(450.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Color.Red)
            }
        } else {
            IdCardContent(
                user = user, 
                displaySignature = globalSignature
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
    
    // Global signature ప్రాధాన్యత, అది లేకపోతే అడ్మిన్ అయితే స్వంత సంతకం, లేదంటే ఖాళీ
    val signatureUrl = displaySignature ?: if (user.role == UserRole.ADMIN) user.signatureUrl else null
    
    Card(
        modifier = modifier
            .width(cardWidth)
            .shadow(12.dp, RoundedCornerShape(12.dp)),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
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
            AsyncImage(
                model = photoUrl,
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
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp),
                horizontalAlignment = Alignment.Start,
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                DetailItem(label = "ID No", value = ": ${user.id.takeLast(8).uppercase()}")
                DetailItem(label = "Address", value = ": ${user.address ?: "N/A"}")
                DetailItem(label = "District", value = ": ${user.district ?: "N/A"}")
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
                // QR Code
                AsyncImage(
                    model = "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=alfa_id_${user.id}",
                    contentDescription = "QR Code",
                    modifier = Modifier.size(90.dp)
                )

                // Authorised Signature
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.width(150.dp)
                ) {
                    if (signatureUrl != null) {
                        AsyncImage(
                            model = signatureUrl,
                            contentDescription = "Signature",
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(70.dp),
                            contentScale = ContentScale.Fit
                        )
                    } else {
                        // సంతకం లేకపోతే అడ్మిన్ ఒకసారి అప్‌లోడ్ చేయాలి అని సూచించే స్పేస్
                        Spacer(modifier = Modifier.height(70.dp))
                    }
                    
                    HorizontalDivider(color = Color.Black, thickness = 1.dp)
                    Text(
                        text = "Authorised Signatory",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = Poppins,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(top = 4.dp)
                    )
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
            modifier = Modifier.width(85.dp)
        )
        Text(
            text = value,
            fontSize = 15.sp,
            fontWeight = FontWeight.Normal,
            fontFamily = Mallanna,
            lineHeight = 20.sp
        )
    }
}
