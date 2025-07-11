const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { USER_ROLES } = require('../constants');

class AuthService {
  /**
   * Generate JWT token
   * @param {string} userId
   * @param {string} role
   * @returns {string} token
   */
  static generateToken(userId, role) {
    return jwt.sign({ userId, role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRY || '30d'
    });
  }

  /**
   * Register a new user
   * @param {Object} userData
   * @returns {Promise<Object>} Created user object
   */
  static async registerUser(userData) {
    const { email } = userData;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Create new user
    const user = new User({
      ...userData,
      role: userData.role || USER_ROLES.AGENT
    });

    await user.save();
    return user;
  }

  /**
   * Login user
   * @param {string} email
   * @param {string} password
   * @returns {Promise<Object>} User and token
   */
  static async loginUser(email, password) {
    // Find user
    const user = await User.findOne({ email, isActive: true });
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    // Generate token with role
    const token = this.generateToken(user._id, user.role);

    return { user, token };
  }

  /**
   * Super login - Admin can login as any user
   * @param {string} email
   * @returns {Promise<Object>} User and token
   */
  static async superLogin(email) {
    const user = await User.findOne({ email, isActive: true });

    if (!user) {
      throw new Error('User not found or inactive');
    }
    const token = this.generateToken(user._id, user.role);

    return { user, token };
  }

  /**
   * Get user by ID
   * @param {string} userId
   * @returns {Promise<Object>} User object
   */
  static async getUserById(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  /**
   * Verify JWT token
   * @param {string} token
   * @returns {Promise<Object>} Decoded token
   */
  static async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findOne({ _id: decoded.userId, isActive: true });

      if (!user) {
        throw new Error('User not found or inactive');
      }

      return { user, decoded };
    } catch (error) {
      throw new Error('Invalid authentication token');
    }
  }
}

module.exports = AuthService; 