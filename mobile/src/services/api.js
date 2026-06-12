import axios from 'axios';
import { getItem, setItem, removeItem } from './storage';

const RAILWAY_URL = 'https://shopmaster-backend-production.up.railway.app/api/v1';

const BASE_URL = (() => {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  // Electron desktop: loaded from file:// — always use Railway
  if (typeof window !== 'undefined' && window.location?.protocol === 'file:') return RAILWAY_URL;
  // Web browser dev server
  if (typeof window !== 'undefined' && window.location) return 'http://localhost:3001/api/v1';
  // Native mobile fallback
  return RAILWAY_URL;
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

// Health
export const checkHealth = () =>
  axios.get(`${BASE_ORIGIN}/health`, { timeout: 5000 }).then(r => r.data);

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
export const getLowStockProducts = () => api.get('/products/low-stock').then(r => r.data);
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

// Premium / Subscriptions
export const initiatePremiumPayment = (plan, phone) =>
  api.post('/premium/initiate', { plan, phone }).then(r => r.data);
export const checkPremiumPaymentStatus = reference =>
  api.get(`/premium/status/${reference}`).then(r => r.data);

// Day Close / Reconciliation
export const getDayCloseSummary = date => api.get('/day-close/summary', { params: { date } }).then(r => r.data);
export const saveDayClosure = data => api.post('/day-close', data).then(r => r.data);
export const getDayCloseHistory = () => api.get('/day-close/history').then(r => r.data);

// Staff / User management
export const getStaff = () => api.get('/users').then(r => r.data);
export const createStaff = data => api.post('/users', data).then(r => r.data);
export const updateStaff = (id, data) => api.put(`/users/${id}`, data).then(r => r.data);
export const deactivateStaff = id => api.put(`/users/${id}/deactivate`).then(r => r.data);

// Analytics
export const getAnalyticsSummary = () => api.get('/analytics/summary').then(r => r.data);
export const getAnalyticsTrend = (days = 7) => api.get('/analytics/trend', { params: { days } }).then(r => r.data);
export const getTopProducts = (days = 30) => api.get('/analytics/top-products', { params: { days } }).then(r => r.data);
export const getPaymentBreakdown = (days = 30) => api.get('/analytics/payment-breakdown', { params: { days } }).then(r => r.data);

// Customers
export const getCustomers = (params) => api.get('/customers', { params }).then(r => r.data);
export const getCustomer = (id) => api.get(`/customers/${id}`).then(r => r.data);
export const createCustomer = (data) => api.post('/customers', data).then(r => r.data);
export const updateCustomer = (id, data) => api.put(`/customers/${id}`, data).then(r => r.data);

// Product variants
export const getVariants = (productId) => api.get(`/products/${productId}/variants`).then(r => r.data);
export const createVariant = (productId, data) => api.post(`/products/${productId}/variants`, data).then(r => r.data);
export const updateVariant = (productId, variantId, data) => api.put(`/products/${productId}/variants/${variantId}`, data).then(r => r.data);
export const deleteVariant = (productId, variantId) => api.delete(`/products/${productId}/variants/${variantId}`).then(r => r.data);

// Suppliers
export const getSuppliers = (params) => api.get('/suppliers', { params }).then(r => r.data);
export const createSupplier = (data) => api.post('/suppliers', data).then(r => r.data);
export const updateSupplier = (id, data) => api.put(`/suppliers/${id}`, data).then(r => r.data);
export const deleteSupplier = (id) => api.delete(`/suppliers/${id}`).then(r => r.data);

// Purchase Orders
export const getPurchaseOrders = (params) => api.get('/purchase-orders', { params }).then(r => r.data);
export const getPurchaseOrder = (id) => api.get(`/purchase-orders/${id}`).then(r => r.data);
export const createPurchaseOrder = (data) => api.post('/purchase-orders', data).then(r => r.data);
export const receivePurchaseOrder = (id, data) => api.put(`/purchase-orders/${id}/receive`, data).then(r => r.data);
export const deletePurchaseOrder = (id) => api.delete(`/purchase-orders/${id}`).then(r => r.data);

// Promotions
export const getPromotions = () => api.get('/promotions').then(r => r.data);
export const createPromotion = (data) => api.post('/promotions', data).then(r => r.data);
export const updatePromotion = (id, data) => api.put(`/promotions/${id}`, data).then(r => r.data);
export const deletePromotion = (id) => api.delete(`/promotions/${id}`).then(r => r.data);
export const validatePromo = (code, subtotal) => api.post('/promotions/validate', { code, subtotal }).then(r => r.data);

// CSV Import / Export
export const exportProductsCSV = () => api.get('/products/export', { responseType: 'text' }).then(r => r.data);
export const importProductsCSV = (csv) => api.post('/products/import', { csv }).then(r => r.data);

// Expenses
export const getExpenses = (params) => api.get('/expenses', { params }).then(r => r.data);
export const getExpensesSummary = (params) => api.get('/expenses/summary', { params }).then(r => r.data);
export const createExpense = (data) => api.post('/expenses', data).then(r => r.data);
export const updateExpense = (id, data) => api.put(`/expenses/${id}`, data).then(r => r.data);
export const deleteExpense = (id) => api.delete(`/expenses/${id}`).then(r => r.data);

// Email receipt
export const sendReceiptEmail = (saleId, email) => api.post(`/sales/${saleId}/send-receipt`, { email }).then(r => r.data);

export default api;
