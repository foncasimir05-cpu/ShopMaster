const nodemailer = require('nodemailer');

function createTransporter() {
  const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS } = process.env;
  if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) return null;
  const port = parseInt(EMAIL_PORT) || 587;
  return nodemailer.createTransport({
    host: EMAIL_HOST,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });
}

function buildReceiptHtml({ shop, sale, items }) {
  const currency = shop?.currency ?? 'XAF';
  const fmt = (n) => `${currency} ${Number(n ?? 0).toLocaleString()}`;
  const saleId = (sale.id ?? sale.saleId ?? '').slice(0, 8).toUpperCase();

  const rows = (items ?? []).map(i => `
    <tr>
      <td style="padding:6px 0;border-bottom:1px solid #eee">${i.product_name ?? ''}</td>
      <td style="text-align:right;padding:6px 0;border-bottom:1px solid #eee">${i.quantity} × ${fmt(i.unit_price)}</td>
      <td style="text-align:right;padding:6px 0;border-bottom:1px solid #eee;font-weight:600">${fmt(i.subtotal)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:520px;margin:40px auto;padding:24px;color:#222;background:#fff">
  <h2 style="text-align:center;margin-bottom:4px">${shop?.name ?? 'Receipt'}</h2>
  ${shop?.address ? `<p style="text-align:center;color:#777;margin:2px 0">${shop.address}</p>` : ''}
  ${shop?.phone ? `<p style="text-align:center;color:#777;margin:2px 0">${shop.phone}</p>` : ''}
  <hr style="margin:14px 0;border:none;border-top:1px solid #eee">
  <table style="width:100%;font-size:14px"><tbody>
    <tr><td style="color:#777">Ref</td><td style="text-align:right;font-weight:600">#${saleId}</td></tr>
    <tr><td style="color:#777">Date</td><td style="text-align:right">${new Date(sale.created_at).toLocaleString()}</td></tr>
    <tr><td style="color:#777">Payment</td><td style="text-align:right">${(sale.payment_method ?? '').replace('_', ' ')}</td></tr>
  </tbody></table>
  <hr style="margin:14px 0;border:none;border-top:1px solid #eee">
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <thead><tr style="color:#999;font-size:12px">
      <th style="text-align:left;padding-bottom:8px">Item</th>
      <th style="text-align:right;padding-bottom:8px">Qty × Price</th>
      <th style="text-align:right;padding-bottom:8px">Total</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <hr style="margin:14px 0;border:none;border-top:1px solid #eee">
  ${(sale.discount ?? 0) > 0 ? `<p style="text-align:right;margin:4px 0;color:#dc2626">Discount: −${fmt(sale.discount)}</p>` : ''}
  ${(sale.tax ?? 0) > 0 ? `<p style="text-align:right;margin:4px 0">Tax: ${fmt(sale.tax)}</p>` : ''}
  <p style="text-align:right;font-size:22px;font-weight:900;margin:10px 0">Total: ${fmt(sale.total)}</p>
  <hr style="margin:14px 0;border:none;border-top:1px solid #eee">
  ${shop?.receipt_footer ? `<p style="text-align:center;color:#777;font-size:13px">${shop.receipt_footer}</p>` : ''}
  <p style="text-align:center;color:#aaa;font-size:12px;margin-top:8px">Thank you for your purchase!</p>
</body></html>`;
}

async function sendReceiptEmail({ to, shop, sale, items }) {
  const transporter = createTransporter();
  if (!transporter) {
    const err = new Error('Email not configured. Add EMAIL_HOST, EMAIL_USER, and EMAIL_PASS to server environment variables.');
    err.status = 503;
    throw err;
  }
  const from = process.env.EMAIL_FROM || `"${shop?.name ?? 'ShopMaster'}" <${process.env.EMAIL_USER}>`;
  await transporter.sendMail({
    from,
    to,
    subject: `Your receipt from ${shop?.name ?? 'ShopMaster'}`,
    html: buildReceiptHtml({ shop, sale, items }),
  });
}

module.exports = { sendReceiptEmail };
