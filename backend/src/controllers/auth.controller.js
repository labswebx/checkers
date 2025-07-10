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
    user.lastLogin = new Date();
    await user.save();
    return successResponse(res, 'Login successful', { user, token }, STATUS_CODES.OK);
  } catch (error) {
    return errorResponse(res, error.message, {}, STATUS_CODES.UNAUTHORIZED);
  }
};

// Super login - Admin can login as any user
const superLogin = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 'Validation failed', { errors: errors.array() }, STATUS_CODES.BAD_REQUEST);
    }
    const { email } = req.body;
    
    if (!email) {
      return errorResponse(res, 'Email is required', {}, STATUS_CODES.BAD_REQUEST);
    }

    const { user, token } = await AuthService.superLogin(email);
    return successResponse(res, 'Super login successful', { user, token }, STATUS_CODES.OK);
  } catch (error) {
    return errorResponse(res, error.message, {}, STATUS_CODES.UNAUTHORIZED);
  }
};

// Verify JWT token and return user details
const verifyToken = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'Bearer token is required', {}, STATUS_CODES.UNAUTHORIZED);
    }

    const token = authHeader.split(" ")[1];
    const { user } = await AuthService.verifyToken(token);
    
    return successResponse(res, 'Token verified successfully. User Authenticated', { user }, STATUS_CODES.OK);
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
  superLogin,
  verifyToken,
  getProfile
}; 