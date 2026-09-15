import https from 'https';

function testAPI(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const json = JSON.parse(data);
        const models = json.models ? json.models.map(m => m.name) : Object.keys(json);
        resolve(models.filter(m => String(m).includes('flash')));
      });
    });
  });
}

async function run() {
  const apiKey = process.env.GEMINI_API_KEY || '';
  const v1 = await testAPI(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
  const v1beta = await testAPI(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  
  console.log('v1 flash models:', v1);
  console.log('v1beta flash models:', v1beta);
}
run();
