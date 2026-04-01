const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({
  apiKey: process.env.API_KEY || "YOUR_API_KEY_HERE",
});

async function run() {
  try {
    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-001',
      prompt: 'A cartoon about politics in Telugu states, line art, white background',
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '16:9'
      }
    });
    console.log("Success:", response.generatedImages.length);
  } catch (e) {
    console.error("Error generating image:", e.message);
  }
}
run();