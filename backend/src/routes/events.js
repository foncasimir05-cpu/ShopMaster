const express = require('express');
const { subscribe } = require('../services/eventBus');

const router = express.Router();

const EVENTS = ['low_stock', 'day_close', 'payment_received', 'sale_created'];

// GET /api/v1/events  — Server-Sent Events stream (one connection per client)
router.get('/', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // prevent nginx from buffering SSE
  });
  res.flushHeaders();

  // Let the client know the stream is open
  res.write('event: connected\ndata: {}\n\n');

  // Keepalive ping every 25 s so proxies don't drop idle connections
  const keepalive = setInterval(() => res.write(':ping\n\n'), 25000);

  const unsubscribe = subscribe(req.shopId, EVENTS, (payload) => {
    res.write(`event: ${payload.event}\ndata: ${JSON.stringify(payload.data)}\n\n`);
  });

  req.on('close', () => {
    clearInterval(keepalive);
    unsubscribe();
  });
});

module.exports = router;
