const transactionService = require("../services/transaction.service");
const { successResponse, errorResponse } = require("../utils/response.util");
const { STATUS_CODES } = require("../constants");
const logger = require("../utils/logger.util");


const validatePaginationParams = (page, limit) => {
  const parsedPage = parseInt(page);
  const parsedLimit = parseInt(limit);
  if (isNaN(parsedPage) || parsedPage <= 0) {
    return { error: 'Invalid page number', status: STATUS_CODES.BAD_REQUEST };
  }
  if (isNaN(parsedLimit) || parsedLimit <= 0) {
    return { error: 'Invalid limit number', status: STATUS_CODES.BAD_REQUEST };
  }
  return { page: parsedPage, limit: parsedLimit };
};

/**
 * Controller for fetching deposits.
 * Handles request parsing and delegates to service.
 */
exports.getDeposits = async (req, res) => {
  try {
    // 1. Basic param validation
    const pagination = validatePaginationParams(req.query.page, req.query.limit);
    if (pagination.error) {
      return errorResponse(res, pagination.error, null, pagination.status);
    }

    const { search, status, timeSlab, franchise } = req.query;

    // 2. Call the service layer
    const responseData = await transactionService.fetchDeposits({
      search,
      status,
      timeSlab,
      franchise,
      page: pagination.page || 1,
      limit: pagination.limit || 10,
    });

    // 3. Send success response
    return successResponse(res, "Deposits fetched successfully", responseData);

  } catch (error) {
    logger.error("Error in getDeposits controller:", error);
    return errorResponse(
      res,
      "Error fetching deposits",
      error.message || "Internal Server Error", // More specific error message if available
      error.statusCode || STATUS_CODES.SERVER_ERROR // Custom error status if service throws
    );
  }
};

/**
 * Controller for fetching withdraws.
 * Handles request parsing and delegates to service.
 */
exports.getWithdraws = async (req, res) => {
  try {
    // 1. Basic param validation
    const pagination = validatePaginationParams(req.query.page, req.query.limit);
    if (pagination.error) {
      return errorResponse(res, pagination.error, null, pagination.status);
    }

    const { search, status, timeSlab, franchise } = req.query;

    // 2. Call the service layer
    const responseData = await transactionService.fetchWithdraws({
      search,
      status,
      timeSlab,
      franchise,
      page: pagination.page || 1,
      limit: pagination.limit || 10,
    });

    // 3. Send success response
    return successResponse(res, "Withdraws fetched successfully", responseData);

  } catch (error) {
    logger.error("Error in getWithdraws controller:", error);
    return errorResponse(
      res,
      "Error fetching withdraws",
      error.message || "Internal Server Error",
      error.statusCode || STATUS_CODES.SERVER_ERROR
    );
  }
};

/**
 * Controller for fetching status update statistics.
 */
exports.getStatusUpdateStats = async (req, res) => {
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
};

/**
 * Controller for fetching all franchises.
 */
exports.getFranchises = async (req, res) => {
  try {
    const franchises = await transactionService.getAllFranchises();

    return successResponse(
      res,
      "Franchises fetched successfully",
      franchises
    );
  } catch (error) {
    logger.error("Error in getFranchises controller:", error.message, error.stack);
    return errorResponse(
      res,
      "Error fetching franchises",
      null,
      error.statusCode || STATUS_CODES.SERVER_ERROR
    );
  }
};

/**
 * Controller for fetching withdraw analysis time statistics.
 */
exports.getWithdrawAnalysisStats = async (req, res) => {
  try {
    const {
      status,
      timeFrame,
      startDate,
      endDate,
      timeField = "approvedOn", // Default value for timeField
    } = req.query;

    // Basic validation
    if (!status || !timeFrame) {
        return errorResponse(res, "Status and timeFrame are required.", null, STATUS_CODES.BAD_REQUEST);
    }
    if (timeFrame === "custom" && (!startDate || !endDate)) {
        return errorResponse(res, "startDate and endDate are required for custom timeFrame.", null, STATUS_CODES.BAD_REQUEST);
    }

    const filters = {
        status,
        timeFrame,
        startDate: timeFrame === "custom" ? startDate : undefined,
        endDate: timeFrame === "custom" ? endDate : undefined,
    };

    const stats = await transactionService.getWithdrawAnalysisStats(filters, timeField);

    return successResponse(
      res,
      "Withdraw analysis statistics fetched successfully",
      stats
    );
  } catch (error) {
    logger.error("Error in getWithdrawAnalysisStats controller:", error.message, error.stack);
    return errorResponse(
      res,
      "Error fetching withdraw analysis statistics",
      null,
      error.statusCode || STATUS_CODES.SERVER_ERROR
    );
  }
};

/**
 * Controller for fetching transcript link by orderId.
 */
exports.getTranscriptLink = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Basic validation for orderId
    if (!orderId) {
        return errorResponse(res, "orderId is required.", null, STATUS_CODES.BAD_REQUEST);
    }

    const transactionData = await transactionService.getTranscriptLink(orderId);

    if (!transactionData) {
      return errorResponse(
        res,
        "Transaction not found",
        null,
        STATUS_CODES.NOT_FOUND
      );
    }

    return successResponse(res, "Transcript link fetched successfully", transactionData);
  } catch (error) {
    logger.error("Error in getTranscriptLink controller:", error.message, error.stack);
    return errorResponse(
      res,
      "Error fetching transcript link",
      null,
      error.statusCode || STATUS_CODES.SERVER_ERROR
    );
  }
};