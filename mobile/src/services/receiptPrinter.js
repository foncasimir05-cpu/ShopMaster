import { Alert } from 'react-native';
import * as Print from 'expo-print';

export function generateReceiptHtml({ shop, sale, items, tendered, change }) {
  const currency = shop?.currency ?? 'XAF';
  const fmt = (n) =>
    `${currency} ${Number(n || 0).toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const date = new Date(sale.created_at || sale.completedAt || Date.now()).toLocaleString();
  const saleRef = (sale.saleId || sale.id || '').slice(0, 8).toUpperCase();
  const payLabel = (sale.paymentMethod || sale.payment_method || 'cash')
    .replace(/_/g, ' ')
    .toUpperCase();

  const itemRows = (items || [])
    .map(
      item => `
    <tr><td class="desc" colspan="2">${item.product_name}${item.variant_name ? ` – ${item.variant_name}` : ''}</td></tr>
    <tr><td class="dim">${item.quantity} x ${fmt(item.unit_price)}</td><td class="r">${fmt(item.subtotal)}</td></tr>`
    )
    .join('');

  const subtotal = (items || []).reduce((s, i) => s + (i.subtotal || 0), 0);
  const discount = sale.discount ?? 0;
  const tax = sale.tax ?? 0;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Courier New',Courier,monospace;font-size:12px;width:80mm;padding:4mm;line-height:1.5}
@media print{@page{size:80mm auto;margin:0}}
.c{text-align:center}.r{text-align:right}.b{font-weight:bold}.lg{font-size:15px}.sm{font-size:10px}
hr{border:none;border-top:1px dashed #000;margin:3mm 0}
table{width:100%;border-collapse:collapse}
td{padding:1mm 0;vertical-align:top}
.desc{font-weight:bold}.dim{font-size:10px;color:#666}
.row{display:flex;justify-content:space-between;padding:1mm 0}
.total{font-size:15px;font-weight:bold;border-top:1px dashed #000;padding-top:3mm;margin-top:1mm}
</style></head><body>
<div class="c b lg">${shop?.name || 'MY SHOP'}</div>
${shop?.address ? `<div class="c sm">${shop.address}</div>` : ''}
${shop?.phone ? `<div class="c sm">Tel: ${shop.phone}</div>` : ''}
<hr>
<div>Ref: #${saleRef || '--------'}</div>
<div>${date}</div>
${sale.customer_name ? `<div>Customer: ${sale.customer_name}</div>` : ''}
<hr>
<table><tbody>${itemRows}</tbody></table>
<hr>
<div class="row"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
${discount > 0 ? `<div class="row"><span>Discount</span><span>- ${fmt(discount)}</span></div>` : ''}
${tax > 0 ? `<div class="row"><span>Tax</span><span>${fmt(tax)}</span></div>` : ''}
<div class="row total"><span>TOTAL</span><span>${fmt(sale.total)}</span></div>
<div class="row"><span>${payLabel}</span><span></span></div>
${tendered ? `<div class="row"><span>Tendered</span><span>${fmt(tendered)}</span></div>` : ''}
${change > 0 ? `<div class="row"><span>Change</span><span>${fmt(change)}</span></div>` : ''}
<hr>
${shop?.receipt_footer ? `<div class="c sm">${shop.receipt_footer}</div>` : ''}
<div class="c sm">Thank you for your business!</div>
<div class="c sm" style="color:#aaa;margin-top:3mm">Powered by ShopMaster</div>
</body></html>`;
}

export async function printReceipt(options) {
  const html = generateReceiptHtml(options);
  try {
    await Print.printAsync({ html });
  } catch (e) {
    Alert.alert('Print error', e.message || 'Could not open print dialog');
  }
}
