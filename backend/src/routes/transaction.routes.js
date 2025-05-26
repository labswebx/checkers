const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth.middleware');
const Transaction = require('../models/transaction.model');
const transactionService = require('../services/transaction.service');
const { successResponse, errorResponse } = require('../utils/response.util');
const { STATUS_CODES } = require('../constants');
const logger = require('../utils/logger.util');

// Get deposits with filters and pagination
router.get('/deposits', auth, async (req, res) => {
  try {
    const {
      search,
      status,
      startDate,
      endDate,
      amountRange,
      page = 1,
      limit = 10
    } = req.query;

    // Build query
    const query = { type: 'deposit' };

    // Add filters
    if (search) {
      query.$or = [
        { transactionId: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { utr: { $regex: search, $options: 'i' } },
        { franchise: { $regex: search, $options: 'i' } }
      ];
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    // Add amount range filter
    if (amountRange && amountRange !== 'all') {
      const [min, max] = amountRange.split('-').map(Number);
      if (max === 'above') {
        query.amount = { $gte: min };
      } else {
        query.amount = { $gte: min, $lte: max };
      }
    }

    if (startDate || endDate) {
      query.requestedAt = {};
      if (startDate) query.requestedAt.$gte = new Date(startDate);
      if (endDate) query.requestedAt.$lte = new Date(endDate);
    }

    // Get total count for pagination (before applying limit/skip)
    const totalRecords = await Transaction.countDocuments(query);
    const totalPages = Math.ceil(totalRecords / limit);

    // Get paginated results
    const deposits = await Transaction.find(query)
      .sort({ requestedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('agentId', 'name email franchise');

    logger.info('Deposits fetched successfully', {
      filters: { search, status, startDate, endDate, amountRange },
      pagination: { page, limit, totalRecords, totalPages }
    });

    return successResponse(res, 'Deposits fetched successfully', {
      data: deposits,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages,
      totalRecords
    });
  } catch (error) {
    logger.error('Error fetching deposits:', error);
    return errorResponse(res, 'Error fetching deposits', error, STATUS_CODES.INTERNAL_SERVER_ERROR);
  }
});

// Get status update time statistics
router.get('/status-update-stats', auth, async (req, res) => {
  try {
    const stats = await transactionService.getStatusUpdateStats();
    return successResponse(res, 'Status update statistics fetched successfully', stats);
  } catch (error) {
    logger.error('Error fetching status update statistics:', error);
    return errorResponse(res, 'Error fetching status update statistics', error, STATUS_CODES.SERVER_ERROR);
  }
});

module.exports = router; 