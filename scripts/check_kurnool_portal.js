const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\alfan\\.gemini\\antigravity\\brain\\35b2910b-16ac-4b07-bb90-e78527dff521\\.system_generated\\steps\\328\\content.md', 'utf8');
const rx = /https?:\/\/[^\s"\'<>]+/g;
const urls = content.match(rx) || [];
const social = urls.filter(u => u.includes('twitter') || u.includes('x.com'));
console.log('Twitter URLs in Kurnool portal:', social);
