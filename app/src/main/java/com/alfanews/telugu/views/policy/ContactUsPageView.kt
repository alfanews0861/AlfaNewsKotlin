package com.alfanews.telugu.views.policy

import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alfanews.telugu.services.FirebaseFunctionsService
import kotlinx.coroutines.launch

@Composable
fun ContactUsPageView() {
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    
    fun handleSubmit() {
        if (name.isEmpty() || phone.isEmpty() || message.isEmpty()) {
            Toast.makeText(context, "దయచేసి అన్ని వివరాలను పూరించండి.", Toast.LENGTH_SHORT).show()
            return
        }
        
        scope.launch {
            isSubmitting = true
            try {
                val result = FirebaseFunctionsService.sendContactEmail(name, phone, message)
                if (result.isSuccess) {
                    Toast.makeText(context, "మీ సందేశం మాకు విజయవంతంగా చేరింది! మా ప్రతినిధి మిమ్మల్ని త్వరలో సంప్రదిస్తారు.", Toast.LENGTH_LONG).show()
                    name = ""
                    phone = ""
                    message = ""
                } else {
                    Toast.makeText(context, "సందేశం పంపడంలో లోపం: ${result.exceptionOrNull()?.message}", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, "సందేశం పంపడంలో లోపం: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                isSubmitting = false
            }
        }
    }
    
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
                text = "మమ్మల్ని సంప్రదించండి",
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = Color.Black
            )
            
            Text(
                text = "మా వార్తా సేవ గురించి మీకు ఏవైనా ప్రశ్నలు, సూచనలు లేదా అభిప్రాయాలు ఉన్నాయా? మమ్మల్ని సంప్రదించడానికి సంకోచించకండి.",
                fontSize = 16.sp
            )
            
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFFF9FAFB)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("మీ సందేశాన్ని మాకు పంపండి", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
                    
                    OutlinedTextField(
                        value = name,
                        onValueChange = { name = it },
                        label = { Text("మీ పేరు") },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !isSubmitting
                    )
                    
                    OutlinedTextField(
                        value = phone,
                        onValueChange = { phone = it },
                        label = { Text("ఫోన్ నంబర్") },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !isSubmitting
                    )
                    
                    OutlinedTextField(
                        value = message,
                        onValueChange = { message = it },
                        label = { Text("సందేశం") },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(120.dp),
                        maxLines = 4,
                        enabled = !isSubmitting
                    )
                    
                    Button(
                        onClick = { handleSubmit() },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !isSubmitting,
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                    ) {
                        if (isSubmitting) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White)
                            Spacer(modifier = Modifier.width(8.dp))
                        }
                        Text(if (isSubmitting) "పంపుతోంది..." else "సందేశాన్ని పంపండి")
                    }
                }
            }
            
            Text("సాధారణ విచారణల కోసం:", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
            Text("మీరు మమ్మల్ని ఇమెయిల్ ద్వారా సంప్రదించవచ్చు. మేము వీలైనంత త్వరగా మీకు ప్రత్యుత్తరం ఇస్తాము.", fontSize = 16.sp)
            Text("ఇమెయిల్: contact@alfanews.app", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            
            Text("మా కార్యాలయం:", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFFF3F4F6)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text("Alfa News,", fontWeight = FontWeight.Bold)
                    Text("Alfa New Gen Platforms,")
                    Text("Palam Najafgarh Road,")
                    Text("Sector 12 Dwarka,")
                    Text("Dwarka, Delhi, 110078")
                }
            }
        }
    }
}
