import axios from 'axios';
import { getItem, setItem, removeItem } from './storage';

const BASE_URL = (() => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // React Native web (browser) → use localhost
  if (typeof window !== 'undefined' && window.location) {
    return 'http://localhost:3001/api/v1';
  }
  // Physical device → use Railway backend
  return 'https://shopmaster-backend-production.up.railway.app/api/v1';
})();

// Origin only (no /api path) — used by auth screens that call /api/auth/...
const BASE_ORIGIN = BASE_URL.replace(/\/api.*$/, '');
export { BASE_URL, BASE_ORIGIN };

const api = axios.create({ baseURL: BASE_URL });

// Attach JWT token to every request
api.interceptors.request.use(async config => {
  const token = await getItem('auth_token');
  console.log('Interceptor token:', token ? 'found' : 'MISSING');
  console.log('Sending token:', token?.substring(0, 20) + '...');
  console.log('Full auth header:', 'Bearer ' + token?.substring(0, 20));
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh expired access tokens
api.interceptors.response.use(
  response => response,
  async error => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = await getItem('refresh_token');
        if (!refreshToken) throw new Error('No refresh token');
        const res = await axios.post(
          `${BASE_ORIGIN}/api/auth/refresh`,
          { refreshToken }
        );
        const { accessToken } = res.data;
        await setItem('auth_token', accessToken);
        original.headers.Authorization = 'Bearer ' + accessToken;
        return api(original);
      } catch (err) {
        await removeItem('auth_token');
        await removeItem('refresh_token');
        return Promise.reject(err);
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const register = (shopName, email, password) =>
  api.post('/auth/register', { shopName, email, password }).then(r => r.data);

export const forgotPassword = email =>
  api.post('/auth/forgot', { email }).then(r => r.data);

export const getSecurityQuestion = (email, shopId) =>
  api.post('/auth/security-question', { email, shopId }).then(r => r.data);

export const verifySecurityAnswer = (email, shopId, answer) =>
  api.post('/auth/verify-security', { email, shopId, answer }).then(r => r.data);

export const resetPassword = (email, shopId, otp, newPassword) =>
  api.post('/auth/reset-password', { email, shopId, otp, newPassword }).then(r => r.data);

export const login = (email, password, tenantId) =>
  api.post('/auth/login', { email, password, tenantId }).then(r => r.data);

export const getMe = () => api.get('/auth/me').then(r => r.data);

// Products
export const getProducts = params => api.get('/products', { params }).then(r => r.data);
export const getProduct = id => api.get(`/products/${id}`).then(r => r.data);
export const createProduct = data => api.post('/products', data).then(r => r.data);
export const updateProduct = (id, data) => api.put(`/products/${id}`, data).then(r => r.data);
export const deleteProduct = id => api.delete(`/products/${id}`).then(r => r.data);

// Sales
export const getSales = params => api.get('/sales', { params }).then(r => r.data);
export const getSale = id => api.get(`/sales/${id}`).then(r => r.data);
export const createSale = data => api.post('/sales', data).then(r => r.data);
export const voidSale = id => api.delete(`/sales/${id}`).then(r => r.data);
export const getInvoiceUrl = id => `${BASE_URL}/sales/${id}/invoice`;
export const getDailyReport = date => api.get('/sales/report/daily', { params: { date } }).then(r => r.data);
export const getWeeklyReport = week => api.get('/sales/report/weekly', { params: { week } }).then(r => r.data);
export const getMonthlyReport = month => api.get('/sales/report/monthly', { params: { month } }).then(r => r.data);

// Inventory
export const getInventory = params => api.get('/inventory', { params }).then(r => r.data);
export const adjustStock = (productId, delta, reason) =>
  api.patch(`/inventory/${productId}/adjust`, { delta, reason }).then(r => r.data);

// Settings
export const getSettings = () => api.get('/settings').then(r => r.data);
export const updateSettings = data => api.put('/settings', data).then(r => r.data);

// Premium & Branches
export const getPremiumStatus = () => api.get('/settings/premium-status').then(r => r.data);
export const upgradeToPremium = () => api.post('/settings/upgrade').then(r => r.data);
export const getSubShops = () => api.get('/sub-shops').then(r => r.data);
export const createSubShop = data => api.post('/sub-shops', data).then(r => r.data);
export const switchToSubShopApi = id => api.post(`/sub-shops/${id}/switch`).then(r => r.data);

// Staff / User management
export const getStaff = () => api.get('/users').then(r => r.data);
export const createStaff = data => api.post('/users', data).then(r => r.data);
export const updateStaff = (id, data) => api.put(`/users/${id}`, data).then(r => r.data);
export const deactivateStaff = id => api.put(`/users/${id}/deactivate`).then(r => r.data);

export default api;
