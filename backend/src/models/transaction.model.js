const mongoose = require('mongoose');
const mongooseDelete = require('mongoose-delete');

const transactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    required: true,
    index: true
  },
  statusUpdatedAt: {
    type: Date
  },
  type: {
    type: String,
    enum: ['deposit', 'withdrawal'],
    required: true,
    index: true
  },
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',  // Reference to User model instead of Agent
    required: true,
    index: true
  },
  customerId: {
    type: String,
    required: true,
    index: true
  },
  customerName: String,
  franchise: {
    type: String,
    required: true,
    index: true
  },
  utr: String,
  bank: String,
  requestedAt: Date,
  processedAt: Date,
  remarks: String,
  lastScrapedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  lastNotificationSent: {
    type: Date
  }
}, {
  timestamps: true
});

// Add soft delete functionality
transactionSchema.plugin(mongooseDelete, { 
  deletedAt: true,
  overrideMethods: true 
});

module.exports = mongoose.model('Transaction', transactionSchema); 