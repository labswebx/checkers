const User = require('../models/user.model');
const { successResponse, errorResponse } = require('../utils/response.util');
const { STATUS_CODES } = require('../constants');

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

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, contactNumber } = req.body;

    // Input validation
    if (!name || !email || !contactNumber) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and contact number are required'
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
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
    if (email !== existingUser.email) {
      const emailExists = await User.findOne({ email, _id: { $ne: id } });
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use'
        });
      }
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { 
        name, 
        email, 
        contactNumber,
        updatedAt: new Date()
      },
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
  updateUser
}; 