import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchConversations = createAsyncThunk(
  'conversations/fetchConversations',
  async ({ page = 1, limit = 20 }, { rejectWithValue }) => {
    try {
      console.log('Fetching conversations with params:', { page, limit });
      const response = await api.get(`/api/conversations?page=${page}&limit=${limit}`);
      console.log('Conversations API response:', response.data);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const fetchConversationMessages = createAsyncThunk(
  'conversations/fetchMessages',
  async ({ conversationId, page = 1, limit = 50 }) => {
    const response = await api.get(`/api/conversations/${conversationId}/messages?page=${page}&limit=${limit}`);
    return response.data.data;
  }
);

export const sendMessage = createAsyncThunk(
  'conversations/sendMessage',
  async ({ conversationId, content }) => {
    const response = await api.post(`/api/conversations/${conversationId}/messages`, { content });
    return response.data.data;
  }
);

const conversationSlice = createSlice({
  name: 'conversations',
  initialState: {
    conversations: [],
    currentConversation: null,
    messages: [],
    loading: false,
    messagesLoading: false,
    error: null,
    totalPages: 0,
    currentPage: 1
  },
  reducers: {
    setCurrentConversation: (state, action) => {
      state.currentConversation = action.payload;
      state.messages = [];
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConversations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.loading = false;
        state.conversations = action.payload.conversations || [];
        state.totalPages = action.payload.pagination?.totalPages || 0;
        state.currentPage = action.payload.pagination?.page || 1;
      })
      .addCase(fetchConversations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
        console.error('fetchConversations rejected:', action.payload || action.error.message);
      })
      .addCase(fetchConversationMessages.pending, (state) => {
        state.messagesLoading = true;
      })
      .addCase(fetchConversationMessages.fulfilled, (state, action) => {
        state.messagesLoading = false;
        state.messages = action.payload.messages || [];
      })
      .addCase(fetchConversationMessages.rejected, (state, action) => {
        state.messagesLoading = false;
        state.error = action.error.message;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.messages.unshift(action.payload);
      });
  }
});

export const { setCurrentConversation, clearError } = conversationSlice.actions;
export default conversationSlice.reducer;