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
    // We will manage these dynamically now, so we can remove many of these
    // Instead, we will store a map of active browser instances
    this.activeBrowsers = new Map();
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
    // This method is now only for finding the path, no need to launch a browser here
    const executablePath = await this.findChromePath();
    if (!executablePath) {
      throw new Error("No valid Chrome installation found");
    }
    this.executablePath = executablePath;
  }

  async cleanup() {
    for (const [name, { browser, page }] of this.activeBrowsers) {
      try {
        await this._cleanupBrowserAndPage(browser, page);
        logger.info(`Cleaned up browser and page for: ${name}`);
      } catch (error) {
        logger.error(`Error cleaning up browser for ${name}:`, error);
      }
    }
    this.activeBrowsers.clear();
  }

  /**
   * Helper method to launch a new browser with standard configurations.
   * @returns {Promise<puppeteer.Browser>} A Puppeteer Browser instance.
   */
  async _launchBrowser() {
    return await puppeteer.launch({
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
  }

  /**
   * Helper method to set up a new page with common settings.
   * @param {puppeteer.Browser} browser - The browser instance.
   * @returns {Promise<puppeteer.Page>} A Puppeteer Page instance.
   */
  async _setupPage(browser) {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(180000); // 3 minutes
    page.setDefaultTimeout(180000);
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );
    return page;
  }

  /**
   * Encapsulates the entire login process.
   * @param {puppeteer.Page} page - The page to perform the login on.
   */
  async _login(page) {
    await page.goto(`${process.env.SCRAPING_WEBSITE_URL}/login`, {
      waitUntil: "networkidle2",
      timeout: 90000,
    });
    
    // Wait for selectors with increased timeouts
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

  /**
   * Generic handler to process transaction list responses.
   * @param {puppeteer.Response} interceptedResponse - The Puppeteer intercepted response object.
   * @param {string} transactionType - 'deposit' or 'withdrawal'.
   */
  async _processTransactionListResponse(interceptedResponse, transactionType) {
    let url = interceptedResponse.url();
    if (!url.includes("/accounts/GetListOfRequestsForFranchise")) {
      return;
    }

    logger.info(`Received transaction response - ${transactionType.toUpperCase()}`);
    try {
      const json = await interceptedResponse.json();
      let transactions = Array.isArray(json) ? json : json.data || [];

      // You can add filtering here if needed, like the approved deposits filter.
      // E.g., `if (transactionType === 'approvedDeposits') { ... }`

      for (const transaction of transactions) {
        try {
          if (transaction.amount >= 0) {
            await transactionService.findOrCreateAgent(
              transaction.franchiseName.split(" (")[0]
            );

            const transactionData = await transactionService.mapTransactionData(
              transaction,
              transactionType,
              process.env.ADMIN_USER_ID
            );

            await Transaction.findOneAndUpdate(
              { orderId: transaction.orderID },
              transactionData,
              { upsert: true, new: true, runValidators: true }
            );

            // Specific logic for pending deposits
            if (transactionType === 'pendingDeposits') {
              let authToken = await Constant.findOne({ key: "SCRAPING_AUTH_TOKEN" });
              authToken = authToken?.value;
              let fetchTranscriptResponse = await this.fetchTranscript(transaction.orderID, authToken);
              logger.info(`fetchTranscriptResponse - ${fetchTranscriptResponse}, orderId - ${transaction.orderID}`);
            }
          }
        } catch (transactionError) {
          logger.error("Error processing individual transaction:", {
            orderId: transaction?.orderID,
            error: transactionError.message,
          });
          sentryUtil.captureException(transactionError, {
            context: `monitor${transactionType}_transaction_update`,
            orderId: transaction?.orderID,
            method: `monitor${transactionType}`,
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
        context: `monitor${transactionType}_api_response`,
        url: url,
        method: `monitor${transactionType}`,
        statusCode: err.response?.status || "unknown",
      });
    }
  }

  /**
   * Generic monitoring function to handle the entire scraping flow.
   * @param {string} taskName - A unique name for the monitoring task.
   * @param {string} monitoringUrl - The URL to navigate to for monitoring.
   * @param {string} transactionType - 'deposit' or 'withdrawal'.
   */
  async _monitor(taskName, monitoringUrl, transactionType) {
    try {
      // Cleanup previous instance if it exists
      const existingInstance = this.activeBrowsers.get(taskName);
      if (existingInstance) {
        await this._cleanupBrowserAndPage(existingInstance.browser, existingInstance.page);
      }

      const browser = await this._launchBrowser();
      const page = await this._setupPage(browser);
      this.activeBrowsers.set(taskName, { browser, page });

      // Handle browser/page closure events
      browser.on("disconnected", () => {
        logger.error(`${taskName}_browser_disconnected`);
        this.activeBrowsers.delete(taskName);
      });
      page.on("close", () => {
        logger.error(`${taskName}_page_closed`);
        this.activeBrowsers.delete(taskName);
      });

      // Set up network interception
      await page.setRequestInterception(true);
      page.on("request", async (interceptedRequest) => {
        try {
          if (!interceptedRequest.isInterceptResolutionHandled()) {
            await interceptedRequest.continue();
          }
        } catch (error) {
          logger.error("Error handling request:", { url: interceptedRequest.url(), error: error.message });
        }
      });
      page.on("response", async (interceptedResponse) => {
        try {
          const url = interceptedResponse.url();
          if (url.includes("/accounts/login")) {
            const responseData = await interceptedResponse.json();
            if (responseData && responseData.detail && responseData.detail.token) {
              await Constant.findOneAndUpdate(
                { key: "SCRAPING_AUTH_TOKEN" },
                { value: responseData.detail.token, lastUpdated: new Date() },
                { upsert: true }
              );
            }
          }
          await this._processTransactionListResponse(interceptedResponse, transactionType);
        } catch (error) {
          logger.error("Error in response handler:", error);
          sentryUtil.captureException(error);
        }
      });
      
      // Navigate and login
      await this._login(page);
      await page.goto(monitoringUrl, {
        waitUntil: "networkidle2",
        timeout: 90000,
      });

      // Wait for table to be visible and data to load
      try {
        await page.waitForSelector("table", { timeout: 10000 });
        await this.sleep(5000);
      } catch (error) {
        sentryUtil.captureException(error, { context: `${taskName}_waiting_for_table_failed` });
      }

      return { success: true, browser, page };

    } catch (error) {
      logger.error(`Error monitoring ${taskName}:`, { error: error.message, stack: error.stack });
      sentryUtil.captureException(error, { context: `${taskName}_failed` });
      throw error;
    }
  }

  // PUBLIC API: Now these methods are just clean wrappers
  async monitorPendingDeposits() {
    const url = `${process.env.SCRAPING_WEBSITE_URL}/admin/deposit/deposit-approval`;
    return this._monitor('pendingDeposits', url, 'deposit');
  }

  async monitorRecentDeposits() {
    const url = `${process.env.SCRAPING_WEBSITE_URL}/admin/deposit/recent-deposit`;
    return this._monitor('recentDeposits', url, 'deposit');
  }
  
  async monitorRejectedDeposits() {
    const url = `${process.env.SCRAPING_WEBSITE_URL}/admin/deposit/rejected-deposit`;
    return this._monitor('rejectedDeposits', url, 'deposit');
  }

  async monitorPendingWithdrawals() {
    const url = `${process.env.SCRAPING_WEBSITE_URL}/admin/withdrawal/withdrawal-approval`;
    return this._monitor('pendingWithdrawals', url, 'withdrawal');
  }
  
  async monitorApprovedWithdrawals() {
    const url = `${process.env.SCRAPING_WEBSITE_URL}/admin/withdrawal/recent-withdrawal`;
    return this._monitor('approvedWithdrawals', url, 'withdrawal');
  }

  async monitorRejectedWithdrawals() {
    const url = `${process.env.SCRAPING_WEBSITE_URL}/admin/withdrawal/rejected-withdrawal`;
    return this._monitor('rejectedWithdrawals', url, 'withdrawal');
  }

  // The rest of the methods remain as they were, as they are not repetitive.
  async fetchTranscript(orderId, authToken) {
    // ... (unchanged)
  }

  async runTranscriptFetchScheduler() {
    // ... (unchanged)
  }

  async processTransactionNotification() {
    // ... (unchanged)
  }
}

// Export a singleton instance
module.exports = new NetworkInterceptor();