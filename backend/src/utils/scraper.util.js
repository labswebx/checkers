const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const logger = require('./logger.util');
const sessionUtil = require('./session.util');
const transactionService = require('../services/transaction.service');
const fs = require('fs');
const path = require('path');

// Add stealth plugin to puppeteer
puppeteer.use(StealthPlugin());

class ScraperUtil {
  constructor() {
    this.browser = null;
    this.page = null;
    this.isLoggedIn = false;
    this.currentUserId = null;
  }

  async findChromiumPath() {
    const possiblePaths = [
      process.env.PUPPETEER_EXECUTABLE_PATH,
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',  // macOS Chrome path
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
      // Find Chrome executable
      const executablePath = await this.findChromiumPath();
      if (!executablePath) {
        logger.error('No valid Chrome installation found');
        throw new Error('No valid Chrome installation found. Please install Google Chrome.');
      }

      // Launch browser with multiple retries
      let retries = 3;
      let lastError = null;

      while (retries > 0) {
        try {          
          this.browser = await puppeteer.launch({
            headless: 'new',
            executablePath,
            product: 'chrome',  // Explicitly set to use Chrome
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-accelerated-2d-canvas',
              '--disable-gpu',
              '--disable-software-rasterizer',
              '--window-size=1920,1080',
              '--disable-web-security',
              '--disable-features=IsolateOrigins,site-per-process',
              '--disable-site-isolation-trials',
              '--no-zygote',
              '--single-process',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-notifications',
              '--disable-extensions'
            ],
            defaultViewport: {
              width: 1920,
              height: 1080
            },
            ignoreHTTPSErrors: true,
            timeout: 30000,
            handleSIGINT: false,
            handleSIGTERM: false,
            handleSIGHUP: false
          });

          // Verify browser is running
          const version = await this.browser.version();
          break;
        } catch (error) {
          lastError = error;
          retries--;
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }

      if (!this.browser) {
        throw lastError || new Error('Failed to launch browser after multiple attempts');
      }

      // Create new page
      this.page = await this.browser.newPage();

      // Set viewport
      await this.page.setViewport({ width: 1920, height: 1080 });

      // Set user agent to latest Chrome
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

      // Set extra headers
      await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br'
      });

      await this.page.setRequestInterception(true);
      this.page.on('request', request => {
        request.continue();
      });
      
      return true;
    } catch (error) {
      logger.error('Error initializing scraper:', { 
        error: error.message, 
        stack: error.stack,
        chromiumPath: process.env.PUPPETEER_EXECUTABLE_PATH 
      });
      throw new Error(`Failed to initialize scraper: ${error.message}`);
    }
  }

  /**
   * Login to the website
   * @param {string} userId - User ID
   * @param {string} username - Username
   * @param {string} password - Password
   */
  async login(userId, username, password) {
    try {
      this.currentUserId = userId;

      if (!this.page) {
        await this.initialize();
      }

      // Try to restore session first
      const sessionRestored = await sessionUtil.restoreSession(userId, this.page);
      if (sessionRestored) {
        const isValid = await this.validateSession();
        if (isValid) {
          this.isLoggedIn = true;
          return {
            success: true,
            data: await this.extractDashboardData()
          };
        }
      }

      const loginUrl = `${process.env.SCRAPING_WEBSITE_URL}/login`;
      await this.page.goto(loginUrl, { 
        waitUntil: 'networkidle0',
        timeout: 30000 
      });
      await this.page.waitForSelector('input[type="text"]', { visible: true, timeout: 5000 });
      await this.page.waitForSelector('input[type="password"]', { visible: true, timeout: 5000 });

      // Clear existing values
      await this.page.evaluate(() => {
        document.querySelector('input[type="text"]').value = '';
        document.querySelector('input[type="password"]').value = '';
      });

      await this.page.type('input[type="text"]', username, { delay: 100 });
      await this.page.type('input[type="password"]', password, { delay: 100 });

      const loginButton = await this.page.$('button[type="submit"]');
      if (!loginButton) {
        logger.error('Login button not found on page');
        throw new Error('Login button not found');
      }

      await Promise.all([
        this.page.waitForNavigation({ 
          waitUntil: 'networkidle0',
          timeout: 30000 
        }),
        loginButton.click()
      ]);

      // Check if login was successful
      const isSuccess = await this.checkLoginSuccess();
      if (!isSuccess) {
        logger.error('Login verification failed');
        throw new Error('Login failed');
      }
      await sessionUtil.saveSession(userId, this.page);
      const dashboardData = await this.extractDashboardData();
      this.isLoggedIn = true;
      return {
        success: true,
        data: dashboardData
      };
    } catch (error) {
      logger.error('Login error:', { 
        error: error.message, 
        stack: error.stack,
        url: this.page ? this.page.url() : 'N/A'
      });
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  /**
   * Close browser and cleanup
   */
  async close() {
    if (this.browser) {
      // Save session before closing if logged in
      if (this.isLoggedIn && this.currentUserId) {
        await sessionUtil.saveSession(this.currentUserId, this.page);
      }

      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.isLoggedIn = false;
      this.currentUserId = null;
      logger.debug('Browser closed, resources cleaned up');
    }
  }

  /**
   * Validate current session by checking dashboard access
   */
  async validateSession() {
    try {
      await this.page.goto('https://dwpanell100.online/admin/dashboard', {
        waitUntil: 'networkidle0',
        timeout: 10000
      });

      // Check if we're still on dashboard
      const url = this.page.url();
      return url.includes('/admin/dashboard');
    } catch (error) {
      logger.error('Session validation error:', {
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * Check if login was successful
   */
  async checkLoginSuccess() {
    try {
      await this.page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));
      const currentUrl = this.page.url();
      if (currentUrl.includes('/login')) {        
        const errorMessage = await this.page.$eval('.error-message', el => el.textContent)
          .catch(() => null);

        if (errorMessage) {
          logger.error('Login error message found:', { message: errorMessage });
          throw new Error(errorMessage);
        }
        return false;
      }
      return true;
    } catch (error) {
      logger.error('Error checking login status:', { 
        error: error.message, 
        stack: error.stack,
        url: this.page ? this.page.url() : 'N/A'
      });
      return false;
    }
  }

  /**
   * Extract data from the dashboard after successful login
   */
  async extractDashboardData() {
    try {
      await this.page.waitForSelector('body', { timeout: 5000 });
      const currentUrl = this.page.url();
      const pageTitle = await this.page.title();
      
      const data = await this.page.evaluate(() => {
        const pageText = document.body.innerText;
        const inputs = Array.from(document.querySelectorAll('input')).map(input => ({
          type: input.type,
          name: input.name,
          id: input.id,
          value: input.value
        }));
        const buttons = Array.from(document.querySelectorAll('button')).map(btn => btn.innerText.trim());
        return {
          pageContent: pageText,
          inputs,
          buttons
        };
      });

      // Add metadata
      data.url = currentUrl;
      data.title = pageTitle;

      return data;
    } catch (error) {
      logger.error('Error extracting dashboard data:', {
        error: error.message,
        stack: error.stack,
        url: this.page ? this.page.url() : 'N/A'
      });
      // Return basic URL info even if extraction fails
      return {
        url: this.page ? this.page.url() : 'N/A',
        error: error.message
      };
    }
  }

  /**
   * Get deposit approval data for a specific page
   * @param {number} page - Page number to fetch
   */
  async getDepositApprovalData(page = 1) {
    try {
      if (!this.isLoggedIn) {
        throw new Error('Not logged in. Please login first.');
      }

      await this.page.goto(`https://dwpanell100.online/admin/deposit/deposit-approval?page=${page}`, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      // Wait for the table to load
      await this.page.waitForSelector('table', { timeout: 5000 });

      // Extract table data and pagination info
      const data = await this.page.evaluate(() => {
        // Helper function to safely get text content
        const getText = (element) => element ? element.textContent.trim() : null;

        // Get pagination info
        const paginationInfo = {
          currentPage: parseInt(document.querySelector('.pagination .active')?.textContent || '1'),
          totalPages: Math.max(...Array.from(document.querySelectorAll('.pagination li'))
            .map(li => parseInt(li.textContent) || 0))
        };

        // Get table headers
        const headers = Array.from(document.querySelectorAll('table thead th'))
          .map(th => getText(th));

        // Get table rows
        const rows = Array.from(document.querySelectorAll('table tbody tr'))
          .map(row => {
            const cells = Array.from(row.querySelectorAll('td'));
            const rowData = {};
            
            // Map each cell to its corresponding header
            cells.forEach((cell, index) => {
              if (headers[index]) {
                // Get button text/status if present
                const button = cell.querySelector('button');
                const value = button ? {
                  text: getText(button), // TODO
                  status: button.className.includes('success') ? 'success' : 
                         button.className.includes('danger') ? 'danger' : 'default'
                } : getText(cell);
                
                rowData[headers[index].toLowerCase().replace(/\s+/g, '_')] = value;
              }
            });

            return rowData;
          });

        return {
          headers,
          rows,
          pagination: paginationInfo
        };
      });

      return {
        success: true,
        data: data
      };
    } catch (error) {
      logger.error('Error fetching deposit approval data:', {
        error: error.message,
        stack: error.stack,
        url: this.page ? this.page.url() : 'N/A'
      });
      throw new Error(`Failed to fetch deposit approval data: ${error.message}`);
    }
  }

  /**
   * Get all deposit approval data across all pages
   */
  async getAllDepositApprovalData() {
    try {
      // Get first page and pagination info
      const firstPage = await this.getDepositApprovalData(1);
      const totalPages = firstPage.data.pagination.totalPages;      
      const allData = [firstPage.data.rows];
      
      // Get remaining pages
      for(let page = 2; page <= totalPages; page++) {
        const pageData = await this.getDepositApprovalData(page);
        allData.push(pageData.data.rows);
      }

      const allRows = allData.flat();
      
      // Process transactions
      const processResult = await transactionService.processTransactions(allRows, 'deposit');

      return {
        success: true,
        data: {
          headers: firstPage.data.headers,
          rows: allRows,
          totalPages,
          totalRecords: allRows.length,
          processResult
        }
      };
    } catch (error) {
      logger.error('Error fetching all deposit approval data:', {
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Failed to fetch all deposit approval data: ${error.message}`);
    }
  }

  /**
   * Get recent deposit data with status filtering and retry mechanism
   * @param {string} status - Transaction status ('approved' or 'rejected')
   * @param {number} page - Page number to fetch (default: 1)
   */
  async getRecentDepositData(status, page = 1, maxRetries = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Ensure we have a working page
        await this.ensurePageInitialized();

        if (!this.isLoggedIn) {
          throw new Error('Not logged in. Please login first.');
        }
        const url = `https://dwpanell100.online/admin/deposit/recent-deposit?status=${status}&page=${page}`;
        
        // Navigate with longer timeout
        await this.page.goto(url, {
          waitUntil: ['networkidle0', 'domcontentloaded'],
          timeout: 30000
        });

        // Wait for table with retry mechanism
        await this.waitForTableData();

        // Extract table data and pagination info
        const data = await this.page.evaluate(() => {
          // Helper function to safely get text content
          const getText = (element) => element ? element.textContent.trim() : null;

          // Get pagination info
          const paginationInfo = {
            currentPage: parseInt(document.querySelector('.pagination .active')?.textContent || '1'),
            totalPages: Math.max(...Array.from(document.querySelectorAll('.pagination li'))
              .map(li => parseInt(li.textContent) || 0))
          };

          // Get table headers
          const headers = Array.from(document.querySelectorAll('table thead th'))
            .map(th => getText(th));

          // Get table rows
          const rows = Array.from(document.querySelectorAll('table tbody tr'))
            .map(row => {
              const cells = Array.from(row.querySelectorAll('td'));
              const rowData = {};
              
              cells.forEach((cell, index) => {
                if (headers[index]) {
                  rowData[headers[index].toLowerCase().replace(/\s+/g, '_')] = getText(cell);
                }
              });

              // Add status from URL parameter
              rowData.status = new URLSearchParams(window.location.search).get('status');
              return rowData;
            });

          return {
            headers,
            rows,
            pagination: paginationInfo
          };
        });

        // Validate extracted data
        if (!data.rows || data.rows.length === 0) {
          if (attempt < maxRetries) continue;
        }

        return {
          success: true,
          data
        };
      } catch (error) {
        lastError = error;
        logger.error(`Attempt ${attempt}/${maxRetries} failed:`, {
          error: error.message,
          stack: error.stack,
          url: this.page ? this.page.url() : 'N/A'
        });

        if (attempt < maxRetries) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Reinitialize browser if needed
          await this.ensurePageInitialized();
          
          // Re-login if needed
          if (!this.isLoggedIn) {
            await this.login(
              process.env.ADMIN_USER_ID,
              process.env.SCRAPING_USERNAME,
              process.env.SCRAPING_PASSWORD
            );
          }
        }
      }
    }

    throw new Error(`Failed to fetch recent deposit data after ${maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Get all recent deposit data for a specific status across all pages with improved reliability
   * @param {string} status - Transaction status ('approved' or 'rejected')
   */
  async getAllRecentDepositData(status) {
    try {
      // Get first page and pagination info with retries
      const firstPage = await this.getRecentDepositData(status, 1);
      const totalPages = firstPage.data.pagination.totalPages;
      
      const allData = [firstPage.data.rows];
      let successfulPages = 1;
      let failedPages = 0;
      
      // Get remaining pages with individual retries
      for(let page = 2; page <= totalPages; page++) {
        try {
          const pageData = await this.getRecentDepositData(status, page);
          allData.push(pageData.data.rows);
          successfulPages++;
          
          // Add a small delay between pages to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          failedPages++;
          logger.error(`Failed to fetch page ${page}`, {
            error: error.message,
            status,
            successfulPages,
            failedPages,
            remainingPages: totalPages - page
          });
        }
      }

      const allRows = allData.flat();
      
      // Process transactions
      const processResult = await transactionService.processTransactions(allRows, 'deposit');

      return {
        success: true,
        data: {
          headers: firstPage.data.headers,
          rows: allRows,
          totalPages,
          totalRecords: allRows.length,
          processResult,
          paginationStats: {
            totalPages,
            successfulPages,
            failedPages
          }
        }
      };
    } catch (error) {
      logger.error('Error fetching all recent deposit data:', {
        error: error.message,
        stack: error.stack,
        status
      });
      throw new Error(`Failed to fetch all recent deposit data: ${error.message}`);
    }
  }

  /**
   * Ensure browser and page are initialized
   */
  async ensurePageInitialized() {
    try {
      if (!this.browser || !this.page) {
        await this.initialize();
      }

      // Test if page is still usable
      try {
        await this.page.evaluate(() => true);
      } catch (error) {
        await this.initialize();
      }

      return true;
    } catch (error) {
      logger.error('Failed to ensure page initialization:', { error: error.message });
      throw error;
    }
  }

  /**
   * Wait for table data to load with retry
   */
  async waitForTableData(maxRetries = 3, timeout = 10000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Wait for table element
        await this.page.waitForSelector('table', { timeout });
        
        // Wait for table rows to be present
        const hasRows = await this.page.evaluate(() => {
          const rows = document.querySelectorAll('table tbody tr');
          return rows.length > 0;
        });

        if (!hasRows) {
          throw new Error('Table has no rows');
        }

        return true;
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Refresh the page
          await this.page.reload({ waitUntil: 'networkidle0' });
        }
      }
    }

    throw lastError;
  }

  /**
   * Ensure the screenshots directory exists
   * @param {string} dirPath - Directory path to create
   * @returns {Promise<void>}
   */
  async ensureDirectoryExists(dirPath) {
    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
      logger.debug('Directory created/verified:', { path: dirPath });
    } catch (error) {
      logger.error('Error creating directory:', { 
        path: dirPath,
        error: error.message 
      });
      throw error;
    }
  }
}

// Export a singleton instance
module.exports = new ScraperUtil();
