// Tests for the pure normalizeOp function — no AsyncStorage mock needed.
import { normalizeOp } from '../src/services/offlineQueue';

describe('normalizeOp', () => {
  test('passes through new-format ops unchanged', () => {
    const op = { clientId: 'abc-123', type: 'sale', data: { items: [] }, queuedAt: '2024-01-01T00:00:00Z' };
    expect(normalizeOp(op)).toEqual(op);
  });

  test('migrates old-format ops (localId → clientId, no type)', () => {
    const op = { localId: 'old-id-1', data: { total: 500 }, queuedAt: '2024-01-01T00:00:00Z' };
    expect(normalizeOp(op)).toEqual({
      clientId: 'old-id-1',
      type: 'sale',
      data: { total: 500 },
      queuedAt: '2024-01-01T00:00:00Z',
    });
  });

  test('prefers clientId over localId when both exist', () => {
    const op = { clientId: 'new-id', localId: 'old-id', type: 'expense', data: {} };
    expect(normalizeOp(op).clientId).toBe('new-id');
  });

  test('defaults type to sale when missing', () => {
    const op = { localId: 'x', data: {} };
    expect(normalizeOp(op).type).toBe('sale');
  });

  test('preserves non-sale types', () => {
    const op = { clientId: 'y', type: 'stock_adjustment', data: { quantity: 5 } };
    expect(normalizeOp(op).type).toBe('stock_adjustment');
  });
});
