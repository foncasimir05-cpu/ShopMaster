import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { getPendingSales, removePendingSale, getPendingCount } from '../services/offlineQueue';
import { checkHealth, createSale } from '../services/api';

const OfflineContext = createContext({ isOnline: true, pendingCount: 0, sync: async () => {}, refreshCount: async () => {} });

export function OfflineProvider({ children }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const syncingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    setPendingCount(await getPendingCount());
  }, []);

  const sync = useCallback(async () => {
    if (syncingRef.current) return;
    const pending = await getPendingSales();
    if (!pending.length) return;
    syncingRef.current = true;
    let synced = 0;
    for (const sale of pending) {
      try {
        await createSale(sale.data);
        await removePendingSale(sale.localId);
        synced++;
      } catch (err) {
        if (err.response) {
          // Server rejected (stock issues etc.) — remove to avoid infinite retry
          await removePendingSale(sale.localId);
          synced++;
        }
        // Network error: leave in queue
      }
    }
    syncingRef.current = false;
    if (synced > 0) await refreshCount();
  }, [refreshCount]);

  const ping = useCallback(async () => {
    try {
      await checkHealth();
      setIsOnline(true);
      await sync();
    } catch {
      setIsOnline(false);
    }
  }, [sync]);

  useEffect(() => {
    refreshCount();
    ping();
    const interval = setInterval(ping, 30000);
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') ping();
    });
    return () => { clearInterval(interval); sub.remove(); };
  }, [ping, refreshCount]);

  return (
    <OfflineContext.Provider value={{ isOnline, pendingCount, sync, refreshCount }}>
      {children}
    </OfflineContext.Provider>
  );
}

export const useOffline = () => useContext(OfflineContext);
