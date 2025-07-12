const User = require('../models/user.model');
const Conversation = require('../models/conversation.model');
const Message = require('../models/message.model');
const logger = require('../utils/logger.util');
const wsManager = require('../utils/websocket.util');
const sentryUtil = require('../utils/sentry.util');
const { CONVERSATION_TYPES, MESSAGE_TYPES } = require('../constants');

class NotificationService {
  /**
   * Send notification to user based on transaction time difference
   * @param {string} franchiseName - Franchise name to find the user
   * @param {number} timeDifferenceMinutes - Time difference in minutes
   * @param {Object} transactionDetails - Transaction details
   */
  async sendTransactionNotification(franchiseName, timeDifferenceMinutes, transactionDetails) {
    try {
      const user = await User.findOne({ name: franchiseName });
      if (!user) {
        logger.warn(`User not found with franchise: ${franchiseName}`);
        return false;
      }

      // Build and send message based on time difference
      await this.buildNotificationAndSendMessage(timeDifferenceMinutes, transactionDetails, user._id);
      return true;
    } catch (error) {
      logger.error('Error sending transaction notification:', {
        franchiseName,
        timeDifferenceMinutes,
        orderId: transactionDetails?.orderId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Build notification message based on time difference
   * @param {number} timeDifferenceMinutes - Time difference in minutes
   * @param {Object} transactionDetails - Transaction details
   * @returns {string} - Formatted message
   */
  async buildNotificationAndSendMessage(timeDifferenceMinutes, transactionDetails, userId) {
    // timeDifferenceMinutes -= 330; // TODO - comment this line for production
    if (transactionDetails.amount >= 0) { // Deposits
      await this.getDepositTransactionMessage(timeDifferenceMinutes, transactionDetails, userId)
    } else { // Withdraws
      await this.getWithdrawTransactionMessage(timeDifferenceMinutes, transactionDetails, userId)
    }
  }

  async getDepositTransactionMessage(timeDifferenceMinutes, transactionDetails, userId) {
    let { orderId, amount } = transactionDetails
    let message = ''

    if (timeDifferenceMinutes <= 2) {
      return;
    } else if (timeDifferenceMinutes <= 5) {
      message = `Your deposit transaction is pending from last 2-5 minutes\nOrder Id - ${orderId}\nAmount - ₹${Math.abs(amount)}`;
    } else if (timeDifferenceMinutes <= 8) {
      message = `Your deposit transaction is pending from last 5-8 minutes\nOrder Id - ${orderId}\nAmount - ₹${Math.abs(amount)}`;
    } else if (timeDifferenceMinutes <= 12) {
      message = `Your deposit transaction is pending from last 8-12 minutes\nOrder Id - ${orderId}\nAmount - ₹${Math.abs(amount)}`;
    } else if (timeDifferenceMinutes <= 20) {
      message = `Your deposit transaction is pending from last 12-20 minutes\nOrder Id - ${orderId}\nAmount - ₹${Math.abs(amount)}`;
    } else {
      message = `Your deposit transaction is pending for more than 20 minutes\nOrder Id - ${orderId}\nAmount - ₹${Math.abs(amount)}`;
    }

    // Send message to user
    await this.sendMessageToUser(userId, message);
  }

  async getWithdrawTransactionMessage(timeDifferenceMinutes, transactionDetails, userId) {
    let { orderId, amount } = transactionDetails
    let message = ''

    if (timeDifferenceMinutes <= 20) {
      return;
    } else if (timeDifferenceMinutes <= 30) {
      message = `Your withdraw transaction is pending from last 20-30 minutes\nOrder Id - ${orderId}\nAmount - ₹${Math.abs(amount)}`;
    } else if (timeDifferenceMinutes <= 45) {
      message = `Your withdraw transaction is pending from last 30-45 minutes\n$Order Id - ${orderId}\nAmount - ₹${Math.abs(amount)}`;
    } else if (timeDifferenceMinutes <= 60) {
      message = `Your withdraw transaction is pending from last 45-60 minutes\nOrder Id - ${orderId}\nAmount - ₹${Math.abs(amount)}`;
    } else {
      message = `Your withdraw transaction is pending for more than 60 minutes\nOrder Id - ${orderId}\nAmount - ₹${Math.abs(amount)}`;
    }

    // Send message to user
    await this.sendMessageToUser(userId, message);
    await this.sendMessageToAdmin(message, transactionDetails.franchiseName)
  }

  /**
   * Send message to user using conversation system
   * @param {string} userId - User ID to send message to
   * @param {string} messageContent - Message content
   */
  async sendMessageToUser(userId, messageContent) {
    try {
      const aiUser = await this.getAIUser();
      const conversation = await this.findOrCreateConversation(aiUser._id, userId);
      
      // Create and save message
      const message = new Message({
        conversationId: conversation._id,
        senderId: aiUser._id,
        senderType: 'ai',
        content: messageContent,
        messageType: MESSAGE_TYPES.TEXT,
        metadata: {
          aiServiceId: 'transaction-notification-ai'
        }
      });
      
      await message.save();
      
      // Populate sender info for WebSocket broadcast
      await message.populate('senderId', 'name email');
      
      // Update conversation with last message
      conversation.lastMessage = message._id;
      conversation.lastMessageAt = new Date();
      await conversation.save();
      await conversation.incrementUnreadCount(userId);
      
      // Broadcast message via WebSocket
      const wsMessage = {
        type: 'new_message',
        message: {
          _id: message._id,
          conversationId: message.conversationId,
          senderId: message.senderId,
          content: message.content,
          messageType: message.messageType,
          createdAt: message.createdAt,
          updatedAt: message.updatedAt
        }
      };
      
      wsManager.broadcastToConversation(conversation._id.toString(), wsMessage, aiUser._id.toString());     
    } catch (error) {
      console.error('🔔 Error sending message to user:', error);
      logger.error('Error sending message to user:', {
        userId,
        error: error.message
      });
      sentryUtil.captureException(error, {
        context: 'send_message_to_user',
        method: 'sendMessageToUser'
      });
      throw error;
    }
  }

  /**
   * Get or create system user for notifications
   * @returns {Object} - AI user object
   */
  async getAIUser() {
    let aiUser = await User.findOne({ email: 'checkerschatai@agent.com' });
    
    if (!aiUser) {
      aiUser = new User({
        name: 'Checkers Chat AI',
        email: 'checkerschatai@agent.com',
        password: 'checkerschatai@agent.com',
        contactNumber: "0000000000",
        role: 'agent'
      });
      await aiUser.save();
    }
    
    return aiUser;
  }

    /**
   * Get or create system user for notifications
   * @returns {Object} - Admin user object
   */
    async getAdminUser() {
      let adminUser = await User.findOne({ email: process.env.CHAT_ADMIN_EMAIL });
      return adminUser;
    }

  async sendMessageToAdmin(messageContent, franchiseName) {
    try {
      const adminUser = await this.getAdminUser();
      const aiUser = await this.getAIUser();
      const conversation = await this.findOrCreateConversation(adminUser._id, aiUser._id);

      // Create and save message
      const message = new Message({
        conversationId: conversation._id,
        senderId: aiUser._id,
        senderType: 'ai',
        content: `${messageContent}\nFranchise - ${franchiseName}`,
        messageType: MESSAGE_TYPES.TEXT,
        metadata: {
          aiServiceId: 'transaction-notification-admin'
        }
      });
      await message.save();

      // Update conversation with last message
      conversation.lastMessage = message._id;
      conversation.lastMessageAt = new Date();
      await conversation.save();
      await conversation.incrementUnreadCount(adminUser._id);
      
      // Broadcast message via WebSocket
      const wsMessage = {
        type: 'new_message',
        message: {
          _id: message._id,
          conversationId: message.conversationId,
          senderId: message.senderId,
          content: message.content,
          messageType: message.messageType,
          createdAt: message.createdAt,
          updatedAt: message.updatedAt
        }
      };
      wsManager.broadcastToConversation(conversation._id.toString(), wsMessage, aiUser._id.toString());
    } catch (error) {
      logger.error('Error sending message to Admin:', {
        error: error.message
      });
      sentryUtil.captureException(error, {
        context: 'send_message_to_admin',
        method: 'sendMessageToAdmin'
      });
      throw error;
    }
  }

  /**
   * Find or create conversation between two users
   * @param {string} aiUserId - System user ID
   * @param {string} userId - Target user ID
   * @returns {Object} - Conversation object
   */
  async findOrCreateConversation(aiUserId, userId) {
    let conversation = await Conversation.findConversationBetweenUsers(aiUserId, userId);
    
    if (!conversation) {
      conversation = new Conversation({
        participant1: aiUserId,
        participant2: userId,
        conversationType: CONVERSATION_TYPES.AI_TO_USER,
        aiUserId: aiUserId
      });
      await conversation.save();
    }
    
    return conversation;
  }
}

module.exports = new NotificationService();