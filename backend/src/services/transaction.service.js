const User = require("../models/user.model");
const Transaction = require("../models/transaction.model");
const whatsapp = require("../utils/whatsapp.util");
const logger = require("../utils/logger.util");
const {
  convertToUAETime,
  convertFromUAETime,
} = require("../config/timezone.config");
const { successResponse, errorResponse } = require("../utils/response.util");
const { STATUS_CODES, TRANSACTION_STATUS } = require("../constants");
const { Cache } = require("../utils/cache.util");

class TransactionService {

  constructor() {
    
    this.TIME_SLABS = [
      { min: 2, max: 5, label: "2-5" },
      { min: 5, max: 8, label: "5-8" },
      { min: 8, max: 12, label: "8-12" },
      { min: 12, max: 20, label: "12-20" },
      { min: 20, max: "above", label: "20-above" },
    ];

    // Time slab configurations for withdraws
    this.WITHDRAW_TIME_SLABS = [
      { min: 20, max: 30, label: "20-30" },
      { min: 30, max: 45, label: "30-45" },
      { min: 45, max: 60, label: "45-60" },
      { min: 60, max: "above", label: "60-above" },
    ];

    this.depositsCache = new Cache({ max: 100, ttl: 300 }); // Caching for 5 mins
    this.withdrawsCache = new Cache({ max: 100, ttl: 300 }); // Caching for 5 mins

  }
  /**
   * Process scraped deposit/withdrawal data
   * @param {Array} transactions - Array of scraped transactions
   * @param {string} type - Transaction type ('deposit' or 'withdrawal')
   */
  async processTransactions(transactions, type) {
    try {
      const results = {
        created: 0,
        updated: 0,
        statusChanged: 0,
        failed: 0,
        total: transactions.length,
        errors: [],
      };

      for (const transaction of transactions) {
        try {
          if (!transaction || !transaction.id) {
            results.failed++;
            results.errors.push("Invalid transaction data");
            continue;
          }

          // Find or create agent user
          const agent = await this.findOrCreateAgent(transaction.franchise);

          // Map scraped data to our schema
          const mappedData = this.mapTransactionData(
            transaction,
            type,
            agent._id
          );

          // Validate mapped data
          if (!mappedData.transactionId || !mappedData.status) {
            results.failed++;
            results.errors.push(
              `Invalid mapped data for transaction ${transaction.id}`
            );
            continue;
          }

          // Update or create transaction
          const existingTransaction = await Transaction.findOne({
            transactionId: mappedData.transactionId,
          });

          if (existingTransaction) {
            const updateData = {
              ...mappedData,
              lastScrapedAt: convertToUAETime(new Date()),
            };

            // Only update statusUpdatedAt if status has changed
            if (existingTransaction.status !== mappedData.status) {
              updateData.statusUpdatedAt = convertToUAETime(new Date());
              results.statusChanged++;
            }

            // Update with validation
            const updated = await Transaction.findByIdAndUpdate(
              existingTransaction._id,
              updateData,
              { new: true, runValidators: true }
            );

            if (!updated) {
              results.failed++;
              results.errors.push(
                `Failed to update transaction ${mappedData.transactionId}`
              );
              continue;
            }

            results.updated++;
          } else {
            // Create new transaction with validation
            try {
              await Transaction.create({
                ...mappedData,
                lastScrapedAt: convertToUAETime(new Date()),
                statusUpdatedAt: convertToUAETime(new Date()), // Set initial statusUpdatedAt
              });
              results.created++;
            } catch (createError) {
              results.failed++;
              results.errors.push(
                `Failed to create transaction ${mappedData.transactionId}: ${createError.message}`
              );
              continue;
            }
          }
        } catch (error) {
          logger.error("Error processing transaction:", {
            error: error.message,
            transaction: transaction?.id || "unknown",
          });
          results.failed++;
          results.errors.push(
            `Error processing transaction ${transaction?.id || "unknown"}: ${
              error.message
            }`
          );
        }
      }

      return results;
    } catch (error) {
      logger.error("Error in processTransactions:", error);
      throw error;
    }
  }

  /**
   * Find or create an agent user by franchise name
   * @param {string} franchise - Franchise name
   */
  async findOrCreateAgent(franchise) {
    try {
      // Look for existing agent user with this franchise
      let agent = await User.findOne({
        franchise,
        role: "agent",
        isActive: true,
      });

      if (!agent) {
        // Create new agent user
        agent = await User.create({
          name: franchise,
          email: `${franchise.toLowerCase().replace(/\s+/g, ".")}@agent.com`,
          franchise,
          role: "agent",
          isActive: true,
          password: Math.random().toString(36).slice(-8), // Generate random password
          contactNumber: 1234567891, // Will be updated later
          notificationPreferences: {
            email: true,
            sms: true,
            whatsapp: false,
          },
        });
      }

      return agent;
    } catch (error) {
      logger.error("Error in findOrCreateAgent:", {
        error: error.message,
        franchise,
      });
      throw error;
    }
  }

  /**
   * Map scraped data to our schema
   * @param {Object} data - Raw scraped data
   * @param {string} type - Transaction type
   * @param {string} agentId - Agent ID
   */
  mapTransactionData(data, type, agentId) {
    try {
      // Extract transaction ID from data based on type
      const transactionId =
        type === "deposit"
          ? data.deposit_id || data.id
          : data.withdrawal_id || data.id;

      // Map status
      const status = this.mapStatus(data.status);

      // Parse dates
      const requestedAt = this.parseDate(data.request_date || data.created_at);
      const processedAt = this.parseDate(data.processed_at || data.updated_at);

      // Clean amount string and convert to number
      const amount = parseFloat(String(data.amount).replace(/[₹,]/g, ""));
      if (isNaN(amount)) {
        throw new Error(`Invalid amount: ${data.amount}`);
      }

      return {
        transactionId,
        type,
        agentId,
        status,
        amount,
        customerId: data.id,
        customerName: data.name,
        franchise: data.franchise,
        utr: data.utr,
        bank: data.payment_method,
        requestedAt,
        processedAt,
        remarks: data.remarks,
        metadata: {
          raw: data,
        },
      };
    } catch (error) {
      logger.error("Error mapping transaction data:", {
        error: error.message,
        data,
      });
      throw error;
    }
  }

  /**
   * Map status from scraped data to our schema
   * @param {string} status - Raw status
   */
  mapStatus(status) {
    if (!status) return TRANSACTION_STATUS.PENDING;

    // Convert to lowercase and remove extra spaces
    status = String(status).toLowerCase().trim();

    // Common variations of status text
    const approvedKeywords = [
      "approved",
      "success",
      "completed",
      "done",
      "processed",
    ];
    const rejectedKeywords = [
      "rejected",
      "failed",
      "cancelled",
      "declined",
      "error",
    ];
    const pendingKeywords = [
      "Pending",
      "statuspen",
      "processing",
      "in progress",
      "waiting",
    ];

    // Check for approved status
    if (approvedKeywords.some((keyword) => status.includes(keyword))) {
      return TRANSACTION_STATUS.SUCCESS;
    }

    // Check for rejected status
    if (rejectedKeywords.some((keyword) => status.includes(keyword))) {
      return TRANSACTION_STATUS.REJECTED;
    }

    // Check for pending status
    if (pendingKeywords.some((keyword) => status.includes(keyword))) {
      return TRANSACTION_STATUS.PENDING;
    }

    return TRANSACTION_STATUS.PENDING;
  }

  /**
   * Parse date string to Date object in UAE timezone
   * @param {string} dateStr - Date string to parse
   */
  parseDate(dateStr) {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return convertToUAETime(date);
    } catch (error) {
      logger.error("Error parsing date:", { dateStr, error: error.message });
      return null;
    }
  }

  /**
   * Get transaction statistics
   * @param {Object} query - Query parameters
   */
  async getStats(query = {}) {
    try {
      const stats = await Transaction.aggregate([
        { $match: query },
        {
          $group: {
            _id: {
              type: "$type",
              status: "$status",
            },
            count: { $sum: 1 },
            totalAmount: { $sum: "$amount" },
          },
        },
        {
          $group: {
            _id: "$_id.type",
            stats: {
              $push: {
                status: "$_id.status",
                count: "$count",
                amount: "$totalAmount",
              },
            },
            totalCount: { $sum: "$count" },
            totalAmount: { $sum: "$totalAmount" },
          },
        },
      ]);

      return stats;
    } catch (error) {
      logger.error("Error getting transaction stats:", error);
      throw error;
    }
  }

  async checkPendingTransactions() {
    try {
      // Find transactions that are:
      // 1. In pending status
      // 2. More than 2 minutes old
      // 3. Haven't sent a notification yet (or last notification was more than 30 mins ago)
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

      const pendingTransactions = await Transaction.find({
        status: TRANSACTION_STATUS.PENDING,
        requestedAt: { $lte: twoMinutesAgo },
        $or: [
          { lastNotificationSent: { $exists: false } },
          { lastNotificationSent: { $lte: thirtyMinutesAgo } },
        ],
      }).populate("agentId");

      // Send notifications for each transaction
      for (const transaction of pendingTransactions) {
        if (transaction.agentId && transaction.agentId.contactNumber) {
          try {
            await whatsapp.sendPendingTransactionAlert(
              transaction,
              transaction.agentId
            );

            // Update the lastNotificationSent timestamp
            await Transaction.findByIdAndUpdate(transaction._id, {
              lastNotificationSent: new Date(),
            });
          } catch (error) {}
        }
      }
    } catch (error) {
      logger.error("Error checking pending transactions:", error);
      throw error;
    }
  }

  /**
   * Get status update time statistics with filters
   * @param {Object} filters - Filter parameters
   * @param {string} filters.status - Transaction status filter
   * @param {string} filters.timeFrame - Time frame filter (1h, 3h, 6h, 1d, 3d, 1w, 1m, all)
   */
  async getStatusUpdateStats(filters = {}) {
    try {
      const timeSlabs = [
        { min: 0, max: 2, label: "0-2 minutes" },
        { min: 2, max: 5, label: "2-5 minutes" },
        { min: 5, max: 8, label: "5-8 minutes" },
        { min: 8, max: 12, label: "8-12 minutes" },
        { min: 12, max: 20, label: "12-20 minutes" },
        { min: 20, max: null, label: "Above 20 minutes" },
      ];

      const results = {
        overall: {},
        byAgent: {},
      };

      const baseMatch = {
        amount: { $gte: 0 },
      };

      //  Status filter
      if (filters.status && filters.status !== "all") {
        const statusMap = {
          success: TRANSACTION_STATUS.SUCCESS,
          rejected: TRANSACTION_STATUS.REJECTED,
          pending: TRANSACTION_STATUS.PENDING,
        };
        baseMatch.transactionStatus =
          statusMap[filters.status.toLowerCase()] || filters.status;
      }

      //  Time filtering
      const now = new Date();

      if (
        filters.timeFrame === "custom" &&
        filters.startDate &&
        filters.endDate
      ) {
        // Handle custom date range
        const start = new Date(`${filters.startDate}T00:00:00`);
        const end = new Date(`${filters.endDate}T23:59:59.999`);

        if (isNaN(start.getTime())) throw new Error("Invalid start date");
        if (isNaN(end.getTime())) throw new Error("Invalid end date");

        baseMatch.requestDate = {
          $gte: start,
          $lte: end,
        };
      } else if (filters.timeFrame && filters.timeFrame !== "all") {
        // Handle predefined timeFrame
        let startDate;

        switch (filters.timeFrame) {
          case "1h":
            startDate = new Date(now.getTime() - 1 * 60 * 60 * 1000);
            break;
          case "3h":
            startDate = new Date(now.getTime() - 3 * 60 * 60 * 1000);
            break;
          case "6h":
            startDate = new Date(now.getTime() - 6 * 60 * 60 * 1000);
            break;
          case "1d":
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case "3d":
            startDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
            break;
          case "1w":
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case "1m":
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          default:
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        }

        baseMatch.requestDate = { $gte: startDate };
      }
      //  Loop over time slabs and run aggregation
      for (const slab of timeSlabs) {
        const matchStage = {
          $match: {
            ...baseMatch,
            $expr: {
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
                              then: {
                                $subtract: ["$approvedOn", "$requestDate"],
                              },
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
                              then: {
                                $subtract: ["$approvedOn", "$requestDate"],
                              },
                            },
                          ],
                          default: { $subtract: [new Date(), "$requestDate"] },
                        },
                      },
                      60 * 1000,
                    ],
                  },
                },
                in: slab.max
                  ? {
                      $and: [
                        { $gte: ["$$timeDiffMinutes", slab.min] },
                        { $lt: ["$$timeDiffMinutes", slab.max] },
                      ],
                    }
                  : { $gte: ["$$timeDiffMinutes", slab.min] },
              },
            },
          },
        };

        //  Get overall counts
        const overallCount = await Transaction.aggregate([
          matchStage,
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
            },
          },
        ]);
        results.overall[slab.label] = overallCount[0]?.count || 0;

        //  Get counts grouped by franchise
        const agentStats = await Transaction.aggregate([
          matchStage,
          {
            $group: {
              _id: "$franchiseName",
              count: { $sum: 1 },
            },
          },
          {
            $project: {
              agentName: { $arrayElemAt: [{ $split: ["$_id", " ("] }, 0] },
              franchise: "$_id",
              count: 1,
            },
          },
        ]);

        //  Organize results into final format
        agentStats.forEach((stat) => {
          if (!results.byAgent[stat._id]) {
            results.byAgent[stat._id] = {
              name: stat.agentName,
              franchise: stat.franchise,
              timeSlabs: {},
            };
          }
          results.byAgent[stat._id].timeSlabs[slab.label] = stat.count;
        });
      }

      return results;
    } catch (error) {
      logger.error("Error getting status update stats:", {
        error: error.message,
        stack: error.stack,
        filters,
      });
      throw error;
    }
  }

  async getWithdrawAnalysisStats(filters = {}, timeField) {
    try {
      // Custom time slabs for withdraw analysis
      const timeSlabs =
        timeField === "bonusApprovedOn"
          ? [
              { min: 0, max: 2, label: "0-2 minutes" },
              { min: 2, max: 5, label: "2-5 minutes" },
              { min: 5, max: 8, label: "5-8 minutes" },
              { min: 8, max: 12, label: "8-12 minutes" },
              { min: 12, max: 20, label: "12-20 minutes" },
              { min: 20, max: null, label: "20+ minutes" },
            ]
          : [
              { min: 0, max: 20, label: "0-20 minutes" },
              { min: 20, max: 30, label: "20-30 minutes" },
              { min: 30, max: 45, label: "30-45 minutes" },
              { min: 45, max: 50, label: "45-50 minutes" },
              { min: 50, max: 60, label: "50-60 minutes" },
              { min: 60, max: null, label: "60+ minutes" },
            ];
      // Initialize results object
      const results = {
        overall: {},
        byAgent: {},
      };
      const baseMatch = {
        amount: { $lt: 0 },
      };

      if (filters.status && filters.status !== "all") {
        // Map frontend status to database status
        const statusMap = {
          success: TRANSACTION_STATUS.SUCCESS,
          rejected: TRANSACTION_STATUS.REJECTED,
          pending: TRANSACTION_STATUS.PENDING,
        };
        baseMatch.transactionStatus =
          statusMap[filters.status.toLowerCase()] || filters.status;
      }

      // Time frame filter
      const now = new Date();

      if (
        filters.timeFrame === "custom" &&
        filters.startDate &&
        filters.endDate
      ) {
        // Handle custom date range
        const start = new Date(`${filters.startDate}T00:00:00`);
        const end = new Date(`${filters.endDate}T23:59:59.999`);

        baseMatch.requestDate = {
          $gte: start,
          $lte: end,
        };
      } else if (filters.timeFrame && filters.timeFrame !== "all") {
        // Handle predefined timeFrame
        let startDate;

        switch (filters.timeFrame) {
          case "1h":
            startDate = new Date(now.getTime() - 1 * 60 * 60 * 1000);
            break;
          case "3h":
            startDate = new Date(now.getTime() - 3 * 60 * 60 * 1000);
            break;
          case "6h":
            startDate = new Date(now.getTime() - 6 * 60 * 60 * 1000);
            break;
          case "1d":
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case "3d":
            startDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
            break;
          case "1w":
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case "1m":
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          default:
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        }

        baseMatch.requestDate = { $gte: startDate };
      }

      for (const slab of timeSlabs) {
        const matchStage = {
          $match: {
            ...baseMatch,
            $expr: {
              $let: {
                vars: {
                  timeValue: {
                    $getField: { input: "$$ROOT", field: timeField },
                  },
                  timeDiffMinutes: {
                    $divide: [
                      {
                        $cond: {
                          if: { $ne: [`$${timeField}`, null] },
                          then: {
                            $subtract: [`$${timeField}`, "$requestDate"],
                          },
                          else: { $subtract: ["$$NOW", "$requestDate"] },
                        },
                      },
                      60 * 1000,
                    ],
                  },
                },
                in: slab.max
                  ? {
                      $and: [
                        { $gte: ["$$timeDiffMinutes", slab.min] },
                        { $lt: ["$$timeDiffMinutes", slab.max] },
                      ],
                    }
                  : { $gte: ["$$timeDiffMinutes", slab.min] },
              },
            },
          },
        };
        // Overall count
        const count = await Transaction.countDocuments(matchStage.$match);
        results.overall[slab.label] = count;

        // Agent-wise aggregation by franchiseName
        const agentStats = await Transaction.aggregate([
          matchStage,
          {
            $group: {
              _id: "$franchiseName",
              count: { $sum: 1 },
            },
          },
          {
            $project: {
              agentName: { $arrayElemAt: [{ $split: ["$_id", " ("] }, 0] },
              franchise: "$_id",
              count: 1,
            },
          },
        ]);

        agentStats.forEach((stat) => {
          if (!results.byAgent[stat.franchise]) {
            results.byAgent[stat.franchise] = {
              name: stat.agentName,
              franchise: stat.franchise,
              timeSlabs: {},
            };
          }
          results.byAgent[stat.franchise].timeSlabs[slab.label] = stat.count;
        });
      }
      return results;
    } catch (error) {
      throw error;
    }
  }

  async fetchDeposits({ search, status, timeSlab, franchise, page, limit }) {
    const matchStage = {
      amount: { $gte: 0 },
    };

    let CACHE_KEYS = {};
    const BASE_CACHE_KEY = `DEPOSITS_${(
      status || TRANSACTION_STATUS.PENDING
    ).toUpperCase()}_${page}_${limit}_${timeSlab || "all"}_${
      franchise || "all"
    }`;
    CACHE_KEYS[`${BASE_CACHE_KEY}_DATA`] = `${BASE_CACHE_KEY}_DATA`;
    CACHE_KEYS[
      `${BASE_CACHE_KEY}_this.TIME_SLABS_COUNT`
    ] = `${BASE_CACHE_KEY}_this.TIME_SLABS_COUNT`;
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
        const cached = this.depositsCache.get(key);
        if (cached) {
          cacheResponse[key] = cached;
        } else {
          allCached = false;
          break;
        }
      }
      if (allCached) {
        // All required cache keys are present
        return  {
          data: cacheResponse[CACHE_KEYS[`${BASE_CACHE_KEY}_DATA`]],
          timeSlabCounts:
            cacheResponse[CACHE_KEYS[`${BASE_CACHE_KEY}_this.TIME_SLABS_COUNT`]],
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages:
            cacheResponse[CACHE_KEYS[`${BASE_CACHE_KEY}_TOTAL_PAGES`]],
          totalRecords:
            cacheResponse[CACHE_KEYS[`${BASE_CACHE_KEY}_TOTAL_RECORDS`]],
        }
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
      const range = this.TIME_SLABS.find((slab) => slab.label === timeSlab);
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
        { orderId: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
        { utr: { $regex: search, $options: "i" } },
      ];
    }

    let timeSlabCounts = [];
    // Optimization: Use a reusable $addFields stage for time difference and minutes
    const statusTimeDiffAddFields = {
      $addFields: {
        currentTime: "$$NOW",
        baseDifference: {
          $cond: [
            {
              $and: [
                {
                  $in: [
                    "$transactionStatus",
                    [TRANSACTION_STATUS.SUCCESS, TRANSACTION_STATUS.REJECTED],
                  ],
                },
                { $ne: ["$approvedOn", null] },
              ],
            },
            { $subtract: ["$approvedOn", "$requestDate"] },
            { $subtract: ["$$NOW", "$requestDate"] },
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
          ...(search
            ? {
                $or: [
                  { orderId: { $regex: search, $options: "i" } },
                  { name: { $regex: search, $options: "i" } },
                  { utr: { $regex: search, $options: "i" } },
                ],
              }
            : {}),
        },
      },
      statusTimeDiffAddFields,
      {
        $addFields: {
          minutes: { $divide: ["$baseDifference", 60000] },
        },
      },
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
        $group: {
          _id: "$timeSlab",
          count: { $sum: 1 },
          samples: {
            $push: {
              minutes: "$minutes",
              status: "$transactionStatus",
              requestDate: "$requestDate",
              approvedOn: "$approvedOn",
              rejectedOn: "$rejectedOn",
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
    const total = await Transaction.countDocuments(matchStage);
    const pipeline = [
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: "users",
          localField: "truncatedFranchiseName",
          foreignField: "name",
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
          isImageAvailable: "$isImageAvailable",
          createdAt: 1,
          agentId: 1,
        },
      },
    ];

    const result = await Transaction.aggregate(pipeline);

    const totalRecords = total || 0;
    const totalPages = Math.ceil(totalRecords / parseInt(limit));
    const responseData = {
      data: result,
      timeSlabCounts,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages,
      totalRecords,
    };

    // Update the data in Cache
    if (status !== TRANSACTION_STATUS.PENDING && !search) {
      this.depositsCache.set(
        CACHE_KEYS[`${BASE_CACHE_KEY}_DATA`],
        responseData.data
      );
      this.depositsCache.set(
        CACHE_KEYS[`${BASE_CACHE_KEY}_this.TIME_SLABS_COUNT`],
        responseData.timeSlabCounts
      );
      this.depositsCache.set(
        CACHE_KEYS[`${BASE_CACHE_KEY}_TOTAL_PAGES`],
        responseData.totalPages
      );
      this.depositsCache.set(
        CACHE_KEYS[`${BASE_CACHE_KEY}_TOTAL_RECORDS`],
        responseData.totalRecords
      );
    }

    return responseData;
  } 

  async fetchWithdraws({ search, status, timeSlab, franchise, page, limit }) {
    const matchStage = {
      amount: { $lt: 0 },
    };

    let CACHE_KEYS = {};
    const BASE_CACHE_KEY = `WITHDRAWS_${(
      status || TRANSACTION_STATUS.PENDING
    ).toUpperCase()}_${page}_${limit}_${timeSlab || "all"}_${
      franchise || "all"
    }`;
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
        const cached = this.withdrawsCache.get(key); // Assuming a separate cache for withdraws
        if (cached) {
          cacheResponse[key] = cached;
        } else {
          allCached = false;
          break;
        }
      }
      if (allCached) {
        // All required cache keys are present
        return {
          data: cacheResponse[CACHE_KEYS[`${BASE_CACHE_KEY}_DATA`]],
          timeSlabCounts:
            cacheResponse[CACHE_KEYS[`${BASE_CACHE_KEY}_TIME_SLABS_COUNT`]],
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages:
            cacheResponse[CACHE_KEYS[`${BASE_CACHE_KEY}_TOTAL_PAGES`]],
          totalRecords:
            cacheResponse[CACHE_KEYS[`${BASE_CACHE_KEY}_TOTAL_RECORDS`]],
        }
      }
    }

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    matchStage.requestDate = { $gte: twentyFourHoursAgo };
    matchStage.transactionStatus = status || TRANSACTION_STATUS.PENDING;

    if (franchise && franchise !== "all") {
      matchStage.franchiseName = franchise;
    }

    // Define a reusable expression for time difference calculation
    // This handles Pending, Success (approved), Rejected (approved), and ongoing cases
    const timeDifferenceExpression = {
      $switch: {
        branches: [
          {
            // If transaction is SUCCESS or REJECTED and approvedOn exists
            case: {
              $and: [
                {
                  $in: [
                    "$transactionStatus",
                    [TRANSACTION_STATUS.SUCCESS, TRANSACTION_STATUS.REJECTED],
                  ],
                },
                { $ne: ["$approvedOn", null] },
              ],
            },
            then: { $subtract: ["$approvedOn", "$requestDate"] },
          },
        ],
        // Default: If PENDING or approvedOn doesn't exist for Success/Rejected
        default: { $subtract: ["$$NOW", "$requestDate"] },
      },
    };

    if (timeSlab && timeSlab !== "all") {
      const range = this.WITHDRAW_TIME_SLABS.find((slab) => slab.label === timeSlab);
      if (range) {
        matchStage.$expr = {
          $let: {
            vars: {
              timeDiffMinutes: {
                $divide: [timeDifferenceExpression, 60 * 1000],
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

    if (search) {
      matchStage.$or = [
        { orderId: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
        { utr: { $regex: search, $options: "i" } },
      ];
    }

    const total = await Transaction.countDocuments(matchStage);
    let timeSlabCounts = [];

    // Consolidated reusable $addFields stage for time difference and minutes
    const reusableTimeCalculationStage = {
      $addFields: {
        timeDifference: timeDifferenceExpression, //minutes has been calculated later
      },
    };

    const timeSlabPipeline = [
      {
        $match: {
          amount: { $lt: 0 }, // For withdraws
          requestDate: { $gte: twentyFourHoursAgo },
          transactionStatus: status,
          ...(franchise && franchise !== "all"
            ? { franchiseName: franchise }
            : {}),
          ...(search
            ? {
                $or: [
                  { orderId: { $regex: search, $options: "i" } },
                  { name: { $regex: search, $options: "i" } },
                  { utr: { $regex: search, $options: "i" } },
                ],
              }
            : {}),
        },
      },
      reusableTimeCalculationStage, // Use the reusable stage
      {
        $addFields: {
          minutes: { $divide: ["$timeDifference", 60000] }, // Calculate minutes from timeDifference
        },
      },
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
        $group: {
          _id: "$timeSlab",
          count: { $sum: 1 },
          samples: {
            $push: {
              minutes: "$minutes",
              status: "$transactionStatus",
              requestDate: "$requestDate",
              approvedOn: "$approvedOn",
              rejectedOn: "$rejectedOn",
            },
          }, // Keep samples for debug, remove later
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

    const allWithdrawTimeSlabs = [
      { label: "20-30", count: 0 },
      { label: "30-45", count: 0 },
      { label: "45-60", count: 0 },
      { label: "60-above", count: 0 },
    ];

    timeSlabCounts = await Transaction.aggregate(timeSlabPipeline);

    // Remove samples before sending response
    timeSlabCounts = timeSlabCounts.map(({ samples, ...rest }) => rest);

    // Merge existing counts with default slabs
    timeSlabCounts = allWithdrawTimeSlabs.map((defaultSlab) => {
      const existingSlab = timeSlabCounts.find(
        (ts) => ts.label === defaultSlab.label
      );
      return existingSlab || defaultSlab;
    });
    // Main aggregation pipeline for withdraws
    const pipeline = [
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: "users",
          localField: "truncatedFranchiseName",
          foreignField: "name",
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
          isImageAvailable: "$isImageAvailable",
          agentId: 1,
          ifcsCode: "$iban",
          holderName: 1,
          paymentMethod: 1,
          checkingDeptApprovedOn: 1,
          bonusApprovedOn: 1,
        },
      },
    ];

    const data = await Transaction.aggregate(pipeline);
    const totalRecords = total||0;
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
      this.withdrawsCache.set(
        CACHE_KEYS[`${BASE_CACHE_KEY}_DATA`],
        responseData.data
      );
      this.withdrawsCache.set(
        CACHE_KEYS[`${BASE_CACHE_KEY}_TIME_SLABS_COUNT`],
        responseData.timeSlabCounts
      );
      this.withdrawsCache.set(
        CACHE_KEYS[`${BASE_CACHE_KEY}_TOTAL_PAGES`],
        responseData.totalPages
      );
      this.withdrawsCache.set(
        CACHE_KEYS[`${BASE_CACHE_KEY}_TOTAL_RECORDS`],
        responseData.totalRecords
      );
    }

    return responseData;
  }

  async getAllFranchises(){
    // Get unique franchises from transactions
    const franchises = await Transaction.distinct("franchiseName");
    
    // Clean and sort franchises
    const cleanedFranchises = franchises.filter((f) => f) // Remove null/empty values
          .map((f) => ({
            name: f.split(" (")[0], // Remove anything in parentheses
            fullName: f,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
    
    return cleanedFranchises;
  }

  async getTranscriptLink(orderId) {
    const transaction = await Transaction.findOne({ orderId });
    return {transcriptLink : transaction?.transcriptLink};
  }
}

module.exports = new TransactionService();
