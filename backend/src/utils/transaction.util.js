const sentryUtil = require("./sentry.util");
const transactionService = require("../services/transaction.service");
const notificationService = require("../services/notification.service");
const fs = require("fs");
const Transaction = require("../models/transaction.model");
const Constant = require("../models/constant.model");
const axios = require("axios");
const { TRANSACTION_STATUS } = require("../constants");
const { defaultCache: Cache } = require("./cache.util");

class TransactionUtil {
  async processAndSaveTransaction(transaction, deposit) {
    await transactionService.findOrCreateAgent(
      transaction.franchiseName.split(" (")[0]
    );

    let shouldFetchTranscript=false;
    // Create the transaction data object
    const transactionData = {
      orderId: transaction.orderID,
      userId: transaction.userID,
      userName: transaction.userName,
      name: transaction.name,
      statusId: transaction.StatusID,
      transactionStatus: transaction.transactionStatus,
      amount: transaction.amount,
      requestDate: transaction.requestDate, // Convert UTC to IST
      paymentMethod: transaction.paymentMethod,
      holderName: transaction.holderName,
      bankName: transaction.bankName,
      accountNumber: transaction.number,
      iban: transaction.iBAN,
      cardNo: transaction.cardNo,
      utr: transaction.uTR,
      approvedOn: transaction.approvedOn,
      rejectedOn: transaction.rejectedOn,
      firstDeposit: transaction.firstDeposit,
      approvedBy: transaction.approvedBy,
      franchiseName: transaction.franchiseName,
      remarks: transaction.remarks,
      bonusIncluded: transaction.bonusIncluded,
      bonusExcluded: transaction.bonusExcluded,
      bonusThreshold: transaction.bonusThreshold,
      lastUpdatedUTROn: transaction.lastUpdatedUTROn,
      auditStatusId: transaction.auditStatusID,
      auditStatus: transaction.auditStatus,
      authorizedUserRemarks: transaction.authorizedUserRemarks,
      isImageAvailable: transaction.isImageAvailable,
    };

    if (deposit) {
      // Use findOneAndUpdate with upsert option to create or update
      await Transaction.findOneAndUpdate(
        { orderId: transaction.orderID }, // find criteria
        transactionData, // update data
        {
          upsert: true, // create if doesn't exist
          new: true, // return updated doc
          runValidators: true, // run schema validators
        }
      );
      //console.log("Transaction saved successfully"  );
      
    } else {
      // Use findOneAndUpdate with upsert option to create or update
      const existingTransaction = await Transaction.findOne({
        orderId: transaction.orderID,
      });
      let checkingDeptApprovedOn = null;
      let bonusApprovedOn = null;

      if (
        existingTransaction &&
        existingTransaction.auditStatus === TRANSACTION_STATUS.PENDING &&
        (transaction.auditStatus === TRANSACTION_STATUS.SUCCESS ||
          transaction.auditStatus === TRANSACTION_STATUS.REJECTED)
      ) {
        checkingDeptApprovedOn = transaction.approvedOn;
        transactionData.checkingDeptApprovedOn = checkingDeptApprovedOn;
      }

      // Check if bonusIncluded or bonusExcluded is changing from 0 to non-zero
      if (
        existingTransaction &&
        ((existingTransaction.bonusIncluded === 0 &&
          transaction.bonusIncluded !== 0) ||
          (existingTransaction.bonusExcluded === 0 &&
            transaction.bonusExcluded !== 0))
      ) {
        bonusApprovedOn = transaction.approvedOn;
        transactionData.bonusApprovedOn = bonusApprovedOn;
      }

      // Check if isImageAvailable is changing from false to true
      shouldFetchTranscript =
        existingTransaction &&
        existingTransaction.isImageAvailable === false &&
        transaction.isImageAvailable === true;

      await Transaction.findOneAndUpdate(
        { orderId: transaction.orderID },
        transactionData,
        {
          upsert: true,
          new: true,
          runValidators: true,
        }
      );
      //console.log("Transaction saved successfully from withdraw"  );
    }

    return shouldFetchTranscript;
  }
}

module.exports = new TransactionUtil();
