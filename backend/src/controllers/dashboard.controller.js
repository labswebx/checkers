const User = require("../models/user.model");
const Transaction = require("../models/transaction.model");
const { successResponse, errorResponse } = require("../utils/response.util");
const {
  STATUS_CODES,
  USER_ROLES,
  TRANSACTION_STATUS,
} = require("../constants");

/**
 * Get dashboard statistics
 * @route GET /api/dashboard/stats
 * @access Private
 */
const getDashboardStats = async (req, res) => {
  try {
    // Calculate today's starting point (midnight)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // Get user statistics
    const totalUsers = await User.countDocuments({ isActive: true });
    const totalAdmins = await User.countDocuments({
      role: USER_ROLES.ADMIN,
      isActive: true,
    });
    const totalAgents = await User.countDocuments({
      role: USER_ROLES.AGENT,
      isActive: true,
    });

    // Get transaction statistics for last 24 hours
    const totalTransactions = await Transaction.countDocuments({
      requestDate: { $gte: todayStart, $lte: endOfToday },
    });
    const pendingTransactions = await Transaction.countDocuments({
      transactionStatus: TRANSACTION_STATUS.PENDING,
      requestDate: { $gte: todayStart, $lte: endOfToday },
      amount: { $gte: 0 },
    });
    const approvedTransactions = await Transaction.countDocuments({
      transactionStatus: TRANSACTION_STATUS.SUCCESS,
      requestDate: { $gte: todayStart, $lte: endOfToday },
      amount: { $gte: 0 },
    });
    const rejectedTransactions = await Transaction.countDocuments({
      transactionStatus: TRANSACTION_STATUS.REJECTED,
      requestDate: { $gte: todayStart, $lte: endOfToday },
      amount: { $gte: 0 },
    });

    // Get withdrawal statistics for last 24 hours
    const totalWithdraws = await Transaction.countDocuments({
      requestDate: { $gte: todayStart, $lte: endOfToday },
      amount: { $lt: 0 },
    });
    const pendingWithdraws = await Transaction.countDocuments({
      transactionStatus: TRANSACTION_STATUS.PENDING,
      requestDate: { $gte: todayStart, $lte: endOfToday },
      amount: { $lt: 0 },
    });
    const approvedWithdraws = await Transaction.countDocuments({
      transactionStatus: TRANSACTION_STATUS.SUCCESS,
      requestDate: { $gte: todayStart, $lte: endOfToday },
      amount: { $lt: 0 },
    });
    const rejectedWithdraws = await Transaction.countDocuments({
      transactionStatus: TRANSACTION_STATUS.REJECTED,
      requestDate: { $gte: todayStart, $lte: endOfToday },
      amount: { $lt: 0 },
    });

    // Calculate total amounts for last 24 hours
    const totalAmountStats = await Transaction.aggregate([
      {
        $match: {
          requestDate: { $gte: todayStart, $lte: endOfToday },
          amount: { $gte: 0 },
        },
      },
      {
        $group: {
          _id: "$transactionStatus",
          totalAmount: { $sum: { $toDouble: "$amount" } },
        },
      },
    ]);

    // Calculate total withdrawal amounts for last 24 hours
    const withdrawAmountStats = await Transaction.aggregate([
      {
        $match: {
          requestDate: { $gte: todayStart, $lte: endOfToday },
          amount: { $lt: 0 },
        },
      },
      {
        $group: {
          _id: "$transactionStatus",
          totalAmount: { $sum: { $toDouble: "$amount" } },
        },
      },
    ]);

    // Get hourly trends for last 24 hours
    const hourlyTrends = await Transaction.aggregate([
      {
        $match: {
          requestDate: { $gte: todayStart, $lte: endOfToday },
        },
      },
      {
        $group: {
          _id: {
            hour: {
              $dateToString: { format: "%Y-%m-%d %H:00", date: "$createdAt" },
            },
            status: "$transactionStatus",
          },
          count: { $sum: 1 },
          totalAmount: { $sum: { $toDouble: "$amount" } },
        },
      },
      {
        $sort: { "_id.hour": 1 },
      },
    ]);

    // Get top performing agents in last 24 hours
    const topAgents = await Transaction.aggregate([
      {
        $match: {
          transactionStatus: TRANSACTION_STATUS.SUCCESS,
          requestDate: { $gte: todayStart, $lte: endOfToday },
        },
      },
      {
        $group: {
          _id: "$agentId",
          totalTransactions: { $sum: 1 },
          totalAmount: { $sum: { $toDouble: "$amount" } },
        },
      },
      {
        $sort: { totalAmount: -1 },
      },
      {
        $limit: 5,
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "agentDetails",
        },
      },
      {
        $unwind: "$agentDetails",
      },
      {
        $project: {
          agentName: "$agentDetails.name",
          totalTransactions: 1,
          totalAmount: 1,
        },
      },
    ]);

    // Format amounts from totalAmountStats
    const amountsByStatus = totalAmountStats.reduce((acc, curr) => {
      acc[curr._id.toLowerCase()] = curr.totalAmount;
      return acc;
    }, {});

    // Format amounts from withdrawAmountStats
    const withdrawAmountsByStatus = withdrawAmountStats.reduce((acc, curr) => {
      acc[curr._id.toLowerCase()] = curr.totalAmount;
      return acc;
    }, {});

    return successResponse(
      res,
      "Dashboard statistics fetched successfully",
      {
        users: {
          total: totalUsers,
          admins: totalAdmins,
          agents: totalAgents,
          customers: totalUsers - totalAdmins - totalAgents,
        },
        transactions: {
          total: totalTransactions,
          pending: pendingTransactions,
          approved: approvedTransactions,
          rejected: rejectedTransactions,
        },
        amounts: {
          total: amountsByStatus.success || 0,
          pending: amountsByStatus.pending || 0,
          rejected: amountsByStatus.rejected || 0,
        },
        withdraws: {
          total: totalWithdraws,
          pending: pendingWithdraws,
          approved: approvedWithdraws,
          rejected: rejectedWithdraws,
        },
        withdrawAmounts: {
          total: Math.abs(withdrawAmountsByStatus.success || 0),
          pending: Math.abs(withdrawAmountsByStatus.pending || 0),
          rejected: Math.abs(withdrawAmountsByStatus.rejected || 0),
        },
        trends: {
          hourly: hourlyTrends,
        },
        topAgents,
      },
      STATUS_CODES.OK
    );
  } catch (error) {
    return errorResponse(res, error.message, {}, STATUS_CODES.SERVER_ERROR);
  }
};

module.exports = {
  getDashboardStats,
};
