import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { API_ENDPOINTS, LOCAL_STORAGE_KEYS, USER_ROLES } from '../constants/index';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(LOCAL_STORAGE_KEYS.TOKEN);
    if (token) {
      api.get(API_ENDPOINTS.PROFILE)
        .then(response => {
          setUser(response.data);
        })
        .catch(() => {
          localStorage.removeItem(LOCAL_STORAGE_KEYS.TOKEN);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const response = await api.post(API_ENDPOINTS.LOGIN, { email, password });
    const { token, user } = response.data;
    localStorage.setItem(LOCAL_STORAGE_KEYS.TOKEN, token);
    setUser(user);
    return user;
  };

  const logout = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEYS.TOKEN);
    setUser(null);
  };

  const isAdmin = () => {
    return user?.role === USER_ROLES.ADMIN;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 