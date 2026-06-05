import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import { getItem, setItem, removeItem } from '../services/storage';

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

  useEffect(() => {
    (async () => {
      try {
        const [token, userJson] = await Promise.all([
          getItem('auth_token'),
          getItem('user'),
        ]);
        if (token && !isTokenExpired(token)) {
          setAccessToken(token);
        } else {
          await removeItem('auth_token');
        }
        if (userJson) setUser(JSON.parse(userJson));
      } catch {}
      setLoading(false);
    })();
  }, []);

  const login = async ({ accessToken: token, refreshToken, user: userInfo }) => {
    await Promise.all([
      setItem('auth_token', token),
      setItem('refresh_token', refreshToken),
      setItem('user', JSON.stringify(userInfo)),
    ]);
    setAccessToken(token);
    console.log('AuthContext: token set', token);
    setUser(userInfo);
  };

  const logout = async () => {
    await Promise.all([
      removeItem('auth_token'),
      removeItem('refresh_token'),
      removeItem('user'),
    ]);
    setAccessToken(null);
    setUser(null);
  };

  const updateToken = async newToken => {
    await setItem('auth_token', newToken);
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
