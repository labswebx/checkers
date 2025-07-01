const puppeteer = require('puppeteer');
const logger = require('./logger.util');
const transactionService = require('../services/transaction.service');
const fs = require('fs');
const Transaction = require('../models/transaction.model');
const Constant = require('../models/constant.model');
const axios = require('axios');
const { TRANSACTION_STATUS } = require('../constants');

class NetworkInterceptor {
  constructor() {
    this.pendingDepositsBrowser = null;
    this.recentDepositsBrowser = null;
    this.rejectedDepositsBrowser = null;
    this.pendingWithdrawlsBrowser = null;
    this.approvedWithdrawalsBrowser = null;
    this.rejectedWithdrawalsBrowser = null;
    this.pendingDepositsPage = null;
    this.recentDepositsPage = null;
    this.rejectedDepositsPage = null;
    this.pendingWithdrawlsPage = null;
    this.approvedWithdrawalsPage = null;
    this.rejectedWithdrawalsPage = null;
    this.isLoggedIn = false;
    this.currentUserId = null;
    this.interceptedRequests = new Map();
    this.interceptedResponses = new Map();
    this.isMonitoring = false;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async retryWithBackoff(operation, maxRetries = 3, initialDelay = 1000) {
    let retries = 0;
    while (retries < maxRetries) {
      try {
        return await operation();
      } catch (error) {
        retries++;
        if (retries === maxRetries) {
          throw error;
        }
        const delay = initialDelay * Math.pow(2, retries - 1);
        await this.sleep(delay);
      }
    }
  }

  async findChromePath() {
    const possiblePaths = [
      process.env.PUPPETEER_EXECUTABLE_PATH,
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/snap/chromium/current/usr/lib/chromium-browser/chrome',
      '/snap/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
    ];

    for (const browserPath of possiblePaths) {
      if (browserPath && fs.existsSync(browserPath)) {
        return browserPath;
      }
    }
    return null;
  }

  async initialize() {
    try {      
      const executablePath = await this.findChromePath();
      if (!executablePath) {
        throw new Error('No valid Chrome installation found');
      }

      // Close existing browser if it exists
      if (this.browser) {
        try {
          await this.browser.close();
        } catch (error) {
        }
        this.browser = null;
        // this.page = null;
      }

      this.browser = await puppeteer.launch({
        headless: 'new',
        executablePath,
        product: 'chrome',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--window-size=1920,1080',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--ignore-certificate-errors',
          '--ignore-certificate-errors-spki-list',
          '--disable-blink-features=AutomationControlled',
          '--disable-infobars',
          '--disable-notifications',
          '--disable-popup-blocking',
          '--disable-extensions',
          '--disable-gpu'
        ],
        defaultViewport: { width: 1920, height: 1080 },
        ignoreHTTPSErrors: true
      });

      // Handle browser disconnection
      this.browser.on('disconnected', () => {
        this.browser = null;
        // this.page = null;
        this.isMonitoring = false;
      });

      return true;
    } catch (error) {
      logger.error('Failed to initialize network interceptor:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  isDepositApprovalResponse(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      
      // Match deposit approval endpoints
      const isMatch = pathname.includes('/admin/deposit/deposit-approval');
      
      logger.debug('URL pattern check:', {
        url,
        pathname,
        isMatch
      });

      return isMatch;
    } catch (error) {
      logger.error('Error checking URL pattern:', {
        url,
        error: error.message
      });
      return false;
    }
  }

  async processDepositResponse(responseData) {
    try {
      if (!responseData) {
        return;
      }

      // Extract transactions from response
      let transactions = [];
      if (Array.isArray(responseData)) {
        transactions = responseData;
      } else if (responseData.data) {
        transactions = Array.isArray(responseData.data) ? responseData.data : responseData.data.rows || [];
      } else if (responseData.rows) {
        transactions = responseData.rows;
      }

      if (!transactions.length) {
        return;
      }

      // Process each transaction
      for (const transaction of transactions) {
        try {
          // Map and store transaction
          const mappedData = await transactionService.mapTransactionData(
            transaction,
            'deposit',
            process.env.ADMIN_USER_ID
          );

          const processResult = await transactionService.processTransactions([mappedData], 'deposit');
        } catch (error) {
          logger.error('Error processing transaction:', {
            transaction: JSON.stringify(transaction).substring(0, 500),
            error: error.message,
            stack: error.stack
          });
        }
      }
    } catch (error) {
      logger.error('Error in deposit response processing:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async navigateWithRetry(url, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
        }

        if (response && response.ok()) {
          return response;
        }
      } catch (error) {
        logger.error(`Navigation attempt ${attempt} failed:`, {
          url,
          error: error.message
        });
        
        if (attempt === maxRetries) {
          throw error;
        }
      }
    }
    throw new Error(`Failed to navigate to ${url} after ${maxRetries} attempts`);
  }

  async ensureLogin() {
    try {
      await this.navigateWithRetry(`${process.env.SCRAPING_WEBSITE_URL}/login`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      logger.error('Login failed:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async monitorPendingDeposits() {
    try {
      // Clean up existing pending deposits browser instance first
      // await this.cleanupPendingDeposits();

      const executablePath = await this.findChromePath();
      this.pendingDepositsBrowser = await puppeteer.launch({
        headless: 'new',
        executablePath,
        product: 'chrome',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--window-size=1920,1080',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--ignore-certificate-errors',
          '--ignore-certificate-errors-spki-list',
          '--disable-blink-features=AutomationControlled',
          '--disable-infobars',
          '--disable-notifications',
          '--disable-popup-blocking',
          '--disable-extensions',
          '--disable-gpu'
        ],
        defaultViewport: { width: 1920, height: 1080 },
        ignoreHTTPSErrors: true
      });

      this.pendingDepositsPage = await this.pendingDepositsBrowser.newPage();

      try {
        // If browser exists but page is closed/crashed, clean up first
        if (this.pendingDepositsBrowser) {
          try {
            const pages = await this.pendingDepositsBrowser.pages();
            if (pages.length === 0 || !this.pendingDepositsPage || this.pendingDepositsPage.isClosed()) {
              // await this.cleanupPendingDeposits();
            }
          } catch (error) {
            // await this.cleanupPendingDeposits();
          }
        }

        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
        
        // Set a longer default timeout
        if (!this.pendingDepositsBrowser) {
          this.pendingDepositsBrowser = await puppeteer.launch({
            headless: 'new',
            executablePath,
            product: 'chrome',
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--window-size=1920,1080',
              '--disable-web-security',
              '--disable-features=IsolateOrigins,site-per-process',
              '--ignore-certificate-errors',
              '--ignore-certificate-errors-spki-list',
              '--disable-blink-features=AutomationControlled',
              '--disable-infobars',
              '--disable-notifications',
              '--disable-popup-blocking',
              '--disable-extensions',
              '--disable-gpu'
            ],
            defaultViewport: { width: 1920, height: 1080 },
            ignoreHTTPSErrors: true
          });
        }
        if (!this.pendingDepositsPage) {
          this.pendingDepositsPage = await this.pendingDepositsBrowser.newPage();
        }
        this.pendingDepositsPage.setDefaultNavigationTimeout(180000); // 3 minutes
        this.pendingDepositsPage.setDefaultTimeout(180000);

        // Add user agent
        await this.pendingDepositsPage.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        await this.pendingDepositsPage.setRequestInterception(true);

        this.pendingDepositsPage.on('request', async (interceptedRequest) => {
          try {
            if (!interceptedRequest.isInterceptResolutionHandled()) {
              await interceptedRequest.continue();
            }
          } catch (error) {
            logger.error('Error handling request:', {
              url: interceptedRequest.url(),
              error: error.message
            });
          }
        });

        this.pendingDepositsPage.on('response', async (interceptedResponse) => {
          let url = interceptedResponse.url();

          // Handle login response
          if (url.includes('/accounts/login')) {
            try {
              const responseData = await interceptedResponse.json();
              if (responseData && responseData.detail.token) {
                // Check if token exists and its age
                const existingToken = await Constant.findOne({ key: 'SCRAPING_AUTH_TOKEN' });
                const fiveHoursFortyMins = 5 * 60 * 60 * 1000 + 40 * 60 * 1000; // 5h40m in milliseconds
                
                if (!existingToken || (Date.now() - existingToken.lastUpdated.getTime()) > fiveHoursFortyMins) {
                  // Store the token in constants collection only if it's older than 5h40m
                  await Constant.findOneAndUpdate(
                    { key: 'SCRAPING_AUTH_TOKEN' },
                    { 
                      value: responseData.detail.token,
                      lastUpdated: new Date()
                    },
                    { upsert: true }
                  );
                }
              }
            } catch (error) {
              logger.error('Error processing login response:', error);
            }
          }

          // Handle deposit list API
          if (url.includes('/accounts/GetListOfRequestsForFranchise')) {
            logger.info('Deposits response - PENDING');
            try {
              const json = await interceptedResponse.json();
              const transactions = Array.isArray(json) ? json : json.data || [];

              // Process transactions and click transcript icons
              for (const transaction of transactions) {
                if (transaction.amount >= 0) {
                  try {
                    await transactionService.findOrCreateAgent(transaction.franchiseName.split(' (')[0]);
  
                    // Create the transaction data object
                    const transactionData = {
                      orderId: transaction.orderID,
                      userId: transaction.userID,
                      userName: transaction.userName,
                      name: transaction.name,
                      statusId: transaction.StatusID,
                      transactionStatus: transaction.transactionStatus,
                      amount: transaction.amount,
                      requestDate: transaction.requestDate, // Convert UTC to IST
                      paymentMethod: transaction.paymentMethod,
                      holderName: transaction.holderName,
                      bankName: transaction.bankName,
                      accountNumber: transaction.number,
                      iban: transaction.iBAN,
                      cardNo: transaction.cardNo,
                      utr: transaction.uTR,
                      approvedOn: transaction.approvedOn,
                      rejectedOn: transaction.rejectedOn,
                      firstDeposit: transaction.firstDeposit,
                      approvedBy: transaction.approvedBy,
                      franchiseName: transaction.franchiseName,
                      remarks: transaction.remarks,
                      bonusIncluded: transaction.bonusIncluded,
                      bonusExcluded: transaction.bonusExcluded,
                      bonusThreshold: transaction.bonusThreshold,
                      lastUpdatedUTROn: transaction.lastUpdatedUTROn,
                      auditStatusId: transaction.auditStatusID,
                      auditStatus: transaction.auditStatus,
                      authorizedUserRemarks: transaction.authorizedUserRemarks,
                      isImageAvailable: transaction.isImageAvailable
                    };
  
                    // Use findOneAndUpdate with upsert option to create or update
                    await Transaction.findOneAndUpdate(
                      { orderId: transaction.orderID }, // find criteria
                      transactionData, // update data
                      {
                        upsert: true, // create if doesn't exist
                        new: true, // return updated doc
                        runValidators: true // run schema validators
                      }
                    );
  
                    await this.fetchTranscript(transaction.orderID);
                  } catch (transactionError) {
                    logger.error('Error processing individual transaction:', {
                      orderId: transaction?.orderID,
                      error: transactionError.message
                    });
                  }
                }
              }
            } catch (err) {
              logger.error('Error processing API response:', {
                url,
                error: err.message
              });
            }
          }
        });

        // Handle browser/page closure
        this.pendingDepositsBrowser.on('disconnected', () => {
          this.isMonitoring = false;
          this.pendingDepositsBrowser = null;
          this.pendingDepositsPage = null;
        });

        this.pendingDepositsPage.on('close', () => {
          this.isMonitoring = false;
          this.pendingDepositsPage = null;
        });

        // Only proceed with login if we're not already on the right page
        if (!this.pendingDepositsPage.url().includes('/admin/deposit/deposit-approval')) {
          // First handle login
          await this.pendingDepositsPage.goto(`${process.env.SCRAPING_WEBSITE_URL}/login`, {
            waitUntil: 'networkidle2',
            timeout: 90000
          });

          // Wait for selectors with increased timeouts
          await this.pendingDepositsPage.waitForSelector('input[type="text"]', { visible: true, timeout: 30000 });
          await this.pendingDepositsPage.waitForSelector('input[type="password"]', { visible: true, timeout: 30000 });

          await this.pendingDepositsPage.type('input[type="text"]', process.env.SCRAPING_USERNAME);
          await this.pendingDepositsPage.type('input[type="password"]', process.env.SCRAPING_PASSWORD);

          const loginButton = await this.pendingDepositsPage.$('button[type="submit"]');
          if (!loginButton) {
            throw new Error('Login button not found');
          }

          // Wait for navigation after login
          await Promise.all([
            this.pendingDepositsPage.waitForNavigation({ 
              waitUntil: 'networkidle2',
              timeout: 90000
            }),
            loginButton.click()
          ]);

          // Wait a bit after login before next navigation
          await new Promise(resolve => setTimeout(resolve, 1500));

          // Then navigate to deposit approval page
          await this.pendingDepositsPage.goto(`${process.env.SCRAPING_WEBSITE_URL}/admin/deposit/deposit-approval`, {
            waitUntil: 'networkidle2',
            timeout: 30000
          });

          try {
            // Wait for table to be visible
            await this.pendingDepositsPage.waitForSelector('table', { timeout: 10000 });
            // Additional wait for API calls and data loading
            await new Promise(resolve => setTimeout(resolve, 5000));
          } catch (error) {
            
          }
        }

        this.isMonitoring = true;
        return { success: true, browser: this.pendingDepositsBrowser, page: this.pendingDepositsPage };
      } catch (error) {
        logger.error('Error monitoring deposit list:', {
          error: error.message,
          stack: error.stack
        });
        // await this.cleanupPendingDeposits();
        throw error;
      }
    } catch (error) {
      logger.error('Error monitoring deposit list:', {
        error: error.message,
        stack: error.stack
      });
      // await this.cleanupPendingDeposits();
      throw error;
    }
  }

  async monitorRecentDeposits() {
    try {
      // Clean up existing recent deposits browser instance first
      await this.cleanupRecentDeposits();

      const executablePath = await this.findChromePath();
      this.recentDepositsBrowser = await puppeteer.launch({
        headless: 'new',
        executablePath,
        product: 'chrome',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--window-size=1920,1080',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--ignore-certificate-errors',
          '--ignore-certificate-errors-spki-list',
          '--disable-blink-features=AutomationControlled',
          '--disable-infobars',
          '--disable-notifications',
          '--disable-popup-blocking',
          '--disable-extensions',
          '--disable-gpu'
        ],
        defaultViewport: { width: 1920, height: 1080 },
        ignoreHTTPSErrors: true
      });
  
      this.recentDepositsPage = await this.recentDepositsBrowser.newPage();
      
      // Set a longer default timeout
      if (!this.recentDepositsBrowser) {
        this.recentDepositsBrowser = await puppeteer.launch({
          headless: 'new',
          executablePath,
          product: 'chrome',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--window-size=1920,1080',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--ignore-certificate-errors',
            '--ignore-certificate-errors-spki-list',
            '--disable-blink-features=AutomationControlled',
            '--disable-infobars',
            '--disable-notifications',
            '--disable-popup-blocking',
            '--disable-extensions',
            '--disable-gpu'
          ],
          defaultViewport: { width: 1920, height: 1080 },
          ignoreHTTPSErrors: true
        });
      }
      if (!this.recentDepositsPage) {
        this.recentDepositsPage = await this.recentDepositsBrowser.newPage();
      }
      this.recentDepositsPage.setDefaultNavigationTimeout(180000); // 3 minutes
      this.recentDepositsPage.setDefaultTimeout(180000);

      // Add user agent
      await this.recentDepositsPage.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

      await this.recentDepositsPage.setRequestInterception(true);

      this.recentDepositsPage.on('request', async (interceptedRequest) => {
        try {
          if (!interceptedRequest.isInterceptResolutionHandled()) {
            await interceptedRequest.continue();
          }
        } catch (error) {
          logger.error('Error handling request:', {
            url: interceptedRequest.url(),
            error: error.message
          });
        }
      });

      this.recentDepositsPage.on('response', async (interceptedResponse) => {
        let url = interceptedResponse.url();

        // Handle login response
        if (url.includes('/accounts/login')) {
          try {
            const responseData = await interceptedResponse.json();
            if (responseData && responseData.detail.token) {
              // Check if token exists and its age
              const existingToken = await Constant.findOne({ key: 'SCRAPING_AUTH_TOKEN' });
              const fiveHoursFortyMins = 5 * 60 * 60 * 1000 + 40 * 60 * 1000; // 5h40m in milliseconds
              
              if (!existingToken || (Date.now() - existingToken.lastUpdated.getTime()) > fiveHoursFortyMins) {
                // Store the token in constants collection only if it's older than 5h40m
                await Constant.findOneAndUpdate(
                  { key: 'SCRAPING_AUTH_TOKEN' },
                  { 
                    value: responseData.detail.token,
                    lastUpdated: new Date()
                  },
                  { upsert: true }
                );
              }
            }
          } catch (error) {
            logger.error('Error processing login response:', error);
          }
        }

        // Handle deposit list API
        if (url.includes('/accounts/GetListOfRequestsForFranchise')) {
          logger.info('Deposits response - APPROVED');
          try {
            const json = await interceptedResponse.json();
            const transactions = Array.isArray(json) ? json : json.data || [];

            // Process transactions
            for (const transaction of transactions) {
              if (transaction.amount >= 0) {
                try {
                  // skip the update is transaction is already in Success status in the database
                  const existingTransaction = await Transaction.findOne({ orderId: transaction.orderID });
                  if(existingTransaction && existingTransaction.transactionStatus === TRANSACTION_STATUS.SUCCESS) {
                    continue;
                  }

                  await transactionService.findOrCreateAgent(transaction.franchiseName.split(' (')[0]);
  
                  // Create the transaction data object
                  const transactionData = {
                    orderId: transaction.orderID,
                    userId: transaction.userID,
                    userName: transaction.userName,
                    name: transaction.name,
                    statusId: transaction.StatusID,
                    transactionStatus: transaction.transactionStatus,
                    amount: transaction.amount,
                    requestDate: transaction.requestDate, // Convert UTC to IST
                    paymentMethod: transaction.paymentMethod,
                    holderName: transaction.holderName,
                    bankName: transaction.bankName,
                    accountNumber: transaction.number,
                    iban: transaction.iBAN,
                    cardNo: transaction.cardNo,
                    utr: transaction.uTR,
                    approvedOn: transaction.approvedOn,
                    rejectedOn: transaction.rejectedOn,
                    firstDeposit: transaction.firstDeposit,
                    approvedBy: transaction.approvedBy,
                    franchiseName: transaction.franchiseName,
                    remarks: transaction.remarks,
                    bonusIncluded: transaction.bonusIncluded,
                    bonusExcluded: transaction.bonusExcluded,
                    bonusThreshold: transaction.bonusThreshold,
                    lastUpdatedUTROn: transaction.lastUpdatedUTROn,
                    auditStatusId: transaction.auditStatusID,
                    auditStatus: transaction.auditStatus,
                    authorizedUserRemarks: transaction.authorizedUserRemarks,
                    isImageAvailable: transaction.isImageAvailable
                  };
  
                  logger.info(`Transaction orderID - ${transaction.orderID}`);
                  if(transaction.orderID === '3560182') {
                    logger.info('Inside successful transaction ------------------', transaction.orderID);
                  }
  
                  // Use findOneAndUpdate with upsert option to create or update
                  await Transaction.findOneAndUpdate(
                    { orderId: transaction.orderID },
                    transactionData,
                    {
                      upsert: true,
                      new: true,
                      runValidators: true
                    }
                  );
                } catch (transactionError) {
                  logger.error('[ApprovedDeposits] Error -------------------------------- processing individual transaction', {
                    orderId: transaction?.orderID,
                    error: transactionError.message,
                    stack: transactionError.stack
                  });
                }
              }
            }
          } catch (err) {
            logger.error('Error processing API response:', {
              url,
              error: err.message
            });
          }
        }
      });

      // Handle browser/page closure
      this.recentDepositsBrowser.on('disconnected', () => {
        this.isMonitoring = false;
        this.recentDepositsBrowser = null;
        this.recentDepositsPage = null;
      });

      this.recentDepositsPage.on('close', () => {
        this.isMonitoring = false;
        this.recentDepositsPage = null;
      });

      // Only proceed with login if we're not already on the right page
      if (!this.recentDepositsPage.url().includes('/admin/deposit/recent-deposit')) {
        // First handle login
        await this.recentDepositsPage.goto(`${process.env.SCRAPING_WEBSITE_URL}/login`, {
          waitUntil: 'networkidle2',
          timeout: 90000
        });

        // Wait for selectors with increased timeouts
        await this.recentDepositsPage.waitForSelector('input[type="text"]', { visible: true, timeout: 30000 });
        await this.recentDepositsPage.waitForSelector('input[type="password"]', { visible: true, timeout: 30000 });

        await this.recentDepositsPage.type('input[type="text"]', process.env.SCRAPING_USERNAME);
        await this.recentDepositsPage.type('input[type="password"]', process.env.SCRAPING_PASSWORD);

        const loginButton = await this.recentDepositsPage.$('button[type="submit"]');
        if (!loginButton) {
          throw new Error('Login button not found');
        }

        // Wait for navigation after login
        await Promise.all([
          this.recentDepositsPage.waitForNavigation({ 
            waitUntil: 'networkidle2',
            timeout: 90000
          }),
          loginButton.click()
        ]);

        await new Promise(resolve => setTimeout(resolve, 1500));
        await this.recentDepositsPage.goto(`${process.env.SCRAPING_WEBSITE_URL}/admin/deposit/recent-deposit`, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
      }

      // Set up auto-refresh
      const startAutoRefresh = async () => {
        try {
          const refreshButton = await this.recentDepositsPage.$('span.d-flex.justify-content-center.align-items-center.pointer');
          if (refreshButton) {
            await refreshButton.click();
          }
        } catch (error) {}
      };

      // Start auto-refresh interval
      const refreshInterval = setInterval(startAutoRefresh, 10000);

      // Clean up interval when browser is closed
      this.recentDepositsBrowser.on('disconnected', () => {
        clearInterval(refreshInterval);
        this.isMonitoring = false;
        this.recentDepositsBrowser = null;
        this.recentDepositsPage = null;
      });

      this.recentDepositsPage.on('close', () => {
        clearInterval(refreshInterval);
        this.isMonitoring = false;
        this.recentDepositsPage = null;
      });

      this.isMonitoring = true;
      return { success: true, browser: this.recentDepositsBrowser, page: this.recentDepositsPage };
    } catch (error) {
      logger.error('Error monitoring recent deposits:', {
        error: error.message,
        stack: error.stack
      });
      await this.cleanupRecentDeposits();
      throw error;
    }
  }

  async monitorRejectedDeposits() {
    try {
      // Clean up existing rejected deposits browser instance first
      await this.cleanupRejectedDeposits();

      const executablePath = await this.findChromePath();
      this.rejectedDepositsBrowser = await puppeteer.launch({
        headless: 'new',
        executablePath,
        product: 'chrome',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--window-size=1920,1080',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--ignore-certificate-errors',
          '--ignore-certificate-errors-spki-list',
          '--disable-blink-features=AutomationControlled',
          '--disable-infobars',
          '--disable-notifications',
          '--disable-popup-blocking',
          '--disable-extensions',
          '--disable-gpu'
        ],
        defaultViewport: { width: 1920, height: 1080 },
        ignoreHTTPSErrors: true
      });
  
      this.rejectedDepositsPage = await this.rejectedDepositsBrowser.newPage();
      await this.rejectedDepositsPage.setRequestInterception(true);

      this.rejectedDepositsPage.on('request', async (interceptedRequest) => {
        try {
          if (!interceptedRequest.isInterceptResolutionHandled()) {
            await interceptedRequest.continue();
          }
        } catch (error) {
          logger.error('Error handling request:', {
            url: interceptedRequest.url(),
            error: error.message
          });
        }
      });

      this.rejectedDepositsPage.on('response', async (interceptedResponse) => {
        let url = interceptedResponse.url();

        // Handle login response
        if (url.includes('/accounts/login')) {
          try {
            const responseData = await interceptedResponse.json();
            if (responseData && responseData.detail.token) {
              // Check if token exists and its age
              const existingToken = await Constant.findOne({ key: 'SCRAPING_AUTH_TOKEN' });
              const fiveHoursFortyMins = 5 * 60 * 60 * 1000 + 40 * 60 * 1000; // 5h40m in milliseconds
              
              if (!existingToken || (Date.now() - existingToken.lastUpdated.getTime()) > fiveHoursFortyMins) {
                // Store the token in constants collection only if it's older than 5h40m
                await Constant.findOneAndUpdate(
                  { key: 'SCRAPING_AUTH_TOKEN' },
                  { 
                    value: responseData.detail.token,
                    lastUpdated: new Date()
                  },
                  { upsert: true }
                );
              }
            }
          } catch (error) {
            logger.error('Error processing login response:', error);
          }
        }

        // Handle deposit list API
        if (url.includes('/accounts/GetListOfRequestsForFranchise')) {
          logger.info('Deposits response - REJECTED');
          try {
            const json = await interceptedResponse.json();
            const transactions = Array.isArray(json) ? json : json.data || [];

            for (const transaction of transactions) {
              if (transaction.amount >= 0) {
                try {
                  // skip the update is transaction is already in Rejected status in the database
                  const existingTransaction = await Transaction.findOne({ orderId: transaction.orderID });
                  if(existingTransaction && existingTransaction.transactionStatus === TRANSACTION_STATUS.REJECTED) {
                    continue;
                  }
                  await transactionService.findOrCreateAgent(transaction.franchiseName.split(' (')[0]);

                  // Create the transaction data object
                  const transactionData = {
                    orderId: transaction.orderID,
                    userId: transaction.userID,
                    userName: transaction.userName,
                    name: transaction.name,
                    statusId: transaction.StatusID,
                    transactionStatus: transaction.transactionStatus,
                    amount: transaction.amount,
                    requestDate: transaction.requestDate, // Convert UTC to IST
                    paymentMethod: transaction.paymentMethod,
                    holderName: transaction.holderName,
                    bankName: transaction.bankName,
                    accountNumber: transaction.number,
                    iban: transaction.iBAN,
                    cardNo: transaction.cardNo,
                    utr: transaction.uTR,
                    approvedOn: transaction.approvedOn,
                    rejectedOn: transaction.rejectedOn,
                    firstDeposit: transaction.firstDeposit,
                    approvedBy: transaction.approvedBy,
                    franchiseName: transaction.franchiseName,
                    remarks: transaction.remarks,
                    bonusIncluded: transaction.bonusIncluded,
                    bonusExcluded: transaction.bonusExcluded,
                    bonusThreshold: transaction.bonusThreshold,
                    lastUpdatedUTROn: transaction.lastUpdatedUTROn,
                    auditStatusId: transaction.auditStatusID,
                    auditStatus: transaction.auditStatus,
                    authorizedUserRemarks: transaction.authorizedUserRemarks,
                    isImageAvailable: transaction.isImageAvailable
                  };

                  // Use findOneAndUpdate with upsert option to create or update
                  await Transaction.findOneAndUpdate(
                    { orderId: transaction.orderID },
                    transactionData,
                    {
                      upsert: true,
                      new: true,
                      runValidators: true
                    }
                  );
                } catch (transactionError) {
                  logger.error('[RejectedDeposits] Error -------------------------------- processing individual transaction', {
                    orderId: transaction?.orderID,
                    error: transactionError.message,
                    stack: transactionError.stack
                  });
                }
              }
            }
          } catch (err) {
            logger.error('Error processing API response:', {
              url,
              error: err.message
            });
          }
        }
      });

      // Handle browser/page closure
      this.rejectedDepositsBrowser.on('disconnected', () => {
        this.isMonitoring = false;
        this.rejectedDepositsBrowser = null;
        this.rejectedDepositsPage = null;
      });

      this.rejectedDepositsPage.on('close', () => {
        this.isMonitoring = false;
        this.rejectedDepositsPage = null;
      });

      // Only proceed with login if we're not already on the right page
      if (!this.rejectedDepositsPage.url().includes('/admin/deposit/recent-deposit')) {
        // First handle login
        await this.rejectedDepositsPage.goto(`${process.env.SCRAPING_WEBSITE_URL}/login`, {
          waitUntil: 'networkidle2',
          timeout: 90000
        });

        // Wait for selectors with increased timeouts
        await this.rejectedDepositsPage.waitForSelector('input[type="text"]', { visible: true, timeout: 30000 });
        await this.rejectedDepositsPage.waitForSelector('input[type="password"]', { visible: true, timeout: 30000 });

        await this.rejectedDepositsPage.type('input[type="text"]', process.env.SCRAPING_USERNAME);
        await this.rejectedDepositsPage.type('input[type="password"]', process.env.SCRAPING_PASSWORD);

        const loginButton = await this.rejectedDepositsPage.$('button[type="submit"]');
        if (!loginButton) {
          throw new Error('Login button not found');
        }

        // Wait for navigation after login
        await Promise.all([
          this.rejectedDepositsPage.waitForNavigation({ 
            waitUntil: 'networkidle2',
            timeout: 90000
          }),
          loginButton.click()
        ]);

        await new Promise(resolve => setTimeout(resolve, 1500));

        await this.rejectedDepositsPage.goto(`${process.env.SCRAPING_WEBSITE_URL}/admin/deposit/recent-deposit`, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        // Wait for the page to load and then click the rejected filter
        try {
          await this.rejectedDepositsPage.waitForSelector('mat-select[aria-labelledby*="mat-mdc-form-field-label"]', { 
            timeout: 10000,
            visible: true 
          });
          
          // Click the status filter dropdown
          await this.rejectedDepositsPage.click('mat-select[aria-labelledby*="mat-mdc-form-field-label"]');
          
          // Wait for the options panel to be visible
          await this.rejectedDepositsPage.waitForSelector('mat-option', { 
            timeout: 5000,
            visible: true 
          });
          
          // Find and click the "Rejected" option using more specific selectors
          const rejectedOptionSelector = 'mat-option span.mdc-list-item__primary-text';
          const options = await this.rejectedDepositsPage.$$(rejectedOptionSelector);
          
          let rejectedSelected = false;
          for (const option of options) {
            const text = await option.evaluate(el => el.textContent.trim());
            if (text.toLowerCase() === 'reject') {
              await option.click();
              rejectedSelected = true;
              break;
            }
          }

          if (rejectedSelected) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const submitButtonSelector = 'button[mat-raised-button][type="submit"]';
            await this.rejectedDepositsPage.waitForSelector(submitButtonSelector, { 
              visible: true,
              timeout: 5000 
            });
            await this.rejectedDepositsPage.click(submitButtonSelector);
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
          
        } catch (error) {
          logger.error('Error setting rejected filter:', {
            error: error.message,
            stack: error.stack
          });
          
          // Try alternative selector if the first one fails
          try {
            const statusLabel = await this.rejectedDepositsPage
            if (statusLabel.length > 0) {
              const matSelect = await statusLabel[0].evaluateHandle(node => 
                node.closest('mat-select') || node.parentElement.closest('mat-select')
              );
              
              if (matSelect) {
                await matSelect.click();                
                await this.rejectedDepositsPage.waitForSelector('mat-option', { timeout: 5000 });
                const options = await this.rejectedDepositsPage.$$('mat-option');
                
                let rejectedSelected = false;
                for (const option of options) {
                  const text = await option.evaluate(el => el.textContent.trim());
                  if (text.toLowerCase() === 'rejected') {
                    await option.click();
                    rejectedSelected = true;
                    break;
                  }
                }

                if (rejectedSelected) {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  try {
                    // Try by button text
                    const [submitButton] = await this.rejectedDepositsPage.$x("//button[contains(., 'Submit')]");
                    if (submitButton) {
                      await submitButton.click();
                    } else {
                      // Try by class and type
                      const submitButtonSelector = 'button.mat-mdc-raised-button[type="submit"]';
                      await this.rejectedDepositsPage.waitForSelector(submitButtonSelector, { 
                        visible: true,
                        timeout: 5000 
                      });
                      await this.rejectedDepositsPage.click(submitButtonSelector);
                    }
                    await new Promise(resolve => setTimeout(resolve, 3000));
                  } catch (submitError) {
                    logger.error('Error clicking submit button:', {
                      error: submitError.message,
                      stack: submitError.stack
                    });
                  }
                }
              }
            }
          } catch (alternativeError) {
            logger.error('Error with alternative selector:', {
              error: alternativeError.message,
              stack: alternativeError.stack
            });
          }
        }
      }

      // Set up auto-refresh
      const startAutoRefresh = async () => {
        try {
          const refreshButton = await this.rejectedDepositsPage.$('span.d-flex.justify-content-center.align-items-center.pointer');
          if (refreshButton) {
            await refreshButton.click();
          }
        } catch (error) {}
      };

      // Start auto-refresh interval
      const refreshInterval = setInterval(startAutoRefresh, 10000);

      // Clean up interval when browser is closed
      this.rejectedDepositsBrowser.on('disconnected', () => {
        clearInterval(refreshInterval);
        this.isMonitoring = false;
        this.rejectedDepositsBrowser = null;
        this.rejectedDepositsPage = null;
      });

      this.rejectedDepositsPage.on('close', () => {
        clearInterval(refreshInterval);
        this.isMonitoring = false;
        this.rejectedDepositsPage = null;
      });

      this.isMonitoring = true;
      return { success: true, browser: this.rejectedDepositsBrowser, page: this.rejectedDepositsPage };
    } catch (error) {
      logger.error('Error monitoring rejected deposits:', {
        error: error.message,
        stack: error.stack
      });
      await this.cleanupRejectedDeposits();
      throw error;
    }
  }

  async monitorPendingWithdrawals() {
    try {
      const executablePath = await this.findChromePath();
      this.pendingWithdrawlsBrowser = await puppeteer.launch({
        headless: 'new',
        executablePath,
        product: 'chrome',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--window-size=1920,1080',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--ignore-certificate-errors',
          '--ignore-certificate-errors-spki-list',
          '--disable-blink-features=AutomationControlled',
          '--disable-infobars',
          '--disable-notifications',
          '--disable-popup-blocking',
          '--disable-extensions',
          '--disable-gpu'
        ],
        defaultViewport: { width: 1920, height: 1080 },
        ignoreHTTPSErrors: true
      });

      this.pendingWithdrawlsPage = await this.pendingWithdrawlsBrowser.newPage();

      try {
        // If browser exists but page is closed/crashed, clean up first
        if (this.pendingWithdrawlsBrowser) {
          try {
            const pages = await this.pendingWithdrawlsBrowser.pages();
            if (pages.length === 0 || !this.pendingWithdrawlsPage || this.pendingWithdrawlsPage.isClosed()) {
              // await this.cleanupPendingDeposits();
            }
          } catch (error) {
            // await this.cleanupPendingDeposits();
          }
        }

        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
        
        // Set a longer default timeout
        if (!this.pendingWithdrawlsBrowser) {
          this.pendingWithdrawlsBrowser = await puppeteer.launch({
            headless: 'new',
            executablePath,
            product: 'chrome',
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--window-size=1920,1080',
              '--disable-web-security',
              '--disable-features=IsolateOrigins,site-per-process',
              '--ignore-certificate-errors',
              '--ignore-certificate-errors-spki-list',
              '--disable-blink-features=AutomationControlled',
              '--disable-infobars',
              '--disable-notifications',
              '--disable-popup-blocking',
              '--disable-extensions',
              '--disable-gpu'
            ],
            defaultViewport: { width: 1920, height: 1080 },
            ignoreHTTPSErrors: true
          });
        }
        if (!this.pendingWithdrawlsPage) {
          this.pendingWithdrawlsPage = await this.pendingDepositsBrowser.newPage();
        }
        this.pendingWithdrawlsPage.setDefaultNavigationTimeout(180000); // 3 minutes
        this.pendingWithdrawlsPage.setDefaultTimeout(180000);

        // Add user agent
        await this.pendingWithdrawlsPage.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        await this.pendingWithdrawlsPage.setRequestInterception(true);

        this.pendingWithdrawlsPage.on('request', async (interceptedRequest) => {
          try {
            if (!interceptedRequest.isInterceptResolutionHandled()) {
              await interceptedRequest.continue();
            }
          } catch (error) {
            logger.error('Error handling request:', {
              url: interceptedRequest.url(),
              error: error.message
            });
          }
        });

        this.pendingWithdrawlsPage.on('response', async (interceptedResponse) => {
          let url = interceptedResponse.url();

          // Handle login response
          if (url.includes('/accounts/login')) {
            try {
              const responseData = await interceptedResponse.json();
              if (responseData && responseData.detail.token) {
                // Check if token exists and its age
                const existingToken = await Constant.findOne({ key: 'SCRAPING_AUTH_TOKEN' });
                const fiveHoursFortyMins = 5 * 60 * 60 * 1000 + 40 * 60 * 1000; // 5h40m in milliseconds
                
                if (!existingToken || (Date.now() - existingToken.lastUpdated.getTime()) > fiveHoursFortyMins) {
                  // Store the token in constants collection only if it's older than 5h40m
                  await Constant.findOneAndUpdate(
                    { key: 'SCRAPING_AUTH_TOKEN' },
                    { 
                      value: responseData.detail.token,
                      lastUpdated: new Date()
                    },
                    { upsert: true }
                  );
                }
              }
            } catch (error) {
              logger.error('Error processing login response:', error);
            }
          }

          // Handle deposit list API
          if (url.includes('/accounts/GetListOfRequestsForFranchise')) {
            logger.info('Withdraw response - PENDING');
            try {
              const json = await interceptedResponse.json();
              const transactions = Array.isArray(json) ? json : json.data || [];

              // Process transactions and click transcript icons
              for (const transaction of transactions) {
                if (transaction.amount < 0) {
                  try {
                    await transactionService.findOrCreateAgent(transaction.franchiseName.split(' (')[0]);
  
                    // Create the transaction data object
                    const transactionData = {
                      orderId: transaction.orderID,
                      userId: transaction.userID,
                      userName: transaction.userName,
                      name: transaction.name,
                      statusId: transaction.StatusID,
                      transactionStatus: transaction.transactionStatus,
                      amount: transaction.amount,
                      requestDate: transaction.requestDate, // Convert UTC to IST
                      paymentMethod: transaction.paymentMethod,
                      holderName: transaction.holderName,
                      bankName: transaction.bankName,
                      accountNumber: transaction.number,
                      iban: transaction.iBAN,
                      cardNo: transaction.cardNo,
                      utr: transaction.uTR,
                      approvedOn: transaction.approvedOn,
                      rejectedOn: transaction.rejectedOn,
                      firstDeposit: transaction.firstDeposit,
                      approvedBy: transaction.approvedBy,
                      franchiseName: transaction.franchiseName,
                      remarks: transaction.remarks,
                      bonusIncluded: transaction.bonusIncluded,
                      bonusExcluded: transaction.bonusExcluded,
                      bonusThreshold: transaction.bonusThreshold,
                      lastUpdatedUTROn: transaction.lastUpdatedUTROn,
                      auditStatusId: transaction.auditStatusID,
                      auditStatus: transaction.auditStatus,
                      authorizedUserRemarks: transaction.authorizedUserRemarks,
                      isImageAvailable: transaction.isImageAvailable
                    };
  
                    // Use findOneAndUpdate with upsert option to create or update
                    const existingTransaction = await Transaction.findOne({ orderId: transaction.orderID });
                    let checkingDeptApprovedOn = null;
                    let bonusApprovedOn = null;
                    
                    if (existingTransaction && 
                        existingTransaction.auditStatus === TRANSACTION_STATUS.PENDING && 
                        (transaction.auditStatus === TRANSACTION_STATUS.SUCCESS || transaction.auditStatus === TRANSACTION_STATUS.REJECTED)) {
                      checkingDeptApprovedOn = transaction.approvedOn
                      transactionData.checkingDeptApprovedOn = checkingDeptApprovedOn;
                      if (existingTransaction.bonusApprovedOn === null) transactionData.bonusApprovedOn = checkingDeptApprovedOn
                    }
                    
                    // Check if bonusIncluded or bonusExcluded is changing from 0 to non-zero
                    if (existingTransaction && 
                        ((existingTransaction.bonusIncluded === 0 && transaction.bonusIncluded !== 0) ||
                         (existingTransaction.bonusExcluded === 0 && transaction.bonusExcluded !== 0))) {
                      bonusApprovedOn = transaction.approvedOn;
                      transactionData.bonusApprovedOn = bonusApprovedOn;
                    }
                    
                    // Check if isImageAvailable is changing from false to true
                    const shouldFetchTranscript = existingTransaction && 
                      existingTransaction.isImageAvailable === false && 
                      transaction.isImageAvailable === true;
                    
                    await Transaction.findOneAndUpdate(
                      { orderId: transaction.orderID }, // find criteria
                      transactionData, // update data
                      {
                        upsert: true, // create if doesn't exist
                        new: true, // return updated doc
                        runValidators: true // run schema validators
                      }
                    );
  
                    // Only fetch transcript if isImageAvailable changed from false to true
                    if (shouldFetchTranscript) {
                      await this.fetchTranscript(transaction.orderID);
                    }
                  } catch (transactionError) {
                    logger.error('Error processing individual transaction:', {
                      orderId: transaction?.orderID,
                      error: transactionError.message
                    });
                  }
                }
              }
            } catch (err) {
              logger.error('Error processing API response:', {
                url,
                error: err.message
              });
            }
          }
        });

        // Handle browser/page closure
        this.pendingWithdrawlsBrowser.on('disconnected', () => {
          this.isMonitoring = false;
          this.pendingWithdrawlsBrowser = null;
          this.pendingWithdrawlsPage = null;
        });

        this.pendingWithdrawlsPage.on('close', () => {
          this.isMonitoring = false;
          this.pendingWithdrawlsPage = null;
        });

        // Only proceed with login if we're not already on the right page
        if (!this.pendingWithdrawlsPage.url().includes('/admin/deposit/withdraw-approval')) {
          // First handle login
          await this.pendingWithdrawlsPage.goto(`${process.env.SCRAPING_WEBSITE_URL}/login`, {
            waitUntil: 'networkidle2',
            timeout: 90000
          });

          // Wait for selectors with increased timeouts
          await this.pendingWithdrawlsPage.waitForSelector('input[type="text"]', { visible: true, timeout: 30000 });
          await this.pendingWithdrawlsPage.waitForSelector('input[type="password"]', { visible: true, timeout: 30000 });

          await this.pendingWithdrawlsPage.type('input[type="text"]', process.env.SCRAPING_USERNAME);
          await this.pendingWithdrawlsPage.type('input[type="password"]', process.env.SCRAPING_PASSWORD);

          const loginButton = await this.pendingWithdrawlsPage.$('button[type="submit"]');
          if (!loginButton) {
            throw new Error('Login button not found');
          }

          // Wait for navigation after login
          await Promise.all([
            this.pendingWithdrawlsPage.waitForNavigation({ 
              waitUntil: 'networkidle2',
              timeout: 90000
            }),
            loginButton.click()
          ]);

          // Wait a bit after login before next navigation
          await new Promise(resolve => setTimeout(resolve, 1500));

          // Then navigate to deposit approval page
          await this.pendingWithdrawlsPage.goto(`${process.env.SCRAPING_WEBSITE_URL}/admin/deposit/withdraw-approval`, {
            waitUntil: 'networkidle2',
            timeout: 30000
          });

          try {
            // Wait for table to be visible
            await this.pendingWithdrawlsPage.waitForSelector('table', { timeout: 10000 });
            // Additional wait for API calls and data loading
            await new Promise(resolve => setTimeout(resolve, 5000));
          } catch (error) {
            
          }
        }

        this.isMonitoring = true;
        return { success: true, browser: this.pendingWithdrawlsBrowser, page: this.pendingWithdrawlsPage };
      } catch (error) {
        logger.error('Error monitoring deposit list:', {
          error: error.message,
          stack: error.stack
        });
        // await this.cleanupPendingDeposits();
        throw error;
      }
    } catch (error) {
      logger.error('Error monitoring deposit list:', {
        error: error.message,
        stack: error.stack
      });
      // await this.cleanupPendingDeposits();
      throw error;
    }
  }

  async monitorApprovedWithdrawals() {
    try {
      // Clean up existing approved withdrawals browser instance first
      await this.cleanupApprovedWithdrawals();

      const executablePath = await this.findChromePath();
      this.approvedWithdrawalsBrowser = await puppeteer.launch({
        headless: 'new',
        executablePath,
        product: 'chrome',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--window-size=1920,1080',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--ignore-certificate-errors',
          '--ignore-certificate-errors-spki-list',
          '--disable-blink-features=AutomationControlled',
          '--disable-infobars',
          '--disable-notifications',
          '--disable-popup-blocking',
          '--disable-extensions',
          '--disable-gpu'
        ],
        defaultViewport: { width: 1920, height: 1080 },
        ignoreHTTPSErrors: true
      });
  
      this.approvedWithdrawalsPage = await this.approvedWithdrawalsBrowser.newPage();
      
      // Set a longer default timeout
      if (!this.approvedWithdrawalsBrowser) {
        this.approvedWithdrawalsBrowser = await puppeteer.launch({
          headless: 'new',
          executablePath,
          product: 'chrome',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--window-size=1920,1080',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--ignore-certificate-errors',
            '--ignore-certificate-errors-spki-list',
            '--disable-blink-features=AutomationControlled',
            '--disable-infobars',
            '--disable-notifications',
            '--disable-popup-blocking',
            '--disable-extensions',
            '--disable-gpu'
          ],
          defaultViewport: { width: 1920, height: 1080 },
          ignoreHTTPSErrors: true
        });
      }
      if (!this.approvedWithdrawalsPage) {
        this.approvedWithdrawalsPage = await this.approvedWithdrawalsBrowser.newPage();
      }
      this.approvedWithdrawalsPage.setDefaultNavigationTimeout(180000); // 3 minutes
      this.approvedWithdrawalsPage.setDefaultTimeout(180000);

      // Add user agent
      await this.approvedWithdrawalsPage.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

      await this.approvedWithdrawalsPage.setRequestInterception(true);

      this.approvedWithdrawalsPage.on('request', async (interceptedRequest) => {
        try {
          if (!interceptedRequest.isInterceptResolutionHandled()) {
            await interceptedRequest.continue();
          }
        } catch (error) {
          logger.error('Error handling request:', {
            url: interceptedRequest.url(),
            error: error.message
          });
        }
      });

      this.approvedWithdrawalsPage.on('response', async (interceptedResponse) => {
        let url = interceptedResponse.url();

        // Handle login response
        if (url.includes('/accounts/login')) {
          try {
            const responseData = await interceptedResponse.json();
            if (responseData && responseData.detail.token) {
              // Check if token exists and its age
              const existingToken = await Constant.findOne({ key: 'SCRAPING_AUTH_TOKEN' });
              const fiveHoursFortyMins = 5 * 60 * 60 * 1000 + 40 * 60 * 1000; // 5h40m in milliseconds
              
              if (!existingToken || (Date.now() - existingToken.lastUpdated.getTime()) > fiveHoursFortyMins) {
                // Store the token in constants collection only if it's older than 5h40m
                await Constant.findOneAndUpdate(
                  { key: 'SCRAPING_AUTH_TOKEN' },
                  { 
                    value: responseData.detail.token,
                    lastUpdated: new Date()
                  },
                  { upsert: true }
                );
              }
            }
          } catch (error) {
            logger.error('Error processing login response:', error);
          }
        }

        // Handle withdrawal list API
        if (url.includes('/accounts/GetListOfRequestsForFranchise')) {
          logger.info('Withdraw response - APPROVED');
          try {
            const json = await interceptedResponse.json();
            const transactions = Array.isArray(json) ? json : json.data || [];

            for (const transaction of transactions) {
              if (transaction.amount < 0) {
                try {
                  await transactionService.findOrCreateAgent(transaction.franchiseName.split(' (')[0]);

                  // Create the transaction data object
                  const transactionData = {
                    orderId: transaction.orderID,
                    userId: transaction.userID,
                    userName: transaction.userName,
                    name: transaction.name,
                    statusId: transaction.StatusID,
                    transactionStatus: transaction.transactionStatus,
                    amount: transaction.amount,
                    requestDate: transaction.requestDate,
                    paymentMethod: transaction.paymentMethod,
                    holderName: transaction.holderName,
                    bankName: transaction.bankName,
                    accountNumber: transaction.number,
                    iban: transaction.iBAN,
                    cardNo: transaction.cardNo,
                    utr: transaction.uTR,
                    approvedOn: transaction.approvedOn,
                    rejectedOn: transaction.rejectedOn,
                    firstDeposit: transaction.firstDeposit,
                    approvedBy: transaction.approvedBy,
                    franchiseName: transaction.franchiseName,
                    remarks: transaction.remarks,
                    bonusIncluded: transaction.bonusIncluded,
                    bonusExcluded: transaction.bonusExcluded,
                    bonusThreshold: transaction.bonusThreshold,
                    lastUpdatedUTROn: transaction.lastUpdatedUTROn,
                    auditStatusId: transaction.auditStatusID,
                    auditStatus: transaction.auditStatus,
                    authorizedUserRemarks: transaction.authorizedUserRemarks,
                    isImageAvailable: transaction.isImageAvailable
                  };

                  // Use findOneAndUpdate with upsert option to create or update
                  const existingTransaction = await Transaction.findOne({ orderId: transaction.orderID });
                  let checkingDeptApprovedOn = null;
                  let bonusApprovedOn = null;
                  
                  if (existingTransaction && 
                      existingTransaction.auditStatus === TRANSACTION_STATUS.PENDING && 
                      (transaction.auditStatus === TRANSACTION_STATUS.SUCCESS || transaction.auditStatus === TRANSACTION_STATUS.REJECTED)) {
                    checkingDeptApprovedOn = transaction.approvedOn
                    transactionData.checkingDeptApprovedOn = checkingDeptApprovedOn;
                  }
                  
                  // Check if bonusIncluded or bonusExcluded is changing from 0 to non-zero
                  if (existingTransaction && 
                    ((existingTransaction.bonusIncluded === 0 && transaction.bonusIncluded !== 0) ||
                    (existingTransaction.bonusExcluded === 0 && transaction.bonusExcluded !== 0))) {
                      bonusApprovedOn = transaction.approvedOn;
                      transactionData.bonusApprovedOn = bonusApprovedOn;
                    }
                    
                  
                  // Check if isImageAvailable is changing from false to true
                  const shouldFetchTranscript = existingTransaction && 
                    existingTransaction.isImageAvailable === false && 
                    transaction.isImageAvailable === true;
                  
                  await Transaction.findOneAndUpdate(
                    { orderId: transaction.orderID },
                    transactionData,
                    {
                      upsert: true,
                      new: true,
                      runValidators: true
                    }
                  );
                  if (shouldFetchTranscript) {
                    await this.fetchTranscript(transaction.orderID);
                  }

                } catch (transactionError) {
                  logger.error('[ApprovedWithdrawals] Error -------------------------------- processing individual transaction', {
                    orderId: transaction?.orderID,
                    error: transactionError.message,
                    stack: transactionError.stack
                  });
                }
              } else {
                logger.debug(`[ApprovedWithdrawals] Skipping transaction with non-negative amount ${transaction.orderID}`);
              }
            }
          } catch (err) {
            logger.error('Error processing API response:', {
              url,
              error: err.message
            });
          }
        }
      });

      // Handle browser/page closure
      this.approvedWithdrawalsBrowser.on('disconnected', () => {
        this.isMonitoring = false;
        this.approvedWithdrawalsBrowser = null;
        this.approvedWithdrawalsPage = null;
      });

      this.approvedWithdrawalsPage.on('close', () => {
        this.isMonitoring = false;
        this.approvedWithdrawalsPage = null;
      });

      // Only proceed with login if we're not already on the right page
      if (!this.approvedWithdrawalsPage.url().includes('/admin/deposit/recent-withdrawal')) {
        // First handle login
        await this.approvedWithdrawalsPage.goto(`${process.env.SCRAPING_WEBSITE_URL}/login`, {
          waitUntil: 'networkidle2',
          timeout: 90000
        });

        // Wait for selectors with increased timeouts
        await this.approvedWithdrawalsPage.waitForSelector('input[type="text"]', { visible: true, timeout: 30000 });
        await this.approvedWithdrawalsPage.waitForSelector('input[type="password"]', { visible: true, timeout: 30000 });

        await this.approvedWithdrawalsPage.type('input[type="text"]', process.env.SCRAPING_USERNAME);
        await this.approvedWithdrawalsPage.type('input[type="password"]', process.env.SCRAPING_PASSWORD);

        const loginButton = await this.approvedWithdrawalsPage.$('button[type="submit"]');
        if (!loginButton) {
          throw new Error('Login button not found');
        }

        // Wait for navigation after login
        await Promise.all([
          this.approvedWithdrawalsPage.waitForNavigation({ 
            waitUntil: 'networkidle2',
            timeout: 90000
          }),
          loginButton.click()
        ]);

        await new Promise(resolve => setTimeout(resolve, 1500));
        await this.approvedWithdrawalsPage.goto(`${process.env.SCRAPING_WEBSITE_URL}/admin/deposit/recent-withdrawal`, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
      }

      // Set up auto-refresh
      const startAutoRefresh = async () => {
        try {
          const refreshButton = await this.approvedWithdrawalsPage.$('span.d-flex.justify-content-center.align-items-center.pointer');
          if (refreshButton) {
            await refreshButton.click();
          }
        } catch (error) {}
      };

      // Start auto-refresh interval
      const refreshInterval = setInterval(startAutoRefresh, 10000);

      // Clean up interval when browser is closed
      this.approvedWithdrawalsBrowser.on('disconnected', () => {
        clearInterval(refreshInterval);
        this.isMonitoring = false;
        this.approvedWithdrawalsBrowser = null;
        this.approvedWithdrawalsPage = null;
      });

      this.approvedWithdrawalsPage.on('close', () => {
        clearInterval(refreshInterval);
        this.isMonitoring = false;
        this.approvedWithdrawalsPage = null;
      });

      this.isMonitoring = true;
      return { success: true, browser: this.approvedWithdrawalsBrowser, page: this.approvedWithdrawalsPage };
    } catch (error) {
      logger.error('Error monitoring approved withdrawals:', {
        error: error.message,
        stack: error.stack
      });
      await this.cleanupApprovedWithdrawals();
      throw error;
    }
  }

  async monitorRejectedWithdrawals() {
    try {
      // Clean up existing rejected withdrawals browser instance first
      await this.cleanupRejectedWithdrawals();

      const executablePath = await this.findChromePath();
      this.rejectedWithdrawalsBrowser = await puppeteer.launch({
        headless: 'new',
        executablePath,
        product: 'chrome',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--window-size=1920,1080',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--ignore-certificate-errors',
          '--ignore-certificate-errors-spki-list',
          '--disable-blink-features=AutomationControlled',
          '--disable-infobars',
          '--disable-notifications',
          '--disable-popup-blocking',
          '--disable-extensions',
          '--disable-gpu'
        ],
        defaultViewport: { width: 1920, height: 1080 },
        ignoreHTTPSErrors: true
      });
  
      this.rejectedWithdrawalsPage = await this.rejectedWithdrawalsBrowser.newPage();
      await this.rejectedWithdrawalsPage.setRequestInterception(true);

      this.rejectedWithdrawalsPage.on('request', async (interceptedRequest) => {
        try {
          if (!interceptedRequest.isInterceptResolutionHandled()) {
            await interceptedRequest.continue();
          }
        } catch (error) {
          logger.error('Error handling request:', {
            url: interceptedRequest.url(),
            error: error.message
          });
        }
      });

      this.rejectedWithdrawalsPage.on('response', async (interceptedResponse) => {
        let url = interceptedResponse.url();

        // Handle login response
        if (url.includes('/accounts/login')) {
          try {
            const responseData = await interceptedResponse.json();
            if (responseData && responseData.detail.token) {
              // Check if token exists and its age
              const existingToken = await Constant.findOne({ key: 'SCRAPING_AUTH_TOKEN' });
              const fiveHoursFortyMins = 5 * 60 * 60 * 1000 + 40 * 60 * 1000; // 5h40m in milliseconds
              
              if (!existingToken || (Date.now() - existingToken.lastUpdated.getTime()) > fiveHoursFortyMins) {
                // Store the token in constants collection only if it's older than 5h40m
                await Constant.findOneAndUpdate(
                  { key: 'SCRAPING_AUTH_TOKEN' },
                  { 
                    value: responseData.detail.token,
                    lastUpdated: new Date()
                  },
                  { upsert: true }
                );
              }
            }
          } catch (error) {
            logger.error('Error processing login response:', error);
          }
        }

        // Handle withdrawal list API
        if (url.includes('/accounts/GetListOfRequestsForFranchise')) {
          logger.info('Withdraw response - REJECTED');
          try {
            const json = await interceptedResponse.json();
            const transactions = Array.isArray(json) ? json : json.data || [];

            // Process transactions
            for (const transaction of transactions) {
              if (transaction.amount < 0) {
                try {
                  await transactionService.findOrCreateAgent(transaction.franchiseName.split(' (')[0]);

                  // Create the transaction data object
                  const transactionData = {
                    orderId: transaction.orderID,
                    userId: transaction.userID,
                    userName: transaction.userName,
                    name: transaction.name,
                    statusId: transaction.StatusID,
                    transactionStatus: transaction.transactionStatus,
                    amount: transaction.amount,
                    requestDate: transaction.requestDate,
                    paymentMethod: transaction.paymentMethod,
                    holderName: transaction.holderName,
                    bankName: transaction.bankName,
                    accountNumber: transaction.number,
                    iban: transaction.iBAN,
                    cardNo: transaction.cardNo,
                    utr: transaction.uTR,
                    approvedOn: transaction.approvedOn,
                    rejectedOn: transaction.rejectedOn,
                    firstDeposit: transaction.firstDeposit,
                    approvedBy: transaction.approvedBy,
                    franchiseName: transaction.franchiseName,
                    remarks: transaction.remarks,
                    bonusIncluded: transaction.bonusIncluded,
                    bonusExcluded: transaction.bonusExcluded,
                    bonusThreshold: transaction.bonusThreshold,
                    lastUpdatedUTROn: transaction.lastUpdatedUTROn,
                    auditStatusId: transaction.auditStatusID,
                    auditStatus: transaction.auditStatus,
                    authorizedUserRemarks: transaction.authorizedUserRemarks,
                    isImageAvailable: transaction.isImageAvailable
                  };

                  logger.debug(`[RejectedWithdrawals] Prepared transactionData ${transaction.orderID}`);
                  const existingTransaction = await Transaction.findOne({ orderId: transaction.orderID });
                  logger.debug(`[RejectedWithdrawals] Existing transaction ${transaction.orderID}`);
                  let checkingDeptApprovedOn = null;
                  let bonusApprovedOn = null;
                  
                  if (existingTransaction && 
                      existingTransaction.auditStatus === TRANSACTION_STATUS.PENDING && 
                      (transaction.auditStatus === TRANSACTION_STATUS.SUCCESS || transaction.auditStatus === TRANSACTION_STATUS.REJECTED)) {
                    checkingDeptApprovedOn = transaction.approvedOn
                    transactionData.checkingDeptApprovedOn = checkingDeptApprovedOn;
                  }
                  
                  // Check if bonusIncluded or bonusExcluded is changing from 0 to non-zero
                  if (existingTransaction && 
                      ((existingTransaction.bonusIncluded === 0 && transaction.bonusIncluded !== 0) ||
                       (existingTransaction.bonusExcluded === 0 && transaction.bonusExcluded !== 0))) {
                    bonusApprovedOn = transaction.approvedOn;
                    transactionData.bonusApprovedOn = bonusApprovedOn;
                  }
                  
                  
                  // Check if isImageAvailable is changing from false to true
                  const shouldFetchTranscript = existingTransaction && 
                    existingTransaction.isImageAvailable === false && 
                    transaction.isImageAvailable === true;
                  
                  await Transaction.findOneAndUpdate(
                    { orderId: transaction.orderID },
                    transactionData,
                    {
                      upsert: true,
                      new: true,
                      runValidators: true
                    }
                  );
                  if (shouldFetchTranscript) {
                    await this.fetchTranscript(transaction.orderID);
                  }

                } catch (transactionError) {
                  logger.error('[RejectedWithdrawals] Error -------------------------------- processing individual transaction', {
                    orderId: transaction?.orderID,
                    error: transactionError.message,
                    stack: transactionError.stack
                  });
                }
              } else {
                logger.debug('[RejectedWithdrawals] Skipping transaction with non-negative amount', { orderId: transaction.orderID, amount: transaction.amount });
              }
            }
          } catch (err) {
            logger.error('Error processing API response:', {
              url,
              error: err.message
            });
          }
        }
      });

      // Handle browser/page closure
      this.rejectedWithdrawalsBrowser.on('disconnected', () => {
        this.isMonitoring = false;
        this.rejectedWithdrawalsBrowser = null;
        this.rejectedWithdrawalsPage = null;
      });

      this.rejectedWithdrawalsPage.on('close', () => {
        this.isMonitoring = false;
        this.rejectedWithdrawalsPage = null;
      });

      // Only proceed with login if we're not already on the right page
      if (!this.rejectedWithdrawalsPage.url().includes('/admin/deposit/recent-withdrawal')) {
        // First handle login
        await this.rejectedWithdrawalsPage.goto(`${process.env.SCRAPING_WEBSITE_URL}/login`, {
          waitUntil: 'networkidle2',
          timeout: 90000
        });

        // Wait for selectors with increased timeouts
        await this.rejectedWithdrawalsPage.waitForSelector('input[type="text"]', { visible: true, timeout: 30000 });
        await this.rejectedWithdrawalsPage.waitForSelector('input[type="password"]', { visible: true, timeout: 30000 });

        await this.rejectedWithdrawalsPage.type('input[type="text"]', process.env.SCRAPING_USERNAME);
        await this.rejectedWithdrawalsPage.type('input[type="password"]', process.env.SCRAPING_PASSWORD);

        const loginButton = await this.rejectedWithdrawalsPage.$('button[type="submit"]');
        if (!loginButton) {
          throw new Error('Login button not found');
        }

        // Wait for navigation after login
        await Promise.all([
          this.rejectedWithdrawalsPage.waitForNavigation({ 
            waitUntil: 'networkidle2',
            timeout: 90000
          }),
          loginButton.click()
        ]);

        await new Promise(resolve => setTimeout(resolve, 1500));

        await this.rejectedWithdrawalsPage.goto(`${process.env.SCRAPING_WEBSITE_URL}/admin/deposit/recent-withdrawal`, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        // Wait for the page to load and then click the rejected filter
        try {
          await this.rejectedWithdrawalsPage.waitForSelector('mat-select[aria-labelledby*="mat-mdc-form-field-label"]', { 
            timeout: 10000,
            visible: true 
          });
          
          // Click the status filter dropdown
          await this.rejectedWithdrawalsPage.click('mat-select[aria-labelledby*="mat-mdc-form-field-label"]');
          
          // Wait for the options panel to be visible
          await this.rejectedWithdrawalsPage.waitForSelector('mat-option', { 
            timeout: 5000,
            visible: true 
          });
          
          // Find and click the "Rejected" option using more specific selectors
          const rejectedOptionSelector = 'mat-option span.mdc-list-item__primary-text';
          const options = await this.rejectedWithdrawalsPage.$$(rejectedOptionSelector);
          
          let rejectedSelected = false;
          for (const option of options) {
            const text = await option.evaluate(el => el.textContent.trim());
            if (text.toLowerCase() === 'reject') {
              await option.click();
              rejectedSelected = true;
              break;
            }
          }

          if (rejectedSelected) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const submitButtonSelector = 'button[mat-raised-button][type="submit"]';
            await this.rejectedWithdrawalsPage.waitForSelector(submitButtonSelector, { 
              visible: true,
              timeout: 5000 
            });
            await this.rejectedWithdrawalsPage.click(submitButtonSelector);
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
          
        } catch (error) {
          logger.error('Error setting rejected filter:', {
            error: error.message,
            stack: error.stack
          });
          
          // Try alternative selector if the first one fails
          try {
            const statusLabel = await this.rejectedWithdrawalsPage
            if (statusLabel.length > 0) {
              const matSelect = await statusLabel[0].evaluateHandle(node => 
                node.closest('mat-select') || node.parentElement.closest('mat-select')
              );
              
              if (matSelect) {
                await matSelect.click();                
                await this.rejectedWithdrawalsPage.waitForSelector('mat-option', { timeout: 5000 });
                const options = await this.rejectedWithdrawalsPage.$$('mat-option');
                
                let rejectedSelected = false;
                for (const option of options) {
                  const text = await option.evaluate(el => el.textContent.trim());
                  if (text.toLowerCase() === 'rejected') {
                    await option.click();
                    rejectedSelected = true;
                    break;
                  }
                }

                if (rejectedSelected) {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  try {
                    // Try by button text
                    const [submitButton] = await this.rejectedWithdrawalsPage.$x("//button[contains(., 'Submit')]");
                    if (submitButton) {
                      await submitButton.click();
                    } else {
                      // Try by class and type
                      const submitButtonSelector = 'button.mat-mdc-raised-button[type="submit"]';
                      await this.rejectedWithdrawalsPage.waitForSelector(submitButtonSelector, { 
                        visible: true,
                        timeout: 5000 
                      });
                      await this.rejectedWithdrawalsPage.click(submitButtonSelector);
                    }
                    await new Promise(resolve => setTimeout(resolve, 3000));
                  } catch (submitError) {
                    logger.error('Error clicking submit button:', {
                      error: submitError.message,
                      stack: submitError.stack
                    });
                  }
                }
              }
            }
          } catch (alternativeError) {
            logger.error('Error with alternative selector:', {
              error: alternativeError.message,
              stack: alternativeError.stack
            });
          }
        }
      }

      // Set up auto-refresh
      const startAutoRefresh = async () => {
        try {
          const refreshButton = await this.rejectedWithdrawalsPage.$('span.d-flex.justify-content-center.align-items-center.pointer');
          if (refreshButton) {
            await refreshButton.click();
          }
        } catch (error) {}
      };

      // Start auto-refresh interval
      const refreshInterval = setInterval(startAutoRefresh, 10000);

      // Clean up interval when browser is closed
      this.rejectedWithdrawalsBrowser.on('disconnected', () => {
        clearInterval(refreshInterval);
        this.isMonitoring = false;
        this.rejectedWithdrawalsBrowser = null;
        this.rejectedWithdrawalsPage = null;
      });

      this.rejectedWithdrawalsPage.on('close', () => {
        clearInterval(refreshInterval);
        this.isMonitoring = false;
        this.rejectedWithdrawalsPage = null;
      });

      this.isMonitoring = true;
      return { success: true, browser: this.rejectedWithdrawalsBrowser, page: this.rejectedWithdrawalsPage };
    } catch (error) {
      logger.error('Error monitoring rejected withdrawals:', {
        error: error.message,
        stack: error.stack
      });
      await this.cleanupRejectedWithdrawals();
      throw error;
    }
  }

  async cleanup() {
    try {
      if (this.pendingDepositsBrowser) {
        await this.pendingDepositsBrowser.close();
      }
      if (this.recentDepositsBrowser) {
        await this.recentDepositsBrowser.close();
      }
      if (this.rejectedDepositsBrowser) {
        await this.rejectedDepositsBrowser.close();
      }
      if (this.pendingWithdrawlsBrowser) {
        await this.pendingWithdrawlsBrowser.close();
      }
      if (this.approvedWithdrawalsBrowser) {
        await this.approvedWithdrawalsBrowser.close();
      }
      if (this.rejectedWithdrawalsBrowser) {
        await this.rejectedWithdrawalsBrowser.close();
      }
    } catch (error) {
      logger.error('Error closing browsers:', error);
    } finally {
      this.pendingDepositsBrowser = null;
      this.recentDepositsBrowser = null;
      this.rejectedDepositsBrowser = null;
      this.pendingWithdrawlsBrowser = null;
      this.approvedWithdrawalsBrowser = null;
      this.rejectedWithdrawalsBrowser = null;
      this.pendingDepositsPage = null;
      this.recentDepositsPage = null;
      this.rejectedDepositsPage = null;
      this.pendingWithdrawlsPage = null;
      this.approvedWithdrawalsPage = null;
      this.rejectedWithdrawalsPage = null;
      this.isMonitoring = false;
    }
  }

  async cleanupPendingDeposits() {
    try {
      if (this.pendingDepositsBrowser) {
        await this.pendingDepositsBrowser.close();
      }
    } catch (error) {
      logger.error('Error closing pending deposits browser:', error);
    } finally {
      this.pendingDepositsBrowser = null;
      this.pendingDepositsPage = null;
    }
  }

  async cleanupRecentDeposits() {
    try {
      if (this.recentDepositsBrowser) {
        await this.recentDepositsBrowser.close();
      }
    } catch (error) {
      logger.error('Error closing recent deposits browser:', error);
    } finally {
      this.recentDepositsBrowser = null;
      this.recentDepositsPage = null;
    }
  }

  async cleanupRejectedDeposits() {
    try {
      if (this.rejectedDepositsBrowser) {
        await this.rejectedDepositsBrowser.close();
      }
    } catch (error) {
      logger.error('Error closing rejected deposits browser:', error);
    } finally {
      this.rejectedDepositsBrowser = null;
      this.rejectedDepositsPage = null;
    }
  }

  async cleanupApprovedWithdrawals() {
    try {
      if (this.approvedWithdrawalsBrowser) {
        await this.approvedWithdrawalsBrowser.close();
      }
    } catch (error) {
      logger.error('Error closing approved withdrawals browser:', error);
    } finally {
      this.approvedWithdrawalsBrowser = null;
      this.approvedWithdrawalsPage = null;
    }
  }

  async cleanupRejectedWithdrawals() {
    try {
      if (this.rejectedWithdrawalsBrowser) {
        await this.rejectedWithdrawalsBrowser.close();
      }
    } catch (error) {
      logger.error('Error closing rejected withdrawals browser:', error);
    } finally {
      this.rejectedWithdrawalsBrowser = null;
      this.rejectedWithdrawalsPage = null;
    }
  }

  async runTranscriptFetchScheduler() {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
    try {
      const transactions = await Transaction.find({
        isImageAvailable: true,
        transcriptLink: null,
        createdAt: { $gte: twentyFourHoursAgo }
      }, 'orderId');
  
      for (const tx of transactions) {
        try {
          await this.fetchTranscript(tx.orderId);
        } catch (err) {
          logger.error(`[TranscriptScheduler] Error fetching transcript for orderId ${tx.orderId}:`, err);
        }
      }
    } catch (err) {
      logger.error('[TranscriptScheduler] Error fetching transactions for transcript:', err);
    }
  }

  async monitorDepositApproval() {
    try {
      if (!response.ok()) {
        throw new Error(`Failed to load deposit approval page: ${response.status()} ${response.statusText()}`);
      }
      await new Promise(resolve => setTimeout(resolve, 30000)); // Monitor for 30 seconds
    } catch (error) {
      logger.error('Error monitoring deposit approval:', {
        error: error.message,
        stack: error.stack,
        // currentUrl: this.page ? this.page.url() : 'N/A'
      });
      throw error;
    }
  }

  async close() {
    await this.cleanup();
    this.isLoggedIn = false;
    this.currentUserId = null;
    this.interceptedRequests.clear();
    this.interceptedResponses.clear();
  }

  async fetchTranscript(orderId) {
    try {
      const authToken = await this.getAuthToken();
      if (!authToken) {
        logger.error('No auth token found in constants');
        return false;
      }

      const response = await axios.post(
        `${process.env.SCRAPING_WEBSITE_URL}/accounts/GetSnap`,
        { orderID: orderId },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
  
      if (response.data) {
        // Update transaction with transcript link
        await Transaction.findOneAndUpdate(
          { orderId },
          { 
            transcriptLink: response.data.imageData,
            lastTranscriptUpdate: new Date()
          }
        );
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Error fetching transcript for order ${orderId}:`, error);
      return false;
    }
  }

  async getAuthToken() {
    try {
      const tokenData = await Constant.findOne({ key: 'SCRAPING_AUTH_TOKEN' });
      if (!tokenData) {
        logger.error('No auth token found in constants');
        return null;
      }
  
      return tokenData.value;
    } catch (error) {
      logger.error('Error fetching auth token:', error);
      return null;
    }
  }
}


module.exports = new NetworkInterceptor();