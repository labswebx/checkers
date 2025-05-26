const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  cookies: [{
    name: String,
    value: String,
    domain: String,
    path: String,
    expires: Number,
    httpOnly: Boolean,
    secure: Boolean,
    sameSite: String
  }],
  localStorage: [{
    key: String,
    value: String
  }],
  sessionStorage: [{
    key: String,
    value: String
  }],
  lastUsed: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 21600 // 6 hours in seconds
  }
});

// Index for faster lookups
sessionSchema.index({ userId: 1, lastUsed: -1 });

module.exports = mongoose.model('Session', sessionSchema); 