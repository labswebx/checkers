const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth.middleware');
const Transaction = require('../models/transaction.model');
const transactionService = require('../services/transaction.service');
const { successResponse, errorResponse } = require('../utils/response.util');
const { STATUS_CODES } = require('../constants');
const logger = require('../utils/logger.util');

// Time slab configurations
const TIME_SLABS = [
  { min: 2, max: 5, label: '2-5' },
  { min: 5, max: 8, label: '5-8' },
  { min: 8, max: 12, label: '8-12' },
  { min: 12, max: 20, label: '12-20' },
  { min: 20, max: 'above', label: '20-above' }
];

// Get deposits with filters and pagination
router.get('/deposits', auth, async (req, res) => {
  try {
    const {
      search,
      status,
      startDate,
      endDate,
      amountRange,
      timeSlab,
      page = 1,
      limit = 10
    } = req.query;

    // Build base query
    const baseQuery = { type: 'deposit' };

    // Add filters to base query
    if (search) {
      baseQuery.$or = [
        { transactionId: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { utr: { $regex: search, $options: 'i' } },
        { franchise: { $regex: search, $options: 'i' } }
      ];
    }

    if (status && status !== 'all') {
      baseQuery.status = status;
    }

    if (amountRange && amountRange !== 'all') {
      const [min, max] = amountRange.split('-');
      if (max === 'above') {
        baseQuery.amount = { $gte: Number(min) };
      } else {
        baseQuery.amount = { $gte: Number(min), $lte: Number(max) };
      }
    }

    // Calculate time slab counts using aggregation
    const now = new Date();
    const timeSlabPipeline = [
      { $match: baseQuery },
      {
        $facet: {
          ...TIME_SLABS.reduce((acc, slab) => {
            const slabName = slab.label;
            let timeMatch;

            if (slab.max === 'above') {
              // For 20+ mins
              const timeAgo = new Date(now.getTime() - (slab.min * 60 * 1000));
              timeMatch = {
                createdAt: { $lt: timeAgo }
              };
            } else {
              // For ranges like 2-5 mins
              const maxTimeAgo = new Date(now.getTime() - (slab.min * 60 * 1000));
              const minTimeAgo = new Date(now.getTime() - (slab.max * 60 * 1000));
              timeMatch = {
                createdAt: {
                  $gte: minTimeAgo,
                  $lt: maxTimeAgo
                }
              };
            }

            acc[slabName] = [
              { $match: timeMatch },
              { $count: 'count' }
            ];
            return acc;
          }, {})
        }
      }
    ];

    const [timeSlabResults] = await Transaction.aggregate(timeSlabPipeline);

    // Format time slab counts
    const timeSlabCounts = TIME_SLABS.map(slab => ({
      label: slab.label,
      count: (timeSlabResults[slab.label][0]?.count || 0),
      min: slab.min,
      max: slab.max
    }));

    // Log the counts for debugging
    logger.debug('Time slab counts:', {
      timeSlabCounts,
      baseQuery
    });

    // Add time slab filter for actual results if selected
    if (timeSlab && timeSlab !== 'all') {
      const [min, max] = timeSlab.split('-');
      if (max === 'above') {
        const timeAgo = new Date(now.getTime() - (Number(min) * 60 * 1000));
        baseQuery.createdAt = { $lt: timeAgo };
      } else {
        const maxTimeAgo = new Date(now.getTime() - (Number(min) * 60 * 1000));
        const minTimeAgo = new Date(now.getTime() - (Number(max) * 60 * 1000));
        baseQuery.createdAt = {
          $gte: minTimeAgo,
          $lt: maxTimeAgo
        };
      }
    }

    if (startDate || endDate) {
      baseQuery.requestedAt = {};
      if (startDate) baseQuery.requestedAt.$gte = new Date(startDate);
      if (endDate) baseQuery.requestedAt.$lte = new Date(endDate);
    }

    // Get total count for pagination
    const totalRecords = await Transaction.countDocuments(baseQuery);
    const totalPages = Math.ceil(totalRecords / limit);

    // Get paginated results
    const deposits = await Transaction.find(baseQuery)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('agentId', 'name email franchise');

    logger.info('Deposits fetched successfully', {
      filters: { search, status, startDate, endDate, amountRange, timeSlab },
      pagination: { page, limit, totalRecords, totalPages }
    });

    return successResponse(res, 'Deposits fetched successfully', {
      data: deposits,
      timeSlabCounts,
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
    const { status, timeFrame } = req.query;
    const stats = await transactionService.getStatusUpdateStats({ status, timeFrame });
    return successResponse(res, 'Status update statistics fetched successfully', stats);
  } catch (error) {
    logger.error('Error fetching status update statistics:', error);
    return errorResponse(res, 'Error fetching status update statistics', error, STATUS_CODES.SERVER_ERROR);
  }
});

module.exports = router; 