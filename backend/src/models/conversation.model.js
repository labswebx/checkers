const mongoose = require('mongoose');
const mongooseDelete = require('mongoose-delete');
const Constants = require('../constants/index.js')

const conversationSchema = new mongoose.Schema({
  participant1: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participant2: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  conversationType: {
    type: String,
    enum: Object.values(Constants.CONVERSATION_TYPES),
    default: Constants.CONVERSATION_TYPES.USER_TO_USER
  },
  aiUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  lastMessageAt: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  unreadCounts: {
    participant1: {
      type: Number,
      default: 0
    },
    participant2: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

conversationSchema.plugin(mongooseDelete, {
  deletedAt: true,
  deletedBy: true,
  overrideMethods: true
});

conversationSchema.index({ participant1: 1, participant2: 1 });
conversationSchema.index({ conversationType: 1 });
conversationSchema.index({ lastMessageAt: -1 });
conversationSchema.index({ isActive: 1 });

// Virtual for conversation title (for display purposes)
conversationSchema.virtual('title').get(function() {
  if (this.conversationType === Constants.CONVERSATION_TYPES.AI_TO_USER && this.aiUserId) {
    return 'AI Assistant';
  }
  return 'Direct Message';
});

// Method to get the other participant in the conversation
conversationSchema.methods.getOtherParticipant = function(userId) {
  if (this.participant1.toString() === userId.toString()) {
    return this.participant2;
  }
  return this.participant1;
};

// Method to check if user is participant in this conversation
conversationSchema.methods.isParticipant = function(userId) {
  return this.participant1.toString() === userId.toString() || 
         this.participant2.toString() === userId.toString();
};

// Method to get unread count for a specific user
conversationSchema.methods.getUnreadCount = function(userId) {
  if (this.participant1.toString() === userId.toString()) {
    return this.unreadCounts.participant1;
  }
  return this.unreadCounts.participant2;
};

// Method to increment unread count for a specific user
conversationSchema.methods.incrementUnreadCount = function(userId) {
  if (this.participant1.toString() === userId.toString()) {
    this.unreadCounts.participant1 += 1;
  } else {
    this.unreadCounts.participant2 += 1;
  }
  return this.save();
};

// Method to reset unread count for a specific user
conversationSchema.methods.resetUnreadCount = function(userId) {
  if (this.participant1.toString() === userId.toString()) {
    this.unreadCounts.participant1 = 0;
  } else {
    this.unreadCounts.participant2 = 0;
  }
  return this.save();
};

// Static method to find conversation between two users
conversationSchema.statics.findConversationBetweenUsers = function(user1Id, user2Id) {
  return this.findOne({
    $or: [
      { participant1: user1Id, participant2: user2Id },
      { participant1: user2Id, participant2: user1Id }
    ],
    deleted: { $ne: true }
  });
};

// Static method to find conversations for a user
conversationSchema.statics.findUserConversations = function(userId, options = {}) {
  const { skip = 0, limit = 20 } = options;
  
  return this.find({
    $or: [
      { participant1: userId },
      { participant2: userId }
    ],
    deleted: { $ne: true }
  }).populate('participant1', 'name email')
    .populate('participant2', 'name email')
    .populate('lastMessage', 'content senderId createdAt')
    .sort({ lastMessageAt: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to count conversations for a user
conversationSchema.statics.countUserConversations = function(userId) {
  return this.countDocuments({
    $or: [
      { participant1: userId },
      { participant2: userId }
    ],
    deleted: { $ne: true }
  });
};

// Static method to find AI conversations for a user
conversationSchema.statics.findAIConversations = function(userId) {
  return this.find({
    $or: [
      { participant1: userId },
      { participant2: userId }
    ],
    conversationType: Constants.CONVERSATION_TYPES.AI_TO_USER,
    deleted: { $ne: true }
  }).populate('aiUserId', 'name email')
    .populate('lastMessage', 'content senderId createdAt')
    .sort({ lastMessageAt: -1, createdAt: -1 });
};

module.exports = mongoose.model('Conversation', conversationSchema); 