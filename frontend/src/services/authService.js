import api from './api';
import { API_ENDPOINTS, LOCAL_STORAGE_KEYS } from '../constants/index';

// Set up axios interceptor for authentication
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(LOCAL_STORAGE_KEYS.TOKEN);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const login = async (credentials) => {
  try {
    const response = await api.post(API_ENDPOINTS.LOGIN, credentials);
    if (response.data.data.token) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.TOKEN, response.data.data.token);
    }
    return response.data;
  } catch (error) {
    throw error.response.data.message;
  }
};

export const register = async (userData) => {
  try {
    const response = await api.post(API_ENDPOINTS.REGISTER, userData);
    return response.data;
  } catch (error) {
    throw error.response.data.message;
  }
};

export const logout = () => {
  localStorage.removeItem(LOCAL_STORAGE_KEYS.TOKEN);
};

export const getProfile = async () => {
  try {
    const token = localStorage.getItem(LOCAL_STORAGE_KEYS.TOKEN);
    if (!token) throw new Error('No token found');

    const response = await api.get(API_ENDPOINTS.PROFILE);
    return response.data;
  } catch (error) {
    throw error.response.data.message;
  }
}; 