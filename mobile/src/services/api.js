import axios from 'axios';
import { getItem } from './storage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

const api = axios.create({ baseURL: BASE_URL });

// Attach JWT token to every request
api.interceptors.request.use(async config => {
  const token = await getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auth
export const register = (shopName, email, password) =>
  api.post('/auth/register', { shopName, email, password }).then(r => r.data);

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

export default api;
