const { validationResult } = require('express-validator');
const AuthService = require('../services/auth.service');
const { successResponse, errorResponse } = require('../utils/response.util');
const { STATUS_CODES } = require('../constants');

// Register new user (admin only)
const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 'Validation failed', { errors: errors.array() }, STATUS_CODES.BAD_REQUEST);
    }

    const user = await AuthService.registerUser(req.body);
    return successResponse(res, 'User created successfully', { user }, STATUS_CODES.CREATED);
  } catch (error) {
    return errorResponse(res, error.message, {}, STATUS_CODES.BAD_REQUEST);
  }
};

// Login user
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 'Validation failed', { errors: errors.array() }, STATUS_CODES.BAD_REQUEST);
    }

    const { email, password } = req.body;
    const { user, token } = await AuthService.loginUser(email, password);
    return successResponse(res, 'Login successful', { user, token }, STATUS_CODES.OK);
  } catch (error) {
    return errorResponse(res, error.message, {}, STATUS_CODES.UNAUTHORIZED);
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const user = await AuthService.getUserById(req.user._id);
    return successResponse(res, 'Profile fetched successfully', { user }, STATUS_CODES.OK);
  } catch (error) {
    return errorResponse(res, error.message, {}, STATUS_CODES.NOT_FOUND);
  }
};

module.exports = {
  register,
  login,
  getProfile
}; 