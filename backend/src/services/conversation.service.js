const Conversation = require('../models/conversation.model');
const Message = require('../models/message.model');
const Constants = require('../constants/index.js');
const webSocketManager = require('../utils/websocket.util');

class ConversationService {
  /**
   * Create a new conversation between two users
   * @param {string} userId1 - First user ID
   * @param {string} userId2 - Second user ID
   * @returns {Object} - Created conversation
   */
  async createConversation(userId1, userId2) {
    try {
      // Check if conversation already exists
      const existingConversation = await Conversation.findConversationBetweenUsers(userId1, userId2);
      
      if (existingConversation) {
        return existingConversation;
      }

      // Create new conversation
      const conversation = new Conversation({
        participant1: userId1,
        participant2: userId2,
        conversationType: Constants.CONVERSATION_TYPES.USER_TO_USER
      });

      await conversation.save();
      return conversation;
    } catch (error) {
      throw new Error(`Failed to create conversation: ${error.message}`);
    }
  }

  /**
   * Get all conversations for a user
   * @param {string} userId - User ID
   * @param {Object} options - Pagination options
   * @returns {Object} - Conversations and pagination info
   */
  async getUserConversations(userId, options = {}) {
    try {
      const { page = 1, limit = 20 } = options;
      const skip = (page - 1) * limit;
      
      const conversations = await Conversation.findUserConversations(userId, { skip, limit });
      const totalConversations = await Conversation.countUserConversations(userId);
      
      return {
        conversations,
        pagination: {
          page,
          limit,
          total: totalConversations,
          totalPages: Math.ceil(totalConversations / limit),
          hasMore: page * limit < totalConversations
        }
      };
    } catch (error) {
      throw new Error(`Failed to get user conversations: ${error.message}`);
    }
  }

  /**
   * Get a specific conversation by ID
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Object} - Conversation details
   */
  async getConversation(conversationId, userId) {
    try {
      const conversation = await Conversation.findById(conversationId)
      .populate('lastMessage', 'content senderId createdAt')
      
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      if (!conversation.isParticipant(userId)) {
        throw new Error('Access denied. You are not a participant in this conversation.');
      }
      return conversation;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Delete a conversation (soft delete)
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Object} - Deleted conversation
   */
  async deleteConversation(conversationId, userId) {
    try {
      const conversation = await Conversation.findById(conversationId);

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Check if user is participant in this conversation
      if (!conversation.isParticipant(userId)) {
        throw new Error('Access denied. You are not a participant in this conversation.');
      }
      await conversation.delete(userId);
      return conversation;
    } catch (error) {
      throw new Error(`Failed to delete conversation: ${error.message}`);
    }
  }

  /**
   * Get messages in a conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID (for authorization)
   * @param {Object} options - Query options (page, limit, beforeId)
   * @returns {Object} - Messages and pagination info
   */
  async getConversationMessages(conversationId, userId, options = {}) {
    try {
      const conversation = await Conversation.findById(conversationId);
      if (!conversation || !conversation.isParticipant(userId)) {
        throw new Error('Access denied. You are not a participant in this conversation.');
      }

      const { page = 1, limit = 50, beforeId = null } = options;
      const messages = await Message.findConversationMessages(conversationId, {
        page,
        limit,
        beforeId
      });

      await Message.markConversationAsRead(conversationId, userId);
      await conversation.resetUnreadCount(userId);

      return {
        messages: messages.reverse(), // Return in chronological order
        pagination: {
          page,
          limit,
          hasMore: messages.length === limit
        }
      };
    } catch (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Send a message in a conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} senderId - Sender user ID
   * @param {string} content - Message content
   * @param {Object} options - Additional message options
   * @returns {Object} - Created message
   */
  async sendMessage(conversationId, senderId, content, options = {}) {
    try {
      const conversation = await Conversation.findById(conversationId);
      if (!conversation || !conversation.isParticipant(senderId)) {
        throw new Error('Access denied. You are not a participant in this conversation.');
      }

      // Create the message
      const message = new Message({
        conversationId,
        senderId,
        content,
        messageType: options.messageType || Constants.MESSAGE_TYPES.TEXT,
        metadata: options.metadata || {},
        replyTo: options.replyTo || null
      });

      await message.save();

      conversation.lastMessage = message._id;
      conversation.lastMessageAt = message.createdAt;
      
      const otherParticipant = conversation.getOtherParticipant(senderId);
      await conversation.incrementUnreadCount(otherParticipant);
      await conversation.save();

      await message.populate('senderId', 'name email');
      await message.populate('replyTo', 'content senderId');
      
      // Broadcast message via WebSocket
      webSocketManager.broadcastToConversation(conversationId, {
        type: 'new_message',
        data: message
      }, senderId);
      
      return message;
    } catch (error) {
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  /**
   * Mark messages as read
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @returns {Object} - Updated conversation
   */
  async markMessagesAsRead(conversationId, userId) {
    try {
      const conversation = await Conversation.findById(conversationId);
      if (!conversation || !conversation.isParticipant(userId)) {
        throw new Error('Access denied. You are not a participant in this conversation.');
      }

      await Message.markConversationAsRead(conversationId, userId);      
      await conversation.resetUnreadCount(userId);

      return conversation;
    } catch (error) {
      throw new Error(`Failed to mark messages as read: ${error.message}`);
    }
  }

  /**
   * Get total unread message count for a user
   * @param {string} userId - User ID
   * @returns {number} - Total unread count
   */
  async getUnreadMessageCount(userId) {
    try {
      const conversations = await Conversation.findUserConversations(userId);
      const totalUnreadCount = conversations.reduce((total, conversation) => {
        return total + conversation.getUnreadCount(userId);
      }, 0);
      return totalUnreadCount;
    } catch (error) {
      throw new Error(`Failed to get unread message count: ${error.message}`);
    }
  }

  /**
   * Search conversations for a user - Searches for user name or email in the conversation
   * @param {string} userId - User ID
   * @param {string} searchTerm - Search term
   * @returns {Array} - Filtered conversations
   */
  async searchConversations(userId, searchTerm) {
    try {
      const conversations = await Conversation.findUserConversations(userId);
      
      const filteredConversations = conversations.filter(conversation => {
        const participant1Name = `${conversation.participant1.name}`.toLowerCase();
        const participant2Name = `${conversation.participant2.name}`.toLowerCase();
        const searchLower = searchTerm.toLowerCase();
        
        return participant1Name.includes(searchLower) || 
               participant2Name.includes(searchLower) ||
               conversation.participant1.email.toLowerCase().includes(searchLower) ||
               conversation.participant2.email.toLowerCase().includes(searchLower);
      });
      return filteredConversations;
    } catch (error) {
      throw new Error(`Failed to search conversations: ${error.message}`);
    }
  }
}

module.exports = new ConversationService(); 