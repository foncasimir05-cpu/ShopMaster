import { getItem } from './storage';
import { BASE_URL } from './api';

const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 30000;

// Parse an SSE text chunk (may contain multiple events separated by \n\n)
function parseChunk(chunk, onEvent) {
  const messages = chunk.split('\n\n');
  for (const msg of messages) {
    if (!msg.trim() || msg.startsWith(':')) continue; // empty or ping comment
    let event = 'message';
    let data = '';
    for (const line of msg.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data = line.slice(5).trim();
    }
    if (!data) continue;
    try { onEvent(event, JSON.parse(data)); }
    catch { onEvent(event, data); }
  }
}

/**
 * Open an SSE stream to `path` (relative to BASE_URL).
 * `onEvent(eventName, parsedData)` fires for each server-sent event.
 * `onConnected(bool)` fires when the stream opens or closes.
 * Returns a disconnect() function — call it on unmount.
 */
export function connectSSE(path, onEvent, onConnected) {
  let active = true;
  let xhr = null;
  let timer = null;
  let attempt = 0;

  async function connect() {
    if (!active) return;

    const token = await getItem('auth_token');
    if (!token) {
      // No token yet — retry after base delay
      timer = setTimeout(connect, RECONNECT_BASE_MS);
      return;
    }

    xhr = new XMLHttpRequest();
    xhr.open('GET', `${BASE_URL}${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Accept', 'text/event-stream');
    xhr.setRequestHeader('Cache-Control', 'no-cache');

    let cursor = 0;

    xhr.onreadystatechange = () => {
      if (!active) return;

      if (xhr.readyState === 2 && xhr.status === 200) {
        // Headers received, stream is open
        attempt = 0;
        onConnected?.(true);
      }

      if (xhr.readyState >= 3 && xhr.responseText.length > cursor) {
        const chunk = xhr.responseText.slice(cursor);
        cursor = xhr.responseText.length;
        parseChunk(chunk, onEvent);
      }

      if (xhr.readyState === 4) {
        onConnected?.(false);
        scheduleReconnect();
      }
    };

    xhr.onerror = () => {
      if (!active) return;
      onConnected?.(false);
      scheduleReconnect();
    };

    xhr.send();
  }

  function scheduleReconnect() {
    if (!active) return;
    const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, attempt), RECONNECT_MAX_MS);
    attempt = Math.min(attempt + 1, 6);
    timer = setTimeout(connect, delay);
  }

  connect();

  return function disconnect() {
    active = false;
    if (timer) clearTimeout(timer);
    if (xhr) { xhr.abort(); xhr = null; }
  };
}
