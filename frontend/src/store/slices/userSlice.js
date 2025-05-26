import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import { API_ENDPOINTS } from '../../constants/index';

export const fetchUsers = createAsyncThunk(
  'users/fetchUsers',
  async ({ page, limit }) => {
    const queryParams = new URLSearchParams();
    if (page) queryParams.append('page', page);
    if (limit) queryParams.append('limit', limit);

    const response = await api.get(`${API_ENDPOINTS.USERS}?${queryParams}`);
    return response.data.data;
  }
);

export const updateUser = createAsyncThunk(
  'users/updateUser',
  async ({ userId, userData }) => {
    const response = await api.put(`${API_ENDPOINTS.USERS}/${userId}`, userData);
    return response.data.data;
  }
);

const userSlice = createSlice({
  name: 'users',
  initialState: {
    users: [],
    loading: false,
    error: null,
    totalPages: 0,
    totalUsers: 0,
    updateLoading: false,
    updateError: null
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
      state.updateError = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.users = action.payload.users;
        state.totalPages = action.payload.totalPages;
        state.totalUsers = action.payload.totalUsers;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload.message;
      })
      .addCase(updateUser.pending, (state) => {
        state.updateLoading = true;
        state.updateError = null;
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        state.updateLoading = false;
        state.users = state.users.map(user => 
          user._id === action.payload._id ? action.payload : user
        );
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.updateLoading = false;
        state.updateError = action.error.message;
      });
  }
});

export const { clearError } = userSlice.actions;
export default userSlice.reducer; 