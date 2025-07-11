const User = require('../models/user.model');
const { successResponse, errorResponse } = require('../utils/response.util');
const { STATUS_CODES } = require('../constants');
const bcrypt = require('bcryptjs');

/**
 * Get all users with pagination
 * @route GET /api/users
 * @access Private
 */
const getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalUsers = await User.countDocuments({ isActive: true });
    const totalPages = Math.ceil(totalUsers / limit);

    const users = await User.find({ isActive: true })
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return successResponse(res, 'Users fetched successfully', {
      users,
      totalPages,
      totalUsers,
      currentPage: page
    }, STATUS_CODES.OK);
  } catch (error) {
    return errorResponse(res, error.message, {}, STATUS_CODES.SERVER_ERROR);
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return errorResponse(res, 'User not found', {}, STATUS_CODES.NOT_FOUND);
    }

    return successResponse(res, 'User details fetched successfully', { user }, STATUS_CODES.OK);
  } catch (error) {
    return errorResponse(res, error.message, {}, STATUS_CODES.SERVER_ERROR);
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, contactNumber, password } = req.body;

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Password validation
    if (password && password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if user exists
    const existingUser = await User.findById(id);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // If email is being changed, check if new email already exists
    if (email && email !== existingUser.email) {
      const emailExists = await User.findOne({ email, _id: { $ne: id } });
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use'
        });
      }
    }

    // Prepare update data
    const updateData = {
      name, 
      email, 
      contactNumber,
      updatedAt: new Date()
    };

    // Add password to update data if provided (hash it first)
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      id,
      updateData,
      { 
        new: true,
        runValidators: true 
      }
    ).select('-password');

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error('Error in updateUser:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  getUsers,
  updateUser,
  getCurrentUser
}; 