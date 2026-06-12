import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext';
import { getSettings } from '../services/api';
import { formatCurrency as _fmt } from 'shopmaster-shared';

const CACHE_KEY = 'shopmaster_currency';

function readCache() {
  try { return localStorage.getItem(CACHE_KEY) ?? 'XAF'; } catch { return 'XAF'; }
}

function writeCache(code) {
  try { localStorage.setItem(CACHE_KEY, code); } catch {}
}

const ShopContext = createContext(null);

export function ShopProvider({ children }) {
  const { accessToken } = useAuth();
  const { i18n } = useTranslation();
  const [settings, setSettings] = useState(null);
  const [currency, setCurrency] = useState(readCache);

  const reloadSettings = useCallback(async () => {
    try {
      const s = await getSettings();
      setSettings(s);
      const code = s?.currency ?? 'XAF';
      setCurrency(code);
      writeCache(code);
    } catch {}
  }, []);

  useEffect(() => {
    if (accessToken) reloadSettings();
  }, [accessToken, reloadSettings]);

  const formatCurrency = useCallback(
    (amount) => _fmt(amount, currency, i18n.language),
    [currency, i18n.language],
  );

  return (
    <ShopContext.Provider value={{ settings, currency, formatCurrency, reloadSettings }}>
      {children}
    </ShopContext.Provider>
  );
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('useShop must be used inside ShopProvider');
  return ctx;
}
