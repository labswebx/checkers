const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth.middleware");
const Transaction = require("../models/transaction.model");
const transactionService = require("../services/transaction.service");
const { successResponse, errorResponse } = require("../utils/response.util");
const { STATUS_CODES, TRANSACTION_STATUS } = require("../constants");
const logger = require("../utils/logger.util");
const Cache = require("../utils/cache.util");

// Time slab configurations
const TIME_SLABS = [
  { min: 2, max: 5, label: "2-5" },
  { min: 5, max: 8, label: "5-8" },
  { min: 8, max: 12, label: "8-12" },
  { min: 12, max: 20, label: "12-20" },
  { min: 20, max: "above", label: "20-above" },
];

// Time slab configurations for withdraws
const WITHDRAW_TIME_SLABS = [
  { min: 20, max: 30, label: "20-30" },
  { min: 30, max: 45, label: "30-45" },
  { min: 45, max: 60, label: "45-60" },
  { min: 60, max: "above", label: "60-above" },
];

const depositsCache = new Cache({ max: 100, ttl: 300 }); // Caching for 5 mins

// Get deposits with filters and pagination
router.get("/deposits", auth, async (req, res) => {
  try {
    const {
      search,
      status,
      timeSlab,
      franchise,
      page = 1,
      limit = 10,
    } = req.query;
    const matchStage = {
      amount: { $gte: 0 },
    };

    let CACHE_KEYS = {};
    const BASE_CACHE_KEY = `DEPOSITS_${(status || TRANSACTION_STATUS.PENDING).toUpperCase()}_${page}_${limit}_${timeSlab || 'all'}_${franchise || 'all'}`;
    CACHE_KEYS[`${BASE_CACHE_KEY}_DATA`] = `${BASE_CACHE_KEY}_DATA`;
    CACHE_KEYS[
      `${BASE_CACHE_KEY}_TIME_SLABS_COUNT`
    ] = `${BASE_CACHE_KEY}_TIME_SLABS_COUNT`;
    CACHE_KEYS[
      `${BASE_CACHE_KEY}_TOTAL_PAGES`
    ] = `${BASE_CACHE_KEY}_TOTAL_PAGES`;
    CACHE_KEYS[
      `${BASE_CACHE_KEY}_TOTAL_RECORDS`
    ] = `${BASE_CACHE_KEY}_TOTAL_RECORDS`;

    // Don't use caching in case of Pending Status because it gets updated every 10-15 seconds.
    // If status is Success or Rejected, then use the response from Cache
    // Also don't cache search results
    if (status !== TRANSACTION_STATUS.PENDING && !search) {
      let allCached = true;
      let cacheResponse = {};
      for (const key in CACHE_KEYS) {
        const cached = depositsCache.get(key);
        if (cached) {
          cacheResponse[key] = cached;
        } else {
          allCached = false;
          break;
        }
      }
      if (allCached) {
        // All required cache keys are present
        return successResponse(res, "Deposits fetched successfully (cache)", {
          data: cacheResponse[CACHE_KEYS[`${BASE_CACHE_KEY}_DATA`]],
          timeSlabCounts:
            cacheResponse[CACHE_KEYS[`${BASE_CACHE_KEY}_TIME_SLABS_COUNT`]],
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages:
            cacheResponse[CACHE_KEYS[`${BASE_CACHE_KEY}_TOTAL_PAGES`]],
          totalRecords:
            cacheResponse[CACHE_KEYS[`${BASE_CACHE_KEY}_TOTAL_RECORDS`]],
        });
      }
    }

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    matchStage.requestDate = { $gte: twentyFourHoursAgo };
    matchStage.transactionStatus = status || TRANSACTION_STATUS.PENDING;

    if (franchise && franchise !== "all") {
      matchStage.franchiseName = franchise;
    }

    if (timeSlab && timeSlab !== "all") {
      const range = TIME_SLABS.find((slab) => slab.label === timeSlab);
      if (range) {
        matchStage.$expr = {
          $let: {
            vars: {
              timeDiffMinutes: {
                $divide: [
                  {
                    $switch: {
                      branches: [
                        {
                          case: {
                            $and: [
                              {
                                $eq: [
                                  "$transactionStatus",
                                  TRANSACTION_STATUS.SUCCESS,
                                ],
                              },
                              { $ne: ["$approvedOn", null] },
                            ],
                          },
                          then: { $subtract: ["$approvedOn", "$requestDate"] },
                        },
                        {
                          case: {
                            $and: [
                              {
                                $eq: [
                                  "$transactionStatus",
                                  TRANSACTION_STATUS.REJECTED,
                                ],
                              },
                              { $ne: ["$approvedOn", null] },
                            ],
                          },
                          then: { $subtract: ["$approvedOn", "$requestDate"] },
                        },
                      ],
                      default: { $subtract: [new Date(), "$requestDate"] },
                    },
                  },
                  60 * 1000, // ms to minutes
                ],
              },
            },
            in: range.max
              ? {
                  $and: [
                    { $gte: ["$$timeDiffMinutes", range.min] },
                    { $lt: ["$$timeDiffMinutes", range.max] },
                  ],
                }
              : { $gte: ["$$timeDiffMinutes", range.min] },
          },
        };
      }
    }

    // Use regex search if search parameter is provided
    if (search) {
      matchStage.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { utr: { $regex: search, $options: 'i' } }
      ];
    }

    let timeSlabCounts = [];
    // Optimization: Use a reusable $addFields stage for time difference and minutes
    const statusTimeDiffAddFields = {
      $addFields: {
        currentTime: "$$NOW",
        timeDifference: {
          $switch: {
            branches: [
              {
                case: {
                  $and: [
                    { $eq: ["$transactionStatus", TRANSACTION_STATUS.SUCCESS] },
                    { $ne: ["$approvedOn", null] },
                  ],
                },
                then: { $subtract: ["$approvedOn", "$requestDate"] },
              },
              {
                case: {
                  $and: [
                    {
                      $eq: ["$transactionStatus", TRANSACTION_STATUS.REJECTED],
                    },
                    { $ne: ["$approvedOn", null] },
                  ],
                },
                then: { $subtract: ["$approvedOn", "$requestDate"] },
              },
            ],
            default: { $subtract: ["$$NOW", "$requestDate"] },
          },
        },
        minutes: {
          $divide: [
            {
              $switch: {
                branches: [
                  {
                    case: {
                      $and: [
                        {
                          $eq: [
                            "$transactionStatus",
                            TRANSACTION_STATUS.SUCCESS,
                          ],
                        },
                        { $ne: ["$approvedOn", null] },
                      ],
                    },
                    then: { $subtract: ["$approvedOn", "$requestDate"] },
                  },
                  {
                    case: {
                      $and: [
                        {
                          $eq: [
                            "$transactionStatus",
                            TRANSACTION_STATUS.REJECTED,
                          ],
                        },
                        { $ne: ["$approvedOn", null] },
                      ],
                    },
                    then: { $subtract: ["$approvedOn", "$requestDate"] },
                  },
                ],
                default: { $subtract: ["$$NOW", "$requestDate"] },
              },
            },
            1000 * 60,
          ],
        },
      },
    };

    const timeSlabPipeline = [
      {
        $match: {
          amount: { $gte: 0 },
          requestDate: { $gte: twentyFourHoursAgo },
          transactionStatus: status,
          ...(franchise && franchise !== "all"
            ? { franchiseName: franchise }
            : {}),
          ...(search ? {
            $or: [
              { orderId: { $regex: search, $options: 'i' } },
              { name: { $regex: search, $options: 'i' } },
              { utr: { $regex: search, $options: 'i' } }
            ]
          } : {}),
        },
      },
      statusTimeDiffAddFields,
      {
        $addFields: {
          timeSlab: {
            $switch: {
              branches: [
                {
                  case: {
                    $and: [{ $gte: ["$minutes", 2] }, { $lt: ["$minutes", 5] }],
                  },
                  then: "2-5",
                },
                {
                  case: {
                    $and: [{ $gte: ["$minutes", 5] }, { $lt: ["$minutes", 8] }],
                  },
                  then: "5-8",
                },
                {
                  case: {
                    $and: [
                      { $gte: ["$minutes", 8] },
                      { $lt: ["$minutes", 12] },
                    ],
                  },
                  then: "8-12",
                },
                {
                  case: {
                    $and: [
                      { $gte: ["$minutes", 12] },
                      { $lt: ["$minutes", 20] },
                    ],
                  },
                  then: "12-20",
                },
                {
                  case: { $gte: ["$minutes", 20] },
                  then: "20-above",
                },
              ],
              default: "other",
            },
          },
        },
      },
      {
        $match: {
          timeSlab: { $ne: "other" },
        },
      },
      {
        $addFields: {
          debug: {
            timeDifference: "$timeDifference",
            minutes: "$minutes",
            status: "$transactionStatus",
            requestDate: "$requestDate",
            approvedOn: "$approvedOn",
            rejectedOn: "$rejectedOn",
            timeSlab: "$timeSlab",
          },
        },
      },
      {
        $group: {
          _id: "$timeSlab",
          count: { $sum: 1 },
          samples: {
            $push: {
              minutes: "$minutes",
              status: "$transactionStatus",
              debug: "$debug",
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          label: "$_id",
          count: 1,
          samples: 1,
        },
      },
      {
        $sort: {
          label: 1,
        },
      },
    ];

    timeSlabCounts = await Transaction.aggregate(timeSlabPipeline);

    // Remove samples before sending response
    timeSlabCounts = timeSlabCounts.map(({ samples, ...rest }) => rest);

    // Ensure all time slabs are present with zero counts if missing
    const allTimeSlabs = [
      { label: "2-5", count: 0 },
      { label: "5-8", count: 0 },
      { label: "8-12", count: 0 },
      { label: "12-20", count: 0 },
      { label: "20-above", count: 0 },
    ];

    // Merge existing counts with default slabs
    timeSlabCounts = allTimeSlabs.map((defaultSlab) => {
      const existingSlab = timeSlabCounts.find(
        (ts) => ts.label === defaultSlab.label
      );
      return existingSlab || defaultSlab;
    });

    // Main aggregation pipeline for deposits
    const pipeline = [
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          metadata: [
            { $count: "total" },
            {
              $addFields: {
                page: parseInt(page),
                limit: parseInt(limit),
              },
            },
          ],
          data: [
            { $skip: (parseInt(page) - 1) * parseInt(limit) },
            { $limit: parseInt(limit) },
            {
              $lookup: {
                from: "users",
                let: {
                  franchiseName: {
                    $arrayElemAt: [{ $split: ["$franchiseName", " ("] }, 0],
                  },
                },
                pipeline: [
                  {
                    $match: {
                      $expr: { $eq: ["$name", "$$franchiseName"] },
                    },
                  },
                  {
                    $project: {
                      name: 1,
                      email: 1,
                      contactNumber: 1,
                      role: 1,
                      franchise: 1,
                    },
                  },
                ],
                as: "agentDetails",
              },
            },
            {
              $addFields: {
                agentId: {
                  $cond: {
                    if: { $gt: [{ $size: "$agentDetails" }, 0] },
                    then: { $arrayElemAt: ["$agentDetails", 0] },
                    else: {
                      name: "",
                      email: "",
                      contactNumber: "",
                      role: "",
                      franchise: "",
                    },
                  },
                },
              },
            },
            {
              $project: {
                _id: 1,
                orderId: 1,
                customerName: "$name",
                amount: 1,
                utr: 1,
                requestDate: 1,
                approvedOn: 1,
                status: "$transactionStatus",
                franchise: "$franchiseName",
                createdAt: 1,
                transcriptLink: 1,
                agentId: 1,
              },
            },
          ],
        },
      },
    ];

    const [result] = await Transaction.aggregate(pipeline);
    const { metadata, data } = result;
    const totalRecords = metadata[0]?.total || 0;
    const totalPages = Math.ceil(totalRecords / parseInt(limit));
    const responseData = {
      data,
      timeSlabCounts,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages,
      totalRecords,
    };

    // Update the data in Cache
    if (status !== TRANSACTION_STATUS.PENDING && !search) {
      depositsCache.set(
        CACHE_KEYS[`${BASE_CACHE_KEY}_DATA`],
        responseData.data
      );
      depositsCache.set(
        CACHE_KEYS[`${BASE_CACHE_KEY}_TIME_SLABS_COUNT`],
        responseData.timeSlabCounts
      );
      depositsCache.set(
        CACHE_KEYS[`${BASE_CACHE_KEY}_TOTAL_PAGES`],
        responseData.totalPages
      );
      depositsCache.set(
        CACHE_KEYS[`${BASE_CACHE_KEY}_TOTAL_RECORDS`],
        responseData.totalRecords
      );
    }

    return successResponse(res, "Deposits fetched successfully", responseData);
  } catch (error) {
    logger.error("Error in /deposits endpoint:", error);
    return errorResponse(
      res,
      "Error fetching deposits",
      error,
      STATUS_CODES.INTERNAL_SERVER_ERROR
    );
  }
});

// Get status update time statistics
router.get("/status-update-stats", auth, async (req, res) => {
  try {
    const { status, timeFrame, startDate, endDate } = req.query;

    const filters = { status, timeFrame };

    if (timeFrame === "custom" && startDate && endDate) {
      filters.startDate = startDate;
      filters.endDate = endDate;
    }

    const stats = await transactionService.getStatusUpdateStats(filters);

    return successResponse(
      res,
      "Status update statistics fetched successfully",
      stats
    );
  } catch (error) {
    return errorResponse(
      res,
      "Error fetching status update statistics",
      error,
      STATUS_CODES.SERVER_ERROR
    );
  }
});

// Get all franchises
router.get("/franchises", auth, async (req, res) => {
  try {
    // Get unique franchises from transactions
    const franchises = await Transaction.distinct("franchiseName");

    // Clean and sort franchises
    const cleanedFranchises = franchises
      .filter((f) => f) // Remove null/empty values
      .map((f) => ({
        name: f.split(" (")[0], // Remove anything in parentheses
        fullName: f,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return successResponse(
      res,
      "Franchises fetched successfully",
      cleanedFranchises
    );
  } catch (error) {
    logger.error("Error in /franchises endpoint:", error);
    return errorResponse(
      res,
      "Error fetching franchises",
      error,
      STATUS_CODES.INTERNAL_SERVER_ERROR
    );
  }
});

// Get withdraws with filters and pagination (similar to deposits, but amount < 0)
router.get("/withdraws", auth, async (req, res) => {
  try {
    const {
      search,
      status,
      timeSlab,
      franchise,
      page = 1,
      limit = 10,
    } = req.query;
    const matchStage = {
      amount: { $lt: 0 },
    };

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    matchStage.requestDate = { $gte: twentyFourHoursAgo };
    matchStage.transactionStatus = status || TRANSACTION_STATUS.PENDING;

    if (franchise && franchise !== "all") {
      matchStage.franchiseName = franchise;
    }

    if (timeSlab && timeSlab !== "all") {
      const range = WITHDRAW_TIME_SLABS.find((slab) => slab.label === timeSlab);
      if (range) {
        matchStage.$expr = {
          $let: {
            vars: {
              timeDiffMinutes: {
                $divide: [
                  {
                    $cond: {
                      if: {
                        $eq: ["$transactionStatus", TRANSACTION_STATUS.PENDING],
                      },
                      then: { $subtract: [new Date(), "$requestDate"] },
                      else: {
                        $cond: {
                          if: { $ne: ["$approvedOn", null] },
                          then: { $subtract: ["$approvedOn", "$requestDate"] },
                          else: { $subtract: [new Date(), "$requestDate"] },
                        },
                      },
                    },
                  },
                  60 * 1000, // ms to minutes
                ],
              },
            },
            in: range.max
              ? {
                  $and: [
                    { $gte: ["$$timeDiffMinutes", range.min] },
                    { $lt: ["$$timeDiffMinutes", range.max] },
                  ],
                }
              : { $gte: ["$$timeDiffMinutes", range.min] },
          },
        };
      }
    }

    // Use text search if search parameter is provided
    if (search) {
      matchStage.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { utr: { $regex: search, $options: 'i' } }
      ];
    }

    let timeSlabCounts = [];
    // Optimization: Use a reusable $addFields stage for time difference and minutes
    const statusTimeDiffAddFields = {
      $addFields: {
        currentTime: "$$NOW",
        timeDifference: {
          $cond: {
            if: { $eq: ["$transactionStatus", TRANSACTION_STATUS.PENDING] },
            then: { $subtract: ["$$NOW", "$requestDate"] },
            else: {
              $cond: {
                if: { $ne: ["$approvedOn", null] },
                then: { $subtract: ["$approvedOn", "$requestDate"] },
                else: { $subtract: ["$$NOW", "$requestDate"] },
              },
            },
          },
        },
        minutes: {
          $divide: [
            {
              $cond: {
                if: { $eq: ["$transactionStatus", TRANSACTION_STATUS.PENDING] },
                then: { $subtract: ["$$NOW", "$requestDate"] },
                else: {
                  $cond: {
                    if: { $ne: ["$approvedOn", null] },
                    then: { $subtract: ["$approvedOn", "$requestDate"] },
                    else: { $subtract: ["$$NOW", "$requestDate"] },
                  },
                },
              },
            },
            1000 * 60,
          ],
        },
      },
    };

    const timeSlabPipeline = [
      {
        $match: {
          amount: { $lt: 0 },
          requestDate: { $gte: twentyFourHoursAgo },
          transactionStatus: status,
          ...(franchise && franchise !== "all"
            ? { franchiseName: franchise }
            : {}),
          ...(search ? {
            $or: [
              { orderId: { $regex: search, $options: 'i' } },
              { name: { $regex: search, $options: 'i' } },
              { utr: { $regex: search, $options: 'i' } }
            ]
          } : {}),
        },
      },
      statusTimeDiffAddFields,
      {
        $addFields: {
          timeSlab: {
            $switch: {
              branches: [
                {
                  case: {
                    $and: [
                      { $gte: ["$minutes", 20] },
                      { $lt: ["$minutes", 30] },
                    ],
                  },
                  then: "20-30",
                },
                {
                  case: {
                    $and: [
                      { $gte: ["$minutes", 30] },
                      { $lt: ["$minutes", 45] },
                    ],
                  },
                  then: "30-45",
                },
                {
                  case: {
                    $and: [
                      { $gte: ["$minutes", 45] },
                      { $lt: ["$minutes", 60] },
                    ],
                  },
                  then: "45-60",
                },
                {
                  case: { $gte: ["$minutes", 60] },
                  then: "60-above",
                },
              ],
              default: "other",
            },
          },
        },
      },
      {
        $match: {
          timeSlab: { $ne: "other" },
        },
      },
      {
        $addFields: {
          debug: {
            timeDifference: "$timeDifference",
            minutes: "$minutes",
            status: "$transactionStatus",
            requestDate: "$requestDate",
            approvedOn: "$approvedOn",
            rejectedOn: "$rejectedOn",
            timeSlab: "$timeSlab",
          },
        },
      },
      {
        $group: {
          _id: "$timeSlab",
          count: { $sum: 1 },
          samples: {
            $push: {
              minutes: "$minutes",
              status: "$transactionStatus",
              debug: "$debug",
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          label: "$_id",
          count: 1,
          samples: 1,
        },
      },
      {
        $sort: {
          label: 1,
        },
      },
    ];

    timeSlabCounts = await Transaction.aggregate(timeSlabPipeline);

    // Remove samples before sending response
    timeSlabCounts = timeSlabCounts.map(({ samples, ...rest }) => rest);

    // Ensure all time slabs are present with zero counts if missing
    const allTimeSlabs = [
      { label: "20-30", count: 0 },
      { label: "30-45", count: 0 },
      { label: "45-60", count: 0 },
      { label: "60-above", count: 0 },
    ];

    // Merge existing counts with default slabs
    timeSlabCounts = allTimeSlabs.map((defaultSlab) => {
      const existingSlab = timeSlabCounts.find(
        (ts) => ts.label === defaultSlab.label
      );
      return existingSlab || defaultSlab;
    });

    // Main aggregation pipeline for withdraws
    const pipeline = [
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          metadata: [
            { $count: "total" },
            {
              $addFields: {
                page: parseInt(page),
                limit: parseInt(limit),
              },
            },
          ],
          data: [
            { $skip: (parseInt(page) - 1) * parseInt(limit) },
            { $limit: parseInt(limit) },
            {
              $lookup: {
                from: "users",
                let: {
                  franchiseName: {
                    $arrayElemAt: [{ $split: ["$franchiseName", " ("] }, 0],
                  },
                },
                pipeline: [
                  {
                    $match: {
                      $expr: { $eq: ["$name", "$$franchiseName"] },
                    },
                  },
                  {
                    $project: {
                      name: 1,
                      email: 1,
                      contactNumber: 1,
                      role: 1,
                      franchise: 1,
                    },
                  },
                ],
                as: "agentDetails",
              },
            },
            {
              $addFields: {
                agentId: {
                  $cond: {
                    if: { $gt: [{ $size: "$agentDetails" }, 0] },
                    then: { $arrayElemAt: ["$agentDetails", 0] },
                    else: {
                      name: "",
                      email: "",
                      contactNumber: "",
                      role: "",
                      franchise: "",
                    },
                  },
                },
              },
            },
            {
              $project: {
                _id: 1,
                orderId: 1,
                customerName: "$name",
                amount: 1,
                utr: 1,
                requestDate: 1,
                approvedOn: 1,
                accountNumber: 1,
                bonusIncluded: 1,
                bonusExcluded: 1,
                auditStatus: 1,
                status: "$transactionStatus",
                franchise: "$franchiseName",
                createdAt: 1,
                transcriptLink: 1,
                agentId: 1,
                ifcsCode: "$iban",
                holderName: 1,
                paymentMethod: 1,
                checkingDeptApprovedOn: 1,
                bonusApprovedOn: 1,
              },
            },
          ],
        },
      },
    ];

    const [result] = await Transaction.aggregate(pipeline);
    const { metadata, data } = result;
    const totalRecords = metadata[0]?.total || 0;
    const totalPages = Math.ceil(totalRecords / parseInt(limit));

    return successResponse(res, "Withdraws fetched successfully", {
      data,
      timeSlabCounts,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages,
      totalRecords,
    });
  } catch (error) {
    logger.error("Error in /withdraws endpoint:", error);
    return errorResponse(
      res,
      "Error fetching withdraws",
      error,
      STATUS_CODES.INTERNAL_SERVER_ERROR
    );
  }
});

// Get withdraw analysis time statistics (custom time slabs)
router.get("/withdraw-analysis-stats", auth, async (req, res) => {
  try {
    const {
      status,
      timeFrame,
      startDate,
      endDate,
      timeField = "approvedOn",
    } = req.query;

    const stats = await transactionService.getWithdrawAnalysisStats(
      {
        status,
        timeFrame,
        startDate: timeFrame === "custom" ? startDate : undefined,
        endDate: timeFrame === "custom" ? endDate : undefined,
      },
      timeField
    );
    return successResponse(
      res,
      "Withdraw analysis statistics fetched successfully",
      stats
    );
  } catch (error) {
    return errorResponse(
      res,
      "Error fetching withdraw analysis statistics",
      error,
      STATUS_CODES.SERVER_ERROR
    );
  }
});

module.exports = router;
