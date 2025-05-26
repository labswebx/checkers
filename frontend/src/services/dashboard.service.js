import api from './api';
import { API_ENDPOINTS } from '../constants';

export const getDashboardStats = async () => {
  const response = await api.get(API_ENDPOINTS.DASHBOARD_STATS);
  return response.data.data;
}; 