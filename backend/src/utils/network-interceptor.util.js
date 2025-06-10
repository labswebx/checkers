const puppeteer = require('puppeteer');
// const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const logger = require('./logger.util');
const sessionUtil = require('./session.util');
const transactionService = require('../services/transaction.service');
const fs = require('fs');
const Transaction = require('../models/transaction.model');

// Add stealth plugin to puppeteer
// puppeteer.use(StealthPlugin());

class NetworkInterceptor {
  constructor() {
    this.browser = null;
    this.page = null;
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
        logger.info(`Retry ${retries} failed, waiting ${delay}ms before next attempt`);
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
      logger.info('Initializing network interceptor');
      
      const executablePath = await this.findChromePath();
      if (!executablePath) {
        throw new Error('No valid Chrome installation found');
      }

      // Close existing browser if it exists
      if (this.browser) {
        try {
          await this.browser.close();
        } catch (error) {
          logger.warn('Error closing existing browser:', error);
        }
        this.browser = null;
        this.page = null;
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

      this.page = await this.browser.newPage();
      
      // Set a longer default timeout
      this.page.setDefaultNavigationTimeout(180000); // 3 minutes
      this.page.setDefaultTimeout(180000);

      // Add user agent
      await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

      await this.page.setRequestInterception(true);

      this.page.on('request', async (interceptedRequest) => {
        try {
          if (!interceptedRequest.isInterceptResolutionHandled()) {
            if (interceptedRequest.resourceType() === 'image' || interceptedRequest.resourceType() === 'font') {
              await interceptedRequest.abort();
            } else {
              await interceptedRequest.continue();
            }
          }
        } catch (error) {
          logger.error('Error handling request:', {
            url: interceptedRequest.url(),
            error: error.message
          });
        }
      });

      // Handle browser disconnection
      this.browser.on('disconnected', () => {
        logger.info('Browser disconnected, cleaning up');
        this.browser = null;
        this.page = null;
        this.isMonitoring = false;
      });

      // Handle page closure
      this.page.on('close', () => {
        logger.info('Page closed, cleaning up');
        this.page = null;
        this.isMonitoring = false;
      });

      logger.info('Network interceptor initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize network interceptor:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async setupInterceptors() {
    try {
      logger.info('Setting up network interceptors');
      await this.page.setRequestInterception(true);

      // Intercept all requests
      this.page.on('request', async request => {
        try {
          if (!request.isInterceptResolutionHandled()) {
            // Skip loading images and fonts to reduce bandwidth and improve performance
            if (request.resourceType() === 'image' || request.resourceType() === 'font') {
              await request.abort();
            } else {
              await request.continue();
            }
          }
        } catch (error) {
          logger.error('Error handling request:', {
            url: request.url(),
            error: error.message
          });
        }
      });

      // Intercept all responses
      this.page.on('response', async response => {
        const url = response.url();
        const status = response.status();
        
        // Only process deposit-related responses
        if (url.includes('/api/deposit/pending') || url.includes('/api/deposit/list')) {
          logger.info('Intercepted deposit API response:', {
            url,
            status,
            headers: response.headers()
          });

          try {
            const contentType = response.headers()['content-type'];
            if (contentType && contentType.includes('application/json')) {
              const responseBody = await response.json().catch(() => null);
              
              if (responseBody) {
                logger.info('Deposit API response body:', {
                  url,
                  status,
                  bodyPreview: JSON.stringify(responseBody).substring(0, 500)
                });

                this.interceptedResponses.set(url, {
                  url,
                  status,
                  headers: response.headers(),
                  body: responseBody
                });

                // Process deposit response
                await this.processDepositResponse(responseBody);
              }
            }
          } catch (error) {
            logger.error('Error processing deposit API response:', {
              url,
              status,
              error: error.message,
              stack: error.stack
            });
          }
        }
      });

      // Add error handlers
      this.page.on('error', error => {
        logger.error('Page error:', {
          error: error.message,
          stack: error.stack
        });
      });

      this.page.on('pageerror', error => {
        logger.error('Page JavaScript error:', {
          error: error.message,
          stack: error.stack
        });
      });

      this.page.on('console', msg => {
        logger.debug('Browser console:', {
          type: msg.type(),
          text: msg.text()
        });
      });

      logger.info('Network interceptors setup complete');
    } catch (error) {
      logger.error('Error setting up interceptors:', {
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
      logger.info('Processing deposit response', {
        dataType: typeof responseData,
        hasData: !!responseData,
        keys: responseData ? Object.keys(responseData) : []
      });

      if (!responseData) {
        logger.warn('Empty response data');
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
        logger.warn('No transactions found in response');
        return;
      }

      logger.info('Found transactions to process', {
        count: transactions.length,
        sampleTransaction: JSON.stringify(transactions[0]).substring(0, 500)
      });

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
          
          logger.info('Transaction processed successfully', {
            transactionId: mappedData.transactionId,
            result: processResult
          });

        } catch (error) {
          logger.error('Error processing transaction:', {
            transaction: JSON.stringify(transaction).substring(0, 500),
            error: error.message,
            stack: error.stack
          });
        }
      }

      logger.info('Deposit response processing complete', {
        totalProcessed: transactions.length
      });
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
        logger.info(`Navigation attempt ${attempt} to ${url}`);

        // Add a small delay between retries
        if (attempt > 1) {
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
        }

        const response = await this.page.goto(url, {
          waitUntil: ['networkidle2', 'domcontentloaded'],
          timeout: 60000
        });

        if (response && response.ok()) {
          logger.info(`Successfully navigated to ${url}`);
          return response;
        }

        logger.warn(`Navigation attempt ${attempt} failed with status: ${response ? response.status() : 'unknown'}`);
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
      if (!this.page || this.page.isClosed()) {
        await this.initialize();
      }

      // Check if already logged in
      const currentUrl = this.page.url();
      if (currentUrl.includes('/admin/')) {
        const isValid = await this.validateSession();
        if (isValid) {
          return true;
        }
      }

      // Perform login
      logger.info('Starting login process');
      await this.navigateWithRetry(`${process.env.SCRAPING_WEBSITE_URL}/login`);

      await this.page.waitForSelector('input[type="text"]', { visible: true, timeout: 30000 });
      await this.page.waitForSelector('input[type="password"]', { visible: true, timeout: 30000 });

      await this.page.type('input[type="text"]', process.env.SCRAPING_USERNAME);
      await this.page.type('input[type="password"]', process.env.SCRAPING_PASSWORD);

      const loginButton = await this.page.$('button[type="submit"]');
      if (!loginButton) {
        throw new Error('Login button not found');
      }

      await Promise.all([
        this.page.waitForNavigation({ waitUntil: ['networkidle2', 'domcontentloaded'], timeout: 60000 }),
        loginButton.click()
      ]);

      // Add a small delay after login
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify login success
      return await this.validateSession();
    } catch (error) {
      logger.error('Login failed:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async validateSession() {
    try {
      await this.page.goto('https://dwpanell100.online/admin/dashboard', {
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 60000
      });
      
      // Wait for some dashboard element to confirm we're logged in
      try {
        await this.page.waitForSelector('.dashboard, #dashboard, [data-testid="dashboard"]', {
          timeout: 10000
        });
      } catch (selectorError) {
        logger.warn('Dashboard selector not found, falling back to URL check');
      }
      
      return this.page.url().includes('/admin/dashboard');
    } catch (error) {
      logger.error('Session validation failed:', {
        error: error.message,
        currentUrl: this.page ? this.page.url() : 'N/A'
      });
      return false;
    }
  }

  async monitorPendingDeposits() {
    // If already monitoring, don't start another instance
    // if (this.isMonitoring) {
    //   logger.info('Monitoring already in progress, skipping this call');
    //   return { success: false, reason: 'already_monitoring' };
    // }

    const executablePath = await this.findChromePath();
    let browser = await puppeteer.launch({
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

    let page = await browser.newPage();

    try {
      // If browser exists but page is closed/crashed, clean up first
      if (browser) {
        try {
          const pages = await browser.pages();
          if (pages.length === 0 || !page || page.isClosed()) {
            await this.cleanup();
          }
        } catch (error) {
          logger.warn('Error checking browser state, cleaning up:', error);
          await this.cleanup();
        }
      }

      // Add delay before starting new browser instance
      await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));

      // Only create new browser if we don't have one
      // if (!browser) {
        logger.info('Starting deposit list monitoring');
        
        // Set a longer default timeout
        page.setDefaultNavigationTimeout(180000); // 3 minutes
        page.setDefaultTimeout(180000);

        // Add user agent
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        await page.setRequestInterception(true);

        page.on('request', async (interceptedRequest) => {
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

        page.on('response', async (interceptedResponse) => {
          let url = interceptedResponse.url();

          // Handle deposit list API
          if (url.includes('/accounts/GetListOfRequestsForFranchise')) {
            logger.info('Intercepted GetListOfRequestsForFranchise request ================================================')
            try {
              const json = await interceptedResponse.json();
              const transactions = Array.isArray(json) ? json : json.data || [];

              // Process transactions and click transcript icons
              for (const transaction of transactions) {
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
                  await Transaction.findOneAndUpdate(
                    { orderId: transaction.orderID }, // find criteria
                    transactionData, // update data
                    {
                      upsert: true, // create if doesn't exist
                      new: true, // return updated doc
                      runValidators: true // run schema validators
                    }
                  );
                } catch (transactionError) {
                  logger.error('Error processing individual transaction:', {
                    orderId: transaction?.orderID,
                    error: transactionError.message
                  });
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
        browser.on('disconnected', () => {
          this.isMonitoring = false;
          browser = null;
          page = null;
        });

        page.on('close', () => {
          this.isMonitoring = false;
          page = null;
        });
      // }

      // Only proceed with login if we're not already on the right page
      if (!page.url().includes('/admin/deposit/deposit-approval')) {
        // First handle login
        logger.info('Starting login process');
        await page.goto(`${process.env.SCRAPING_WEBSITE_URL}/login`, {
          waitUntil: 'networkidle2',
          timeout: 90000
        });

        // Wait for selectors with increased timeouts
        await page.waitForSelector('input[type="text"]', { visible: true, timeout: 30000 });
        await page.waitForSelector('input[type="password"]', { visible: true, timeout: 30000 });

        await page.type('input[type="text"]', process.env.SCRAPING_USERNAME);
        await page.type('input[type="password"]', process.env.SCRAPING_PASSWORD);

        const loginButton = await page.$('button[type="submit"]');
        if (!loginButton) {
          throw new Error('Login button not found');
        }

        // Wait for navigation after login
        await Promise.all([
          page.waitForNavigation({ 
            waitUntil: 'networkidle2',
            timeout: 90000
          }),
          loginButton.click()
        ]);

        // Wait a bit after login before next navigation
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Then navigate to deposit approval page
        logger.info('Navigating to deposit approval page');
        await page.goto(`${process.env.SCRAPING_WEBSITE_URL}/admin/deposit/deposit-approval`, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        // Wait for the page to load and API calls to complete
        logger.info('Waiting for deposit approval data to load...');
        try {
          // Wait for table to be visible
          await page.waitForSelector('table', { timeout: 10000 });
          // Additional wait for API calls and data loading
          await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (error) {
          logger.warn('Table not found on deposit approval page, continuing anyway');
        }
      }

      this.isMonitoring = true;
      return { success: true, browser: browser, page: page };
    } catch (error) {
      logger.error('Error monitoring deposit list:', {
        error: error.message,
        stack: error.stack
      });
      await this.cleanup();
      throw error;
    }
  }

  async monitorRecentDeposits() {
    // Add delay before starting
    // await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 3000));
    
    try {
      const executablePath = await this.findChromePath();
      let browser = await puppeteer.launch({
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
  
      let page = await browser.newPage();

      // Only create new browser if we don't have one
      // if (!this.browser) {
        logger.info('Starting recent deposits monitoring');
        
        // Set a longer default timeout
        page.setDefaultNavigationTimeout(180000); // 3 minutes
        page.setDefaultTimeout(180000);

        // Add user agent
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        await page.setRequestInterception(true);

        page.on('request', async (interceptedRequest) => {
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

        page.on('response', async (interceptedResponse) => {
          let url = interceptedResponse.url();

          // Handle deposit list API
          if (url.includes('/accounts/GetListOfRequestsForFranchise')) {
            logger.info('Intercepted GetListOfRequestsForFranchise request in recent deposits --------------------------------');
            try {
              const json = await interceptedResponse.json();
              const transactions = Array.isArray(json) ? json : json.data || [];

              // Process transactions
              for (const transaction of transactions) {
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
                  logger.error('Error processing individual transaction:', {
                    orderId: transaction?.orderID,
                    error: transactionError.message
                  });
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
        browser.on('disconnected', () => {
          this.isMonitoring = false;
          browser = null;
          page = null;
        });

        page.on('close', () => {
          this.isMonitoring = false;
          page = null;
        });
      // }

      // Only proceed with login if we're not already on the right page
      if (!page.url().includes('/admin/deposit/recent-deposit')) {
        // First handle login
        logger.info('Starting login process');
        await page.goto(`${process.env.SCRAPING_WEBSITE_URL}/login`, {
          waitUntil: 'networkidle2',
          timeout: 90000
        });

        // Wait for selectors with increased timeouts
        await page.waitForSelector('input[type="text"]', { visible: true, timeout: 30000 });
        await page.waitForSelector('input[type="password"]', { visible: true, timeout: 30000 });

        await page.type('input[type="text"]', process.env.SCRAPING_USERNAME);
        await page.type('input[type="password"]', process.env.SCRAPING_PASSWORD);

        const loginButton = await page.$('button[type="submit"]');
        if (!loginButton) {
          throw new Error('Login button not found');
        }

        // Wait for navigation after login
        await Promise.all([
          page.waitForNavigation({ 
            waitUntil: 'networkidle2',
            timeout: 90000
          }),
          loginButton.click()
        ]);

        // Wait a bit after login before next navigation
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Navigate to recent deposits page
        logger.info('Navigating to recent deposits page');
        await page.goto(`${process.env.SCRAPING_WEBSITE_URL}/admin/deposit/recent-deposit`, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        // Wait for the page to load and data to be fetched
        // logger.info('Waiting for recent deposits data to load...');
        // try {
        //   await this.page.waitForSelector('table', { timeout: 5000 });
          
        //   logger.info('Waiting for Success status data to load...');
        //   await new Promise(resolve => setTimeout(resolve, 5000));
        // } catch (error) {
        //   logger.warn('Table not found on recent deposits page, continuing anyway');
        // }
      }

      this.isMonitoring = true;
      return { success: true, browser: browser, page: page };
    } catch (error) {
      logger.error('Error monitoring recent deposits:', {
        error: error.message,
        stack: error.stack
      });
      await this.cleanup();
      throw error;
    }
  }

  async monitorRejectedDeposits() {
    // Add delay before starting
    // await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 5000));
    
    try {
      const executablePath = await this.findChromePath();
      let browser = await puppeteer.launch({
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
  
      let page = await browser.newPage();

      // Only create new browser if we don't have one
      // if (!this.browser) {
        logger.info('Starting rejected deposits monitoring');
        browser = await puppeteer.launch({
          headless: 'new',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--window-size=1920,1080',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--ignore-certificate-errors',
            '--ignore-certificate-errors-spki-list',
            '--disable-blink-features=AutomationControlled'
          ],
          defaultViewport: { width: 1920, height: 1080 },
          ignoreHTTPSErrors: true
        });

        await page.setRequestInterception(true);

        page.on('request', async (interceptedRequest) => {
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

        page.on('response', async (interceptedResponse) => {
          let url = interceptedResponse.url();
          // logger.info('Intercepted response inside rejected deposits resopnse', { url });

          // Handle deposit list API
          if (url.includes('/accounts/GetListOfRequestsForFranchise')) {
            logger.info('Intercepted GetListOfRequestsForFranchise request in rejected deposits ############################');
            try {
              const json = await interceptedResponse.json();
              const transactions = Array.isArray(json) ? json : json.data || [];

              // Process transactions
              for (const transaction of transactions) {
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
                  logger.error('Error processing individual transaction:', {
                    orderId: transaction?.orderID,
                    error: transactionError.message
                  });
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
        browser.on('disconnected', () => {
          this.isMonitoring = false;
          browser = null;
          page = null;
        });

        page.on('close', () => {
          this.isMonitoring = false;
          page = null;
        });
      // }

      // Only proceed with login if we're not already on the right page
      if (!page.url().includes('/admin/deposit/recent-deposit')) {
        // First handle login
        logger.info('Starting login process');
        await page.goto(`${process.env.SCRAPING_WEBSITE_URL}/login`, {
          waitUntil: 'networkidle2',
          timeout: 90000
        });

        // Wait for selectors with increased timeouts
        await page.waitForSelector('input[type="text"]', { visible: true, timeout: 30000 });
        await page.waitForSelector('input[type="password"]', { visible: true, timeout: 30000 });

        await page.type('input[type="text"]', process.env.SCRAPING_USERNAME);
        await page.type('input[type="password"]', process.env.SCRAPING_PASSWORD);

        const loginButton = await page.$('button[type="submit"]');
        if (!loginButton) {
          throw new Error('Login button not found');
        }

        // Wait for navigation after login
        await Promise.all([
          page.waitForNavigation({ 
            waitUntil: 'networkidle2',
            timeout: 90000
          }),
          loginButton.click()
        ]);

        // Wait a bit after login before next navigation
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Navigate to recent deposits page
        logger.info('Navigating to rejected deposits page');
        await page.goto(`${process.env.SCRAPING_WEBSITE_URL}/admin/deposit/recent-deposit`, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        // Wait for the page to load and then click the rejected filter
        try {
          // Wait for the filter dropdown to be visible and clickable
          await page.waitForSelector('mat-select[aria-labelledby*="mat-mdc-form-field-label"]', { 
            timeout: 10000,
            visible: true 
          });
          
          // Click the status filter dropdown
          await page.click('mat-select[aria-labelledby*="mat-mdc-form-field-label"]');
          
          // Wait for the options panel to be visible
          await page.waitForSelector('mat-option', { 
            timeout: 5000,
            visible: true 
          });
          
          // Find and click the "Rejected" option using more specific selectors
          const rejectedOptionSelector = 'mat-option span.mdc-list-item__primary-text';
          const options = await page.$$(rejectedOptionSelector);
          
          let rejectedSelected = false;
          for (const option of options) {
            const text = await option.evaluate(el => el.textContent.trim());
            logger.info(`Found option: ${text}`);
            if (text.toLowerCase() === 'reject') {
              await option.click();
              logger.info('Clicked Rejected option');
              rejectedSelected = true;
              break;
            }
          }

          if (rejectedSelected) {
            // Wait a bit for the dropdown to close
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Find and click the submit button
            logger.info('Looking for submit button');
            const submitButtonSelector = 'button[mat-raised-button][type="submit"]';
            await page.waitForSelector(submitButtonSelector, { 
              visible: true,
              timeout: 5000 
            });

            // Click the submit button
            await page.click(submitButtonSelector);
            logger.info('Clicked submit button');

            // Wait for the table to update with rejected transactions
            await new Promise(resolve => setTimeout(resolve, 3000));
          } else {
            logger.warn('Rejected option was not found in the dropdown');
          }
          
        } catch (error) {
          logger.error('Error setting rejected filter:', {
            error: error.message,
            stack: error.stack
          });
          
          // Try alternative selector if the first one fails
          try {
            logger.info('Trying alternative selector for status dropdown');
            
            // Try finding by the visible text "Status"
            const statusLabel = await page
            if (statusLabel.length > 0) {
              // Click the parent mat-select element
              const matSelect = await statusLabel[0].evaluateHandle(node => 
                node.closest('mat-select') || node.parentElement.closest('mat-select')
              );
              
              if (matSelect) {
                await matSelect.click();
                
                // Wait for options and click Rejected
                await page.waitForSelector('mat-option', { timeout: 5000 });
                const options = await page.$$('mat-option');
                
                let rejectedSelected = false;
                for (const option of options) {
                  const text = await option.evaluate(el => el.textContent.trim());
                  if (text.toLowerCase() === 'rejected') {
                    await option.click();
                    logger.info('Clicked Rejected option using alternative method');
                    rejectedSelected = true;
                    break;
                  }
                }

                if (rejectedSelected) {
                  // Wait a bit for the dropdown to close
                  await new Promise(resolve => setTimeout(resolve, 1000));

                  // Try to find and click submit button using multiple approaches
                  logger.info('Looking for submit button (alternative method)');
                  try {
                    // Try by button text
                    const [submitButton] = await page.$x("//button[contains(., 'Submit')]");
                    if (submitButton) {
                      await submitButton.click();
                      logger.info('Clicked submit button using XPath');
                    } else {
                      // Try by class and type
                      const submitButtonSelector = 'button.mat-mdc-raised-button[type="submit"]';
                      await page.waitForSelector(submitButtonSelector, { 
                        visible: true,
                        timeout: 5000 
                      });
                      await page.click(submitButtonSelector);
                      logger.info('Clicked submit button using class selector');
                    }

                    // Wait for the table to update with rejected transactions
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

      this.isMonitoring = true;
      return { success: true, browser: browser, page: page };
    } catch (error) {
      logger.error('Error monitoring rejected deposits:', {
        error: error.message,
        stack: error.stack
      });
      await this.cleanup();
      throw error;
    }
  }

  async cleanup() {
    try {
      if (this.browser) {
        await this.browser.close();
      }
    } catch (error) {
      logger.error('Error closing browser:', error);
    } finally {
      this.browser = null;
      this.page = null;
      this.isMonitoring = false;
    }
  }

  async monitorDepositApproval() {
    try {
      logger.info('Starting deposit approval monitoring');

      const url = `${process.env.SCRAPING_WEBSITE_URL}/admin/deposit/deposit-approval`;
      logger.info('Navigating to deposit approval page', { url });

      // Navigate to the page
      const response = await page.goto(url, {
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 60000
      });

      if (!response.ok()) {
        throw new Error(`Failed to load deposit approval page: ${response.status()} ${response.statusText()}`);
      }

      // Wait for table to load initially
      // await this.page.waitForSelector('table', { timeout: 5000 })
      //   .catch(() => logger.warn('Table element not found on page'));

      // Stay on the page to continue intercepting
      logger.info('Monitoring deposit approval API calls...');
      
      // Keep the monitoring active
      await new Promise(resolve => setTimeout(resolve, 30000)); // Monitor for 30 seconds

      logger.info('Deposit approval monitoring complete');
    } catch (error) {
      logger.error('Error monitoring deposit approval:', {
        error: error.message,
        stack: error.stack,
        currentUrl: page ? page.url() : 'N/A'
      });
      throw error;
    }
  }

  async close() {
    logger.info('Closing network interceptor');
    
    if (this.browser) {
      if (this.isLoggedIn && this.currentUserId) {
        await sessionUtil.saveSession(this.currentUserId, this.page);
      }
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.isLoggedIn = false;
      this.currentUserId = null;
      this.interceptedRequests.clear();
      this.interceptedResponses.clear();
      logger.info('Network interceptor closed successfully');
    }
  }

  async clickTranscriptIcon(orderId) {
    try {
      logger.info('Looking for transcript button for order:', { orderId });

      // Wait for table and its content to be present
      await this.page.waitForSelector('table', { timeout: 10000 });
      
      // Wait a bit for data to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Try to find the row with retries and pagination
      let maxRetries = 5;
      let found = false;

      while (maxRetries > 0 && !found) {
        // Check if row exists in current page
        const result = await this.page.evaluate((targetOrderId) => {
          // Helper function to safely get text content
          const getTextContent = (element) => {
            try {
              return (element.textContent || '').trim();
            } catch (e) {
              return '';
            }
          };

          // Try different selectors to find the table
          const table = document.querySelector('table') || 
                       document.querySelector('.mat-table') ||
                       document.querySelector('[role="grid"]');
                       
          if (!table) {
            return { success: false, error: 'Table not found' };
          }

          // Find all rows in the table
          const rows = Array.from(table.querySelectorAll('tr, .mat-row'));
          
          // Debug info about rows and their content
          const rowsInfo = rows.map(row => {
            const cells = Array.from(row.querySelectorAll('td, .mat-cell'));
            return {
              cellCount: cells.length,
              cellContents: cells.map(cell => getTextContent(cell)),
              hasTranscriptCell: !!row.querySelector('.cdk-column-transcript')
            };
          });

          // Find the row containing our orderId
          const targetRow = rows.find(row => {
            const cells = Array.from(row.querySelectorAll('td, .mat-cell'));
            return cells.some(cell => {
              const text = getTextContent(cell);
              // Try both exact match and as part of cell content
              return text === targetOrderId.toString() || text.includes(targetOrderId.toString());
            });
          });

          if (!targetRow) {
            // Check if we have pagination
            const nextButton = document.querySelector('button.mat-paginator-next, .mat-paginator-navigation-next');
            const isNextEnabled = nextButton && !nextButton.disabled;
            
            return { 
              success: false, 
              error: `Row not found for orderId: ${targetOrderId}`,
              debug: {
                totalRows: rows.length,
                rowsInfo,
                tableHtml: table.innerHTML.substring(0, 500),
                hasNextPage: isNextEnabled
              }
            };
          }

          // Find the transcript cell in this row
          const transcriptCell = Array.from(targetRow.querySelectorAll('td, .mat-cell'))
            .find(td => td.classList.contains('cdk-column-transcript'));

          if (!transcriptCell) {
            return { 
              success: false, 
              error: 'Transcript cell not found in row',
              debug: {
                rowHtml: targetRow.innerHTML,
                cellClasses: Array.from(targetRow.querySelectorAll('td')).map(td => td.className)
              }
            };
          }

          // Find the button - try multiple possible selectors
          const button = transcriptCell.querySelector('button') || 
                        transcriptCell.querySelector('mat-icon') ||
                        transcriptCell.querySelector('[role="button"]');

          if (!button) {
            return { 
              success: false, 
              error: 'Button not found in transcript cell',
              debug: {
                cellHtml: transcriptCell.innerHTML,
                cellChildren: Array.from(transcriptCell.children).map(c => c.tagName)
              }
            };
          }

          // Click the button
          button.click();
          
          return { 
            success: true,
            debug: {
              rowFound: true,
              cellFound: true,
              buttonFound: true,
              rowHtml: targetRow.innerHTML,
              cellHtml: transcriptCell.innerHTML,
              buttonHtml: button.outerHTML
            }
          };
        }, orderId);

        if (result.success) {
          found = true;
          logger.info('Successfully clicked transcript button:', {
            orderId,
            debug: result.debug
          });
          break;
        } else {
          // If there's a next page and we haven't found our row yet
          const hasNextPage = result.debug?.hasNextPage;
          
          if (hasNextPage) {
            logger.info('Row not found in current page, trying next page...', { orderId });
            
            // Click the next page button
            await this.page.evaluate(() => {
              const nextButton = document.querySelector('button.mat-paginator-next, .mat-paginator-navigation-next');
              if (nextButton && !nextButton.disabled) {
                nextButton.click();
              }
            });
            
            // Wait for table to update
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            // If no next page, break the loop
            logger.warn('No more pages to check', { orderId });
            break;
          }
        }

        maxRetries--;
      }

      if (!found) {
        logger.warn('Failed to find and click transcript button after checking all pages:', {
          orderId
        });
        
        // Log the current page state for debugging
        const pageState = await this.page.evaluate(() => ({
          url: window.location.href,
          tablePresent: !!document.querySelector('table'),
          rowCount: document.querySelectorAll('tr').length,
          tdCount: document.querySelectorAll('td').length,
          paginatorPresent: !!document.querySelector('.mat-paginator, .mat-paginator-navigation-next'),
          visibleText: Array.from(document.querySelectorAll('td'))
            .map(td => td.textContent.trim())
            .filter(text => text)
            .slice(0, 10)
        }));

        logger.debug('Final page state:', pageState);
        return false;
      }

      // Wait for the API call to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      return true;

    } catch (error) {
      logger.error('Error clicking transcript button:', {
        orderId,
        error: error.message,
        stack: error.stack
      });

      // Log the page content for debugging
      try {
        const html = await this.page.content();
        logger.debug('Page content at time of error:', {
          orderId,
          contentPreview: html.substring(0, 1000)
        });
      } catch (debugError) {
        logger.error('Error getting page content:', debugError);
      }
      return false;
    }
  }
}

module.exports = new NetworkInterceptor(); 