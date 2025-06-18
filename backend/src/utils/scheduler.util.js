const cron = require('node-cron');
const logger = require('./logger.util');
const sessionUtil = require('./session.util');
const networkInterceptor = require('./network-interceptor.util');
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
    } catch (error) {
      logger.error(`Error in task ${this.name.toUpperCase()}:`, error);
    }
  }

  stop() {
    // No need to stop since we're not using cron anymore
    logger.info(`Task ${this.name} stopped`);
  }
}

// Create task instances
const depositListTask = new Task(
  'Pending Deposits Monitor',
  null, // No cron expression needed
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
  'Approved Deposits Monitor',
  null, // No cron expression needed
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
  null, // No cron expression needed
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
      await sessionUtil.cleanupExpiredSessions();
    }));

    // Send whatsApp message for pending transactions every minute
    // this.jobs.set('pendingCheck', cron.schedule('* * * * *', async () => {
    //   try {
    //     await transactionService.checkPendingTransactions();
    //   } catch (error) {
    //     logger.error('Error in pending transactions check job:', error);
    //   }
    // }));

    // Start tasks once with proper error handling
    try {
      await depositListTask.start();
      await recentDepositsTask.start();
      await rejectedDepositsTask.start();
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
  depositListTask,
  recentDepositsTask,
  rejectedDepositsTask
}; 