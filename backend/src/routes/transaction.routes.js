const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth.middleware");
const transactionController = require("../controllers/transaction.controller");

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
