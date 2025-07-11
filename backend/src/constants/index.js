const USER_ROLES = {
  ADMIN: 'admin',
  AGENT: 'agent'
};

const REGEX = {
  PHONE: /^[0-9]{10}$/,
  PASSWORD: /^.{6,}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
};

const STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SERVER_ERROR: 500
};

const TRANSACTION_STATUS = {
  PENDING: 'Pending',
  SUCCESS: 'Success',
  REJECTED: 'Rejected'
}

const CONVERSATION_TYPES = {
  USER_TO_USER: 'user_to_user',
  AI_TO_USER: 'ai_to_user'
};

const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video',
  FILE: 'file',
  AUDIO: 'audio'
};

const MESSAGE_STATUS = {
  SENDING: 'sending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed'
};

const PAGINATION_LIMIT = 50;
const CONVERSATION_PAGINATION_LIMIT = 20;
const MESSAGE_PAGINATION_LIMIT = 50;

module.exports = {
  USER_ROLES,
  REGEX,
  STATUS_CODES,
  TRANSACTION_STATUS,
  CONVERSATION_TYPES,
  MESSAGE_TYPES,
  MESSAGE_STATUS,
  PAGINATION_LIMIT,
  CONVERSATION_PAGINATION_LIMIT,
  MESSAGE_PAGINATION_LIMIT
}; 