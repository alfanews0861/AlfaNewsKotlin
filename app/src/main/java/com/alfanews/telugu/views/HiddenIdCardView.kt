package com.alfanews.telugu.views

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.alfanews.telugu.models.User
import com.alfanews.telugu.models.UserRole
import java.util.Calendar

@Composable
fun HiddenIdCardView(
    user: User,
    displayPhoto: String,
    displaySignature: String,
    modifier: Modifier = Modifier
) {
    // This is a hidden component for generating ID card images
    // It's positioned off-screen and used for screenshot/export purposes
    Box(
        modifier = modifier
            .width(340.dp)
            .wrapContentHeight()
    ) {
        IdCardContent(
            user = user,
            displayPhoto = displayPhoto,
            displaySignature = displaySignature,
            modifier = Modifier.fillMaxSize()
        )
    }
}
