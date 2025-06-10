const mongoose = require('mongoose');

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
    default: 'Pending'
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
  imageLastUpdated: Date
}, {
  timestamps: true
});

// Index for faster lookups
transactionSchema.index({ orderId: 1 });

module.exports = mongoose.model('Transaction', transactionSchema); 