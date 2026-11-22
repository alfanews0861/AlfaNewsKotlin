package com.alfanews.telugu.views

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.alfanews.telugu.models.Language
import com.alfanews.telugu.ui.theme.getBodyFontFamily
import com.alfanews.telugu.ui.theme.getHeadlineFontFamily
import com.alfanews.telugu.utils.EditionRegistry
import com.alfanews.telugu.utils.PreferenceManager
import com.alfanews.telugu.utils.StateCode

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DistrictPickerDialog(
    activeDistrict: String?,
    onDistrictSelected: (String) -> Unit,
    onDismissRequest: () -> Unit,
    activeStateCode: StateCode? = null,
    activeLanguage: Language? = null,
    onEditionSelected: ((StateCode, String, Language) -> Unit)? = null
) {
    val context = LocalContext.current
    val prefs = remember { PreferenceManager.getInstance(context) }

    val initialState = remember(activeStateCode, activeDistrict) {
        activeStateCode
            ?: EditionRegistry.resolveStateCode(prefs.selectedState, activeDistrict)
            ?: prefs.getEffectiveStateCode()
    }
    var selectedState by remember { mutableStateOf(initialState) }
    var selectedLanguage by remember {
        mutableStateOf(
            EditionRegistry.validateLanguageForState(
                initialState,
                activeLanguage ?: prefs.language
            )
        )
    }
    var selectedDistrict by remember {
        val editionDistricts = EditionRegistry.EDITIONS[initialState]?.districts.orEmpty()
        mutableStateOf(
            if (activeDistrict != null && editionDistricts.contains(activeDistrict)) activeDistrict
            else editionDistricts.firstOrNull() ?: ""
        )
    }

    var stateExpanded by remember { mutableStateOf(false) }
    var districtExpanded by remember { mutableStateOf(false) }
    var languageExpanded by remember { mutableStateOf(false) }

    val activeEdition = EditionRegistry.EDITIONS[selectedState] ?: EditionRegistry.EDITIONS[StateCode.AP]!!
    val headlineFont = getHeadlineFontFamily(selectedLanguage)
    val bodyFont = getBodyFontFamily(selectedLanguage)

    val titleText = when (selectedLanguage) {
        Language.TELUGU -> "నివాస ప్రాంతం & భాష"
        Language.HINDI -> "अपना राज्य, जिला और भाषा चुनें"
        Language.PUNJABI -> "ਆਪਣਾ ਰਾਜ, ਜ਼ਿਲ੍ਹਾ ਅਤੇ ਭਾਸ਼ਾ ਚੁਣੋ"
        Language.GUJARATI -> "તમારું રાજ્ય, જિલ્લો અને ભાષા પસંદ કરો"
        Language.ENGLISH -> "Select State, District & Language"
    }
    val stateLabel = when (selectedLanguage) {
        Language.TELUGU -> "రాష్ట్రం"
        Language.HINDI -> "राज्य"
        Language.PUNJABI -> "ਰਾਜ"
        Language.GUJARATI -> "રાજ્ય"
        Language.ENGLISH -> "State"
    }
    val districtLabel = when (selectedLanguage) {
        Language.TELUGU -> "జిల్లా"
        Language.HINDI -> "जिला"
        Language.PUNJABI -> "ਜ਼ਿਲ੍ਹਾ"
        Language.GUJARATI -> "જિલ્લો"
        Language.ENGLISH -> "District"
    }
    val languageLabel = when (selectedLanguage) {
        Language.TELUGU -> "భాష (రాష్ట్ర భాషలు మాత్రమే)"
        Language.HINDI -> "भाषा"
        Language.PUNJABI -> "ਭਾਸ਼ਾ"
        Language.GUJARATI -> "ભાષા"
        Language.ENGLISH -> "Language"
    }
    val cancelLabel = when (selectedLanguage) {
        Language.TELUGU -> "రద్దు"
        Language.HINDI -> "रद्द करें"
        Language.PUNJABI -> "ਰੱਦ ਕਰੋ"
        Language.GUJARATI -> "રદ કરો"
        Language.ENGLISH -> "Cancel"
    }
    val confirmLabel = when (selectedLanguage) {
        Language.TELUGU -> "నిర్ధారించండి"
        Language.HINDI -> "सहेजें"
        Language.PUNJABI -> "ਪੁਸ਼ਟੀ ਕਰੋ"
        Language.GUJARATI -> "પુષ્ટિ કરો"
        Language.ENGLISH -> "Apply"
    }

    AlertDialog(
        onDismissRequest = onDismissRequest,
        title = {
            Text(
                text = titleText,
                fontFamily = headlineFont,
                fontWeight = FontWeight.Normal
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                // 1. STATE SELECTION DROPDOWN (All 9 States)
                ExposedDropdownMenuBox(
                    expanded = stateExpanded,
                    onExpandedChange = { stateExpanded = !stateExpanded }
                ) {
                    val stateDisplay = if (activeEdition.nameNative == activeEdition.nameEn) {
                        activeEdition.nameEn
                    } else {
                        "${activeEdition.nameNative} (${activeEdition.nameEn})"
                    }
                    OutlinedTextField(
                        value = stateDisplay,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text(stateLabel, fontFamily = bodyFont, fontWeight = FontWeight.Normal) },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = stateExpanded) },
                        colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors(),
                        modifier = Modifier.menuAnchor().fillMaxWidth()
                    )

                    ExposedDropdownMenu(
                        expanded = stateExpanded,
                        onDismissRequest = { stateExpanded = false }
                    ) {
                        EditionRegistry.ALL_EDITIONS_LIST.forEach { edition ->
                            val itemLabel = if (edition.nameNative == edition.nameEn) {
                                edition.nameEn
                            } else {
                                "${edition.nameNative} (${edition.nameEn})"
                            }
                            DropdownMenuItem(
                                text = { Text(itemLabel, fontFamily = bodyFont, fontWeight = FontWeight.Normal) },
                                onClick = {
                                    selectedState = edition.stateCode
                                    // Strict State-Bound Language reset when switching states (never cross-state translate)
                                    selectedLanguage = EditionRegistry.validateLanguageForState(
                                        edition.stateCode,
                                        selectedLanguage
                                    )
                                    selectedDistrict = edition.districts.firstOrNull() ?: ""
                                    stateExpanded = false
                                }
                            )
                        }
                    }
                }

                // 2. DISTRICT SELECTION DROPDOWN (236 Districts across 9 States)
                val districts = activeEdition.districts

                ExposedDropdownMenuBox(
                    expanded = districtExpanded,
                    onExpandedChange = { districtExpanded = !districtExpanded }
                ) {
                    OutlinedTextField(
                        value = selectedDistrict.ifBlank { districts.firstOrNull() ?: "" },
                        onValueChange = {},
                        readOnly = true,
                        label = { Text(districtLabel, fontFamily = bodyFont, fontWeight = FontWeight.Normal) },
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
                                text = { Text(district, fontFamily = bodyFont, fontWeight = FontWeight.Normal) },
                                onClick = {
                                    selectedDistrict = district
                                    districtExpanded = false
                                }
                            )
                        }
                    }
                }

                // 3. STRICT STATE-BOUND LANGUAGE DROPDOWN (Only native languages of the chosen state + English)
                ExposedDropdownMenuBox(
                    expanded = languageExpanded,
                    onExpandedChange = { languageExpanded = !languageExpanded }
                ) {
                    OutlinedTextField(
                        value = selectedLanguage.displayName,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text(languageLabel, fontFamily = bodyFont, fontWeight = FontWeight.Normal) },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = languageExpanded) },
                        colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors(),
                        modifier = Modifier.menuAnchor().fillMaxWidth()
                    )

                    ExposedDropdownMenu(
                        expanded = languageExpanded,
                        onDismissRequest = { languageExpanded = false }
                    ) {
                        activeEdition.supportedLanguages.forEach { lang ->
                            DropdownMenuItem(
                                text = {
                                    Text(
                                        text = lang.displayName,
                                        fontFamily = getBodyFontFamily(lang),
                                        fontWeight = FontWeight.Normal
                                    )
                                },
                                onClick = {
                                    selectedLanguage = lang
                                    languageExpanded = false
                                }
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    val chosenDistrict = selectedDistrict.ifBlank { activeEdition.districts.firstOrNull() ?: "" }
                    val validLang = prefs.setEdition(selectedState, chosenDistrict, selectedLanguage)
                    onEditionSelected?.invoke(selectedState, chosenDistrict, validLang)
                    onDistrictSelected(chosenDistrict)
                }
            ) {
                Text(confirmLabel, fontFamily = headlineFont, fontWeight = FontWeight.Normal)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismissRequest) {
                Text(cancelLabel, color = Color.Gray, fontFamily = bodyFont, fontWeight = FontWeight.Normal)
            }
        }
    )
}
