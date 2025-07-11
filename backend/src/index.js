require('dotenv').config();

// Initialize Sentry BEFORE other imports
const Sentry = require('@sentry/node');
const { nodeProfilingIntegration } = require('@sentry/profiling-node');
// Only initialize Sentry if DSN is provided
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
      nodeProfilingIntegration(),
    ],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    environment: process.env.NODE_ENV || 'development',
  });
  console.log('Sentry initialized successfully');
} else {
  console.log('Sentry DSN not found - Sentry disabled');
}


const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const morgan = require('morgan');
const path = require('path');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const scrapingRoutes = require('./routes/scraping.routes');
const transactionRoutes = require('./routes/transaction.routes');
const conversationRoutes = require('./routes/conversation.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const { schedulerUtil } = require('./utils/scheduler.util');
const webSocketManager = require('./utils/websocket.util');

const app = express();
app.use(morgan('combined'));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  maxPoolSize: 20
})

.then(() => {
  console.log('Connected to MongoDB');
  // Start the schedulers after MongoDB connection is established
  schedulerUtil.startJobs();
})
.catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the React build directory
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/scraping', scrapingRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/conversations', conversationRoutes);

// Ping route
app.get('/ping', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

// Serve React App for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: err.message || 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  
  // Initialize WebSocket server
  webSocketManager.initialize(server);
  webSocketManager.startHeartbeat();
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received. Closing HTTP server...');
  server.close(() => {
    console.log('HTTP server closed');
    schedulerUtil.stopJobs().then(() => {
      mongoose.connection.close();
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
}); 