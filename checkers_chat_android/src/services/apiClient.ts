import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const axiosInstance = axios.create({
  baseURL: 'http://192.168.31.98:4000',
});

axiosInstance.interceptors.request.use(async function (config) {
  let token = await AsyncStorage.getItem('authToken');
  token = token ? JSON.parse(token) : '';

  config.headers.Authorization = `${token}`;
  config.headers['Content-Type'] = 'application/json';
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.data?.message) {
      error.message = error.response.data.message;
    }
    return Promise.reject(error);
  }
);

export const webSocketBaseURL = 'localhost:4000'
export default axiosInstance;