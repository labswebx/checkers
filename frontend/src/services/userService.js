import api from './api';

export const getUsers = async (page = 1, limit = 10) => {
  try {
    const response = await api.get(`/users?page=${page}&limit=${limit}`);
    return response.data.data;
  } catch (error) {
    throw error.response?.data?.message || 'Failed to fetch users';
  }
}; 