const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth.middleware');
const Transaction = require('../models/transaction.model');
const User = require('../models/user.model');
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
      timeSlab,
      page = 1,
      limit = 10
    } = req.query;

    // Build base query
    const baseQuery = {
      amount: { $gte: 0 }  // Only return transactions with non-negative amounts
    };

    // Always add 24 hours filter
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    baseQuery.requestDate = { $gte: twentyFourHoursAgo };

    // Add filters to base query
    if (search) {
      baseQuery.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } },
        { utr: { $regex: search, $options: 'i' } },
        { franchiseName: { $regex: search, $options: 'i' } }
      ];
    }

    if (status && status !== 'all') {
      baseQuery.transactionStatus = status;
    }

    // Calculate time slabs for pending deposits
    let timeSlabCounts = [];
    // if (status === 'Pending') {
      try {
        const slabPromises = TIME_SLABS.map(async (slab) => {
          const slabQuery = { ...baseQuery };
          
          // Special handling for 20+ minutes
          if (slab.max === 'above') {
            const minTime = new Date(now.getTime() - (slab.min * 60 * 1000));
            slabQuery.createdAt = {
              $gte: twentyFourHoursAgo,
              $lte: minTime
            };
          } else {
            const minTime = new Date(now.getTime() - (slab.max * 60 * 1000));
            const maxTime = new Date(now.getTime() - (slab.min * 60 * 1000));
            slabQuery.createdAt = {
              $gte: minTime,
              $lte: maxTime
            };
          }

          const count = await Transaction.countDocuments(slabQuery);
          return {
            label: slab.label,
            count
          };
        });
        
        timeSlabCounts = await Promise.all(slabPromises);
      } catch (error) {
        logger.error('Error calculating time slabs:', error);
        timeSlabCounts = TIME_SLABS.map(slab => ({ label: slab.label, count: 0 }));
      }
    // }

    // Apply time slab filter if specified
    if (timeSlab && timeSlab !== 'all') {
      try {
        const [min, max] = timeSlab.split('-');
        if (max === 'above') {
          // For 20+ minutes, show all transactions older than 20 minutes but within 24 hours
          const minTime = new Date(now.getTime() - (parseInt(min) * 60 * 1000));
          baseQuery.createdAt = {
            $gte: twentyFourHoursAgo,
            $lte: minTime
          };
        } else {
          const minTime = new Date(now.getTime() - (parseInt(max) * 60 * 1000));
          const maxTime = new Date(now.getTime() - (parseInt(min) * 60 * 1000));
          baseQuery.createdAt = {
            $gte: minTime,
            $lte: maxTime
          };
        }
      } catch (error) {
        logger.error('Error applying time slab filter:', error);
      }
    }

    // Get total count for pagination
    const totalRecords = await Transaction.countDocuments(baseQuery);
    const totalPages = Math.ceil(totalRecords / limit);

    // Get paginated results with proper parsing of page and limit
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, parseInt(limit));
    
    const deposits = await Transaction.find(baseQuery)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(); // Use lean() for better performance

    // Get all unique agent IDs
    const franchiseNames = [...new Set(deposits.filter(d => d.franchiseName.split(' (')[0]).map(d => d.franchiseName.split(' (')[0]))];
    
    // Fetch all agents in one query
    const agents = await User.find({ name: { $in: franchiseNames } })
      .select('name email contactNumber role franchise')
      .lean();

    // Create a map of agent details for quick lookup
    const agentMap = agents.reduce((acc, agent) => {
      acc[agent.name.toString()] = agent;
      return acc;
    }, {});

    // Transform the data to match the expected format
    const transformedDeposits = deposits.map(deposit => ({
      _id: deposit._id,
      orderId: deposit.orderId?.toString() || '',
      customerName: deposit.name || '',
      amount: deposit.amount || 0,
      utr: deposit.utr || '',
      status: deposit.transactionStatus,
      franchise: deposit.franchiseName || '',
      createdAt: deposit.createdAt,
      agentId: {
        name: agentMap[deposit.franchiseName.split(' (')[0]]?.name || '',
        email: agentMap[deposit.franchiseName.split(' (')[0]]?.email || '',
        contactNumber: agentMap[deposit.franchiseName.split(' (')[0]]?.contactNumber || '',
        role: agentMap[deposit.franchiseName.split(' (')[0]]?.role || '',
        franchise: agentMap[deposit.franchiseName.split(' (')[0]]?.franchise || ''
      }
    }));

    return successResponse(res, 'Deposits fetched successfully', {
      data: transformedDeposits,
      timeSlabCounts,
      page: pageNum,
      limit: limitNum,
      totalPages,
      totalRecords
    });
  } catch (error) {
    logger.error('Error in /deposits endpoint:', error);
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
    return errorResponse(res, 'Error fetching status update statistics', error, STATUS_CODES.SERVER_ERROR);
  }
});

module.exports = router; 