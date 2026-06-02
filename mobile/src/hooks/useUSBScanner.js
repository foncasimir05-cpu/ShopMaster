import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

const SCANNER_SPEED_MS = 50;

export function useUSBScanner(onScan, enabled = true) {
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;

    const handleKeyDown = e => {
      const now = Date.now();
      const gap = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const barcode = bufferRef.current.trim();
        bufferRef.current = '';
        if (barcode.length > 2) onScan(barcode);
        return;
      }

      if (gap > SCANNER_SPEED_MS && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onScan, enabled]);
}
