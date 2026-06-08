import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getLowStockProducts } from '../services/api';
import { useAuth } from './AuthContext';

const StockAlertContext = createContext({ count: 0, products: [], refresh: () => {} });

export function StockAlertProvider({ children }) {
  const [count, setCount] = useState(0);
  const [products, setProducts] = useState([]);
  const { accessToken } = useAuth();

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await getLowStockProducts();
      setProducts(data);
      setCount(data.length);
    } catch {}
  }, [accessToken]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 2 * 60 * 1000); // re-check every 2 min
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <StockAlertContext.Provider value={{ count, products, refresh }}>
      {children}
    </StockAlertContext.Provider>
  );
}

export const useStockAlert = () => useContext(StockAlertContext);
