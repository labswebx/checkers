// const axios = require('axios');
const logger = require('./logger.util');

class WhatsAppService {
  constructor() {
    this.apiUrl = process.env.WHATSAPP_API_URL;
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    this.fromNumberId = process.env.WHATSAPP_FROM_NUMBER_ID;
  }

  async sendMessage(to, message) {
    try {
      // logger.info(`WHATSAPP MESSGAE SENT TO - ${to}, MESSAGE ${message}`)
      // const response = await axios.post(
      //   `${this.apiUrl}/${this.fromNumberId}/messages`,
      //   {
      //     messaging_product: "whatsapp",
      //     to: to,
      //     type: "text",
      //     text: { body: message }
      //   },
      //   {
      //     headers: {
      //       'Authorization': `Bearer ${this.accessToken}`,
      //       'Content-Type': 'application/json'
      //     }
      //   }
      // );

      // logger.info('WhatsApp message sent successfully', {
      //   to,
      //   messageId: response.data.messages[0].id
      // });

      // return response.data;
    } catch (error) {
      logger.error('Error sending WhatsApp message:', {
        to,
        error: error.response?.data || error.message
      });
      throw error;
    }
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