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
  // logger.info('Received test login request', { 
  //   userId: req.user.id,
  //   username: req.body.username 
  // });

  try {
    const { username, password } = req.body;
    const userId = req.user.id;

    if (!username || !password) {
      // logger.warn('Missing credentials in request');
      return errorResponse(res, 'Username and password are required', {}, STATUS_CODES.BAD_REQUEST);
    }

    // logger.debug('Initializing scraper for test login');
    await scraperUtil.initialize();
    
    // logger.info('Attempting test login');
    const result = await scraperUtil.login(userId, username, password);
    
    // Close the browser after testing
    // logger.debug('Test complete, closing browser');
    await scraperUtil.close();

    // logger.info('Test login completed successfully', { success: result.success, data: result.data });
    return successResponse(res, 'Login test successful', result, STATUS_CODES.OK);
  } catch (error) {
    // logger.error('Test login failed:', { 
    //   error: error.message,
    //   stack: error.stack
    // });

    // Ensure browser is closed in case of error
    await scraperUtil.close();
    return errorResponse(res, error.message, {}, STATUS_CODES.BAD_REQUEST);
  }
});

// Get deposit approval data
router.get('/deposit-approval', auth, isAdmin, async (req, res) => {
  logger.info('Received deposit approval data request');

  try {
    // Initialize scraper and login
    logger.debug('Initializing scraper');
    await scraperUtil.initialize();
    
    logger.info('Attempting login');
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
      logger.info('Fetching data from all pages');
      result = await scraperUtil.getAllDepositApprovalData();
    } else {
      logger.info('Fetching data from page', { page });
      result = await scraperUtil.getDepositApprovalData(page);
    }
    
    // Close the browser
    logger.debug('Data fetched, closing browser');
    await scraperUtil.close();

    logger.info('Deposit approval data fetched successfully', { 
      totalRecords: result.data.rows.length,
      page: allPages ? 'all' : page 
    });
    
    return successResponse(res, 'Deposit approval data fetched successfully');
  } catch (error) {
    // logger.error('Failed to fetch deposit approval data:', { 
    //   error: error.message,
    //   stack: error.stack
    // });

    // Ensure browser is closed in case of error
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