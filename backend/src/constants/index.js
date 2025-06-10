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
  APPROVED: 'approved',
  REJECTED: 'rejected'
}

module.exports = {
  USER_ROLES,
  REGEX,
  STATUS_CODES,
  TRANSACTION_STATUS
}; 