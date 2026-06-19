import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AppState } from 'react-native';
import {
  getPendingOperations, removeOperation, getPendingCount,
  cacheProducts, getCachedProducts, cacheCustomers, getCachedCustomers,
  cachePromotions, cacheSettings,
} from '../services/offlineQueue';
import { getItem, setItem } from '../services/storage';
import { checkHealth, syncBatch, syncPull } from '../services/api';

const PING_MIN      = 30_000;   // 30 s when online
const PING_MAX      = 300_000;  // 5 min cap when repeatedly offline
const LAST_SYNC_KEY = 'shopmaster_last_synced_at';

const OfflineContext = createContext({
  isOnline: true,
  pendingCount: 0,
  lastSyncedAt: null,
  sync: async () => {},
  manualSync: async () => {},
  refreshCount: async () => {},
});

export function OfflineProvider({ children }) {
  const [isOnline, setIsOnline]         = useState(true);
  const [pendingCount, setPendingCount]  = useState(0);
  const [lastSyncedAt, setLastSyncedAt]  = useState(null);
  const syncingRef = useRef(false);
  const backoffRef = useRef(PING_MIN);
  const timerRef   = useRef(null);
  const pingFnRef  = useRef(null); // always-current ping — avoids stale closure in loop

  // Load persisted sync timestamp on mount
  useEffect(() => {
    getItem(LAST_SYNC_KEY).then(v => { if (v) setLastSyncedAt(v); });
  }, []);

  const refreshCount = useCallback(async () => {
    setPendingCount(await getPendingCount());
  }, []);

  // Push queued offline operations to server (idempotent batch endpoint)
  const sync = useCallback(async () => {
    if (syncingRef.current) return;
    const pending = await getPendingOperations();
    if (!pending.length) return;

    syncingRef.current = true;
    try {
      const ops = pending.map(op => ({ clientId: op.clientId, type: op.type, data: op.data }));
      const { results } = await syncBatch(ops);

      let synced = 0;
      for (const result of results) {
        // Remove: success, already processed, or permanent app-level error (bad data — retrying won't help)
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

  // Pull changed products, customers and promotions from server and merge into local cache
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

      if (result.customers?.length) {
        const cached = await getCachedCustomers();
        const cMap = {};
        for (const c of cached) cMap[c.id] = c;
        for (const c of result.customers) cMap[c.id] = { ...cMap[c.id], ...c };
        await cacheCustomers(Object.values(cMap));
      }

      if (result.promotions?.length) await cachePromotions(result.promotions);
      if (result.settings)           await cacheSettings(result.settings);

      const now = new Date().toISOString();
      await setItem('last_pull_sync', result.syncedAt);
      await setItem(LAST_SYNC_KEY, now);
      setLastSyncedAt(now);
    } catch {}
  }, []);

  const ping = useCallback(async () => {
    try {
      await checkHealth();
      setIsOnline(true);
      backoffRef.current = PING_MIN; // reset on success
      await sync();
      await pullSync();
    } catch {
      setIsOnline(false);
      // Double the backoff up to the cap so we stop hammering a dead connection
      backoffRef.current = Math.min(backoffRef.current * 2, PING_MAX);
    }
  }, [sync, pullSync]);

  // Keep pingFnRef current so the loop always calls the latest version
  useEffect(() => { pingFnRef.current = ping; }, [ping]);

  // Recursive setTimeout loop — delay adjusts with backoff after each result
  useEffect(() => {
    let cancelled = false;

    const runLoop = async () => {
      if (cancelled) return;
      await pingFnRef.current?.();
      if (!cancelled) {
        timerRef.current = setTimeout(runLoop, backoffRef.current);
      }
    };

    refreshCount();
    runLoop();

    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && !cancelled) {
        // Foreground: cancel pending timer and ping immediately
        if (timerRef.current) clearTimeout(timerRef.current);
        runLoop();
      }
    });

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      sub.remove();
    };
  }, []); // intentionally empty — pingFnRef handles freshness

  // Manual trigger: push queued ops then pull latest data
  const manualSync = useCallback(async () => {
    await sync();
    await pullSync();
  }, [sync, pullSync]);

  const value = useMemo(
    () => ({ isOnline, pendingCount, lastSyncedAt, sync, manualSync, refreshCount }),
    [isOnline, pendingCount, lastSyncedAt, sync, manualSync, refreshCount]
  );

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
}

export const useOffline = () => useContext(OfflineContext);
