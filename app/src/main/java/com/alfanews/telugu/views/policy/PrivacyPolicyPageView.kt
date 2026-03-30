package com.alfanews.telugu.views.policy

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

import androidx.compose.ui.res.stringResource
import com.alfanews.telugu.R

@Composable
fun PrivacyPolicyPageView() {
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
                text = stringResource(R.string.privacy_policy_title),
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = Color.Black
            )
            
            Text(
                text = stringResource(R.string.privacy_intro),
                fontSize = 16.sp
            )
            
            Text(stringResource(R.string.info_we_collect), fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(stringResource(R.string.pii_desc), fontSize = 16.sp)
                Text(stringResource(R.string.usage_data_desc), fontSize = 16.sp)
                Text(stringResource(R.string.device_info_desc), fontSize = 16.sp)
            }
            
            Text(stringResource(R.string.how_we_use_info), fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(stringResource(R.string.use_provide_service), fontSize = 16.sp)
                Text(stringResource(R.string.use_personalize), fontSize = 16.sp)
                Text(stringResource(R.string.use_improve), fontSize = 16.sp)
                Text(stringResource(R.string.use_communicate), fontSize = 16.sp)
                Text(stringResource(R.string.use_fraud_prevention), fontSize = 16.sp)
            }
            
            Text(stringResource(R.string.data_security), fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
            Text(stringResource(R.string.data_security_desc), fontSize = 16.sp)
        }
    }
}
