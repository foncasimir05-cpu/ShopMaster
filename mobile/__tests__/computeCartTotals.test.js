const { computeCartTotals } = require('shopmaster-shared');

const item = (price, qty) => ({ product: { price }, quantity: qty });

describe('computeCartTotals', () => {
  test('returns zeroes for an empty cart', () => {
    expect(computeCartTotals([])).toEqual({ subtotal: 0, discount: 0, tax: 0, total: 0 });
  });

  test('sums multi-item subtotals', () => {
    const result = computeCartTotals([item(1000, 2), item(500, 3)]);
    expect(result.subtotal).toBe(3500);
    expect(result.total).toBe(3500);
  });

  test('applies a flat discount', () => {
    const result = computeCartTotals([item(1000, 1)], { discount: 200 });
    expect(result.discount).toBe(200);
    expect(result.total).toBe(800);
  });

  test('applies a tax rate after discount', () => {
    const result = computeCartTotals([item(1000, 1)], { taxRate: 0.1 });
    expect(result.tax).toBe(100);
    expect(result.total).toBe(1100);
  });

  test('combines discount and tax correctly', () => {
    const result = computeCartTotals([item(1000, 1)], { discount: 200, taxRate: 0.1 });
    expect(result.subtotal).toBe(1000);
    expect(result.discount).toBe(200);
    expect(result.tax).toBeCloseTo(80);
    expect(result.total).toBeCloseTo(880);
  });

  test('handles zero-price items without NaN', () => {
    const result = computeCartTotals([item(0, 5)]);
    expect(result.subtotal).toBe(0);
    expect(result.total).toBe(0);
  });

  test('handles fractional quantities correctly', () => {
    const result = computeCartTotals([item(100, 3)], { discount: 50 });
    expect(result.subtotal).toBe(300);
    expect(result.total).toBe(250);
  });
});
