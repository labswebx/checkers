const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const url = require('url');

class WebSocketManager {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // userId -> Set of WebSocket connections
  }

  initialize(server) {
    this.wss = new WebSocket.Server({
      server,
      path: '/ws',
      verifyClient: this.verifyClient.bind(this)
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    console.log('WebSocket server initialized');
  }

  verifyClient(info) {
    try {
      const query = url.parse(info.req.url, true).query;
      const token = query.token || info.req.headers.authorization?.split(' ')[1];
      
      if (!token) return false;
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      info.req.user = decoded;
      return true;
    } catch (error) {
      return false;
    }
  }

  handleConnection(ws, req) {
    const userId = req.user._id;

    // Add client to tracking
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId).add(ws);
    ws.userId = userId;
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        this.handleMessage(ws, message);
      } catch (error) {
        console.error('Invalid WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      this.removeClient(userId, ws);
    });

    ws.send(JSON.stringify({
      type: 'connection',
      status: 'connected',
      userId: userId
    }));
  }

  handleMessage(ws, message) {
    switch (message.type) {
      case 'join_conversation':
        ws.conversationId = message.conversationId;
        break;
      case 'leave_conversation':
        ws.conversationId = null;
        break;
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
    }
  }

  broadcastToConversation(conversationId, message, excludeUserId = null) {
    let sentCount = 0;
    this.clients.forEach((connections, userId) => {
      if (userId !== excludeUserId) {
        connections.forEach(ws => {
          if (ws.readyState === WebSocket.OPEN && 
              (ws.conversationId === conversationId || !ws.conversationId)) {
            ws.send(JSON.stringify(message));
            sentCount++;
          }
        });
      }
    });
  }

  sendToUser(userId, message) {
    const userConnections = this.clients.get(userId);
    if (userConnections) {
      userConnections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(message));
        }
      });
    }
  }

  removeClient(userId, ws) {
    const userConnections = this.clients.get(userId);
    if (userConnections) {
      userConnections.delete(ws);
      if (userConnections.size === 0) {
        this.clients.delete(userId);
      }
    }
  }

  // Heartbeat to keep connections alive
  startHeartbeat() {
    setInterval(() => {
      this.wss.clients.forEach(ws => {
        if (!ws.isAlive) {
          this.removeClient(ws.userId, ws);
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // 30 seconds
  }
}

module.exports = new WebSocketManager();