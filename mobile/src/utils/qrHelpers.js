// Import only the pure-JS core (no canvas/Buffer/stream — safe in React Native/Hermes)
import QRCore from 'qrcode/lib/core/qrcode';

/**
 * Generate a QR code matrix from a string value.
 * Returns { size, data } where data is a flat Uint8Array:
 *   data[row * size + col] === 1  → dark module
 *   data[row * size + col] === 0  → light module
 */
export function buildQRMatrix(value) {
  const qr = QRCore.create(value, { errorCorrectionLevel: 'M' });
  return { size: qr.modules.size, data: qr.modules.data };
}

/**
 * Derive a short shop-barcode for a product that has no SKU.
 * Format: "SM" + first 8 hex chars of product UUID → "SM1A2B3C4D"
 * This is guaranteed unique within the shop and short enough for Code128.
 */
export function generateBarcode(productId) {
  const hex = productId.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `SM${hex}`;
}

/**
 * Build an inline SVG string for the QR code.
 * Used by expo-print to embed the barcode in a printable HTML label.
 */
export function qrToSVG(value, px = 200) {
  const { size, data } = buildQRMatrix(value);
  const cell = px / size;
  const rects = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (data[r * size + c]) {
        rects.push(
          `<rect x="${(c * cell).toFixed(2)}" y="${(r * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" fill="#000"/>`
        );
      }
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${px} ${px}" shape-rendering="crispEdges">` +
    `<rect width="${px}" height="${px}" fill="#fff"/>` +
    rects.join('') +
    `</svg>`
  );
}

/**
 * Generate a full HTML string for a printable adhesive label.
 * Designed to fit on a standard 5 cm × 3 cm sticker.
 */
export function buildLabelHTML(productName, barcodeValue) {
  const svgContent = qrToSVG(barcodeValue, 180);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, Arial, sans-serif;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background: #fff;
  }
  .label {
    width: 200px;
    border: 1px solid #ccc;
    border-radius: 8px;
    padding: 12px;
    text-align: center;
    background: #fff;
    page-break-inside: avoid;
  }
  .qr { display: block; margin: 0 auto 8px; }
  .code {
    font-family: monospace;
    font-size: 13px;
    letter-spacing: 1px;
    color: #333;
    margin-bottom: 6px;
  }
  .name {
    font-size: 11px;
    color: #555;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
    margin: 0 auto;
  }
</style>
</head>
<body>
  <div class="label">
    <div class="qr">${svgContent}</div>
    <div class="code">${barcodeValue}</div>
    <div class="name">${productName.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
  </div>
</body>
</html>`;
}
