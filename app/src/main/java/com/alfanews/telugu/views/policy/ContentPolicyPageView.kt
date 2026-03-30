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
fun ContentPolicyPageView() {
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
                text = stringResource(R.string.content_policy_title),
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = Color.Black
            )
            
            Text(
                text = stringResource(R.string.content_policy_intro),
                fontSize = 16.sp
            )
            
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFFFEE2E2)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(stringResource(R.string.copyright_complaints), fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Color(0xFF991B1B))
                    Text(stringResource(R.string.copyright_objection), fontSize = 14.sp)
                    Text(stringResource(R.string.dmca_email), fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
                    Text(stringResource(R.string.dmca_response), fontSize = 12.sp, color = Color.Gray)
                }
            }
            
            Text(stringResource(R.string.prohibited_content), fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(stringResource(R.string.hate_speech_desc), fontSize = 16.sp)
                Text(stringResource(R.string.harassment_desc), fontSize = 16.sp)
                Text(stringResource(R.string.obscenity_desc), fontSize = 16.sp)
                Text(stringResource(R.string.violence_desc), fontSize = 16.sp)
            }
        }
    }
}
