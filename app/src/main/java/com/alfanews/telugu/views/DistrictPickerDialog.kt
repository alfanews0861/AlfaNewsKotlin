package com.alfanews.telugu.views

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.alfanews.telugu.ui.theme.Ramabhadra
import com.alfanews.telugu.utils.Constants

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DistrictPickerDialog(
    activeDistrict: String?,
    onDistrictSelected: (String) -> Unit,
    onDismissRequest: () -> Unit
) {
    var selectedState by remember { mutableStateOf(if (Constants.AP_DISTRICTS.contains(activeDistrict)) "AP" else "TS") }
    var stateExpanded by remember { mutableStateOf(false) }
    var districtExpanded by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismissRequest,
        title = { Text("నివాస ప్రాంతాన్ని ఎంచుకోండి", fontFamily = Ramabhadra) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                // 1. STATE SELECTION DROPDOWN
                ExposedDropdownMenuBox(
                    expanded = stateExpanded,
                    onExpandedChange = { stateExpanded = !stateExpanded }
                ) {
                    OutlinedTextField(
                        value = if (selectedState == "TS") "తెలంగాణ" else "ఆంధ్రప్రదేశ్",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("రాష్ట్రం") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = stateExpanded) },
                        colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors(),
                        modifier = Modifier.menuAnchor().fillMaxWidth()
                    )

                    ExposedDropdownMenu(
                        expanded = stateExpanded,
                        onDismissRequest = { stateExpanded = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("తెలంగాణ") },
                            onClick = {
                                selectedState = "TS"
                                stateExpanded = false
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("ఆంధ్రప్రదేశ్") },
                            onClick = {
                                selectedState = "AP"
                                stateExpanded = false
                            }
                        )
                    }
                }

                // 2. DISTRICT SELECTION DROPDOWN
                val districts = if (selectedState == "TS") Constants.TS_DISTRICTS else Constants.AP_DISTRICTS
                
                ExposedDropdownMenuBox(
                    expanded = districtExpanded,
                    onExpandedChange = { districtExpanded = !districtExpanded }
                ) {
                    OutlinedTextField(
                        value = if (districts.contains(activeDistrict)) (activeDistrict ?: "జిల్లాను ఎంచుకోండి") else "జిల్లాను ఎంచుకోండి",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("జిల్లా") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = districtExpanded) },
                        colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors(),
                        modifier = Modifier.menuAnchor().fillMaxWidth()
                    )

                    ExposedDropdownMenu(
                        expanded = districtExpanded,
                        onDismissRequest = { districtExpanded = false }
                    ) {
                        districts.forEach { district ->
                            DropdownMenuItem(
                                text = { Text(district) },
                                onClick = {
                                    onDistrictSelected(district)
                                    districtExpanded = false
                                }
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismissRequest) {
                Text("రద్దు", color = Color.Gray)
            }
        }
    )
}
