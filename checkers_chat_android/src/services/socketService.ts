import { webSocketBaseURL } from "./apiClient";

class SocketService {
  private ws: WebSocket | null = null;
  private messageHandlers: Map<string, Function> = new Map();

  connect(token: string) {
    console.log('Attempting WebSocket connection with token:', token?.substring(0, 10) + '...');
    this.ws = new WebSocket(`ws://${webSocketBaseURL}/ws?token=${token}`);

    this.ws.onopen = () => {
      console.log('✅ Connected to WebSocket server');
    };

    this.ws.onmessage = (event) => {
      try {
        console.log('📨 WebSocket message received:', event.data);
        const data = JSON.parse(event.data);
        const handler = this.messageHandlers.get(data.type);
        if (handler) {
          handler(data);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };

    this.ws.onclose = (event) => {
      console.log('🔌 Disconnected from WebSocket server. Code:', event.code, 'Reason:', event.reason);
    };

    return this.ws;
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  on(event: string, handler: Function) {
    this.messageHandlers.set(event, handler);
  }

  off(event: string) {
    this.messageHandlers.delete(event);
  }

  joinConversation(conversationId: string) {
    console.log('🚀 Joining conversation:', conversationId);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'join_conversation',
        conversationId
      }));
    } else {
      console.log('⚠️ WebSocket not ready. State:', this.ws?.readyState);
    }
  }

  leaveConversation(conversationId: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'leave_conversation',
        conversationId
      }));
    }
  }
}

export const socketService = new SocketService();