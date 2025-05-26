const mongoose = require('mongoose');
const mongooseDelete = require('mongoose-delete');

const transactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    required: true
  },
  statusUpdatedAt: {
    type: Date
  },
  type: {
    type: String,
    enum: ['deposit', 'withdrawal'],
    required: true
  },
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',  // Reference to User model instead of Agent
    required: true
  },
  customerId: {
    type: String,
    required: true
  },
  customerName: String,
  franchise: {
    type: String,
    required: true
  },
  utr: String,
  bank: String,
  requestedAt: Date,
  processedAt: Date,
  remarks: String,
  lastScrapedAt: {
    type: Date,
    default: Date.now
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

// Indexes for faster queries
transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ agentId: 1, type: 1 });
transactionSchema.index({ status: 1, type: 1 });
transactionSchema.index({ franchise: 1 });
transactionSchema.index({ lastScrapedAt: 1 });
transactionSchema.index({ customerId: 1 });

// Add soft delete functionality
transactionSchema.plugin(mongooseDelete, { 
  deletedAt: true,
  overrideMethods: true 
});

module.exports = mongoose.model('Transaction', transactionSchema); 