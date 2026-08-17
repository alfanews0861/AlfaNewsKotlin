/**
 * Quick test: gemini-3.1-flash-image తో image generate అవుతుందా చూద్దాం
 * Run: node test_image_gen_now.js
 */
const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');

// .env file నుండి keys చదవడం
const envFile = fs.readFileSync('.env.alfa-news-31bf7', 'utf8');
const getKey = (name) => {
    const match = envFile.match(new RegExp(`${name}="([^"]+)"`));
    return match ? match[1] : null;
};

const FREE_KEY_1 = getKey('FREE_GEMINI_API_KEY_1');
const FREE_KEY_2 = getKey('FREE_GEMINI_API_KEY_2');
const PAID_KEY   = getKey('PAID_GEMINI_API_KEY');

const MODELS_TO_TEST = [
    "gemini-3.1-flash-image",
    "gemini-3.1-flash-image-preview",
];

async function testModel(apiKey, keyLabel, modelName) {
    console.log(`\n🧪 Testing: [${keyLabel}] + [${modelName}]`);
    try {
        const ai = new GoogleGenAI({ apiKey, apiVersion: "v1beta" });
        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: "A simple red circle on white background. Minimal art." }] }],
            config: {
                responseModalities: ["TEXT", "IMAGE"],
                temperature: 0.5
            }
        });

        if (response.candidates && response.candidates.length > 0) {
            const parts = response.candidates[0].content.parts;
            const imagePart = parts.find(p => p.inlineData);
            if (imagePart) {
                const buf = Buffer.from(imagePart.inlineData.data, 'base64');
                const fname = `test_output_${keyLabel}_${modelName.replace(/\//g, '_')}.jpg`;
                fs.writeFileSync(fname, buf);
                console.log(`   ✅ SUCCESS! Image saved: ${fname} (${buf.length} bytes)`);
                return true;
            } else {
                console.log(`   ⚠️  Response OK but no image data in parts`);
                console.log(`   Parts:`, JSON.stringify(parts.map(p => Object.keys(p))));
            }
        } else {
            console.log(`   ⚠️  No candidates in response`);
        }
    } catch (e) {
        console.log(`   ❌ FAILED: ${e.message.substring(0, 120)}`);
    }
    return false;
}

async function main() {
    console.log("=" .repeat(60));
    console.log("Image Generation Test — checking all keys + models");
    console.log("=".repeat(60));

    const keys = [
        { key: FREE_KEY_1, label: "FREE_KEY_1" },
        { key: FREE_KEY_2, label: "FREE_KEY_2" },
        { key: PAID_KEY,   label: "PAID_KEY"   },
    ].filter(k => k.key);

    let anySuccess = false;
    for (const { key, label } of keys) {
        for (const model of MODELS_TO_TEST) {
            const ok = await testModel(key, label, model);
            if (ok) { anySuccess = true; break; }
        }
        if (anySuccess) break;
    }

    console.log("\n" + "=".repeat(60));
    if (anySuccess) {
        console.log("🎉 RESULT: Image generation IS WORKING!");
    } else {
        console.log("💔 RESULT: Image generation FAILED with all keys & models.");
        console.log("   → Free API కి billing enable చేయాల్సి ఉండవచ్చు.");
    }
    console.log("=".repeat(60));
}

main();
