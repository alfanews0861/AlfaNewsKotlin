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
fun DataCollectionPolicyPageView() {
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
                text = stringResource(R.string.data_collection_title),
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = Color.Black
            )
            
            Text(
                text = stringResource(R.string.data_collection_intro),
                fontSize = 16.sp
            )
            
            Text(stringResource(R.string.info_types), fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
            
            Text(stringResource(R.string.info_provided), fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(stringResource(R.string.account_info_desc), fontSize = 16.sp)
                Text(stringResource(R.string.user_content_desc), fontSize = 16.sp)
            }
            
            Text(stringResource(R.string.info_automatic), fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(stringResource(R.string.usage_details_desc), fontSize = 16.sp)
                Text(stringResource(R.string.technical_info_desc), fontSize = 16.sp)
                Text(stringResource(R.string.location_info_desc), fontSize = 16.sp)
            }
            
            Text(stringResource(R.string.why_collect_info), fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(stringResource(R.string.why_personalize), fontSize = 16.sp)
                Text(stringResource(R.string.why_analyze), fontSize = 16.sp)
                Text(stringResource(R.string.why_prevent_fraud), fontSize = 16.sp)
            }
        }
    }
}
