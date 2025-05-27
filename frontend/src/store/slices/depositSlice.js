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
    if (filters.startDate) queryParams.append('startDate', filters.startDate.toISOString());
    if (filters.endDate) queryParams.append('endDate', filters.endDate.toISOString());
    if (filters.amountRange !== 'all') queryParams.append('amountRange', filters.amountRange);
    if (filters.timeSlab !== 'all') queryParams.append('timeSlab', filters.timeSlab);
    if (filters.page) queryParams.append('page', filters.page);
    if (filters.limit) queryParams.append('limit', filters.limit);

    const response = await api.get(`${API_ENDPOINTS.DEPOSITS}?${queryParams}`);
    return response.data.data;
  }
);

const depositSlice = createSlice({
  name: 'deposits',
  initialState: {
    deposits: [],
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
      });
  }
});

export const { clearDeposits } = depositSlice.actions;
export default depositSlice.reducer; 