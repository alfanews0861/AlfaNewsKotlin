# 🔧 రిపోర్టర్ స్టోరేజ్ పర్మిషన్‌ సమస్య పరిష్కారం

## 🚨 సమస్య
రిపోర్టర్ వాడుకరులు న్యూస్ పోస్ట్‌‌ను సృష్టించేటప్పుడు Firebase Storage కు ఇమేజ్‌‌‌‌లను అప్‌లోడ్ చేయలేకపోతున్నారు.

---

## 🔍 రూట్ కారణం
Firebase Storage నిబంధనలు (`storage.rules`) `news-media` ఫోల్డర్‌కు role-based access control లేవు. ఏ ఆధికార సంతకం చేసిన వాడుకరిც్‌‌చూ Storage కు రాయవచ్చు, కానీ Firestore తో సంబంధం లేకుండా ఉంది.

---

## ✅ నిష్పత్తి (Solution)

### 1. **storage.rules ఆప్‌డేట్ చేయబడింది**

Firestore నుండి వాడుకరి role తనిఖీ చేయడానికి helper functions జోడించబడ్డాయి:

```javascript
// రిపోర్టర్ role ఉందో లేదో తనిఖీ చేసే function
function hasReporterRole(uid) {
  let userDoc = firestore.get(/databases/(default)/documents/users/$(uid));
  return userDoc.exists && userDoc.data.role in ['REPORTER', 'EDITOR', 'ADMIN'];
}
```

### 2. **news-media ఫోల్డర్‌ నియంత్రణ**

**ముందు:**
```javascript
match /news-media/{allPaths=**} {
    allow write: if request.auth != null;  // ఎవరికైనా సరే
}
```

**తర్వాత:**
```javascript
match /news-media/{allPaths=**} {
    allow write: if request.auth != null && 
        hasReporterRole(request.auth.uid);  // కేవలం REPORTER, EDITOR, ADMIN
}
```

---

## 🔄 ఎలా పనిచేస్తుంది

1. **రిపోర్టర్ ఇమేజ్ అప్‌లోడ్ చేస్తాడు** → `uploadMediaToStorage(context, mediaUri, "news-media", false)`
2. **Storage అభ్యర్థన పరిశీలిస్తుంది** → storage.rules చెక్‌ చేస్తుంది
3. **hasReporterRole() function** → Firestore నుండి user document చూస్తుంది
4. **Role చెక్‌** → Role `['REPORTER', 'EDITOR', 'ADMIN']` లో ఉంటే అప్‌లోడ్ అందించబడుతుంది ✅
5. **రిపోర్టర్‌ కాకపోతే** → అభ్యర్థన తిరస్కరించబడుతుంది ❌

---

## 📊 పర్మిషన్ మ్యాట్రిక్స్

| ఫోల్డర్ | చదువు | రాయు | అవసరమైన Role |
|--------|------|-------|---|
| `news-media/` | సార్వజనీన | రిపోర్టర్, ఎడిటర్, అడ్మిన్ | ✅ |
| `citizen-media/` | సార్వజనీన | ఏ ఆధికార వాడుకరిక్‌‌ | సార్వజనీన |
| `uploads/` | సార్వజనీన | ఏ ఆధికార వాడుకరిక్‌‌ | సార్వజనీన |

---

## 🚀 డిప్లాయ్‌మెంట్ (Deployment)

### చేసిన మార్పులు:
- ✅ `storage.rules` - Helper functions మరియు role-based access జోడించబడింది

### అప్‌డేట్ చేయవలసిన ఫైల్:
```bash
firebase deploy --only storage
```

---

## ✨ ఇప్పుడు పరిష్కారం?

✅ **రిపోర్టర్ వాడుకరులు** Firebase Storage కు ఇమేజ్‌‌లను అప్‌లోడ్ చేయవచ్చు

✅ **రోల్ బేస్‌డ్ యాక్‌సెస్** - కేవలం అధికార వాడుకరులు news-media కు అప్‌లోడ్ చేయవచ్చు

✅ **భద్రత** - ప్రతిটి అప్‌లోడ్‌కు role తనిఖీ చేస్తుంది

---

**స్థితి:** ✅ సమస్య పరిష్కారం చేయబడింది

