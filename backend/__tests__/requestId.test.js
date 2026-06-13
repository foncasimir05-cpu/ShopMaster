const requestId = require('../src/middleware/requestId');

describe('requestId middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = { setHeader: jest.fn() };
    next = jest.fn();
  });

  test('generates a UUID v4 when no x-request-id header is present', () => {
    requestId(req, res, next);
    expect(req.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  test('re-uses an existing x-request-id header value', () => {
    req.headers['x-request-id'] = 'my-trace-id-123';
    requestId(req, res, next);
    expect(req.id).toBe('my-trace-id-123');
  });

  test('sets X-Request-Id on the response', () => {
    requestId(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', req.id);
  });

  test('calls next()', () => {
    requestId(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(); // no error argument
  });

  test('each request gets a unique ID', () => {
    requestId(req, res, next);
    const id1 = req.id;
    const req2 = { headers: {} };
    requestId(req2, res, jest.fn());
    expect(req2.id).not.toBe(id1);
  });
});
