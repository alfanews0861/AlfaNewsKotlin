package com.alfanews.telugu.views.policy

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alfanews.telugu.R

@Composable
fun TermsOfServicePageView() {
    Card(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = stringResource(R.string.tos_title),
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = Color.Black
            )
            
            Text(
                text = stringResource(R.string.tos_welcome),
                fontSize = 16.sp
            )
            
            Text(stringResource(R.string.tos_use_service), fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
            Text(stringResource(R.string.tos_use_desc), fontSize = 16.sp)
            
            Text(stringResource(R.string.tos_user_accounts), fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
            Text(stringResource(R.string.tos_accounts_desc), fontSize = 16.sp)
            
            Text(stringResource(R.string.tos_ip_rights), fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
            Text(stringResource(R.string.tos_ip_desc), fontSize = 16.sp)
            
            Text(stringResource(R.string.tos_user_content), fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
            Text(stringResource(R.string.tos_user_content_desc), fontSize = 16.sp)
            
            Text(stringResource(R.string.tos_termination), fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
            Text(stringResource(R.string.tos_termination_desc), fontSize = 16.sp)
            
            Text(stringResource(R.string.tos_changes), fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
            Text(stringResource(R.string.tos_changes_desc), fontSize = 16.sp)
        }
    }
}
