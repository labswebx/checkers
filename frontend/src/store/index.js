import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import userReducer from './slices/userSlice';
import depositReducer from './slices/depositSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    users: userReducer,
    deposits: depositReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export default store; 