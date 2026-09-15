const fs = require('fs');
const path = require('path');
const ts = require('typescript');

console.log('[BUILD] ⚙️ Transpiling TypeScript files from src/ to lib/...');
const srcDir = path.join(__dirname, 'src');
const libDir = path.join(__dirname, 'lib');

if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true });
}

const tsFiles = fs.readdirSync(srcDir).filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts'));

let successCount = 0;
for (const file of tsFiles) {
    const srcPath = path.join(srcDir, file);
    const code = fs.readFileSync(srcPath, 'utf8');
    const result = ts.transpileModule(code, {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2021,
            esModuleInterop: true,
            resolveJsonModule: true
        }
    });

    const outFileName = file.replace(/\.ts$/, '.js');
    const outPath = path.join(libDir, outFileName);
    fs.writeFileSync(outPath, result.outputText, 'utf8');
    successCount++;
}

console.log(`[BUILD] ✅ Successfully transpiled ${successCount} files into lib/.`);
