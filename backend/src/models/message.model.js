const mongoose = require('mongoose');
const mongooseDelete = require('mongoose-delete');
const Constants = require('../constants/index.js')

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderType: {
    type: String,
    enum: ['user', 'ai'],
    default: 'user'
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  messageType: {
    type: String,
    enum: Object.values(Constants.MESSAGE_TYPES),
    default: Constants.MESSAGE_TYPES.TEXT
  },
  metadata: {
    aiServiceId: String, // ID of the AI service sending the message
    aiMessageId: String, // Original message ID from AI service
    externalData: Object, // Any additional data from AI service
    fileUrl: String, // URL for file attachments
    fileName: String, // Original filename
    fileSize: Number, // File size in bytes
    mimeType: String, // MIME type for files
    duration: Number, // Duration for audio/video files
    thumbnail: String // Thumbnail URL for media files
  },
  readBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: Object.values(Constants.MESSAGE_STATUS),
    default: Constants.MESSAGE_STATUS.SENT
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  reactions: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    emoji: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

messageSchema.plugin(mongooseDelete, {
  deletedAt: true,
  deletedBy: true,
  overrideMethods: true
});

messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ 'readBy.userId': 1 });
messageSchema.index({ status: 1 });

// Virtual for formatted timestamp
messageSchema.virtual('formattedTime').get(function() {
  return this.createdAt.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Method to mark message as read by a user
messageSchema.methods.markAsRead = function(userId) {
  const existingRead = this.readBy.find(read => read.userId.toString() === userId.toString());
  
  if (!existingRead) {
    this.readBy.push({
      userId: userId,
      readAt: new Date()
    });
    this.status = Constants.MESSAGE_STATUS.READ;
    return this.save();
  }
  
  return Promise.resolve(this);
};

// Method to check if message is read by a user
messageSchema.methods.isReadBy = function(userId) {
  return this.readBy.some(read => read.userId.toString() === userId.toString());
};

// Method to add reaction
messageSchema.methods.addReaction = function(userId, emoji) {
  // Remove existing reaction from this user
  this.reactions = this.reactions.filter(reaction => 
    reaction.userId.toString() !== userId.toString()
  );
  
  // Add new reaction
  this.reactions.push({
    userId: userId,
    emoji: emoji,
    createdAt: new Date()
  });
  
  return this.save();
};

// Method to remove reaction
messageSchema.methods.removeReaction = function(userId) {
  this.reactions = this.reactions.filter(reaction => 
    reaction.userId.toString() !== userId.toString()
  );
  
  return this.save();
};

// Static method to find messages in a conversation
messageSchema.statics.findConversationMessages = function(conversationId, options = {}) {
  const { page = 1, limit = 50, beforeId = null } = options;
  const skip = (page - 1) * limit;
  
  let query = { conversationId, deleted: { $ne: true } };
  
  // If beforeId is provided, get messages before that message
  if (beforeId) {
    const beforeMessage = this.findById(beforeId);
    if (beforeMessage) {
      query.createdAt = { $lt: beforeMessage.createdAt };
    }
  }
  
  return this.find(query)
    .populate('senderId', 'name email')
    .populate('replyTo', 'content senderId')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to find unread messages for a user in a conversation
messageSchema.statics.findUnreadMessages = function(conversationId, userId) {
  return this.find({
    conversationId,
    senderId: { $ne: userId },
    'readBy.userId': { $ne: userId },
    deleted: { $ne: true }
  });
};

// Static method to mark all messages in conversation as read for a user
messageSchema.statics.markConversationAsRead = function(conversationId, userId) {
  return this.updateMany(
    {
      conversationId,
      senderId: { $ne: userId },
      'readBy.userId': { $ne: userId },
      deleted: { $ne: true }
    },
    {
      $push: {
        readBy: {
          userId: userId,
          readAt: new Date()
        }
      },
      $set: { status: Constants.MESSAGE_STATUS.READ }
    }
  );
};

module.exports = mongoose.model('Message', messageSchema); 