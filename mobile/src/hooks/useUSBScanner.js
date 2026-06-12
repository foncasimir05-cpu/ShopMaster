import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

const SCANNER_SPEED_MS = 60;   // max ms between scanner keystrokes
const SCAN_COOLDOWN_MS = 1000; // min ms before same barcode accepted again

export function useUSBScanner(onScan, enabled = true, onConfirm = null) {
  const bufferRef       = useRef('');
  const lastKeyTimeRef  = useRef(0);
  const lastScanTimeRef = useRef(0);
  const lastScanCodeRef = useRef('');
  const onScanRef       = useRef(onScan);
  const onConfirmRef    = useRef(onConfirm);

  // Always keep refs current so stale closures are never an issue
  onScanRef.current    = onScan;
  onConfirmRef.current = onConfirm;

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;

    const handleKeyDown = (e) => {
      if (e.repeat) return;

      const now = Date.now();
      const gap = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const barcode = bufferRef.current.trim();
        bufferRef.current = '';

        if (barcode.length > 2) {
          // Intercept Enter completely so the focused TextInput never sees it
          e.preventDefault();
          e.stopPropagation();

          // Dedup: ignore same barcode re-scanned within cooldown window
          if (
            barcode === lastScanCodeRef.current &&
            now - lastScanTimeRef.current < SCAN_COOLDOWN_MS
          ) return;

          lastScanCodeRef.current = barcode;
          lastScanTimeRef.current = now;
          onScanRef.current(barcode);
        } else if (barcode.length === 0 && onConfirmRef.current) {
          // Plain Enter with no barcode → Confirm / Charge
          onConfirmRef.current();
        }
        return;
      }

      // Non-Enter key — slow gap means manual typing; reset buffer
      if (gap > SCANNER_SPEED_MS && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    };

    // *** capture: true ***  — fires BEFORE events reach any child element (TextInput).
    // This lets us call stopPropagation() on a valid scanner Enter so the
    // TextInput never receives it, eliminating the double-add bug.
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [enabled]);
}
