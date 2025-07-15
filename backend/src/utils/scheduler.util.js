const cron = require('node-cron');
const logger = require('./logger.util');
const sessionUtil = require('./session.util');
const networkInterceptor = require('./network-interceptor.util');
const sentryUtil = require('./sentry.util')
// const transactionService = require('../services/transaction.service');

class Task {
  constructor(name, cronExpression, handler) {
    this.name = name;
    this.cronExpression = cronExpression;
    this.handler = handler;
    this.job = null;
  }

  async start() {
    try {
      // Run the task immediately once
      await this.handler();
      // Schedule the cron job
      this.job = cron.schedule(this.cronExpression, this.handler);
      this.job.start();
    } catch (error) {
      logger.error(`Error in task ${this.name.toUpperCase()}:`, error);
    }
  }

  stop() {
    if (this.job) {
      this.job.stop();
    }
    logger.info(`Task ${this.name} stopped`);
  }
}

// Create task instances
const pendingDepositsTask = new Task(
  'pendingDepositsTask',
  '0 */5 * * *', // Run every 5 hours
  async () => {
    try {
      await networkInterceptor.monitorPendingDeposits();
    } catch (error) {
      logger.error('Error in deposit list monitoring task:', error);
      sentryUtil.captureException(error, {
        context: 'monitor_pending_deposits_scheduler',
        method: 'monitorPendingDeposits',
        transactionType: 'deposit'
      });
      await networkInterceptor.cleanup();
    }
  }
);

const approvedDepositsTask = new Task(
  'approvedDepositsTask',
  '0 */5 * * *', // Run every 5 hours
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
  'rejectedDepositsTask',
  '0 */5 * * *', // Run every 5 hours
  async () => {
    try {
      await networkInterceptor.monitorRejectedDeposits();
    } catch (error) {
      logger.error('Error in rejected deposits monitoring task:', error);
      await networkInterceptor.cleanup();
    }
  }
);

const pendingWithdrawalsTask = new Task(
  'pendingWithdrawalsTask',
  '0 */5 * * *', // Run every 5 hours
  async () => {
    try {
      await networkInterceptor.monitorPendingWithdrawals();
    } catch (error) {
      logger.error('Error in pending withdrawals monitoring task:', error);
      await networkInterceptor.cleanup();
    }
  }
);

const approvedWithdrawalsTask = new Task(
  'approvedWithdrawalsTask',
  '0 */5 * * *', // Run every 5 hours
  async () => {
    try {
      await networkInterceptor.monitorApprovedWithdrawals();
    } catch (error) {
      logger.error('Error in approved withdrawals monitoring task:', error);
      await networkInterceptor.cleanup();
    }
  }
);

const rejectedWithdrawalsTask = new Task(
  'rejectedWithdrawalsTask',
  '0 */5 * * *', // Run every 5 hours
  async () => {
    try {
      await networkInterceptor.monitorRejectedWithdrawals();
    } catch (error) {
      logger.error('Error in rejected withdrawals monitoring task:', error);
      await networkInterceptor.cleanup();
    }
  }
);

const fetchPendingTranscripts = new Task(
  'Fetch Pending Transcripts',
  '*/15 * * * *', // Runs every 15 minutes
  async () => {
    try {
      await networkInterceptor.runTranscriptFetchScheduler();
    } catch (error) {
      logger.error('Error in transcript fetch scheduler:', error);
    }
  }
);

const pendingTransactionNotifications = new Task(
  'Pending Transaction Notifications',
  '*/30 * * * * *', // Every 30 seconds
  async () => {
    try {
      await networkInterceptor.processTransactionNotification();
    } catch (error) {
      logger.error('Error in pending transaction notifications task:', error);
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
      await sessionUtil.cleanupExpiredSessions();
    }));

    // Transcript fetch every 15 minutes
    this.jobs.set('transcriptFetch', cron.schedule('*/15 * * * *', async () => {
      await fetchPendingTranscripts.start();
    }));    

    // Pending transaction notifications every 30 seconds
    this.jobs.set('pendingNotifications', cron.schedule('*/30 * * * * *', async () => {
      await pendingTransactionNotifications.start();
    }));

    // Start tasks once with proper error handling
    try {
      await pendingDepositsTask.start();
      await approvedDepositsTask.start();
      await rejectedDepositsTask.start();
      await pendingWithdrawalsTask.start();
      await approvedWithdrawalsTask.start();
      await rejectedWithdrawalsTask.start();
    } catch (error) {
      logger.error('Error starting scheduled jobs:', error);
      throw error;
    }
  }

  async stopJobs() {
    for (const [name, job] of this.jobs) {
      job.stop();
    }
    this.jobs.clear();

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
  pendingDepositsTask,
  approvedDepositsTask,
  rejectedDepositsTask,
  pendingWithdrawalsTask,
  approvedWithdrawalsTask,
  rejectedWithdrawalsTask,
  fetchPendingTranscripts,
  pendingTransactionNotifications
}; 