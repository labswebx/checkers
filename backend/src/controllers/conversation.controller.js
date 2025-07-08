const ConversationService = require('../services/conversation.service');
const asyncHandler = require('../middleware/asyncHandler.middleware.js');
const ResponseHandler = require('../utils/responseHandler.util.js');
const Constants = require('../constants/index.js')

class ConversationController {
  /**
   * Create a new conversation between two users
   */
  createConversation = asyncHandler(async (req, res) => {
    const { participantId } = req.body;
    const userId = req.user._id;

    if (!participantId) {
      return ResponseHandler.error(res, 'Participant ID is required', 400);
    }

    if (userId === participantId) {
      return ResponseHandler.error(res, 'Cannot create conversation with yourself', 400);
    }

    const conversation = await ConversationService.createConversation(userId, participantId);
    return ResponseHandler.success(res, 'Conversation created successfully', conversation, 201);
  });

  /**
   * Get all conversations for the authenticated user
   */
  getConversations = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { page = 1, limit = Constants.CONVERSATION_PAGINATION_LIMIT } = req.query;

    const result = await ConversationService.getUserConversations(userId, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    return ResponseHandler.success(res, 'Conversations retrieved successfully', result);
  });

  /**
   * Get a specific conversation by ID
   */
  getConversation = asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user._id;

    const conversation = await ConversationService.getConversation(conversationId, userId);
    return ResponseHandler.success(res, 'Conversation retrieved successfully', conversation);
  });

  /**
   * Get messages for a specific conversation
   */
  getConversationMessages = asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user._id;
    const { page = 1, limit = Constants.CONVERSATION_PAGINATION_LIMIT } = req.query;

    const messages = await ConversationService.getConversationMessages(conversationId, userId, {
      page: parseInt(page),
      limit: parseInt(limit)
    });
    return ResponseHandler.success(res, 'Messages retrieved successfully', messages);
  });

  /**
   * Send a message in a conversation
   */
  sendMessage = asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const { content, messageType, metadata, replyTo } = req.body;
    const senderId = req.user._id;

    if (!content || content.trim().length === 0) {
      return ResponseHandler.error(res, 'Message content is required', 400);
    }

    const message = await ConversationService.sendMessage(conversationId, senderId, content, {
      messageType,
      metadata,
      replyTo
    });

    return ResponseHandler.success(res, 'Message sent successfully', message, 201);
  });

  /**
   * Mark messages as read in a conversation
   */
  markMessagesAsRead = asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user._id;

    await ConversationService.markMessagesAsRead(conversationId, userId);
    return ResponseHandler.success(res, 'Messages marked as read successfully');
  });

  /**
   * Search conversations
   */
  searchConversations = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { searchTerm } = req.query;

    if (!searchTerm || searchTerm.trim().length === 0) {
      return ResponseHandler.error(res, 'Search term is required', 400);
    }

    const conversations = await ConversationService.searchConversations(userId, searchTerm);
    return ResponseHandler.success(res, 'Search completed successfully', conversations);
  });

  /**
   * Delete a conversation (soft delete)
   */
  deleteConversation = asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user._id;

    await ConversationService.deleteConversation(conversationId, userId);

    return ResponseHandler.success(res, 'Conversation deleted successfully');
  });

  /**
   * Get unread message count for a user
   */
  getUnreadCount = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const unreadCount = await ConversationService.getUnreadMessageCount(userId);
    return ResponseHandler.success(res, 'Unread count retrieved successfully', { unreadCount });
  });
}

module.exports = new ConversationController(); 