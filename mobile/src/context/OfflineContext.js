import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AppState } from 'react-native';
import { getPendingOperations, removeOperation, getPendingCount, cacheProducts, getCachedProducts } from '../services/offlineQueue';
import { getItem, setItem } from '../services/storage';
import { checkHealth, syncBatch, syncPull } from '../services/api';

const OfflineContext = createContext({
  isOnline: true,
  pendingCount: 0,
  sync: async () => {},
  refreshCount: async () => {},
});

export function OfflineProvider({ children }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const syncingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    setPendingCount(await getPendingCount());
  }, []);

  // Upload queued offline operations to the server via the idempotent batch endpoint.
  const sync = useCallback(async () => {
    if (syncingRef.current) return;
    const pending = await getPendingOperations();
    if (!pending.length) return;

    syncingRef.current = true;
    try {
      const ops = pending.map(op => ({
        clientId: op.clientId,
        type:     op.type,
        data:     op.data,
      }));

      const { results } = await syncBatch(ops);

      let synced = 0;
      for (const result of results) {
        // Remove permanently: success, already processed, or permanent server error.
        // Network errors cause the entire request to throw, so per-item errors here
        // are application-level rejections (bad data) — retrying won't help.
        if (result.status !== 'pending') {
          await removeOperation(result.clientId);
          synced++;
        }
      }
      if (synced > 0) await refreshCount();
    } catch {
      // Network failure — leave everything in queue for next ping
    } finally {
      syncingRef.current = false;
    }
  }, [refreshCount]);

  // Pull changed products/customers/promotions since last sync and merge into cache.
  const pullSync = useCallback(async () => {
    try {
      const since = (await getItem('last_pull_sync')) || '1970-01-01T00:00:00.000Z';
      const result = await syncPull(since);

      if (result.products?.length) {
        const cached = await getCachedProducts();
        const map = {};
        for (const p of cached) map[p.id] = p;
        for (const p of result.products) {
          if (p.is_deleted) delete map[p.id];
          else map[p.id] = { ...map[p.id], ...p };
        }
        await cacheProducts(Object.values(map));
      }

      await setItem('last_pull_sync', result.syncedAt);
    } catch {}
  }, []);

  const ping = useCallback(async () => {
    try {
      await checkHealth();
      setIsOnline(true);
      await sync();
      await pullSync();
    } catch {
      setIsOnline(false);
    }
  }, [sync, pullSync]);

  useEffect(() => {
    refreshCount();
    ping();
    const interval = setInterval(ping, 30000);
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') ping();
    });
    return () => { clearInterval(interval); sub.remove(); };
  }, [ping, refreshCount]);

  const value = useMemo(
    () => ({ isOnline, pendingCount, sync, refreshCount }),
    [isOnline, pendingCount, sync, refreshCount]
  );

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
}

export const useOffline = () => useContext(OfflineContext);
