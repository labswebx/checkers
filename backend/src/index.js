const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const morgan = require('morgan');
const path = require('path');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const scrapingRoutes = require('./routes/scraping.routes');
const transactionRoutes = require('./routes/transaction.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const { schedulerUtil } = require('./utils/scheduler.util');

// Load environment variables
dotenv.config();
const app = express();
app.use(morgan('combined'));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
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
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received. Closing HTTP server...');
  server.close(() => {
    console.log('HTTP server closed');
    schedulerUtil.stopJobs().then(() => {
      mongoose.connection.close(false, () => {
        console.log('MongoDB connection closed');
        process.exit(0);
      });
    });
  });
}); 