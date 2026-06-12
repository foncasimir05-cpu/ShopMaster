const { EventEmitter } = require('events');

const bus = new EventEmitter();
bus.setMaxListeners(0); // unbounded — one listener per SSE client

function publish(tenantId, event, data) {
  bus.emit(`${tenantId}:${event}`, { event, data, at: new Date().toISOString() });
}

function subscribe(tenantId, events, handler) {
  const keys = events.map(e => `${tenantId}:${e}`);
  keys.forEach(k => bus.on(k, handler));
  return () => keys.forEach(k => bus.off(k, handler));
}

module.exports = { publish, subscribe };
