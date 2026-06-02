const PdfPrinter = require('pdfmake');

const fonts = {
  Roboto: {
    normal: 'node_modules/pdfmake/build/vfs_fonts.js',
  },
};

// pdfmake uses virtual file system fonts bundled with its package
const pdfMake = require('pdfmake/build/pdfmake');
const pdfFonts = require('pdfmake/build/vfs_fonts');
pdfMake.vfs = pdfFonts.pdfMake?.vfs ?? pdfFonts;

/**
 * Generates a PDF invoice buffer for the given sale.
 * @param {{ sale: object, items: object[], tenant: object }} params
 * @returns {Promise<Buffer>}
 */
function generateInvoicePdf({ sale, items, tenant }) {
  const rows = [
    [
      { text: 'Product', bold: true },
      { text: 'Qty', bold: true, alignment: 'right' },
      { text: 'Unit Price', bold: true, alignment: 'right' },
      { text: 'Subtotal', bold: true, alignment: 'right' },
    ],
    ...items.map(i => [
      i.product_name,
      { text: String(i.quantity), alignment: 'right' },
      { text: `$${i.unit_price.toFixed(2)}`, alignment: 'right' },
      { text: `$${i.subtotal.toFixed(2)}`, alignment: 'right' },
    ]),
  ];

  const docDef = {
    content: [
      { text: tenant?.name ?? 'ShopMaster', style: 'header' },
      { text: `Invoice #${sale.id.slice(0, 8).toUpperCase()}`, margin: [0, 4, 0, 4] },
      { text: `Date: ${new Date(sale.created_at).toLocaleString()}`, margin: [0, 0, 0, 16] },
      {
        table: {
          headerRows: 1,
          widths: ['*', 60, 80, 80],
          body: rows,
        },
      },
      { text: `Discount: -$${Number(sale.discount).toFixed(2)}`, alignment: 'right', margin: [0, 8, 0, 0] },
      { text: `Tax: +$${Number(sale.tax).toFixed(2)}`, alignment: 'right' },
      { text: `Total: $${Number(sale.total).toFixed(2)}`, style: 'total', alignment: 'right', margin: [0, 4, 0, 0] },
    ],
    styles: {
      header: { fontSize: 20, bold: true, margin: [0, 0, 0, 8] },
      total: { fontSize: 14, bold: true },
    },
    defaultStyle: { font: 'Helvetica' },
  };

  return new Promise((resolve, reject) => {
    try {
      const doc = pdfMake.createPdf(docDef);
      doc.getBuffer(buffer => resolve(Buffer.from(buffer)));
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateInvoicePdf };
