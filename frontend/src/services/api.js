import axios from 'axios';
import { auth } from './firebase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const registerUser = (email, password, username, phone) => 
  api.post('/auth/register', { email, password, username, phone });

export const loginUser = (email, password) => 
  api.post('/auth/login', { email, password });

export const forgotPassword = (email) => 
  api.post('/auth/forgot-password', { email });

// Games
export const getGames = (params) => api.get('/games', { params });
export const getGame = (id) => api.get(`/games/${id}`);
export const purchaseGame = (gameId) => api.post(`/games/${gameId}/purchase`);
export const getUserGames = () => api.get('/user/games');

// Wallet
export const getBalance = () => api.get('/wallet/balance');
export const getTransactions = () => api.get('/wallet/transactions');

// Payment
export const deposit = (phoneNumber, amount, network) => 
  api.post('/payment/deposit', { phoneNumber, amount, network });

export const getPaymentHistory = () => api.get('/payment/history');

// Admin
export const getDashboardStats = () => api.get('/admin/dashboard/stats');
export const createGame = (data) => api.post('/admin/games', data);
export const updateGame = (id, data) => api.put(`/admin/games/${id}`, data);
export const deleteGame = (id) => api.delete(`/admin/games/${id}`);
export const searchUser = (query, field) => api.post('/admin/wallet/search', { query, field });
export const addBalance = (userId, amount, reason) => api.post('/admin/wallet/add', { userId, amount, reason });
export const removeBalance = (userId, amount, reason) => api.post('/admin/wallet/remove', { userId, amount, reason });
export const setBalance = (userId, amount) => api.post('/admin/wallet/set', { userId, amount });
export const resetBalance = (userId) => api.post('/admin/wallet/reset', { userId });

export default api;
