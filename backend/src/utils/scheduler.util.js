const cron = require('node-cron');
const logger = require('./logger.util');
const sessionUtil = require('./session.util');
const scraperUtil = require('./scraper.util');
const transactionService = require('../services/transaction.service');

class SchedulerUtil {
  constructor() {
    this.jobs = new Map();
    this.isScrapingInProgress = false;
  }

  /**
   * Start all scheduled jobs
   */
  startJobs() {
    // Cleanup expired sessions every hour
    this.jobs.set('sessionCleanup', cron.schedule('0 * * * *', async () => {
      logger.info('Running scheduled session cleanup');
      const deletedCount = await sessionUtil.cleanupExpiredSessions();
    }));

    // Scrape deposits every 20 seconds
    this.jobs.set('depositScraper', cron.schedule('*/20 * * * * *', async () => {
      // Skip if previous scraping is still in progress
      if (this.isScrapingInProgress) {
        logger.warn('Previous scraping job still in progress, skipping this run');
        return;
      }

      this.isScrapingInProgress = true;
      let browserInitialized = false;

      try {
        logger.info('Starting scheduled deposit scraping');
        
        // Initialize scraper and login
        await scraperUtil.initialize();
        browserInitialized = true;
        
        await scraperUtil.login(
          process.env.ADMIN_USER_ID,
          process.env.SCRAPING_USERNAME,
          process.env.SCRAPING_PASSWORD
        );

        // First, get pending deposits
        // logger.info('Scraping pending deposits');
        const pendingResult = await scraperUtil.getAllDepositApprovalData();
        // logger.info('Pending deposits scraping complete');

        // Then, get approved deposits with retry
        // logger.info('Scraping approved deposits');
        const approvedResult = await this.retryOperation(
          () => scraperUtil.getAllRecentDepositData('approved'),
          3
        );
        // logger.info('Approved deposits scraping complete');

        // Finally, get rejected deposits with retry
        // logger.info('Scraping rejected deposits');
        const rejectedResult = await this.retryOperation(
          () => scraperUtil.getAllRecentDepositData('rejected'),
          3
        );
        // logger.info('Rejected deposits scraping complete');

        // Log overall results
        // const totalRecords = 
        //   pendingResult.data.totalRecords + 
        //   approvedResult.data.totalRecords + 
        //   rejectedResult.data.totalRecords;

        // logger.info('All deposit scraping complete');
      } catch (error) {
        logger.error('Scheduled deposit scraping failed:', {
          error: error.message,
          stack: error.stack
        });
      } finally {
        // Always cleanup browser
        if (browserInitialized) {
          try {
            await scraperUtil.close();
          } catch (closeError) {
            logger.error('Error closing browser:', closeError);
          }
        }
        this.isScrapingInProgress = false;
      }
    }));

    // Check pending transactions every minute
    this.jobs.set('pendingCheck', cron.schedule('* * * * *', async () => {
      try {
        logger.info('Running pending transactions check...');
        await transactionService.checkPendingTransactions();
      } catch (error) {
        logger.error('Error in pending transactions check job:', error);
      }
    }));

    // logger.info('Scheduled jobs started');
  }

  /**
   * Helper method to retry operations with delay
   * @param {Function} operation - Operation to retry
   * @param {number} maxRetries - Maximum number of retries
   * @param {number} delayMs - Delay between retries in milliseconds
   */
  async retryOperation(operation, maxRetries = 3, delayMs = 2000) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        logger.warn(`Attempt ${attempt}/${maxRetries} failed:`, {
          error: error.message
        });

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
          
          // Re-initialize browser if needed
          await scraperUtil.initialize();
          await scraperUtil.login(
            process.env.ADMIN_USER_ID,
            process.env.SCRAPING_USERNAME,
            process.env.SCRAPING_PASSWORD
          );
        }
      }
    }

    throw lastError;
  }

  /**
   * Stop all scheduled jobs
   */
  stopJobs() {
    for (const [name, job] of this.jobs) {
      logger.info(`Stopping ${name} job`);
      job.stop();
    }
    this.jobs.clear();
  }
}

// Export singleton instance
module.exports = new SchedulerUtil(); 