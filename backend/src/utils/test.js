const puppeteer = require("puppeteer");
const logger = require("./logger.util");
const sentryUtil = require("./sentry.util");
const transactionService = require("../services/transaction.service");
const notificationService = require("../services/notification.service");
const fs = require("fs");
const Transaction = require("../models/transaction.model");
const Constant = require("../models/constant.model");
const axios = require("axios");
const { TRANSACTION_STATUS } = require("../constants");
const { defaultCache: Cache } = require("./cache.util");

class NetworkInterceptor {
  constructor() {
    this.executablePath = null;
    this.isMonitoringPendingDeposits = false;
    this.pendingDepositsBrowser = null;
    this.pendingDepositsPage = null;

    this.isMonitoringRecentDeposits = false;
    this.recentDepositsBrowser = null;
    this.recentDepositsPage = null;

    this.isMonitoringRejectedDeposits = false;
    this.rejectedDepositsBrowser = null;
    this.rejectedDepositsPage = null;

    this.isMonitoringPendingWithdrawals = false;
    this.pendingWithdrawalsBrowser = null;
    this.pendingWithdrawalsPage = null;

    this.isMonitoringApprovedWithdrawals = false;
    this.approvedWithdrawalsBrowser = null;
    this.approvedWithdrawalsPage = null;

    this.isMonitoringRejectedWithdrawals = false;
    this.rejectedWithdrawalsBrowser = null;
    this.rejectedWithdrawalsPage = null;
  }

  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/snap/chromium/current/usr/lib/chromium-browser/chrome",
      "/snap/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
    ];

    for (const browserPath of possiblePaths) {
      if (browserPath && fs.existsSync(browserPath)) {
        return browserPath;
      }
    }
    return null;
  }

  async initialize() {
    // This now simply finds and stores the executable path once.
    const executablePath = await this.findChromePath();
    if (!executablePath) {
      throw new Error("No valid Chrome installation found");
    }
    this.executablePath = executablePath;
    logger.info(`Chrome executable path set to: ${this.executablePath}`);
  }

  /**
   * Helper method to launch a new browser and set up a page with common configurations.
   * @returns {Promise<{browser: puppeteer.Browser, page: puppeteer.Page}>}
   */
  async _initializeBrowserAndPage() {
    if (!this.executablePath) {
      throw new Error("Chrome executable path not set. Call initialize() first.");
    }
    const browser = await puppeteer.launch({
      headless: "new",
      executablePath: this.executablePath,
      product: "chrome",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--window-size=1920,1080",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
        "--ignore-certificate-errors",
        "--ignore-certificate-errors-spki-list",
        "--disable-blink-features=AutomationControlled",
        "--disable-infobars",
        "--disable-notifications",
        "--disable-popup-blocking",
        "--disable-extensions",
        "--disable-gpu",
      ],
      defaultViewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(180000); // 3 minutes
    page.setDefaultTimeout(180000);
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );
    return { browser, page };
  }

  /**
   * Encapsulates the entire login process for a given page.
   * @param {puppeteer.Page} page - The Puppeteer page instance.
   */
  async _performLogin(page) {
    await page.goto(`${process.env.SCRAPING_WEBSITE_URL}/login`, {
      waitUntil: "networkidle2",
      timeout: 90000,
    });

    await page.waitForSelector('input[type="text"]', {
      visible: true,
      timeout: 30000,
    });
    await page.waitForSelector('input[type="password"]', {
      visible: true,
      timeout: 30000,
    });

    await page.type('input[type="text"]', process.env.SCRAPING_USERNAME);
    await page.type('input[type="password"]', process.env.SCRAPING_PASSWORD);

    const loginButton = await page.$('button[type="submit"]');
    if (!loginButton) {
      throw new Error("Login button not found");
    }

    await Promise.all([
      page.waitForNavigation({
        waitUntil: "networkidle2",
        timeout: 90000,
      }),
      loginButton.click(),
    ]);

    await this.sleep(1500); // Wait a bit after login
  }

  /**
   * Handles the response from the login API to store the auth token.
   * @param {puppeteer.Response} interceptedResponse - The Puppeteer intercepted response.
   */
  async _handleLoginResponse(interceptedResponse, includeFiveFortyMinutesCheck = false) {
    if (interceptedResponse.url().includes("/accounts/login")) {
      try {
        const responseData = await interceptedResponse.json();
        if (responseData && responseData.detail && responseData.detail.token) {
          // You can keep the token age check here if it's still desired.
          // For simplicity, removing the 5h40m check as it might complicate initial token storage.
          let existingToken = null;
          let fiveHoursFortyMins = 0;
          if(includeFiveFortyMinutesCheck) {
           existingToken = await Constant.findOne({
                            key: "SCRAPING_AUTH_TOKEN",
                          });
            fiveHoursFortyMins = 5 * 60 * 60 * 1000 + 40 * 60 * 1000; // 5h40m in milliseconds  
          }
          if(!includeFiveFortyMinutesCheck || !existingToken || Date.now() - existingToken.lastUpdated.getTime() > fiveHoursFortyMins) {
          await Constant.findOneAndUpdate(
            { key: "SCRAPING_AUTH_TOKEN" },
            { value: responseData.detail.token, lastUpdated: new Date() },
            { upsert: true }
          );
          logger.info("Auth token updated from login response.");
        }
        }
      } catch (error) {
        logger.error("Error processing login response:", error);
        sentryUtil.captureException(error, {
          context: '_handleLoginResponse_failed',
          method: '_handleLoginResponse',
        });
      }
    }
  }

  /**
   * Sets up generic network request interception.
   * @param {puppeteer.Page} page - The Puppeteer page instance.
   * @param {string} taskName - Name of the monitoring task for logging/Sentry.
   * @param {string} transactionType - Type of transaction (e.g., 'deposit', 'withdrawal').
   * @param {boolean} fetchTranscriptForPending - Whether to fetch transcript if this is a pending deposit.
   */
  async _setupNetworkInterception(page, taskName, transactionType, fetchTranscriptForPending = false) {
    await page.setRequestInterception(true);

    page.on("request", async (interceptedRequest) => {
      try {
        if (!interceptedRequest.isInterceptResolutionHandled()) {
          await interceptedRequest.continue();
        }
      } catch (error) {
        logger.error(`Error handling request for ${taskName}:`, { url: interceptedRequest.url(), error: error.message });
      }
    });

    page.on("response", async (interceptedResponse) => {
      try {
        await this._handleLoginResponse(interceptedResponse); // Handle login token updates
        
        // Handle specific transaction list response
        const url = interceptedResponse.url();
        if (url.includes("/accounts/GetListOfRequestsForFranchise")) {
          logger.info(`Received transaction list response for ${taskName}`);
          await this._processTransactionListResponse(
            interceptedResponse,
            transactionType,
            fetchTranscriptForPending
          );
        }
      } catch (error) {
        logger.error(`Error in response handler for ${taskName}:`, error);
        sentryUtil.captureException(error, {
          context: `${taskName}_response_handler_error`,
          method: `_setupNetworkInterception`,
        });
      }
    });
  }

  /**
   * Generic handler to process transaction list responses from the API.
   * @param {puppeteer.Response} interceptedResponse - The Puppeteer intercepted response object.
   * @param {string} transactionType - 'deposit' or 'withdrawal'. This is used for logging and Sentry context.
   * @param {boolean} fetchTranscriptForPending - If true, will attempt to fetch transcript for pending deposits.
   */
  async _processTransactionListResponse(interceptedResponse, transactionType, fetchTranscriptForPending) {
    let url = interceptedResponse.url();
    // Ensure we are processing the correct API response
    if (!url.includes("/accounts/GetListOfRequestsForFranchise")) {
      return;
    }

    try {
      const json = await interceptedResponse.json();
      const transactions = Array.isArray(json) ? json : json.data || [];

      for (const transaction of transactions) {
        try {
          if (transaction.amount >= 0) {
            await transactionService.findOrCreateAgent(
              transaction.franchiseName.split(" (")[0]
            );

            const mappedData = {
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
                      isImageAvailable: transaction.isImageAvailable,
                    };

            await Transaction.findOneAndUpdate(
              { orderId: transaction.orderID },
              mappedData,
              { upsert: true, new: true, runValidators: true }
            );

            // Conditional logic for fetching transcript, only if enabled for this type
            if (fetchTranscriptForPending && mappedData.transactionStatus === TRANSACTION_STATUS.PENDING_DEPOSIT) {
              let authToken = await Constant.findOne({ key: "SCRAPING_AUTH_TOKEN" });
              authToken = authToken?.value;
              if (authToken) {
                  let fetchTranscriptResponse = await this.fetchTranscript(transaction.orderID, authToken);
                  logger.info(`fetchTranscriptResponse - ${fetchTranscriptResponse}, orderId - ${transaction.orderID}`);
              }
            }
          }
        } catch (transactionError) {
          logger.error("Error processing individual transaction:", {
            orderId: transaction?.orderID,
            error: transactionError.message,
          });
          sentryUtil.captureException(transactionError, {
            context: `_processTransactionListResponse_transaction_update`,
            orderId: transaction?.orderID,
            method: `_processTransactionListResponse`,
            transactionType: transactionType,
          });
        }
      }
    } catch (err) {
      logger.error("Error processing API response:", {
        url,
        error: err.message,
      });
      sentryUtil.captureException(err, {
        context: `_processTransactionListResponse_api_error`,
        url: url,
        method: `_processTransactionListResponse`,
        statusCode: err.response?.status || "unknown",
      });
    }
  }

  /**
   * Helper method to handle cleanup for a specific browser and page instance.
   * @param {puppeteer.Browser} browser - The browser instance to close.
   * @param {puppeteer.Page} page - The page instance to close.
   */
  async _cleanupBrowserAndPage(browser, page) {
    try {
      if (page && !page.isClosed()) {
        await page.close();
      }
    } catch (error) {
      logger.error("Error closing page:", error);
    }
    try {
      if (browser) {
        await browser.close();
      }
    } catch (error) {
      logger.error("Error closing browser:", error);
    }
  }

  // --- EXISTING MONITORING FUNCTIONS - NOW USING HELPER METHODS ---

  async monitorPendingDeposits() {
    // Clear previous browser/page if they exist
    if (this.pendingDepositsBrowser || this.pendingDepositsPage) {
      await this._cleanupBrowserAndPage(this.pendingDepositsBrowser, this.pendingDepositsPage);
      this.pendingDepositsBrowser = null;
      this.pendingDepositsPage = null;
      this.isMonitoringPendingDeposits = false;
    }

    try {
      const { browser, page } = await this._initializeBrowserAndPage();
      this.pendingDepositsBrowser = browser;
      this.pendingDepositsPage = page;
      this.isMonitoringPendingDeposits = true;

      // Set up generic network interception. Pass true for fetching transcript.
      await this._setupNetworkInterception(this.pendingDepositsPage, 'pendingDeposits', 'deposit', true);

      // Handle browser/page closure events
      this.pendingDepositsBrowser.on("disconnected", () => {
        logger.error('pending_deposits_browser_disconnected');
        this.isMonitoringPendingDeposits = false;
        this.pendingDepositsBrowser = null;
        this.pendingDepositsPage = null;
      });
      this.pendingDepositsPage.on("close", () => {
        logger.error(`pending_deposits_page_closed`);
        this.isMonitoringPendingDeposits = false;
        this.pendingDepositsPage = null;
      });

      // Perform login using the helper method
      await this._performLogin(this.pendingDepositsPage);
      logger.info('Successfully logged in for Pending Deposits.');

      // Navigate to the specific monitoring URL
      await this.pendingDepositsPage.goto(
        `${process.env.SCRAPING_WEBSITE_URL}/admin/deposit/deposit-approval`,
        {
          waitUntil: "networkidle2",
          timeout: 90000,
        }
      );
      logger.info('Navigated to pending deposits page.');

      try {
        await this.pendingDepositsPage.waitForSelector("table", {
          timeout: 10000,
        });
        await this.sleep(5000); // Additional wait for data loading
        logger.info('Table detected and additional sleep completed for pending deposits.');
      } catch (error) {
        logger.warn('Failed to find table or data took long to load for pending deposits.');
        sentryUtil.captureException(error, {
          context: 'monitor_pending_deposits_waiting_for_table_failed',
          method: 'monitorPendingDeposits',
          transactionType: 'deposit'
        });
      }

      return {
        success: true,
        browser: this.pendingDepositsBrowser,
        page: this.pendingDepositsPage,
      };
    } catch (error) {
      logger.error("Error monitoring pending deposits:", {
        error: error.message,
        stack: error.stack,
      });
      sentryUtil.captureException(error, {
        context: 'monitor_pending_deposits_failed',
        method: 'monitorPendingDeposits',
        transactionType: 'deposit'
      });
      // Ensure cleanup on error
      if (this.pendingDepositsBrowser || this.pendingDepositsPage) {
          await this._cleanupBrowserAndPage(this.pendingDepositsBrowser, this.pendingDepositsPage);
          this.pendingDepositsBrowser = null;
          this.pendingDepositsPage = null;
          this.isMonitoringPendingDeposits = false;
      }
      throw error;
    }
  }

  async monitorRecentDeposits() {
    // Clear previous browser/page if they exist
    if (this.recentDepositsBrowser || this.recentDepositsPage) {
      await this._cleanupBrowserAndPage(this.recentDepositsBrowser, this.recentDepositsPage);
      this.recentDepositsBrowser = null;
      this.recentDepositsPage = null;
      this.isMonitoringRecentDeposits = false;
    }

    try {
      const { browser, page } = await this._initializeBrowserAndPage();
      this.recentDepositsBrowser = browser;
      this.recentDepositsPage = page;
      this.isMonitoringRecentDeposits = true;

      // Set up generic network interception. No need to fetch transcript for recent.
      await this._setupNetworkInterception(this.recentDepositsPage, 'recentDeposits', 'deposit', false);

      // Handle browser/page closure events
      this.recentDepositsBrowser.on("disconnected", () => {
        logger.error('recent_deposits_browser_disconnected');
        this.isMonitoringRecentDeposits = false;
        this.recentDepositsBrowser = null;
        this.recentDepositsPage = null;
      });
      this.recentDepositsPage.on("close", () => {
        logger.error(`recent_deposits_page_closed`);
        this.isMonitoringRecentDeposits = false;
        this.recentDepositsPage = null;
      });

      // Perform login using the helper method
      await this._performLogin(this.recentDepositsPage);
      logger.info('Successfully logged in for Recent Deposits.');

      // Navigate to the specific monitoring URL
      await this.recentDepositsPage.goto(
        `${process.env.SCRAPING_WEBSITE_URL}/admin/deposit/recent-deposit`,
        {
          waitUntil: "networkidle2",
          timeout: 90000,
        }
      );
      logger.info('Navigated to recent deposits page.');

      try {
        await this.recentDepositsPage.waitForSelector("table", {
          timeout: 10000,
        });
        await this.sleep(5000); // Additional wait for data loading
        logger.info('Table detected and additional sleep completed for recent deposits.');
      } catch (error) {
        logger.warn('Failed to find table or data took long to load for recent deposits.');
        sentryUtil.captureException(error, {
          context: 'monitor_recent_deposits_waiting_for_table_failed',
          method: 'monitorRecentDeposits',
          transactionType: 'deposit'
        });
      }

      return {
        success: true,
        browser: this.recentDepositsBrowser,
        page: this.recentDepositsPage,
      };
    } catch (error) {
      logger.error("Error monitoring recent deposits:", {
        error: error.message,
        stack: error.stack,
      });
      sentryUtil.captureException(error, {
        context: 'monitor_recent_deposits_failed',
        method: 'monitorRecentDeposits',
        transactionType: 'deposit'
      });
      // Ensure cleanup on error
      if (this.recentDepositsBrowser || this.recentDepositsPage) {
          await this._cleanupBrowserAndPage(this.recentDepositsBrowser, this.recentDepositsPage);
          this.recentDepositsBrowser = null;
          this.recentDepositsPage = null;
          this.isMonitoringRecentDeposits = false;
      }
      throw error;
    }
  }

  // You will apply the same pattern to these:
  async monitorRejectedDeposits() {
    if (this.rejectedDepositsBrowser || this.rejectedDepositsPage) {
      await this._cleanupBrowserAndPage(this.rejectedDepositsBrowser, this.rejectedDepositsPage);
      this.rejectedDepositsBrowser = null;
      this.rejectedDepositsPage = null;
      this.isMonitoringRejectedDeposits = false;
    }

    try {
      const { browser, page } = await this._initializeBrowserAndPage();
      this.rejectedDepositsBrowser = browser;
      this.rejectedDepositsPage = page;
      this.isMonitoringRejectedDeposits = true;

      await this._setupNetworkInterception(this.rejectedDepositsPage, 'rejectedDeposits', 'deposit', false);

      this.rejectedDepositsBrowser.on("disconnected", () => {
        logger.error('rejected_deposits_browser_disconnected');
        this.isMonitoringRejectedDeposits = false;
        this.rejectedDepositsBrowser = null;
        this.rejectedDepositsPage = null;
      });
      this.rejectedDepositsPage.on("close", () => {
        logger.error(`rejected_deposits_page_closed`);
        this.isMonitoringRejectedDeposits = false;
        this.rejectedDepositsPage = null;
      });

      await this._performLogin(this.rejectedDepositsPage);
      logger.info('Successfully logged in for Rejected Deposits.');

      await this.rejectedDepositsPage.goto(
        `${process.env.SCRAPING_WEBSITE_URL}/admin/deposit/rejected-deposit`,
        {
          waitUntil: "networkidle2",
          timeout: 90000,
        }
      );
      logger.info('Navigated to rejected deposits page.');

      try {
        await this.rejectedDepositsPage.waitForSelector("table", {
          timeout: 10000,
        });
        await this.sleep(5000);
        logger.info('Table detected and additional sleep completed for rejected deposits.');
      } catch (error) {
        logger.warn('Failed to find table or data took long to load for rejected deposits.');
        sentryUtil.captureException(error, {
          context: 'monitor_rejected_deposits_waiting_for_table_failed',
          method: 'monitorRejectedDeposits',
          transactionType: 'deposit'
        });
      }

      return {
        success: true,
        browser: this.rejectedDepositsBrowser,
        page: this.rejectedDepositsPage,
      };
    } catch (error) {
      logger.error("Error monitoring rejected deposits:", {
        error: error.message,
        stack: error.stack,
      });
      sentryUtil.captureException(error, {
        context: 'monitor_rejected_deposits_failed',
        method: 'monitorRejectedDeposits',
        transactionType: 'deposit'
      });
      if (this.rejectedDepositsBrowser || this.rejectedDepositsPage) {
          await this._cleanupBrowserAndPage(this.rejectedDepositsBrowser, this.rejectedDepositsPage);
          this.rejectedDepositsBrowser = null;
          this.rejectedDepositsPage = null;
          this.isMonitoringRejectedDeposits = false;
      }
      throw error;
    }
  }

  async monitorPendingWithdrawals() {
    if (this.pendingWithdrawalsBrowser || this.pendingWithdrawalsPage) {
      await this._cleanupBrowserAndPage(this.pendingWithdrawalsBrowser, this.pendingWithdrawalsPage);
      this.pendingWithdrawalsBrowser = null;
      this.pendingWithdrawalsPage = null;
      this.isMonitoringPendingWithdrawals = false;
    }

    try {
      const { browser, page } = await this._initializeBrowserAndPage();
      this.pendingWithdrawalsBrowser = browser;
      this.pendingWithdrawalsPage = page;
      this.isMonitoringPendingWithdrawals = true;

      // Withdrawals typically don't have transcripts in the same way deposits do.
      await this._setupNetworkInterception(this.pendingWithdrawalsPage, 'pendingWithdrawals', 'withdrawal', false);

      this.pendingWithdrawalsBrowser.on("disconnected", () => {
        logger.error('pending_withdrawals_browser_disconnected');
        this.isMonitoringPendingWithdrawals = false;
        this.pendingWithdrawalsBrowser = null;
        this.pendingWithdrawalsPage = null;
      });
      this.pendingWithdrawalsPage.on("close", () => {
        logger.error(`pending_withdrawals_page_closed`);
        this.isMonitoringPendingWithdrawals = false;
        this.pendingWithdrawalsPage = null;
      });

      await this._performLogin(this.pendingWithdrawalsPage);
      logger.info('Successfully logged in for Pending Withdrawals.');

      await this.pendingWithdrawalsPage.goto(
        `${process.env.SCRAPING_WEBSITE_URL}/admin/withdrawal/withdrawal-approval`,
        {
          waitUntil: "networkidle2",
          timeout: 90000,
        }
      );
      logger.info('Navigated to pending withdrawals page.');

      try {
        await this.pendingWithdrawalsPage.waitForSelector("table", {
          timeout: 10000,
        });
        await this.sleep(5000);
        logger.info('Table detected and additional sleep completed for pending withdrawals.');
      } catch (error) {
        logger.warn('Failed to find table or data took long to load for pending withdrawals.');
        sentryUtil.captureException(error, {
          context: 'monitor_pending_withdrawals_waiting_for_table_failed',
          method: 'monitorPendingWithdrawals',
          transactionType: 'withdrawal'
        });
      }

      return {
        success: true,
        browser: this.pendingWithdrawalsBrowser,
        page: this.pendingWithdrawalsPage,
      };
    } catch (error) {
      logger.error("Error monitoring pending withdrawals:", {
        error: error.message,
        stack: error.stack,
      });
      sentryUtil.captureException(error, {
        context: 'monitor_pending_withdrawals_failed',
        method: 'monitorPendingWithdrawals',
        transactionType: 'withdrawal'
      });
      if (this.pendingWithdrawalsBrowser || this.pendingWithdrawalsPage) {
          await this._cleanupBrowserAndPage(this.pendingWithdrawalsBrowser, this.pendingWithdrawalsPage);
          this.pendingWithdrawalsBrowser = null;
          this.pendingWithdrawalsPage = null;
          this.isMonitoringPendingWithdrawals = false;
      }
      throw error;
    }
  }

  async monitorApprovedWithdrawals() {
    if (this.approvedWithdrawalsBrowser || this.approvedWithdrawalsPage) {
      await this._cleanupBrowserAndPage(this.approvedWithdrawalsBrowser, this.approvedWithdrawalsPage);
      this.approvedWithdrawalsBrowser = null;
      this.approvedWithdrawalsPage = null;
      this.isMonitoringApprovedWithdrawals = false;
    }

    try {
      const { browser, page } = await this._initializeBrowserAndPage();
      this.approvedWithdrawalsBrowser = browser;
      this.approvedWithdrawalsPage = page;
      this.isMonitoringApprovedWithdrawals = true;

      await this._setupNetworkInterception(this.approvedWithdrawalsPage, 'approvedWithdrawals', 'withdrawal', false);

      this.approvedWithdrawalsBrowser.on("disconnected", () => {
        logger.error('approved_withdrawals_browser_disconnected');
        this.isMonitoringApprovedWithdrawals = false;
        this.approvedWithdrawalsBrowser = null;
        this.approvedWithdrawalsPage = null;
      });
      this.approvedWithdrawalsPage.on("close", () => {
        logger.error(`approved_withdrawals_page_closed`);
        this.isMonitoringApprovedWithdrawals = false;
        this.approvedWithdrawalsPage = null;
      });

      await this._performLogin(this.approvedWithdrawalsPage);
      logger.info('Successfully logged in for Approved Withdrawals.');

      await this.approvedWithdrawalsPage.goto(
        `${process.env.SCRAPING_WEBSITE_URL}/admin/withdrawal/recent-withdrawal`,
        {
          waitUntil: "networkidle2",
          timeout: 90000,
        }
      );
      logger.info('Navigated to approved withdrawals page.');

      try {
        await this.approvedWithdrawalsPage.waitForSelector("table", {
          timeout: 10000,
        });
        await this.sleep(5000);
        logger.info('Table detected and additional sleep completed for approved withdrawals.');
      } catch (error) {
        logger.warn('Failed to find table or data took long to load for approved withdrawals.');
        sentryUtil.captureException(error, {
          context: 'monitor_approved_withdrawals_waiting_for_table_failed',
          method: 'monitorApprovedWithdrawals',
          transactionType: 'withdrawal'
        });
      }

      return {
        success: true,
        browser: this.approvedWithdrawalsBrowser,
        page: this.approvedWithdrawalsPage,
      };
    } catch (error) {
      logger.error("Error monitoring approved withdrawals:", {
        error: error.message,
        stack: error.stack,
      });
      sentryUtil.captureException(error, {
        context: 'monitor_approved_withdrawals_failed',
        method: 'monitorApprovedWithdrawals',
        transactionType: 'withdrawal'
      });
      if (this.approvedWithdrawalsBrowser || this.approvedWithdrawalsPage) {
          await this._cleanupBrowserAndPage(this.approvedWithdrawalsBrowser, this.approvedWithdrawalsPage);
          this.approvedWithdrawalsBrowser = null;
          this.approvedWithdrawalsPage = null;
          this.isMonitoringApprovedWithdrawals = false;
      }
      throw error;
    }
  }

  async monitorRejectedWithdrawals() {
    if (this.rejectedWithdrawalsBrowser || this.rejectedWithdrawalsPage) {
      await this._cleanupBrowserAndPage(this.rejectedWithdrawalsBrowser, this.rejectedWithdrawalsPage);
      this.rejectedWithdrawalsBrowser = null;
      this.rejectedWithdrawalsPage = null;
      this.isMonitoringRejectedWithdrawals = false;
    }

    try {
      const { browser, page } = await this._initializeBrowserAndPage();
      this.rejectedWithdrawalsBrowser = browser;
      this.rejectedWithdrawalsPage = page;
      this.isMonitoringRejectedWithdrawals = true;

      await this._setupNetworkInterception(this.rejectedWithdrawalsPage, 'rejectedWithdrawals', 'withdrawal', false);

      this.rejectedWithdrawalsBrowser.on("disconnected", () => {
        logger.error('rejected_withdrawals_browser_disconnected');
        this.isMonitoringRejectedWithdrawals = false;
        this.rejectedWithdrawalsBrowser = null;
        this.rejectedWithdrawalsPage = null;
      });
      this.rejectedWithdrawalsPage.on("close", () => {
        logger.error(`rejected_withdrawals_page_closed`);
        this.isMonitoringRejectedWithdrawals = false;
        this.rejectedWithdrawalsPage = null;
      });

      await this._performLogin(this.rejectedWithdrawalsPage);
      logger.info('Successfully logged in for Rejected Withdrawals.');

      await this.rejectedWithdrawalsPage.goto(
        `${process.env.SCRAPING_WEBSITE_URL}/admin/withdrawal/rejected-withdrawal`,
        {
          waitUntil: "networkidle2",
          timeout: 90000,
        }
      );
      logger.info('Navigated to rejected withdrawals page.');

      try {
        await this.rejectedWithdrawalsPage.waitForSelector("table", {
          timeout: 10000,
        });
        await this.sleep(5000);
        logger.info('Table detected and additional sleep completed for rejected withdrawals.');
      } catch (error) {
        logger.warn('Failed to find table or data took long to load for rejected withdrawals.');
        sentryUtil.captureException(error, {
          context: 'monitor_rejected_withdrawals_waiting_for_table_failed',
          method: 'monitorRejectedWithdrawals',
          transactionType: 'withdrawal'
        });
      }

      return {
        success: true,
        browser: this.rejectedWithdrawalsBrowser,
        page: this.rejectedWithdrawalsPage,
      };
    } catch (error) {
      logger.error("Error monitoring rejected withdrawals:", {
        error: error.message,
        stack: error.stack,
      });
      sentryUtil.captureException(error, {
        context: 'monitor_rejected_withdrawals_failed',
        method: 'monitorRejectedWithdrawals',
        transactionType: 'withdrawal'
      });
      if (this.rejectedWithdrawalsBrowser || this.rejectedWithdrawalsPage) {
          await this._cleanupBrowserAndPage(this.rejectedWithdrawalsBrowser, this.rejectedWithdrawalsPage);
          this.rejectedWithdrawalsBrowser = null;
          this.rejectedWithdrawalsPage = null;
          this.isMonitoringRejectedWithdrawals = false;
      }
      throw error;
    }
  }


  // --- CLEANUP FUNCTIONS (now using _cleanupBrowserAndPage) ---

  async cleanupPendingDeposits() {
    if (this.pendingDepositsBrowser || this.pendingDepositsPage) {
      logger.info("Cleaning up pending deposits browser...");
      await this._cleanupBrowserAndPage(this.pendingDepositsBrowser, this.pendingDepositsPage);
      this.pendingDepositsBrowser = null;
      this.pendingDepositsPage = null;
      this.isMonitoringPendingDeposits = false;
      logger.info("Pending deposits browser cleaned up.");
    }
  }

  async cleanupRecentDeposits() {
    if (this.recentDepositsBrowser || this.recentDepositsPage) {
      logger.info("Cleaning up recent deposits browser...");
      await this._cleanupBrowserAndPage(this.recentDepositsBrowser, this.recentDepositsPage);
      this.recentDepositsBrowser = null;
      this.recentDepositsPage = null;
      this.isMonitoringRecentDeposits = false;
      logger.info("Recent deposits browser cleaned up.");
    }
  }

  async cleanupRejectedDeposits() {
    if (this.rejectedDepositsBrowser || this.rejectedDepositsPage) {
      logger.info("Cleaning up rejected deposits browser...");
      await this._cleanupBrowserAndPage(this.rejectedDepositsBrowser, this.rejectedDepositsPage);
      this.rejectedDepositsBrowser = null;
      this.rejectedDepositsPage = null;
      this.isMonitoringRejectedDeposits = false;
      logger.info("Rejected deposits browser cleaned up.");
    }
  }

  async cleanupPendingWithdrawals() {
    if (this.pendingWithdrawalsBrowser || this.pendingWithdrawalsPage) {
      logger.info("Cleaning up pending withdrawals browser...");
      await this._cleanupBrowserAndPage(this.pendingWithdrawalsBrowser, this.pendingWithdrawalsPage);
      this.pendingWithdrawalsBrowser = null;
      this.pendingWithdrawalsPage = null;
      this.isMonitoringPendingWithdrawals = false;
      logger.info("Pending withdrawals browser cleaned up.");
    }
  }

  async cleanupApprovedWithdrawals() {
    if (this.approvedWithdrawalsBrowser || this.approvedWithdrawalsPage) {
      logger.info("Cleaning up approved withdrawals browser...");
      await this._cleanupBrowserAndPage(this.approvedWithdrawalsBrowser, this.approvedWithdrawalsPage);
      this.approvedWithdrawalsBrowser = null;
      this.approvedWithdrawalsPage = null;
      this.isMonitoringApprovedWithdrawals = false;
      logger.info("Approved withdrawals browser cleaned up.");
    }
  }

  async cleanupRejectedWithdrawals() {
    if (this.rejectedWithdrawalsBrowser || this.rejectedWithdrawalsPage) {
      logger.info("Cleaning up rejected withdrawals browser...");
      await this._cleanupBrowserAndPage(this.rejectedWithdrawalsBrowser, this.rejectedWithdrawalsPage);
      this.rejectedWithdrawalsBrowser = null;
      this.rejectedWithdrawalsPage = null;
      this.isMonitoringRejectedWithdrawals = false;
      logger.info("Rejected withdrawals browser cleaned up.");
    }
  }

  // --- Master Cleanup (calls all individual cleanups) ---
  async cleanup() {
    logger.info("Initiating full cleanup of all interceptor browser instances.");
    await this.cleanupPendingDeposits();
    await this.cleanupRecentDeposits();
    await this.cleanupRejectedDeposits();
    await this.cleanupPendingWithdrawals();
    await this.cleanupApprovedWithdrawals();
    await this.cleanupRejectedWithdrawals();
    logger.info("Full cleanup completed.");
  }


  // --- Other Methods (Keep as is) ---
  // These methods do not contain the same kind of Puppeteer-related repetition
  // and are likely specific business logic.

  isDepositApprovalResponse(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const isMatch = pathname.includes("/admin/deposit/deposit-approval");
      logger.debug("URL pattern check:", { url, pathname, isMatch });
      return isMatch;
    } catch (error) {
      logger.error("Error checking URL pattern:", { url, error: error.message });
      return false;
    }
  }

  // The processDepositResponse function seems redundant given _processTransactionListResponse.
  // If it's not used elsewhere, consider removing it.
  async processDepositResponse(responseData) {
    try {
      if (!responseData) {
        return;
      }

      let transactions = [];
      if (Array.isArray(responseData)) {
        transactions = responseData;
      } else if (responseData.data) {
        transactions = Array.isArray(responseData.data)
          ? responseData.data
          : responseData.data.rows || [];
      } else if (responseData.rows) {
        transactions = responseData.rows;
      }

      if (!transactions.length) {
        return;
      }

      for (const transaction of transactions) {
        try {
          const mappedData = await transactionService.mapTransactionData(
            transaction,
            "deposit",
            process.env.ADMIN_USER_ID
          );

          const processResult = await transactionService.processTransactions(
            [mappedData],
            "deposit"
          );
        } catch (error) {
          logger.error("Error processing transaction:", {
            transaction: JSON.stringify(transaction).substring(0, 500),
            error: error.message,
            stack: error.stack,
          });
        }
      }
    } catch (error) {
      logger.error("Error in deposit response processing:", {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  // navigateWithRetry and ensureLogin are also likely superseded by _performLogin
  // and direct page.goto calls within the monitor functions. Review their usage.
  async navigateWithRetry(url, maxRetries = 3, page = null) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
        }

        const targetPage = page || this.pendingDepositsPage; // This still relies on a specific property.
        if (!targetPage) {
          throw new Error(
            "No Puppeteer page instance available for navigation"
          );
        }

        const response = await targetPage.goto(url, {
          waitUntil: "networkidle2",
          timeout: 90000,
        });

        if (response && response.ok()) {
          return response;
        }
      } catch (error) {
        logger.error(`Navigation attempt ${attempt} failed:`, {
          url,
          error: error.message,
        });

        if (attempt === maxRetries) {
          throw error;
        }
      }
    }
    throw new Error(
      `Failed to navigate to ${url} after ${maxRetries} attempts`
    );
  }

  async ensureLogin() {
    try {
      await this.navigateWithRetry(`${process.env.SCRAPING_WEBSITE_URL}/login`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      logger.error("Login failed:", {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  async fetchTranscript(orderId, authToken) {
    try {
        if (!authToken) {
            logger.warn(`Auth token not found for orderId ${orderId}. Cannot fetch transcript.`);
            return null;
        }
        const apiUrl = `${process.env.SCRAPING_WEBSITE_URL}/accounts/GetTranscriptDetailsForFranchise?OrderID=${orderId}`;
        const response = await axios.get(apiUrl, {
            headers: {
                Authorization: `Bearer ${authToken}`,
                "Content-Type": "application/json",
            },
            timeout: 60000, // 60 seconds
        });
        if (response.status === 200 && response.data) {
            const transcript = response.data.detail || response.data;
            if (transcript) {
                await Transaction.findOneAndUpdate(
                    { orderId: orderId },
                    { $set: { transcript: transcript } },
                    { new: true, runValidators: true }
                );
                logger.info(`Transcript fetched and saved for Order ID: ${orderId}`);
                return true;
            }
        }
        logger.warn(`No transcript data found for Order ID: ${orderId} or API call failed.`);
        return false;
    } catch (error) {
        logger.error(`Error fetching transcript for Order ID ${orderId}:`, {
            error: error.message,
            stack: error.stack,
        });
        sentryUtil.captureException(error, {
            context: `fetchTranscript_failed`,
            orderId: orderId,
            method: `fetchTranscript`,
            statusCode: error.response?.status || "unknown",
        });
        return false;
    }
  }

  async runTranscriptFetchScheduler() {
    logger.info("Running transcript fetch scheduler...");
    try {
      const transactionsWithoutTranscript = await Transaction.find({
        $or: [
          { transactionStatus: TRANSACTION_STATUS.PENDING_DEPOSIT },
          { transactionStatus: TRANSACTION_STATUS.APPROVED_DEPOSIT },
        ],
        transcript: { $exists: false },
        isImageAvailable: true
      }).limit(50);

      if (transactionsWithoutTranscript.length === 0) {
        logger.info("No pending/approved deposits without transcripts found.");
        return;
      }

      let authToken = await Constant.findOne({ key: "SCRAPING_AUTH_TOKEN" });
      authToken = authToken?.value;

      if (!authToken) {
        logger.warn("No SCRAPING_AUTH_TOKEN found. Cannot fetch transcripts.");
        return;
      }

      for (const transaction of transactionsWithoutTranscript) {
        await this.sleep(1000 + Math.random() * 1000);
        const success = await this.fetchTranscript(transaction.orderId, authToken);
        if (!success) {
          logger.warn(`Failed to fetch transcript for orderId ${transaction.orderId}`);
        }
      }
      logger.info(`Transcript fetch scheduler completed. Processed ${transactionsWithoutTranscript.length} transactions.`);
    } catch (error) {
      logger.error("Error in transcript fetch scheduler:", {
        error: error.message,
        stack: error.stack,
      });
      sentryUtil.captureException(error, {
        context: 'runTranscriptFetchScheduler_failed',
        method: 'runTranscriptFetchScheduler',
      });
    }
  }

  async processTransactionNotification(data) {
    try {
        logger.info("Received transaction notification:", data);

        if (!data || !data.orderId || typeof data.amount !== 'number' || data.amount < 0) {
            logger.warn("Invalid transaction notification data received.", data);
            return;
        }

        const transactionType = data.type === 'deposit' ? 'deposit' : 'withdrawal';

        const mappedData = {
            orderId: data.orderId,
            userId: data.userId,
            userName: data.userName,
            amount: data.amount,
            requestDate: new Date(data.requestDate),
            transactionStatus: data.transactionStatus,
            isNotification: true,
        };

        if (data.franchiseName) {
            await transactionService.findOrCreateAgent(data.franchiseName.split(" (")[0]);
        }

        const updatedTransaction = await Transaction.findOneAndUpdate(
            { orderId: data.orderId },
            mappedData,
            { upsert: true, new: true, runValidators: true }
        );

        logger.info(`Transaction ${data.orderId} processed from notification. Status: ${updatedTransaction.transactionStatus}`);

        if (updatedTransaction.transactionStatus === TRANSACTION_STATUS.PENDING_DEPOSIT && updatedTransaction.isImageAvailable) {
            let authToken = await Constant.findOne({ key: "SCRAPING_AUTH_TOKEN" });
            authToken = authToken?.value;
            if (authToken) {
                await this.fetchTranscript(updatedTransaction.orderId, authToken);
            } else {
                logger.warn(`No auth token available to fetch transcript for notification orderId: ${updatedTransaction.orderId}`);
            }
        }

        return updatedTransaction;
    } catch (error) {
        logger.error("Failed to process transaction notification:", {
            data: data,
            error: error.message,
            stack: error.stack,
        });
        sentryUtil.captureException(error, {
            context: 'processTransactionNotification_failed',
            notificationData: data,
        });
        throw error;
    }
  }

}

// Export a singleton instance
module.exports = new NetworkInterceptor();