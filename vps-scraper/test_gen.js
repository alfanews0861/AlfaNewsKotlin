async function testModel(modelName, version) {
  const url = `https://generativelanguage.googleapis.com/${version}/models/${modelName}:generateContent?key=AIzaSyA8-YNKtCIRWLyGo6cnRTzblpD4fBBVdo0`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: "Hello" }] }] })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Unknown error");
    console.log(`SUCCESS: ${modelName} on ${version}`);
  } catch (e) {
    console.log(`FAILED: ${modelName} on ${version} - ${e.message}`);
  }
}

async function run() {
  await testModel('gemini-3.1-flash', 'v1');
  await testModel('gemini-3.1-flash', 'v1beta');
  await testModel('gemini-3-flash-preview', 'v1beta');
  await testModel('gemini-3.1-flash-lite', 'v1beta');
  await testModel('gemini-2.5-flash', 'v1');
}
run();
