// const axios = require('axios');
const logger = require('./logger.util');

class WhatsAppService {
  constructor() {
    this.apiUrl = process.env.WHATSAPP_API_URL;
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    this.fromNumberId = process.env.WHATSAPP_FROM_NUMBER_ID;
  }

  async sendMessage(to, message) {
    return true;
  }

  async sendPendingTransactionAlert(transaction, agent) {
    const message = `🚨 *Pending Transaction Alert*\n\n` +
      `Transaction ID: ${transaction.transactionId}\n` +
      `Customer: ${transaction.customerName}\n` +
      `Amount: ₹${transaction.amount}\n` +
      `Status: Pending\n` +
      `Time Elapsed: ${Math.floor((Date.now() - new Date(transaction.requestedAt)) / 1000 / 60)} minutes\n\n` +
      `Please check and update the status.`;

    return this.sendMessage(agent.contactNumber, message);
  }
}

module.exports = new WhatsAppService(); 