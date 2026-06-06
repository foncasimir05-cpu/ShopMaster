const https = require('https');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const FONT_URL = 'https://github.com/google/fonts/raw/main/ofl/bebasneue/BebasNeue-Regular.ttf';
const FONT_CACHE = path.join(__dirname, 'BebasNeue.ttf');

function downloadFont() {
  if (fs.existsSync(FONT_CACHE)) return Promise.resolve();
  console.log('Downloading Bebas Neue font...');
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(FONT_CACHE);
    https.get(FONT_URL, res => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Font download failed: HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', err => { fs.unlink(FONT_CACHE, () => {}); reject(err); });
  });
}

function makeSvg(size, fontBase64) {
  const cx = size / 2;
  const cy = Math.round(size * 0.52);
  const fontSize = Math.round(size * 0.44);

  const fontFace = fontBase64
    ? `<defs><style>@font-face{font-family:'BebasNeue';src:url('data:font/truetype;base64,${fontBase64}');}</style></defs>`
    : '';
  const fontFamily = fontBase64 ? "'BebasNeue'" : 'Impact,Arial';

  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  ${fontFace}
  <rect width="${size}" height="${size}" fill="#1a2e4a"/>
  <g transform="translate(${cx},${cy})">
    <text x="0" y="0"
      font-family="${fontFamily}"
      font-size="${fontSize}"
      font-weight="bold"
      fill="#ffffff"
      text-anchor="middle"
      dominant-baseline="middle"
      transform="skewX(-12)"
    >SM</text>
  </g>
</svg>`;
}

async function generateIcon(size, outputPath, fontBase64) {
  await sharp(Buffer.from(makeSvg(size, fontBase64))).png().toFile(outputPath);
  console.log('Generated:', outputPath, `${size}x${size}`);
}

async function main() {
  let fontBase64 = null;
  try {
    await downloadFont();
    fontBase64 = fs.readFileSync(FONT_CACHE).toString('base64');
    console.log('Bebas Neue loaded.');
  } catch (err) {
    console.warn('Font unavailable, using fallback:', err.message);
  }

  const assets = path.join(__dirname, '../assets');
  await generateIcon(1024, path.join(assets, 'icon.png'), fontBase64);
  await generateIcon(1024, path.join(assets, 'adaptive-icon.png'), fontBase64);
  await generateIcon(1024, path.join(assets, 'splash.png'), fontBase64);
  await generateIcon(48,   path.join(assets, 'favicon.png'), fontBase64);
  console.log('All icons generated!');
}

main().catch(err => { console.error(err); process.exit(1); });
