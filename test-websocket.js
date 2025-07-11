const WebSocket = require('ws');

// Test WebSocket connection
function testWebSocket() {
    console.log('Testing WebSocket connection...');
    
    // You'll need to replace this with a valid JWT token
    const testToken = 'your_jwt_token_here';
    
    if (testToken === 'your_jwt_token_here') {
        console.log('❌ Please set a valid JWT token in the script');
        console.log('1. Login via API to get a token:');
        console.log('curl -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d \'{"username":"your_username","password":"your_password"}\'');
        console.log('2. Replace testToken in this script with the actual token');
        return;
    }
    
    const ws = new WebSocket(`ws://localhost:4000/ws?token=${testToken}`);
    
    ws.on('open', function() {
        console.log('✅ WebSocket connected successfully');
        
        // Test joining a conversation
        ws.send(JSON.stringify({
            type: 'join_conversation',
            conversationId: 'test_conversation_id'
        }));
        
        // Test ping
        ws.send(JSON.stringify({
            type: 'ping'
        }));
    });
    
    ws.on('message', function(data) {
        const message = JSON.parse(data);
        console.log('📨 Received message:', message);
    });
    
    ws.on('close', function() {
        console.log('❌ WebSocket connection closed');
    });
    
    ws.on('error', function(error) {
        console.log('❌ WebSocket error:', error.message);
    });
    
    // Close connection after 10 seconds
    setTimeout(() => {
        ws.close();
        console.log('🔚 Test completed');
        process.exit(0);
    }, 10000);
}

// Test server availability first
const http = require('http');
const options = {
    hostname: 'localhost',
    port: 4000,
    path: '/ping',
    method: 'GET'
};

console.log('Checking if server is running...');
const req = http.request(options, (res) => {
    if (res.statusCode === 200) {
        console.log('✅ Server is running');
        testWebSocket();
    } else {
        console.log('❌ Server responded with status:', res.statusCode);
    }
});

req.on('error', (err) => {
    console.log('❌ Server is not running. Please start the server first:');
    console.log('cd backend && npm start');
});

req.end();