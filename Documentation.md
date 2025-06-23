# Checkers Guide

## Type of Transactions
* **Deposits** - These are the transactions in which amount is +ve. We store them in the database & query overy transactionStatus to get their current status. Status could be
    * Pending
    * Success
    * Rejected
* **Withdraw** - These are the transactions in which amount is -ve. We store them in the database & query over auditStatus & transactionStatus to get their current status. In this case, the status depends on multiple factors - 

## Caching
* We cache the transaction data in order to make the API response fast.
    * Caching is done for /deposits API

## Cron Jobs & Network Interception
* We have multiple cron jobs that run on server start. These jobs are responsible for intercepting the network on DW Panel & fetch the data from there.