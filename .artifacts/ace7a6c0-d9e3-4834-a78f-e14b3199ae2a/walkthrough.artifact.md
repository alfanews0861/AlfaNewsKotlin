# Mandatory Fields in Reporter Application - Walkthrough

రిపోర్టర్ అప్లికేషన్ ఫారమ్‌లోని అన్ని వివరాలను తప్పనిసరి (Compulsory) చేశాము.

## మార్పులు (Changes Made)

### 1. Strict Validation
- **Join Form**: ఇప్పుడు అప్లికేషన్ సబ్మిట్ చేసేముందు యూజర్ ఈ క్రింది అన్ని వివరాలను తప్పకుండా నింపాలి:
    1.  Full Name
    2.  Father Name
    3.  Phone Number
    4.  Address
    5.  Position
    6.  Interested Category
    7.  Education
    8.  Current Organization
    9.  District
    10. Mandal
    11. Additional Message
- ఏదైనా ఒక ఫీల్డ్ నింపకపోయినా, "దయచేసి అన్ని వివరాలు నింపండి" అని అలర్ట్ వస్తుంది.

## వెరిఫికేషన్ (Verification Done)
- **Validation**: ఫారమ్‌లోని వివిధ ఫీల్డ్స్‌ను ఖాళీగా ఉంచి సబ్మిట్ చేయగా, సిస్టమ్ ఆటోమేటిక్‌గా అడ్డుకుని ఎర్రర్ మెసేజ్ చూపించింది.
- **Submission**: అన్ని ఫీల్డ్స్ నింపినప్పుడు మాత్రమే అప్లికేషన్ బ్యాకెండ్‌కు చేరుతోంది.

---

> [!NOTE]
> **Next Steps**: భవిష్యత్తులో ఈ వివరాలను రిపోర్టర్ ఐడి కార్డుపై ఆటోమేటిక్‌గా ప్రింట్ చేసేలా కూడా మార్పులు చేయవచ్చు.
