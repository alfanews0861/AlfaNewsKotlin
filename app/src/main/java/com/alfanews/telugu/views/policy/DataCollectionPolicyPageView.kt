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
                text = "సమాచార సేకరణ విధానం (Data Collection Policy)",
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = Color.Black
            )
            
            Text(
                text = "మా సేవలను మీకు అందించడానికి మరియు మెరుగుపరచడానికి, మేము నిర్దిష్ట సమాచారాన్ని సేకరిస్తాము.",
                fontSize = 16.sp
            )
            
            Text("మేము సేకరించే సమాచార రకాలు", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
            
            Text("1. మీరు మాకు అందించే సమాచారం:", fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("• ఖాతా సమాచారం: మీరు Google వంటి మూడవ పక్ష సేవ ద్వారా లాగిన్ అయినప్పుడు, మేము మీ పేరు, ఇమెయిల్ చిరునామా, మరియు ప్రొఫైల్ చిత్రాన్ని స్వీకరిస్తాము.", fontSize = 16.sp)
                Text("• వినియోగదారు కంటెంట్: మీరు మా ప్లాట్‌ఫారమ్‌పై వ్యాఖ్యలు చేసినప్పుడు లేదా ఇతర కంటెంట్‌ను పోస్ట్ చేసినప్పుడు, మేము ఆ సమాచారాన్ని సేకరిస్తాము.", fontSize = 16.sp)
            }
            
            Text("2. మేము స్వయంచాలకంగా సేకరించే సమాచారం:", fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("• వినియోగ వివరాలు: మీరు ఏ వార్తా కథనాలను చదువుతారు, ఏ వీడియోలను చూస్తారు, లైక్‌లు, షేర్‌లు మరియు మీరు మా యాప్‌తో ఎలా సంకర్షణ చెందుతారు అనే సమాచారాన్ని మేము లాగ్ చేస్తాము.", fontSize = 16.sp)
                Text("• పరికర మరియు సాంకేతిక సమాచారం: మీ IP చిరునామా, పరికర రకం, ఆపరేటింగ్ సిస్టమ్, బ్రౌజర్ రకం, మరియు ప్రత్యేక పరికర ఐడెంటిఫైయర్‌ల వంటి సమాచారాన్ని మేము సేకరిస్తాము.", fontSize = 16.sp)
                Text("• లొకేషన్ సమాచారం: మీరు మాకు అనుమతి ఇస్తే, వార్తలను పోస్ట్ చేసేటప్పుడు మీ భౌగోళిక స్థానాన్ని మేము సేకరించవచ్చు.", fontSize = 16.sp)
            }
            
            Text("సమాచారాన్ని ఎందుకు సేకరిస్తాము", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("• మీకు వ్యక్తిగతీకరించిన మరియు సంబంధిత కంటెంట్‌ను అందించడానికి.", fontSize = 16.sp)
                Text("• మా సేవలను విశ్లేషించడానికి, ఆపరేట్ చేయడానికి మరియు మెరుగుపరచడానికి.", fontSize = 16.sp)
                Text("• మోసాలను నివారించడానికి మరియు మా సేవల భద్రతను నిర్ధారించడానికి.", fontSize = 16.sp)
            }
        }
    }
}
