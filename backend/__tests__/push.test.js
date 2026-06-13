const { shouldAlert, _alerted } = require('../src/services/push');

beforeEach(() => {
  // Isolate each test: clear the shared in-memory map
  _alerted.clear();
});

describe('shouldAlert (low-stock dedup)', () => {
  test('returns true the first time a product is seen', () => {
    expect(shouldAlert('tenant-1', 'product-abc')).toBe(true);
  });

  test('returns false on an immediate second call for the same product', () => {
    shouldAlert('tenant-1', 'product-abc');
    expect(shouldAlert('tenant-1', 'product-abc')).toBe(false);
  });

  test('allows different products to alert independently', () => {
    shouldAlert('tenant-1', 'product-A');
    expect(shouldAlert('tenant-1', 'product-B')).toBe(true);
  });

  test('allows the same product ID across different tenants', () => {
    shouldAlert('tenant-1', 'product-abc');
    expect(shouldAlert('tenant-2', 'product-abc')).toBe(true);
  });

  test('returns true again after the 1-hour window has elapsed', () => {
    jest.useFakeTimers();
    shouldAlert('tenant-1', 'product-abc');
    jest.advanceTimersByTime(60 * 60 * 1000 + 1);
    expect(shouldAlert('tenant-1', 'product-abc')).toBe(true);
    jest.useRealTimers();
  });

  test('returns false when called just before 1-hour window expires', () => {
    jest.useFakeTimers();
    shouldAlert('tenant-1', 'product-abc');
    jest.advanceTimersByTime(60 * 60 * 1000 - 1);
    expect(shouldAlert('tenant-1', 'product-abc')).toBe(false);
    jest.useRealTimers();
  });
});
