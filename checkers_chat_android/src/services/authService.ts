import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from './apiClient';
import { LoginCredentials } from '../types/auth.types';

class AuthService {
  async login(credentials: LoginCredentials) {
    const response = await axiosInstance.post('api/auth/login', credentials);
    const { user, token } = response.data?.data;
    
    await AsyncStorage.setItem('authToken', JSON.stringify(token));
    return { user, token };
  }

  async logout() {
    await AsyncStorage.removeItem('authToken');
  }

  async getStoredToken() {
    return await AsyncStorage.getItem('authToken');
  }

  async getCurrentUser() {
    const response = await axiosInstance.get('/api/users/me');
    return response.data.data.user;
  }

  async updateUser(userId: string, userData: { name: string }) {
    const response = await axiosInstance.put(`/api/users/${userId}`, {
      name: userData.name
    });
    return response.data.data;
  }

  async superLogin(email: string) {
    const response = await axiosInstance.post('/api/auth/super-login', { email });
    const { user, token } = response.data.data;
    
    await AsyncStorage.setItem('authToken', JSON.stringify(token));
    return { user, token };
  }
}

export const authService = new AuthService();