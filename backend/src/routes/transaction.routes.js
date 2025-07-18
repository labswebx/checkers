const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth.middleware");
const Transaction = require("../models/transaction.model");
const User = require("../models/user.model");
const transactionService = require("../services/transaction.service");
const transactionController = require("../controllers/transaction.controller");
const { successResponse, errorResponse } = require("../utils/response.util");
const { STATUS_CODES, TRANSACTION_STATUS } = require("../constants");
const logger = require("../utils/logger.util");
const { Cache } = require("../utils/cache.util");

const depositsCache = new Cache({ max: 100, ttl: 300 }); // Caching for 5 mins
const withdrawsCache = new Cache({ max: 100, ttl: 300 }); // Caching for 5 mins

// Get deposits with filters and pagination
router.get("/deposits", auth, transactionController.getDeposits);

// Get withdraws with filters and pagination (similar to deposits, but amount < 0)
router.get("/withdraws", auth, transactionController.getWithdraws);

// Get status update time statistics
router.get("/status-update-stats",auth, transactionController.getStatusUpdateStats);

// Get all franchises
router.get("/franchises", auth, transactionController.getFranchises);

// Get withdraw analysis time statistics (custom time slabs)
router.get("/withdraw-analysis-stats", auth, transactionController.getWithdrawAnalysisStats);

// Get transcript link by orderId
router.get("/transcript/:orderId", auth, transactionController.getTranscriptLink);

module.exports = router;
