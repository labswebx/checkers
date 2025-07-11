import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Conversation, Message } from '../../types/chat.types';
import { chatService } from '../../services/chatService';
import { MESSAGE_PAGINATION_LIMIT } from '../../../constants'

interface ChatState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  loading: boolean;
  messagesLoading: boolean;
  loadingMore: boolean;
  hasMoreMessages: boolean;
  currentPage: number;
  error: string | null;
}

const initialState: ChatState = {
  conversations: [],
  currentConversation: null,
  messages: [],
  loading: false,
  messagesLoading: false,
  loadingMore: false,
  hasMoreMessages: true,
  currentPage: 1,
  error: null,
};

export const fetchConversations = createAsyncThunk(
  'chat/fetchConversations',
  async ({ page = 1, limit = 20 }: { page?: number; limit?: number }) => {
    return await chatService.getConversations(page, limit);
  }
);

export const fetchMessages = createAsyncThunk(
  'chat/fetchMessages',
  async ({ conversationId, page = 1 }: { conversationId: string; page?: number }) => {
    return await chatService.getConversationMessages(conversationId, page);
  }
);

export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async ({ conversationId, content }: { conversationId: string; content: string }) => {
    return await chatService.sendMessage(conversationId, content);
  }
);

export const loadMoreMessages = createAsyncThunk(
  'chat/loadMoreMessages',
  async ({ conversationId, page }: { conversationId: string; page: number }) => {
    return await chatService.getConversationMessages(conversationId, page);
  }
);

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setCurrentConversation: (state, action: PayloadAction<Conversation>) => {
      state.currentConversation = action.payload;
      state.messages = [];
      state.currentPage = 1;
      state.hasMoreMessages = true;
    },
    clearError: (state) => {
      state.error = null;
    },
    addMessage: (state, action: PayloadAction<Message>) => {
      state.messages.push(action.payload);
    },
    incrementUnreadCount: (state, action: PayloadAction<{ conversationId: string; userId: string }>) => {
      const { conversationId, userId } = action.payload;
      const conversation = state.conversations.find(c => c._id === conversationId);
      if (conversation) {
        if (conversation.participant1._id === userId) {
          conversation.unreadCounts.participant1 += 1;
        } else {
          conversation.unreadCounts.participant2 += 1;
        }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConversations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.loading = false;
        state.conversations = action.payload.conversations;
      })
      .addCase(fetchConversations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch conversations';
      })
      .addCase(fetchMessages.pending, (state) => {
        state.messagesLoading = true;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        state.messagesLoading = false;
        state.messages = action.payload.messages;
        state.currentPage = 1;
        state.hasMoreMessages = action.payload.messages.length === 50; // Assuming limit is 50
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        state.messagesLoading = false;
        state.error = action.error.message || 'Failed to fetch messages';
      })
      .addCase(sendMessage.pending, (state) => {
        state.error = null;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.messages.push(action.payload);
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to send message';
      })
      .addCase(loadMoreMessages.pending, (state) => {
        state.loadingMore = true;
      })
      .addCase(loadMoreMessages.fulfilled, (state, action) => {
        state.loadingMore = false;
        const newMessages = action.payload.messages;

        state.messages = [...newMessages, ...state.messages]
        state.currentPage += 1;
        state.hasMoreMessages = newMessages.length === MESSAGE_PAGINATION_LIMIT;
      })
      .addCase(loadMoreMessages.rejected, (state, action) => {
        state.loadingMore = false;
        state.error = action.error.message || 'Failed to load more messages';
      });
  },
});

export const { setCurrentConversation, clearError, addMessage, incrementUnreadCount } = chatSlice.actions;
export { loadMoreMessages };
export default chatSlice.reducer;