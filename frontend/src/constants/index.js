export const USER_ROLES = {
  ADMIN: 'admin',
  AGENT: 'agent'
};

export const REGEX = {
  PHONE: /^[0-9]{10}$/,
  PASSWORD: /^.{6,}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
};

export const API_ENDPOINTS = {
  LOGIN: '/api/auth/login',
  REGISTER: '/api/auth/register',
  PROFILE: '/api/auth/profile',
  DEPOSITS: '/api/transactions/deposits',
  USERS: '/api/users',
  DASHBOARD_STATS: '/api/dashboard/stats',
  DASHBOARD_STATUS_UPDATE_STATS: '/api/transactions/status-update-stats'
};

export const LOCAL_STORAGE_KEYS = {
  TOKEN: 'token'
};

export const STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SERVER_ERROR: 500
}; 