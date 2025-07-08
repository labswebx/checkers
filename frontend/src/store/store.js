import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import userReducer from './slices/userSlice';
import conversationReducer from './slices/conversationSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    users: userReducer,
    conversations: conversationReducer,
  },
});

export default store; 