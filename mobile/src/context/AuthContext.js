import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';

// expo-secure-store falls back to localStorage on web automatically
async function secureGet(key) {
  if (Platform.OS === 'web') return localStorage.getItem(key);
  const { getItemAsync } = await import('expo-secure-store');
  return getItemAsync(key);
}

async function secureSet(key, value) {
  if (Platform.OS === 'web') { localStorage.setItem(key, value); return; }
  const { setItemAsync } = await import('expo-secure-store');
  return setItemAsync(key, value);
}

async function secureDel(key) {
  if (Platform.OS === 'web') { localStorage.removeItem(key); return; }
  const { deleteItemAsync } = await import('expo-secure-store');
  return deleteItemAsync(key);
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [token, userJson] = await Promise.all([
          secureGet('access_token'),
          secureGet('user'),
        ]);
        if (token) setAccessToken(token);
        if (userJson) setUser(JSON.parse(userJson));
      } catch {}
      setLoading(false);
    })();
  }, []);

  const login = async ({ accessToken: token, refreshToken, user: userInfo }) => {
    await Promise.all([
      secureSet('access_token', token),
      secureSet('refresh_token', refreshToken),
      secureSet('user', JSON.stringify(userInfo)),
    ]);
    setAccessToken(token);
    setUser(userInfo);
  };

  const logout = async () => {
    await Promise.all([
      secureDel('access_token'),
      secureDel('refresh_token'),
      secureDel('user'),
    ]);
    setAccessToken(null);
    setUser(null);
  };

  const updateToken = async newToken => {
    await secureSet('access_token', newToken);
    setAccessToken(newToken);
  };

  return (
    <AuthContext.Provider value={{ accessToken, user, loading, login, logout, updateToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
