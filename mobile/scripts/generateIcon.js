const sharp = require('sharp');
const path = require('path');

function makeSvg(size) {
  const fontSize = Math.round(size * 0.38);
  const textY = Math.round(size * 0.52);
  const lineY = Math.round(size * 0.62);
  const lineW = Math.round(size * 0.35);
  const lineH = Math.max(2, Math.round(size * 0.04));
  const lineX = Math.round((size - lineW) / 2);
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#1a2e4a"/>
  <text x="${size / 2}" y="${textY}" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">SM</text>
  <rect x="${lineX}" y="${lineY}" width="${lineW}" height="${lineH}" fill="#f5a623"/>
</svg>`;
}

async function generateIcon(size, outputPath) {
  await sharp(Buffer.from(makeSvg(size)))
    .png()
    .toFile(outputPath);
  console.log('Generated:', outputPath, `${size}x${size}`);
}

async function main() {
  const assets = path.join(__dirname, '../assets');
  await generateIcon(1024, path.join(assets, 'icon.png'));
  await generateIcon(1024, path.join(assets, 'adaptive-icon.png'));
  await generateIcon(1024, path.join(assets, 'splash.png'));
  await generateIcon(48,   path.join(assets, 'favicon.png'));
  console.log('All icons generated!');
}

main().catch(err => { console.error(err); process.exit(1); });
