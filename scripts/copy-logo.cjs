const fs = require('fs');
const path = require('path');

const tempDir = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\583c1a2a-724d-4e42-b77c-da6ad54b3e51\\.tempmediaStorage';
const destDir = path.join(__dirname, '..', 'src', 'assets');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const files = fs.readdirSync(tempDir);
const pngFiles = files
  .filter(f => f.endsWith('.png'))
  .map(f => {
    const fullPath = path.join(tempDir, f);
    const stats = fs.statSync(fullPath);
    return { name: f, path: fullPath, mtime: stats.mtimeMs };
  })
  .sort((a, b) => b.mtime - a.mtime);

if (pngFiles.length > 0) {
  const latestPng = pngFiles[0];
  console.log(`Latest uploaded PNG: ${latestPng.name}`);
  const destPath = path.join(destDir, 'logo.png');
  fs.copyFileSync(latestPng.path, destPath);
  console.log(`Successfully copied ${latestPng.name} to src/assets/logo.png`);
} else {
  console.error("No PNG files found in temp media storage.");
}
