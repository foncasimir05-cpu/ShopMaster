import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getLowStockProducts } from '../services/api';
import { connectSSE } from '../services/sseClient';
import { useAuth } from './AuthContext';

const StockAlertContext = createContext({ count: 0, products: [], refresh: () => {} });

export function StockAlertProvider({ children }) {
  const [count, setCount] = useState(0);
  const [products, setProducts] = useState([]);
  const { accessToken } = useAuth();
  const seenIdsRef = useRef(new Set());

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await getLowStockProducts();
      seenIdsRef.current = new Set(data.map(p => p.id));
      setProducts(data);
      setCount(data.length);
    } catch {}
  }, [accessToken]);

  // Called by SSE low_stock event — adds a product to the alert list immediately,
  // without waiting for the next poll. seenIds prevents duplicates.
  const onLowStock = useCallback((data) => {
    if (seenIdsRef.current.has(data.productId)) return;
    seenIdsRef.current.add(data.productId);
    const entry = {
      id:        data.productId,
      name:      data.name,
      stock:     data.stock,
      min_stock: data.minStock,
    };
    setProducts(prev => [...prev, entry]);
    setCount(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (!accessToken) return;

    refresh();

    // SSE connection — real-time low_stock events
    const disconnect = connectSSE('/events', (event, data) => {
      if (event === 'low_stock') onLowStock(data);
    });

    // Polling fallback every 2 min: corrects any missed SSE events
    // and refreshes counts after the SSE reconnects
    const interval = setInterval(refresh, 2 * 60 * 1000);

    return () => {
      disconnect();
      clearInterval(interval);
    };
  }, [accessToken, refresh, onLowStock]);

  const value = useMemo(() => ({ count, products, refresh }), [count, products, refresh]);

  return (
    <StockAlertContext.Provider value={value}>
      {children}
    </StockAlertContext.Provider>
  );
}

export const useStockAlert = () => useContext(StockAlertContext);
