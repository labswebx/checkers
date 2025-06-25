import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import { API_ENDPOINTS } from '../../constants/index';

// Async thunk for fetching deposits
export const fetchDeposits = createAsyncThunk(
  'deposits/fetchDeposits',
  async (filters) => {
    const queryParams = new URLSearchParams();
    
    if (filters.search) queryParams.append('search', filters.search);
    if (filters.status !== 'all') queryParams.append('status', filters.status);
    if (filters.timeSlab !== 'all') queryParams.append('timeSlab', filters.timeSlab);
    if (filters.page) queryParams.append('page', filters.page);
    if (filters.limit) queryParams.append('limit', filters.limit);
    if (filters.franchise) queryParams.append('franchise', filters.franchise);

    const response = await api.get(`${API_ENDPOINTS.DEPOSITS}?${queryParams}`);
    return response.data.data;
  }
);

// Async thunk for fetching withdrawals
export const fetchWithdraws = createAsyncThunk(
  'deposits/fetchWithdraws',
  async (filters) => {
    const queryParams = new URLSearchParams();
    if (filters.search) queryParams.append('search', filters.search);
    if (filters.status) queryParams.append('status', filters.status);
    if (filters.page) queryParams.append('page', filters.page);
    if (filters.limit) queryParams.append('limit', filters.limit);
    if (filters.franchise) queryParams.append('franchise', filters.franchise);

    const response = await api.get(`${API_ENDPOINTS.WITHDRAWS}?${queryParams}`);
    return response.data.data;
  }
);

// Async thunk for fetching franchises
export const fetchFranchises = createAsyncThunk(
  'deposits/fetchFranchises',
  async () => {
    const response = await api.get(API_ENDPOINTS.FRANCHISES);
    return response.data.data;
  }
);

const depositSlice = createSlice({
  name: 'deposits',
  initialState: {
    deposits: [],
    withdraws: [],
    franchises: [],
    loading: false,
    error: null,
    totalPages: 0,
    totalRecords: 0,
    timeSlabCounts: []
  },
  reducers: {
    clearDeposits: (state) => {
      state.deposits = [];
      state.totalPages = 0;
      state.totalRecords = 0;
      state.timeSlabCounts = [];
    },
    clearWithdraws: (state) => {
      state.withdraws = [];
      state.totalPages = 0;
      state.totalRecords = 0;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDeposits.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDeposits.fulfilled, (state, action) => {
        state.loading = false;
        state.deposits = action.payload.data;
        state.totalPages = action.payload.totalPages;
        state.totalRecords = action.payload.totalRecords;
        state.timeSlabCounts = Array.isArray(action.payload.timeSlabCounts) ? 
          action.payload.timeSlabCounts : [];
      })
      .addCase(fetchDeposits.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(fetchWithdraws.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWithdraws.fulfilled, (state, action) => {
        state.loading = false;
        state.withdraws = action.payload.data;
        state.totalPages = action.payload.totalPages;
        state.totalRecords = action.payload.totalRecords;
      })
      .addCase(fetchWithdraws.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(fetchFranchises.fulfilled, (state, action) => {
        state.franchises = action.payload;
      });
  }
});

export const { clearDeposits, clearWithdraws } = depositSlice.actions;
export default depositSlice.reducer; 