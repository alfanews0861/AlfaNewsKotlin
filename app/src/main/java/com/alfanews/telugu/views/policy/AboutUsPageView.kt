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
fun AboutUsPageView() {
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
                text = stringResource(R.string.about_us_title),
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = Color.Black
            )
            
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFFDBEAFE)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(stringResource(R.string.news_aggregator), fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Color(0xFF1E3A8A))
                    Text(
                        text = stringResource(R.string.about_us_description),
                        fontSize = 16.sp
                    )
                }
            }
            
            Text(
                text = stringResource(R.string.time_valuable),
                fontSize = 16.sp
            )
            
            Text(
                text = stringResource(R.string.our_vision),
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFFDC2626)
            )
            Text(
                text = stringResource(R.string.our_vision_description),
                fontSize = 16.sp
            )
            
            Text(
                text = stringResource(R.string.our_values),
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFFDC2626)
            )
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(stringResource(R.string.value_honesty), fontSize = 16.sp)
                Text(stringResource(R.string.value_speed), fontSize = 16.sp)
                Text(stringResource(R.string.value_brevity), fontSize = 16.sp)
                Text(stringResource(R.string.value_public_interest), fontSize = 16.sp)
            }
            
            Divider()
            
            Text(
                text = stringResource(R.string.dmca_policy),
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold
            )
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFFF3F4F6)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = stringResource(R.string.dmca_description),
                        fontSize = 14.sp
                    )
                    Text(stringResource(R.string.dmca_email), fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
                    Text(stringResource(R.string.dmca_response), fontSize = 12.sp, color = Color.Gray)
                }
            }
            
            Text(
                text = stringResource(R.string.thank_you),
                fontSize = 16.sp
            )
        }
    }
}
