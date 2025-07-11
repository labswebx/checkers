import apiClient from './apiClient';
import { ConversationsResponse } from '../types/chat.types';

export const chatService = {
  getConversations: async (page = 1, limit = 20): Promise<ConversationsResponse> => {
    const response = await apiClient.get(`/api/conversations?page=${page}&limit=${limit}`);
    return response.data.data;
  },

  getConversationMessages: async (conversationId: string, page = 1, limit = 50) => {
    const response = await apiClient.get(`/api/conversations/${conversationId}/messages?page=${page}&limit=${limit}`);
    return response.data.data;
  },

  sendMessage: async (conversationId: string, content: string) => {
    const response = await apiClient.post(`/api/conversations/${conversationId}/messages`, { content });
    return response.data.data;
  },

  createConversation: async (participantId: string) => {
    const response = await apiClient.post('/api/conversations', { participantId });
    return response.data.data;
  }
};