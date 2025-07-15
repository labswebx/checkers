const mongoose = require('mongoose');
const { TRANSACTION_STATUS } = require('../constants');

const transactionSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: String,
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  name: String,
  statusId: Number,
  transactionStatus: {
    type: String,
    required: true,
    default: TRANSACTION_STATUS.PENDING
  },
  amount: {
    type: Number,
    required: true
  },
  requestDate: {
    type: Date,
    required: true
  },
  paymentMethod: String,
  holderName: String,
  bankName: String,
  accountNumber: String,
  iban: String,
  cardNo: String,
  utr: String,
  approvedOn: Date,
  rejectedOn: Date,
  firstDeposit: {
    type: Boolean,
    default: false
  },
  approvedBy: String,
  franchiseName: String,
  remarks: String,
  bonusIncluded: {
    type: Number,
    default: 0
  },
  bonusExcluded: {
    type: Number,
    default: 0
  },
  bonusThreshold: {
    type: Number,
    default: 0
  },
  lastUpdatedUTROn: Date,
  auditStatusId: Number,
  auditStatus: String,
  authorizedUserRemarks: String,
  isImageAvailable: {
    type: Boolean,
    default: false
  },
  imageUrl: String,
  imageLastUpdated: Date,
  transcriptLink: {
    type: String,
    default: null
  },
  lastTranscriptUpdate: {
    type: Date,
    default: null
  },
  checkingDeptApprovedOn: {
    type: Date,
    default: null
  },
  bonusApprovedOn: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Create compound indexes for common query patterns
transactionSchema.index({ requestDate: 1, transactionStatus: 1, franchiseName: 1 });
transactionSchema.index({ transactionStatus: 1, amount: 1, requestDate: 1 });
transactionSchema.index({ createdAt: -1 });

transactionSchema.index({ transactionStatus: 1, amount: 1, requestDate: 1, createdAt: -1 }); // Index to be used on View Pages for Deposit Transactions
transactionSchema.index({ createdAt: -1, transactionStatus: 1, amount: 1, requestDate: 1 }); // Index to be used on View Pages for Withdraw Transactions

// Additional indexes for optimization
transactionSchema.index({ approvedOn: 1 });
transactionSchema.index({ rejectedOn: 1 });
transactionSchema.index({ amount: 1 });

// Create text index for search functionality
transactionSchema.index(
  { 
    orderId: 'text', 
    name: 'text',
    utr: 'text',
    franchiseName: 'text' 
  },
  {
    weights: {
      orderId: 10,
      name: 5,
      utr: 5,
      franchiseName: 3
    },
    name: 'transaction_search'
  }
);

// mongoose.set('debug', true);
const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction; 