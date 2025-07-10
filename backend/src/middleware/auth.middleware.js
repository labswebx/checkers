const AuthService = require('../services/auth.service');
const { errorResponse } = require('../utils/response.util');
const { STATUS_CODES, USER_ROLES } = require('../constants');
const User = require('../models/user.model');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return errorResponse(res, 'Authentication required', {}, STATUS_CODES.UNAUTHORIZED);
    }

    const { user } = await AuthService.verifyToken(token);
    req.user = user;
    req.token = token;

    if (user && user._id) {
      User.findByIdAndUpdate(user._id, {
        lastVisited: new Date(),
        lastVisitedPage: req.originalUrl
      }).exec();
    }

    next();
  } catch (error) {
    return errorResponse(res, error.message, {}, STATUS_CODES.UNAUTHORIZED);
  }
};

const isAdmin = async (req, res, next) => {
  try {
    if (req.user.role !== USER_ROLES.ADMIN) {
      return errorResponse(res, 'Access denied. Admin privileges required.', {}, STATUS_CODES.FORBIDDEN);
    }
    next();
  } catch (error) {
    return errorResponse(res, 'Server error', {}, STATUS_CODES.SERVER_ERROR);
  }
};

module.exports = { auth, isAdmin }; 