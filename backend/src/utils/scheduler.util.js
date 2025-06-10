const cron = require('node-cron');
const logger = require('./logger.util');
const sessionUtil = require('./session.util');
const networkInterceptor = require('./network-interceptor.util');
const transactionService = require('../services/transaction.service');

class Task {
  constructor(name, interval, action) {
    this.name = name;
    this.interval = interval;
    this.action = action;
    this.isRunning = false;
    this.job = null;
  }

  async _execution() {
    // if (this.isRunning) {
    //   logger.info(`Task ${this.name} is already running, skipping this execution`);
    //   return;
    // }

    this.isRunning = true;
    try {
      await this.action();
    } catch (error) {
      logger.error(`Error executing task ${this.name}:`, error);
    } finally {
      this.isRunning = false;
    }
  }

  start() {
    if (this.job) {
      logger.warn(`Task ${this.name} is already scheduled`);
      return;
    }

    this.job = cron.schedule(this.interval, () => this._execution());
    logger.info(`Task ${this.name} scheduled successfully`);
  }

  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
      logger.info(`Task ${this.name} stopped`);
    }
  }
}

// Create task instances
const depositListTask = new Task(
  'Deposit List Monitor',
  '*/20 * * * * *', // Every 20 seconds
  async () => {
    try {
      await networkInterceptor.monitorPendingDeposits();
    } catch (error) {
      logger.error('Error in deposit list monitoring task:', error);
      await networkInterceptor.cleanup();
    }
  }
);

const recentDepositsTask = new Task(
  'Recent Deposits Monitor',
  '*/30 * * * * *', // Every 30 seconds
  async () => {
    try {
      await networkInterceptor.monitorRecentDeposits();
    } catch (error) {
      logger.error('Error in recent deposits monitoring task:', error);
      await networkInterceptor.cleanup();
    }
  }
);

const rejectedDepositsTask = new Task(
  'Rejected Deposits Monitor',
  '*/20 * * * * *', // Every 20 seconds
  async () => {
    try {
      await networkInterceptor.monitorRejectedDeposits();
    } catch (error) {
      logger.error('Error in rejected deposits monitoring task:', error);
      await networkInterceptor.cleanup();
    }
  }
);

class SchedulerUtil {
  constructor() {
    this.jobs = new Map();
  }

  async startJobs() {
    // Cleanup expired sessions every hour
    this.jobs.set('sessionCleanup', cron.schedule('0 * * * *', async () => {
      logger.info('Running scheduled session cleanup');
      await sessionUtil.cleanupExpiredSessions();
    }));

    // Send whatsApp message for pending transactions every minute
    this.jobs.set('pendingCheck', cron.schedule('* * * * *', async () => {
      try {
        logger.info('Sending pending transactions WhatsApp message...');
        await transactionService.checkPendingTransactions();
      } catch (error) {
        logger.error('Error in pending transactions check job:', error);
      }
    }));

    // Start tasks with proper delays and error handling
    try {
      // Start deposit list task first
      logger.info('Started deposit list monitoring task');
      depositListTask.start();

      // Wait 10 seconds before starting recent deposits task
      // await new Promise(resolve => setTimeout(resolve, 10000));
      logger.info('Started recent deposits monitoring task');
      recentDepositsTask.start();

      // Wait another 10 seconds before starting rejected deposits task
      // await new Promise(resolve => setTimeout(resolve, 10000));
      logger.info('Started rejected deposits monitoring task');
      rejectedDepositsTask.start();

      // logger.info('All scheduled jobs started successfully');
    } catch (error) {
      logger.error('Error starting scheduled jobs:', error);
      throw error;
    }
  }

  async stopJobs() {
    for (const [name, job] of this.jobs) {
      logger.info(`Stopping ${name} job`);
      job.stop();
    }
    this.jobs.clear();

    // Stop the monitoring tasks
    depositListTask.stop();
    recentDepositsTask.stop();
    rejectedDepositsTask.stop();

    // Cleanup browser when stopping jobs
    try {
      await networkInterceptor.cleanup();
    } catch (error) {
      logger.error('Error cleaning up network interceptor:', error);
    }
  }
}

// Export both the scheduler util instance and the tasks
module.exports = {
  schedulerUtil: new SchedulerUtil(),
  depositListTask,
  recentDepositsTask,
  rejectedDepositsTask
}; 