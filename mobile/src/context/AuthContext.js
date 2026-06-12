import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { jwtDecode } from 'jwt-decode';
import { getItem, setItem, removeItem } from '../services/storage';
import api from '../services/api';

const isTokenExpired = (token) => {
  try {
    const { exp } = jwtDecode(token);
    return Date.now() >= exp * 1000;
  } catch {
    return true;
  }
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isViewingSubShop, setIsViewingSubShop] = useState(false);
  const [parentUser, setParentUser] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [token, userJson, parentToken, parentUserJson] = await Promise.all([
          getItem('auth_token'),
          getItem('user'),
          getItem('parent_auth_token'),
          getItem('parent_user'),
        ]);
        if (token && !isTokenExpired(token)) {
          setAccessToken(token);
        } else {
          await removeItem('auth_token');
        }
        if (userJson) setUser(JSON.parse(userJson));
        if (parentToken && parentUserJson) {
          setIsViewingSubShop(true);
          setParentUser(JSON.parse(parentUserJson));
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async ({ accessToken: token, refreshToken, user: userInfo }) => {
    await Promise.all([
      setItem('auth_token', token),
      setItem('refresh_token', refreshToken),
      setItem('user', JSON.stringify(userInfo)),
    ]);
    setAccessToken(token);
    setUser(userInfo);
  }, []);

  const logout = useCallback(async () => {
    try {
      const refreshToken = await getItem('refresh_token');
      if (refreshToken) {
        api.post('/auth/logout', { refreshToken }).catch(() => {});
      }
    } catch {}

    await Promise.all([
      removeItem('auth_token'),
      removeItem('refresh_token'),
      removeItem('user'),
      removeItem('parent_auth_token'),
      removeItem('parent_user'),
    ]);
    setAccessToken(null);
    setUser(null);
    setIsViewingSubShop(false);
    setParentUser(null);
  }, []);

  const updateToken = useCallback(async (newToken) => {
    await setItem('auth_token', newToken);
    setAccessToken(newToken);
  }, []);

  const switchToSubShop = useCallback(async ({ accessToken: subToken, shopName, shopId }) => {
    const currentToken = await getItem('auth_token');
    const currentUser = await getItem('user');
    await Promise.all([
      setItem('parent_auth_token', currentToken),
      setItem('parent_user', currentUser),
      setItem('auth_token', subToken),
      setItem('user', JSON.stringify({ ...user, shopId, shopName })),
    ]);
    setParentUser(user);
    setUser({ ...user, shopId, shopName });
    setAccessToken(subToken);
    setIsViewingSubShop(true);
  }, [user]);

  const switchBackToParent = useCallback(async () => {
    const parentToken = await getItem('parent_auth_token');
    const parentUserJson = await getItem('parent_user');
    if (!parentToken || !parentUserJson) return;
    await Promise.all([
      setItem('auth_token', parentToken),
      setItem('user', parentUserJson),
      removeItem('parent_auth_token'),
      removeItem('parent_user'),
    ]);
    const restoredUser = JSON.parse(parentUserJson);
    setAccessToken(parentToken);
    setUser(restoredUser);
    setParentUser(null);
    setIsViewingSubShop(false);
  }, []);

  const value = useMemo(() => ({
    accessToken, user, loading,
    isViewingSubShop, parentUser,
    login, logout, updateToken,
    switchToSubShop, switchBackToParent,
  }), [accessToken, user, loading, isViewingSubShop, parentUser,
      login, logout, updateToken, switchToSubShop, switchBackToParent]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
