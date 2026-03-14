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

@Composable
fun AdPolicyPageView() {
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
                text = "ప్రకటనల విధానం (Advertising Policy)",
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = Color.Black
            )
            
            Text(
                text = "Alfa News Telugu సేవలను మా వినియోగదారులకు ఉచితంగా అందించడానికి, మేము మా అప్లికేషన్ మరియు వెబ్‌సైట్‌లో ప్రకటనలను ప్రదర్శిస్తాము.",
                fontSize = 16.sp
            )
            
            Text("ప్రకటనల ప్రయోజనం", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("• జర్నలిస్టులు మరియు సిబ్బందికి చెల్లింపులు చేయడానికి.", fontSize = 16.sp)
                Text("• సర్వర్లు, నిర్వహణ మరియు సాంకేతిక మౌలిక సదుపాయాల ఖర్చులను భరించడానికి.", fontSize = 16.sp)
                Text("• మా సేవలను నిరంతరం మెరుగుపరచడానికి మరియు కొత్త ఫీచర్లను అభివృద్ధి చేయడానికి.", fontSize = 16.sp)
            }
            
            Text("ప్రకటనల భాగస్వాములు", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
            Text("మేము Google AdMob వంటి మూడవ-పక్ష ప్రకటనల నెట్‌వర్క్‌లతో కలిసి పనిచేస్తాము. ఈ భాగస్వాములు మీకు మరింత సంబంధిత ప్రకటనలను చూపించడానికి కుక్కీలు, వెబ్ బీకాన్‌లు మరియు ఇతర సాంకేతికతలను ఉపయోగిస్తారు.", fontSize = 16.sp)
            
            Text("ప్రకటనల రకాలు", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
            Text("మా ప్లాట్‌ఫారమ్‌పై మీరు బ్యానర్ ప్రకటనలు, ఇంటర్‌స్టీషియల్ (పూర్తి స్క్రీన్) ప్రకటనలు మరియు స్థానిక (నేటివ్) ప్రకటనలు వంటి వివిధ రకాల ప్రకటనలను చూడవచ్చు.", fontSize = 16.sp)
            
            Text("వినియోగదారు ఎంపికలు", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
            Text("వ్యక్తిగతీకరించిన ప్రకటనలను నియంత్రించడానికి మీకు కొన్ని ఎంపికలు ఉన్నాయి. మీరు మీ మొబైల్ పరికరం యొక్క సెట్టింగ్‌లలో ప్రకటనల ట్రాకింగ్‌ను పరిమితం చేయవచ్చు.", fontSize = 16.sp)
        }
    }
}
