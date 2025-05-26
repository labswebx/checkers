const User = require('../models/user.model');
const Transaction = require('../models/transaction.model');
const whatsapp = require('../utils/whatsapp.util');
const logger = require('../utils/logger.util');

class TransactionService {
  /**
   * Process scraped deposit/withdrawal data
   * @param {Array} transactions - Array of scraped transactions
   * @param {string} type - Transaction type ('deposit' or 'withdrawal')
   */
  async processTransactions(transactions, type) {
    try {
      const results = {
        created: 0,
        updated: 0,
        statusChanged: 0,
        failed: 0,
        total: transactions.length,
        errors: []
      };

      for (const transaction of transactions) {
        try {
          if (!transaction || !transaction.id) {
            results.failed++;
            results.errors.push('Invalid transaction data');
            continue;
          }

          // Find or create agent user
          const agent = await this.findOrCreateAgent(transaction.franchise);
          
          // Map scraped data to our schema
          const mappedData = this.mapTransactionData(transaction, type, agent._id);

          // Validate mapped data
          if (!mappedData.transactionId || !mappedData.status) {
            results.failed++;
            results.errors.push(`Invalid mapped data for transaction ${transaction.id}`);
            continue;
          }

          // Update or create transaction
          const existingTransaction = await Transaction.findOne({
            transactionId: mappedData.transactionId
          });

          if (existingTransaction) {
            const updateData = {
              ...mappedData,
              lastScrapedAt: new Date()
            };

            // Only update statusUpdatedAt if status has changed
            if (existingTransaction.status !== mappedData.status) {
              updateData.statusUpdatedAt = new Date();
              results.statusChanged++;

              // Log status change for monitoring
              logger.info('Transaction status changed', {
                transactionId: mappedData.transactionId,
                oldStatus: existingTransaction.status,
                newStatus: mappedData.status,
                timeTaken: updateData.statusUpdatedAt - existingTransaction.createdAt
              });
            }

            // Update with validation
            const updated = await Transaction.findByIdAndUpdate(
              existingTransaction._id,
              updateData,
              { new: true, runValidators: true }
            );

            if (!updated) {
              results.failed++;
              results.errors.push(`Failed to update transaction ${mappedData.transactionId}`);
              continue;
            }

            results.updated++;
          } else {
            // Create new transaction with validation
            try {
              await Transaction.create({
                ...mappedData,
                lastScrapedAt: new Date(),
                statusUpdatedAt: new Date() // Set initial statusUpdatedAt
              });
              results.created++;
            } catch (createError) {
              results.failed++;
              results.errors.push(`Failed to create transaction ${mappedData.transactionId}: ${createError.message}`);
              continue;
            }
          }
        } catch (error) {
          logger.error('Error processing transaction:', {
            error: error.message,
            transaction: transaction?.id || 'unknown'
          });
          results.failed++;
          results.errors.push(`Error processing transaction ${transaction?.id || 'unknown'}: ${error.message}`);
        }
      }

      // Log detailed results
      logger.info('Transaction processing complete', { 
        results,
        errorSummary: results.errors.length > 0 ? results.errors : 'No errors'
      });

      return results;
    } catch (error) {
      logger.error('Error in processTransactions:', error);
      throw error;
    }
  }

  /**
   * Find or create an agent user by franchise name
   * @param {string} franchise - Franchise name
   */
  async findOrCreateAgent(franchise) {
    try {
      // Look for existing agent user with this franchise
      let agent = await User.findOne({ 
        franchise,
        role: 'agent',
        isActive: true
      });
      
      if (!agent) {
        // Create new agent user
        agent = await User.create({
          name: franchise,
          email: `${franchise.toLowerCase().replace(/\s+/g, '.')}@agent.com`,
          franchise,
          role: 'agent',
          isActive: true,
          password: 'defaultPassword123', // You should generate a random password here
          contactNumber: 1234567890, // Default contact number, should be updated later
          notificationPreferences: {
            email: true,
            sms: true,
            whatsapp: false
          }
        });
        logger.info('New agent user created', { franchise });
      }

      return agent;
    } catch (error) {
      logger.error('Error in findOrCreateAgent:', {
        error: error.message,
        franchise
      });
      throw error;
    }
  }

  /**
   * Map scraped data to our schema
   * @param {Object} data - Raw scraped data
   * @param {string} type - Transaction type
   * @param {string} agentId - Agent ID
   */
  mapTransactionData(data, type, agentId) {
    // Extract transaction ID from data based on type
    const transactionId = type === 'deposit' 
      ? data.deposit_id || data.id
      : data.withdrawal_id || data.id;

    // Map status
    const status = this.mapStatus(data.status);

    // Parse dates
    const requestedAt = this.parseDate(data.request_date || data.created_at);
    const processedAt = this.parseDate(data.processed_at || data.updated_at);

    return {
      transactionId,
      type,
      agentId,
      status,
      amount: parseFloat(data.amount.replace(/[₹,]/g, '')),
      customerId: data.id,
      customerName: data.name,
      franchise: data.franchise,
      utr: data.utr,
      bank: data.payment_method,
      requestedAt,
      processedAt,
      remarks: data.remarks,
      metadata: {
        raw: data
      }
    };
  }

  /**
   * Map status from scraped data to our schema
   * @param {string} status - Raw status
   */
  mapStatus(status) {
    if (!status) return 'pending';
    
    // Convert to lowercase and remove extra spaces
    status = status.toLowerCase().trim();

    // Common variations of status text
    const approvedKeywords = ['approved', 'success', 'completed', 'done', 'processed'];
    const rejectedKeywords = ['rejected', 'failed', 'cancelled', 'declined', 'error'];
    const pendingKeywords = ['pending', 'statuspen', 'processing', 'in progress', 'waiting'];

    // Check for approved status
    if (approvedKeywords.some(keyword => status.includes(keyword))) {
      return 'approved';
    }

    // Check for rejected status
    if (rejectedKeywords.some(keyword => status.includes(keyword))) {
      return 'rejected';
    }

    // Check for pending status
    if (pendingKeywords.some(keyword => status.includes(keyword))) {
      return 'pending';
    }

    // Log unknown status for monitoring
    logger.warn('Unknown transaction status encountered', { 
      rawStatus: status,
      defaultingTo: 'pending'
    });

    return 'pending';
  }

  /**
   * Parse date string to Date object
   * @param {string} dateStr - Date string
   */
  parseDate(dateStr) {
    if (!dateStr) return null;
    try {
      return new Date(dateStr);
    } catch (error) {
      logger.error('Error parsing date:', { dateStr, error: error.message });
      return null;
    }
  }

  /**
   * Get transaction statistics
   * @param {Object} query - Query parameters
   */
  async getStats(query = {}) {
    try {
      const stats = await Transaction.aggregate([
        { $match: query },
        {
          $group: {
            _id: {
              type: '$type',
              status: '$status'
            },
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        },
        {
          $group: {
            _id: '$_id.type',
            stats: {
              $push: {
                status: '$_id.status',
                count: '$count',
                amount: '$totalAmount'
              }
            },
            totalCount: { $sum: '$count' },
            totalAmount: { $sum: '$totalAmount' }
          }
        }
      ]);

      return stats;
    } catch (error) {
      logger.error('Error getting transaction stats:', error);
      throw error;
    }
  }

  async checkPendingTransactions() {
    try {
      // Find transactions that are:
      // 1. In pending status
      // 2. More than 2 minutes old
      // 3. Haven't sent a notification yet (or last notification was more than 30 mins ago)
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

      const pendingTransactions = await Transaction.find({
        status: 'pending',
        requestedAt: { $lte: twoMinutesAgo },
        $or: [
          { lastNotificationSent: { $exists: false } },
          { lastNotificationSent: { $lte: thirtyMinutesAgo } }
        ]
      }).populate('agentId');

      logger.info(`Found ${pendingTransactions.length} pending transactions to send notifications for`);

      // Send notifications for each transaction
      for (const transaction of pendingTransactions) {
        if (transaction.agentId && transaction.agentId.contactNumber) {
          try {
            await whatsapp.sendPendingTransactionAlert(transaction, transaction.agentId);
            
            // Update the lastNotificationSent timestamp
            await Transaction.findByIdAndUpdate(transaction._id, {
              lastNotificationSent: new Date()
            });

            logger.info('Notification sent for transaction', {
              transactionId: transaction.transactionId,
              agent: transaction.agentId.name
            });
          } catch (error) {
            logger.error('Error sending notification for transaction', {
              transactionId: transaction.transactionId,
              error: error.message
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error checking pending transactions:', error);
      throw error;
    }
  }

  /**
   * Get status update time statistics
   * Groups transactions by how long they took to update status
   */
  async getStatusUpdateStats() {
    try {
      const timeSlabs = [
        { min: 2, max: 5, label: '2-5 minutes' },
        { min: 5, max: 8, label: '5-8 minutes' },
        { min: 8, max: 12, label: '8-12 minutes' },
        { min: 12, max: 20, label: '12-20 minutes' },
        { min: 20, max: null, label: 'Above 20 minutes' }
      ];

      // Initialize results object
      const results = {
        overall: {},
        byAgent: {}
      };

      for (const slab of timeSlabs) {
        // Calculate time difference in minutes between statusUpdatedAt and createdAt
        const matchStage = {
          $match: {
            statusUpdatedAt: { $exists: true },
            $expr: {
              $let: {
                vars: {
                  timeDiffMinutes: {
                    $divide: [
                      { $subtract: ['$statusUpdatedAt', '$createdAt'] },
                      60000 // Convert ms to minutes
                    ]
                  }
                },
                in: slab.max 
                  ? {
                      $and: [
                        { $gte: ['$$timeDiffMinutes', slab.min] },
                        { $lt: ['$$timeDiffMinutes', slab.max] }
                      ]
                    }
                  : { $gte: ['$$timeDiffMinutes', slab.min] }
              }
            }
          }
        };

        // Get overall count for this time slab
        const overallCount = await Transaction.aggregate([
          matchStage,
          {
            $group: {
              _id: null,
              count: { $sum: 1 }
            }
          }
        ]);

        results.overall[slab.label] = overallCount[0]?.count || 0;

        // Get agent-wise breakdown for this time slab
        const agentStats = await Transaction.aggregate([
          matchStage,
          {
            $group: {
              _id: '$agentId',
              count: { $sum: 1 }
            }
          },
          {
            $lookup: {
              from: 'users',
              localField: '_id',
              foreignField: '_id',
              as: 'agent'
            }
          },
          {
            $unwind: '$agent'
          },
          {
            $project: {
              agentName: '$agent.name',
              franchise: '$agent.franchise',
              count: 1
            }
          }
        ]);

        // Organize agent stats
        agentStats.forEach(stat => {
          if (!results.byAgent[stat._id]) {
            results.byAgent[stat._id] = {
              name: stat.agentName,
              franchise: stat.franchise,
              timeSlabs: {}
            };
          }
          results.byAgent[stat._id].timeSlabs[slab.label] = stat.count;
        });
      }

      return results;
    } catch (error) {
      logger.error('Error getting status update stats:', error);
      throw error;
    }
  }
}

module.exports = new TransactionService(); 