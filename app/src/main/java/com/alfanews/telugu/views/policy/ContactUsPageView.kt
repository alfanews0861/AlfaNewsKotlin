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
import androidx.compose.ui.res.stringResource
import com.alfanews.telugu.R
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
            Toast.makeText(context, context.getString(R.string.fill_details_error), Toast.LENGTH_SHORT).show()
            return
        }
        
        scope.launch {
            isSubmitting = true
            try {
                val result = FirebaseFunctionsService.sendContactEmail(name, phone, message)
                if (result.isSuccess) {
                    Toast.makeText(context, context.getString(R.string.message_success), Toast.LENGTH_LONG).show()
                    name = ""
                    phone = ""
                    message = ""
                } else {
                    Toast.makeText(context, context.getString(R.string.message_send_error, result.exceptionOrNull()?.message ?: ""), Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, context.getString(R.string.message_send_error, e.message ?: ""), Toast.LENGTH_SHORT).show()
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
                text = stringResource(R.string.contact_us_title),
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = Color.Black
            )
            
            Text(
                text = stringResource(R.string.contact_intro),
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
                    Text(stringResource(R.string.send_message), fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
                    
                    OutlinedTextField(
                        value = name,
                        onValueChange = { name = it },
                        label = { Text(stringResource(R.string.your_name)) },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !isSubmitting
                    )
                    
                    OutlinedTextField(
                        value = phone,
                        onValueChange = { phone = it },
                        label = { Text(stringResource(R.string.phone_number)) },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !isSubmitting
                    )
                    
                    OutlinedTextField(
                        value = message,
                        onValueChange = { message = it },
                        label = { Text(stringResource(R.string.message)) },
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
                        Text(if (isSubmitting) stringResource(R.string.sending) else stringResource(R.string.send_message))
                    }
                }
            }
            
            Text(stringResource(R.string.general_inquiries), fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
            Text(stringResource(R.string.contact_by_email), fontSize = 16.sp)
            Text(stringResource(R.string.dmca_email), fontWeight = FontWeight.Bold, fontSize = 16.sp)
            
            Text(stringResource(R.string.our_office), fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626))
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
