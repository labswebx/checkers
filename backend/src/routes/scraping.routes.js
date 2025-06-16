const express = require('express');
const router = express.Router();
const { auth, isAdmin } = require('../middleware/auth.middleware');
const scraperUtil = require('../utils/scraper.util');
const logger = require('../utils/logger.util');
const { successResponse, errorResponse } = require('../utils/response.util');
const { STATUS_CODES } = require('../constants');
const Session = require('../models/session.model');

// Test scraping login
router.post('/test-login', auth, isAdmin, async (req, res) => {
  try {
    const { username, password } = req.body;
    const userId = req.user.id;

    if (!username || !password) {
      return errorResponse(res, 'Username and password are required', {}, STATUS_CODES.BAD_REQUEST);
    }
    await scraperUtil.initialize();
    const result = await scraperUtil.login(userId, username, password);
    await scraperUtil.close();
    return successResponse(res, 'Login test successful', result, STATUS_CODES.OK);
  } catch (error) {
    await scraperUtil.close();
    return errorResponse(res, error.message, {}, STATUS_CODES.BAD_REQUEST);
  }
});

// Get deposit approval data
router.get('/deposit-approval', auth, isAdmin, async (req, res) => {
  try {
    await scraperUtil.initialize();
    const userId = req.user.id;
    await scraperUtil.login(
      userId,
      process.env.SCRAPING_USERNAME,
      process.env.SCRAPING_PASSWORD
    );
    
    // Get deposit approval data
    const page = parseInt(req.query.page) || 1;
    const allPages = req.query.allPages === 'true';
    
    let result;
    if (allPages) {
      result = await scraperUtil.getAllDepositApprovalData();
    } else {
      result = await scraperUtil.getDepositApprovalData(page);
    }
    await scraperUtil.close();
    
    return successResponse(res, 'Deposit approval data fetched successfully');
  } catch (error) {
    await scraperUtil.close();
    return errorResponse(res, error.message, {}, STATUS_CODES.BAD_REQUEST);
  }
});

// Check session status
router.get('/session-status', auth, async (req, res) => {
  try {
    const session = await Session.findOne({ userId: req.user.id })
      .sort({ lastUsed: -1 })
      .lean();

    if (!session) {
      return res.json({
        hasSession: false,
        message: 'No active session found'
      });
    }

    const expiryTime = new Date(session.lastUsed);
    expiryTime.setHours(expiryTime.getHours() + 6);
    const now = new Date();

    res.json({
      hasSession: true,
      isValid: expiryTime > now,
      session: {
        createdAt: session.createdAt,
        lastUsed: session.lastUsed,
        expiresAt: expiryTime,
        timeRemaining: Math.round((expiryTime - now) / 1000 / 60) + ' minutes',
        cookiesCount: session.cookies.length,
        localStorageCount: session.localStorage.length,
        sessionStorageCount: session.sessionStorage.length
      }
    });
  } catch (error) {
    logger.error('Error checking session status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router; 