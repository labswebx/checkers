const User = require('../models/user.model');
const Transaction = require('../models/transaction.model');
const { successResponse, errorResponse } = require('../utils/response.util');
const { STATUS_CODES, USER_ROLES, TRANSACTION_STATUS } = require('../constants');

/**
 * Get dashboard statistics
 * @route GET /api/dashboard/stats
 * @access Private
 */
const getDashboardStats = async (req, res) => {
  try {
    // Get user statistics
    const totalUsers = await User.countDocuments({ isActive: true });
    const totalAdmins = await User.countDocuments({ role: USER_ROLES.ADMIN, isActive: true });
    const totalAgents = await User.countDocuments({ role: USER_ROLES.AGENT, isActive: true });

    // Get transaction statistics
    const totalTransactions = await Transaction.countDocuments();
    const pendingTransactions = await Transaction.countDocuments({ status: TRANSACTION_STATUS.PENDING });
    const approvedTransactions = await Transaction.countDocuments({ status: TRANSACTION_STATUS.APPROVED });
    const rejectedTransactions = await Transaction.countDocuments({ status: TRANSACTION_STATUS.REJECTED });

    // Calculate total amounts
    const totalAmountStats = await Transaction.aggregate([
      {
        $group: {
          _id: '$status',
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    // Get transaction trends (last 7 days)
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const dailyTrends = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: last7Days }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            status: '$status'
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      {
        $sort: { '_id.date': 1 }
      }
    ]);

    // Get top performing agents
    const topAgents = await Transaction.aggregate([
      {
        $match: { status: TRANSACTION_STATUS.APPROVED }
      },
      {
        $group: {
          _id: '$agentId',
          totalTransactions: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      {
        $sort: { totalAmount: -1 }
      },
      {
        $limit: 5
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'agentDetails'
        }
      },
      {
        $unwind: '$agentDetails'
      },
      {
        $project: {
          agentName: '$agentDetails.name',
          totalTransactions: 1,
          totalAmount: 1
        }
      }
    ]);

    // Format amounts from totalAmountStats
    const amountsByStatus = totalAmountStats.reduce((acc, curr) => {
      acc[curr._id.toLowerCase()] = curr.totalAmount;
      return acc;
    }, {});

    return successResponse(res, 'Dashboard statistics fetched successfully', {
      users: {
        total: totalUsers,
        admins: totalAdmins,
        agents: totalAgents,
        customers: totalUsers - totalAdmins - totalAgents
      },
      transactions: {
        total: totalTransactions,
        pending: pendingTransactions,
        approved: approvedTransactions,
        rejected: rejectedTransactions
      },
      amounts: {
        total: amountsByStatus.approved || 0,
        pending: amountsByStatus.pending || 0,
        rejected: amountsByStatus.rejected || 0
      },
      trends: {
        daily: dailyTrends
      },
      topAgents
    }, STATUS_CODES.OK);
  } catch (error) {
    return errorResponse(res, error.message, {}, STATUS_CODES.SERVER_ERROR);
  }
};

module.exports = {
  getDashboardStats
}; 