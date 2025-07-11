import { webSocketBaseURL } from "./apiClient";

class SocketService {
  private ws: WebSocket | null = null;
  private messageHandlers: Map<string, Function[]> = new Map();
  private unreadCountHandler: Function | null = null;
  private isConnecting: boolean = false;

  connect(token: string) {
    if (this.isConnecting) {
      return this.ws;
    }
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return this.ws;
    }
    
    this.isConnecting = true;
    
    if (this.ws) {
      this.ws.close();
    }
    
    const wsUrl = `ws://${webSocketBaseURL}/ws?token=${token}`;
    
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.isConnecting = false;
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle unread count updates globally
        if (this.unreadCountHandler && data.type === 'new_message') {
          this.unreadCountHandler(data);
        }
        
        // Handle other message types - call all handlers
        const handlers = this.messageHandlers.get(data.type);
        if (handlers && handlers.length > 0) {
          handlers.forEach((handler, index) => {
            handler(data);
          });
        } else {
          console.log('⚠️ No handlers for message type:', data.type);
        }
      } catch (error) {
        console.error('❌ WebSocket message error:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('❌ WebSocket connection error:', error);
      this.isConnecting = false;
    };

    this.ws.onclose = (event) => {
      this.isConnecting = false;
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
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, []);
    }
    this.messageHandlers.get(event)!.push(handler);
  }

  off(event: string, handler?: Function) {
    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      if (handler) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      } else {
        this.messageHandlers.delete(event);
      }
    }
  }

  joinConversation(conversationId: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'join_conversation',
        conversationId
      }));
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

  setUnreadCountHandler(handler: Function) {
    this.unreadCountHandler = handler;
  }
}

export const socketService = new SocketService();

// Global setup for unread counts
let globalSetupDone = false;

export const setupGlobalUnreadHandler = (dispatch: any, user: any) => {
  if (globalSetupDone) {
    return;
  }
  
  socketService.setUnreadCountHandler((data: any) => {
    if (data.message && user._id !== data.message.senderId._id) {
      dispatch({
        type: 'chat/incrementUnreadCount',
        payload: { 
          conversationId: data.message.conversationId, 
          userId: user._id 
        }
      });
    }
  });
  
  globalSetupDone = true;
};