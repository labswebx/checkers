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
      '/snap/chromium/current/usr/lib/chromium-browser/chrome',
      '/snap/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
    ];

    for (const browserPath of possiblePaths) {
      if (browserPath && fs.existsSync(browserPath)) {
        logger.info('Found Chromium at:', browserPath);
        return browserPath;
      }
    }
    return null;
  }

  async initialize() {
    try {
      logger.info('Initializing scraper browser');
      
      // Find Chromium executable
      const executablePath = await this.findChromiumPath();
      if (!executablePath) {
        logger.error('No valid Chromium installation found');
        throw new Error('No valid Chromium installation found. Please install Chromium browser.');
      }

      logger.info(`Using Chromium at: ${executablePath}`);

      // Launch browser with multiple retries
      let retries = 3;
      let lastError = null;

      while (retries > 0) {
        try {
          logger.info(`Attempting to launch browser (attempt ${4-retries}/3)`);
          
          this.browser = await puppeteer.launch({
            headless: 'new',
            executablePath,
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
          logger.info(`Browser launched successfully. Version: ${version}`);
          break;
        } catch (error) {
          lastError = error;
          retries--;
          logger.warn(`Browser launch failed, retrying... (${retries} attempts left)`, { 
            error: error.message,
            stack: error.stack 
          });
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

      this.page.on('error', err => {
        logger.error('Page error:', err);
      });

      this.page.on('pageerror', err => {
        logger.error('Page error:', err);
      });

      logger.info('Scraper initialized successfully');
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

  // ... rest of the file remains unchanged ...
}

// Export a singleton instance
module.exports = new ScraperUtil();
