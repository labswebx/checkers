const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversation.controller');
const { auth } = require('../middleware/auth.middleware.js');
const { validateRequest } = require('../middleware/validation.middleware.js');
const Constants = require('../constants/index.js')

// Apply authentication middleware to all routes
router.use(auth);

/**
 * @route POST /api/conversations
 * @desc Create a new conversation
 * @access Private
 */
router.post('/', 
  validateRequest({
    body: {
      participantId: { type: 'string', required: true }
    }
  }),
  conversationController.createConversation
);

/**
 * @route GET /api/conversations
 * @desc Get all conversations for the user
 * @access Private
 */
router.get('/', conversationController.getConversations);

/**
 * @route GET /api/conversations/search
 * @desc Search conversations
 * @access Private
 */
router.get('/search',
  validateRequest({
    query: {
      searchTerm: { type: 'string', required: true, minLength: 1 }
    }
  }),
  conversationController.searchConversations
);

/**
 * @route GET /api/conversations/unread-count
 * @desc Get unread message count
 * @access Private
 */
router.get('/unread-count', conversationController.getUnreadCount);

/**
 * @route GET /api/conversations/:conversationId
 * @desc Get a specific conversation
 * @access Private
 */
router.get('/:conversationId', 
  validateRequest({
    params: {
      conversationId: { type: 'ObjectId', required: true }
    }
  }),
  conversationController.getConversation
);

/**
 * @route GET /api/conversations/:conversationId/messages
 * @desc Get messages for a conversation
 * @access Private
 */
router.get('/:conversationId/messages', 
  validateRequest({
    params: {
      conversationId: { type: 'ObjectId', required: true }
    }
  }),
  conversationController.getConversationMessages
);

/**
 * @route POST /api/conversations/:conversationId/messages
 * @desc Send a message in a conversation
 * @access Private
 */
router.post('/:conversationId/messages',
  validateRequest({
    params: {
      conversationId: { type: 'ObjectId', required: true }
    },
    body: {
      content: { type: 'string', required: true, minLength: 1 },
      messageType: { type: 'string', enum: Object.values(Constants.MESSAGE_TYPES), required: false },
      replyTo: { type: 'string', required: false }
    }
  }),
  conversationController.sendMessage
);

/**
 * @route PUT /api/conversations/:conversationId/messages/read
 * @desc Mark messages as read in a conversation
 * @access Private
 */
router.put('/:conversationId/messages/read', 
  validateRequest({
    params: {
      conversationId: { type: 'ObjectId', required: true }
    }
  }),
  conversationController.markMessagesAsRead
);

/**
 * @route DELETE /api/conversations/:conversationId
 * @desc Delete a conversation (soft delete)
 * @access Private
 */
router.delete('/:conversationId', 
  validateRequest({
    params: {
      conversationId: { type: 'ObjectId', required: true }
    }
  }),
  conversationController.deleteConversation
);

module.exports = router; 