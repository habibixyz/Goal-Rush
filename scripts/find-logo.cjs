const fs = require('fs');
const path = require('path');

const tempDir = 'C:/Users/user/.gemini/antigravity/brain/583c1a2a-724d-4e42-b77c-da6ad54b3e51/.tempmediaStorage';
const destDir = path.join(__dirname, '..', 'src', 'assets');
const publicDir = path.join(__dirname, '..', 'public');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

function getPngDimensions(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(24);
    fs.readSync(fd, buffer, 0, 24, 0);
    fs.closeSync(fd);

    // PNG signature check
    if (buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4E || buffer[3] !== 0x47) {
      return null;
    }

    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  } catch (err) {
    return null;
  }
}

const files = fs.readdirSync(tempDir);
const candidates = [];

for (const file of files) {
  if (file.endsWith('.png')) {
    const filePath = path.join(tempDir, file);
    const dims = getPngDimensions(filePath);
    if (dims) {
      candidates.push({
        name: file,
        path: filePath,
        width: dims.width,
        height: dims.height,
        ratio: dims.width / dims.height,
        size: fs.statSync(filePath).size,
        mtime: fs.statSync(filePath).mtimeMs
      });
    }
  }
}

console.log("Analyzing PNG files in temp media storage...");
candidates.forEach(c => {
  console.log(`- ${c.name}: ${c.width}x${c.height} (ratio: ${c.ratio.toFixed(2)}), size: ${c.size} bytes`);
});

// The logo is square (ratio ~ 1.0) and typically large (e.g. 1000x1000)
const squarePngs = candidates.filter(c => Math.abs(c.ratio - 1.0) < 0.05);

if (squarePngs.length > 0) {
  // Sort by modification time to get the latest one in case there are multiple
  squarePngs.sort((a, b) => b.mtime - a.mtime);
  const logo = squarePngs[0];
  console.log(`\n🎉 Found Logo Candidate: ${logo.name} (${logo.width}x${logo.height})`);
  
  fs.copyFileSync(logo.path, path.join(destDir, 'logo.png'));
  fs.copyFileSync(logo.path, path.join(publicDir, 'logo.png'));
  console.log(`Copied logo to src/assets/logo.png and public/logo.png`);
} else {
  console.log("\n❌ No square PNG files found.");
}
