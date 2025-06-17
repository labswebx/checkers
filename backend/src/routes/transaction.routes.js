const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth.middleware');
const Transaction = require('../models/transaction.model');
const transactionService = require('../services/transaction.service');
const { successResponse, errorResponse } = require('../utils/response.util');
const { STATUS_CODES, TRANSACTION_STATUS } = require('../constants');
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
      franchise,
      page = 1,
      limit = 10
    } = req.query;
    const matchStage = {
      amount: { $gte: 0 }
    };

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    matchStage.requestDate = { $gte: twentyFourHoursAgo };
    matchStage.transactionStatus = status || TRANSACTION_STATUS.PENDING;

    if (franchise && franchise !== 'all') {
      matchStage.franchiseName = franchise;
    }

    if (timeSlab && timeSlab !== 'all') {
      const range = TIME_SLABS.find(slab => slab.label === timeSlab);
      if (range) {
        matchStage.$expr = {
          $let: {
            vars: {
              timeDiffMinutes: {
                $divide: [
                  { $subtract: [new Date(), '$requestDate'] },
                  60 * 1000 // Convert ms to minutes
                ]
              }
            },
            in: range.max
              ? {
                  $and: [
                    { $gte: ['$$timeDiffMinutes', range.min] },
                    { $lt: ['$$timeDiffMinutes', range.max] }
                  ]
                }
              : { $gte: ['$$timeDiffMinutes', range.min] }
          }
        };
      }
    }

    // Use text search if search parameter is provided
    if (search) {
      matchStage.$text = { $search: search };
    }

    let timeSlabCounts = [];
    const timeSlabPipeline = [
      {
        $match: {
          ...matchStage
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          timeSlabs: {
            $push: {
              $switch: {
                branches: [
                  {
                    case: { $lte: [{ $subtract: [new Date(), '$requestDate'] }, 2 * 60 * 1000] },
                    then: '0-2'
                  },
                  {
                    case: { $lte: [{ $subtract: [new Date(), '$requestDate'] }, 5 * 60 * 1000] },
                    then: '2-5'
                  },
                  {
                    case: { $lte: [{ $subtract: [new Date(), '$requestDate'] }, 8 * 60 * 1000] },
                    then: '5-8'
                  },
                  {
                    case: { $lte: [{ $subtract: [new Date(), '$requestDate'] }, 12 * 60 * 1000] },
                    then: '8-12'
                  },
                  {
                    case: { $lte: [{ $subtract: [new Date(), '$requestDate'] }, 20 * 60 * 1000] },
                    then: '12-20'
                  }
                ],
                default: '20-above'
              }
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          total: 1,
          timeSlabs: 1
        }
      }
    ];

    const timeSlabResult = await Transaction.aggregate(timeSlabPipeline);
    if (timeSlabResult.length > 0) {
      const timeSlabCountsMap = timeSlabResult[0].timeSlabs.reduce((acc, slab) => {
        acc[slab] = (acc[slab] || 0) + 1;
        return acc;
      }, {});

      timeSlabCounts = TIME_SLABS.map(slab => ({
        label: slab.label,
        count: timeSlabCountsMap[slab.label] || 0
      }));
    }

    // Main aggregation pipeline for deposits
    const pipeline = [
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          metadata: [
            { $count: 'total' },
            {
              $addFields: {
                page: parseInt(page),
                limit: parseInt(limit)
              }
            }
          ],
          data: [
            { $skip: (parseInt(page) - 1) * parseInt(limit) },
            { $limit: parseInt(limit) },
            {
              $lookup: {
                from: 'users',
                let: { franchiseName: { $arrayElemAt: [{ $split: ['$franchiseName', ' ('] }, 0] } },
                pipeline: [
                  {
                    $match: {
                      $expr: { $eq: ['$name', '$$franchiseName'] }
                    }
                  },
                  {
                    $project: {
                      name: 1,
                      email: 1,
                      contactNumber: 1,
                      role: 1,
                      franchise: 1
                    }
                  }
                ],
                as: 'agentDetails'
              }
            },
            {
              $addFields: {
                agentId: {
                  $cond: {
                    if: { $gt: [{ $size: '$agentDetails' }, 0] },
                    then: { $arrayElemAt: ['$agentDetails', 0] },
                    else: {
                      name: '',
                      email: '',
                      contactNumber: '',
                      role: '',
                      franchise: ''
                    }
                  }
                }
              }
            },
            {
              $project: {
                _id: 1,
                orderId: 1,
                customerName: '$name',
                amount: 1,
                utr: 1,
                requestDate: 1,
                approvedOn: 1,
                status: '$transactionStatus',
                franchise: '$franchiseName',
                createdAt: 1,
                transcriptLink: 1,
                agentId: 1
              }
            }
          ]
        }
      }
    ];

    const [result] = await Transaction.aggregate(pipeline);
    const { metadata, data } = result;
    const totalRecords = metadata[0]?.total || 0;
    const totalPages = Math.ceil(totalRecords / parseInt(limit));

    return successResponse(res, 'Deposits fetched successfully', {
      data,
      timeSlabCounts,
      page: parseInt(page),
      limit: parseInt(limit),
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

// Get all franchises
router.get('/franchises', auth, async (req, res) => {
  try {
    // Get unique franchises from transactions
    const franchises = await Transaction.distinct('franchiseName');
    
    // Clean and sort franchises
    const cleanedFranchises = franchises
      .filter(f => f) // Remove null/empty values
      .map(f => ({
        name: f.split(' (')[0], // Remove anything in parentheses
        fullName: f
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return successResponse(res, 'Franchises fetched successfully', cleanedFranchises);
  } catch (error) {
    logger.error('Error in /franchises endpoint:', error);
    return errorResponse(res, 'Error fetching franchises', error, STATUS_CODES.INTERNAL_SERVER_ERROR);
  }
});

module.exports = router; 