export interface User {
  _id: string;
  name: string;
  email: string;
}

export interface Message {
  _id: string;
  conversationId: string;
  senderId: User;
  content: string;
  createdAt: string;
  readBy: Array<{
    userId: string;
    readAt: string;
  }>;
}

export interface Conversation {
  _id: string;
  participant1: User;
  participant2: User;
  lastMessage?: Message;
  lastMessageAt?: string;
  unreadCounts: {
    participant1: number;
    participant2: number;
  };
  createdAt: string;
}

export interface ConversationsResponse {
  conversations: Conversation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}