# WebSocket Implementation Testing Guide

## Backend WebSocket Features Added

### 1. WebSocket Server Setup
- **Endpoint**: `ws://localhost:4000/ws`
- **Authentication**: JWT token via query parameter or Authorization header
- **Path**: `/ws`

### 2. WebSocket Message Types

#### Client to Server:
```json
{
  "type": "join_conversation",
  "conversationId": "conversation_id_here"
}

{
  "type": "leave_conversation"
}

{
  "type": "ping"
}
```

#### Server to Client:
```json
{
  "type": "connection",
  "status": "connected",
  "userId": "user_id_here"
}

{
  "type": "new_message",
  "data": {
    "_id": "message_id",
    "conversationId": "conversation_id",
    "senderId": "sender_id",
    "content": "message_content",
    "messageType": "text",
    "createdAt": "timestamp"
  }
}

{
  "type": "pong"
}
```

## Testing Steps

### 1. Start the Server
```bash
cd backend
npm start
```

### 2. Get JWT Token
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your_username",
    "password": "your_password"
  }'
```

### 3. Test WebSocket Connection

#### Option A: Use the HTML Test Client
1. Open `http://localhost:4000/websocket-test.html` in your browser
2. Enter your JWT token
3. Click "Connect"
4. Enter a conversation ID and click "Join Conversation"
5. Send test messages

#### Option B: Use Node.js Test Script
1. Edit `test-websocket.js` and add your JWT token
2. Run: `node test-websocket.js`

#### Option C: Use WebSocket Client Tools
- **Postman**: Create a WebSocket request to `ws://localhost:4000/ws?token=YOUR_JWT_TOKEN`
- **wscat**: `wscat -c "ws://localhost:4000/ws?token=YOUR_JWT_TOKEN"`

### 4. Test Real-time Messaging

1. **Connect two WebSocket clients** with different user tokens
2. **Join the same conversation** on both clients
3. **Send a message via API** from one user:
   ```bash
   curl -X POST http://localhost:4000/api/conversations/CONVERSATION_ID/messages \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -d '{
       "content": "Hello from API!",
       "messageType": "text"
     }'
   ```
4. **Verify** the other client receives the message via WebSocket

## WebSocket Features

### ✅ Implemented Features:
- JWT Authentication
- Connection management
- Conversation joining/leaving
- Real-time message broadcasting
- Heartbeat/ping-pong
- Multiple connections per user
- Automatic cleanup on disconnect

### 🔄 Message Flow:
1. User sends message via REST API
2. Message saved to database
3. WebSocket broadcasts to conversation participants
4. Connected clients receive real-time updates

### 🛡️ Security:
- JWT token validation
- User authorization for conversations
- Connection tracking per user

## Troubleshooting

### Common Issues:

1. **Connection Refused**
   - Ensure server is running on port 4000
   - Check if WebSocket server initialized successfully

2. **Authentication Failed**
   - Verify JWT token is valid and not expired
   - Check token format in connection URL

3. **Messages Not Broadcasting**
   - Verify both users are in the same conversation
   - Check if WebSocket connections are active
   - Ensure conversation ID is correct

### Debug Commands:
```bash
# Check server logs
npm start

# Test server availability
curl http://localhost:4000/ping

# Check WebSocket endpoint
curl -I http://localhost:4000/ws
```

## Next Steps for Android Implementation

When you're ready for Android:

1. **Add WebSocket dependency**: `implementation 'com.squareup.okhttp3:okhttp:4.11.0'`
2. **Connect with JWT**: `ws://your-server.com/ws?token=JWT_TOKEN`
3. **Handle message types**: Parse JSON messages and update UI
4. **Manage connection lifecycle**: Connect/disconnect based on app state
5. **Implement reconnection logic**: Handle network changes and failures

The backend is now ready for real-time messaging!