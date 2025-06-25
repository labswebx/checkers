# Checkers Guide

## Type of Transactions
* **Deposits** - These are the transactions in which amount is +ve. We store them in the database & query overy transactionStatus to get their current status. Status could be
    * Pending
    * Success
    * Rejected
* **Withdraw** - These are the transactions in which amount is -ve. We store them in the database & query over auditStatus & transactionStatus to get their current status. In this case, the status depends on multiple factors.

## Caching
* We cache the transaction data in order to make the API response fast.
    * Caching is done for /deposits API

## Cron Jobs & Network Interception
* We have multiple cron jobs that run on server start. These jobs are responsible for intercepting the network on DW Panel & fetch the data from there. We currently have below cron jobs - 
    * Fetch Pending, Approved & Rejected Deposits
    * Fetch Pending, Approved & Rejected Withdraws
    * Check all the transactions in the system & fetch their transcripts if needed. 


## Deposits
* These transactions simply get updated from Pending status to Success or Rejected status.

## Withdraws
Initially bonusIncluded, bonusExcluded, auditStatus, transactionStatus, UTR, transcript will all be null. They will get updated in 3 steps, and once everything is Success, then only the transaction gets to Success, else it is marked as Rejected.

* These transactions get completed in 3 steps
    * Bonus
    * Checkers
    * Franchise

1. **Bonus** - Initally the bonus team adds bonusIcluded or bonusExcluded to the transaction. Once any of these is added, then we show the transaction amount. We subtract the bonusIncluded from the amount & display that. This is the amount that the customer gets. No need to subtract bonusExcluded. At this moment we store the approvedOn time as bonusApprovedOn.
2. **Checkers** - Once bonus is added, then the checkers team verify & update the auditStatus of the transaction. If the auditStatus is Success, we proceed further. But if it is Rejected, then the transaction is moved to the Rejected section. At this moment we store the approvedOn time as checkingDeptApprovedOn.
3. **Franchise** - Once the above 2 steps are Success, then the Franchise verifies everything on their end and then add UTR & transcript to this transaction. Before this step, isImageAvailable column is false for the transaction. Once the transcript is added we fetch the transcript as well. And once the transcript is added, UTR is added, then the Franchise updates the transactionStatus of the transaction.
* **Note** - Sometimes, the bonusIncluded & bonusExcluded both are 0 but still auditStatus comes as Success or Rejected. This is a common case & is expected. In such cases, we directly move teh transaction forward skipping the first step.