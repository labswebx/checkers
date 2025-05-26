const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const logger = require('./logger.util');
const sessionUtil = require('./session.util');
const transactionService = require('../services/transaction.service');

// Add stealth plugin to puppeteer
puppeteer.use(StealthPlugin());

class ScraperUtil {
  constructor() {
    this.browser = null;
    this.page = null;
    this.isLoggedIn = false;
    this.currentUserId = null;
  }

  /**
   * Initialize browser and page
   */
  async initialize() {
    try {
      logger.info('Initializing scraper browser');
      
      // Launch browser
      this.browser = await puppeteer.launch({
        headless: 'new',  // Use new headless mode
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null, // Allow custom Chrome path
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-site-isolation-trials',
          '--no-zygote',
          '--single-process',
          '--disable-setuid-sandbox'
        ],
        defaultViewport: {
          width: 1920,
          height: 1080
        },
        ignoreHTTPSErrors: true,
        env: {
          ...process.env,
          DISPLAY: ':99'  // For Xvfb
        }
      });

      logger.info('Browser launched successfully');

      // Create new page
      this.page = await this.browser.newPage();
      logger.debug('New page created');

      // Set viewport
      await this.page.setViewport({ width: 1920, height: 1080 });
      logger.debug('Viewport set to 1920x1080');

      // Set user agent to latest Chrome
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
      logger.debug('User agent set');

      // Set extra headers
      await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br'
      });

      // Enable request interception for better logging
      await this.page.setRequestInterception(true);
      this.page.on('request', request => {
        logger.debug('Outgoing request:', { 
          url: request.url(),
          method: request.method(),
          resourceType: request.resourceType()
        });
        request.continue();
      });

      this.page.on('response', response => {
        logger.debug('Incoming response:', { 
          url: response.url(),
          status: response.status()
        });
      });

      this.page.on('console', msg => {
        logger.debug('Browser console:', msg.text());
      });

      logger.info('Scraper initialized successfully');
      return true;
    } catch (error) {
      logger.error('Error initializing scraper:', { error: error.message, stack: error.stack });
      throw new Error('Failed to initialize scraper');
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
      logger.info('Starting login process');
      this.currentUserId = userId;

      if (!this.page) {
        logger.debug('Page not initialized, initializing now');
        await this.initialize();
      }

      // Try to restore session first
      const sessionRestored = await sessionUtil.restoreSession(userId, this.page);
      if (sessionRestored) {
        logger.info('Session restored, validating...');
        const isValid = await this.validateSession();
        if (isValid) {
          logger.info('Session validated successfully');
          this.isLoggedIn = true;
          return {
            success: true,
            data: await this.extractDashboardData()
          };
        }
        logger.info('Session invalid, proceeding with fresh login');
      }

      const loginUrl = process.env.SCRAPING_WEBSITE_URL;
      logger.info('Navigating to login page:', { url: loginUrl });
      
      // Navigate to login page
      await this.page.goto(loginUrl, { 
        waitUntil: 'networkidle0',
        timeout: 30000 
      });
      logger.debug('Navigation complete');

      // Wait for form elements and fill them
      logger.debug('Waiting for login form elements');
      await this.page.waitForSelector('input[type="text"]', { visible: true, timeout: 5000 });
      await this.page.waitForSelector('input[type="password"]', { visible: true, timeout: 5000 });
      logger.debug('Form elements found');

      // Clear existing values
      await this.page.evaluate(() => {
        document.querySelector('input[type="text"]').value = '';
        document.querySelector('input[type="password"]').value = '';
      });

      // Type credentials (using type instead of fill for more human-like behavior)
      logger.debug('Typing credentials');
      await this.page.type('input[type="text"]', username, { delay: 100 });
      await this.page.type('input[type="password"]', password, { delay: 100 });

      // Find and click the login button
      logger.debug('Looking for login button');
      const loginButton = await this.page.$('button[type="submit"]');
      if (!loginButton) {
        logger.error('Login button not found on page');
        throw new Error('Login button not found');
      }

      // Click the login button and wait for navigation
      logger.info('Submitting login form');
      await Promise.all([
        this.page.waitForNavigation({ 
          waitUntil: 'networkidle0',
          timeout: 30000 
        }),
        loginButton.click()
      ]);
      logger.debug('Form submitted, navigation complete');

      // Check if login was successful
      const isSuccess = await this.checkLoginSuccess();
      if (!isSuccess) {
        logger.error('Login verification failed');
        throw new Error('Login failed');
      }

      // Save session after successful login
      await sessionUtil.saveSession(userId, this.page);

      // Extract data after successful login
      logger.info('Extracting dashboard data');
      const dashboardData = await this.extractDashboardData();
      logger.debug('Dashboard data extracted:', { dashboardData });

      logger.info('Login successful');
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
      logger.debug('Checking login success');
      
      // Wait for a short time to let any redirects complete
      await this.page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));

      // Get the current URL
      const currentUrl = this.page.url();
      logger.debug('Current URL after login:', { url: currentUrl });

      // If we're still on the login page, login failed
      if (currentUrl.includes('/login')) {
        logger.debug('Still on login page, checking for error messages');
        
        // Check for error messages
        const errorMessage = await this.page.$eval('.error-message', el => el.textContent)
          .catch(() => null);

        if (errorMessage) {
          logger.error('Login error message found:', { message: errorMessage });
          throw new Error(errorMessage);
        }
        
        logger.warn('Login appears to have failed (still on login page)');
        return false;
      }

      // Take a screenshot for debugging if needed
      await this.page.screenshot({ 
        path: `logs/screenshots/login-success-${Date.now()}.png`,
        fullPage: true 
      });
      logger.debug('Saved login success screenshot');

      logger.info('Login success verification complete');
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
      // Wait for content to load
      await this.page.waitForSelector('body', { timeout: 5000 });
      
      // Take a screenshot for debugging
      await this.page.screenshot({ 
        path: `logs/screenshots/dashboard-${Date.now()}.png`,
        fullPage: true 
      });

      // Get the current URL and HTML content
      const currentUrl = this.page.url();
      const pageTitle = await this.page.title();
      
      // Extract all relevant data from the dashboard
      const data = await this.page.evaluate(() => {
        // Get all text content from the page
        const pageText = document.body.innerText;
        
        // Get all visible input fields
        const inputs = Array.from(document.querySelectorAll('input')).map(input => ({
          type: input.type,
          name: input.name,
          id: input.id,
          value: input.value
        }));

        // Get all button text
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

      logger.info('Dashboard data extracted successfully', { url: currentUrl });
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
   * Close browser and cleanup
   */
  async close() {
    if (this.browser) {
      // Save session before closing if logged in
      if (this.isLoggedIn && this.currentUserId) {
        await sessionUtil.saveSession(this.currentUserId, this.page);
      }

      logger.info('Closing browser');
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.isLoggedIn = false;
      this.currentUserId = null;
      logger.debug('Browser closed, resources cleaned up');
    }
  }

  /**
   * Navigate to deposit approval page and extract data
   * @param {number} page - Page number to fetch (default: 1)
   */
  async getDepositApprovalData(page = 1) {
    try {
      if (!this.isLoggedIn) {
        throw new Error('Not logged in. Please login first.');
      }

      logger.info('Navigating to deposit approval page', { page });
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
                  text: getText(button),
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

      logger.info('Deposit approval data extracted successfully', {
        page: data.pagination.currentPage,
        totalPages: data.pagination.totalPages,
        rowsCount: data.rows.length
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
      
      logger.info('Starting full data extraction', { totalPages });
      
      const allData = [firstPage.data.rows];
      
      // Get remaining pages
      for(let page = 2; page <= totalPages; page++) {
        const pageData = await this.getDepositApprovalData(page);
        allData.push(pageData.data.rows);
        logger.info(`Extracted page ${page}/${totalPages}`);
      }

      const allRows = allData.flat();
      
      // Process transactions
      const processResult = await transactionService.processTransactions(allRows, 'deposit');
      logger.info('Transaction processing complete', { processResult });

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
   * Ensure browser and page are initialized
   */
  async ensurePageInitialized() {
    try {
      if (!this.browser || !this.page) {
        logger.info('Browser or page not initialized, reinitializing...');
        await this.initialize();
      }

      // Test if page is still usable
      try {
        await this.page.evaluate(() => true);
      } catch (error) {
        logger.warn('Page is not usable, reinitializing...', { error: error.message });
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
        logger.warn(`Attempt ${attempt}/${maxRetries} to wait for table data failed:`, { 
          error: error.message,
          url: this.page.url()
        });

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

        logger.info('Navigating to recent deposit page', { status, page, attempt });
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
          logger.warn('No rows found in table, might be an error');
          if (attempt < maxRetries) continue;
        }

        logger.info('Recent deposit data extracted successfully', {
          status,
          page: data.pagination.currentPage,
          totalPages: data.pagination.totalPages,
          rowsCount: data.rows.length,
          attempt
        });

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
      logger.info('Fetching first page of recent deposits', { status });
      const firstPage = await this.getRecentDepositData(status, 1);
      const totalPages = firstPage.data.pagination.totalPages;
      
      logger.info('Starting full recent deposit data extraction', { 
        status, 
        totalPages,
        firstPageRows: firstPage.data.rows.length 
      });
      
      const allData = [firstPage.data.rows];
      let successfulPages = 1;
      let failedPages = 0;
      
      // Get remaining pages with individual retries
      for(let page = 2; page <= totalPages; page++) {
        try {
          logger.info(`Fetching page ${page}/${totalPages} for ${status} transactions`);
          const pageData = await this.getRecentDepositData(status, page);
          allData.push(pageData.data.rows);
          successfulPages++;
          
          logger.info(`Successfully extracted page ${page}/${totalPages}`, {
            status,
            rowsInThisPage: pageData.data.rows.length,
            totalRowsSoFar: allData.flat().length
          });
          
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
      logger.info('Recent deposit processing complete', { 
        status, 
        processResult,
        totalPagesAttempted: totalPages,
        successfulPages,
        failedPages,
        totalRowsProcessed: allRows.length
      });

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
}

// Export a singleton instance
module.exports = new ScraperUtil(); 