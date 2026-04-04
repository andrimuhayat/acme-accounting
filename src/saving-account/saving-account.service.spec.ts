import { Test, TestingModule } from '@nestjs/testing';
import { SavingAccountService } from './saving-account.service';

describe('SavingAccountService', () => {
  let service: SavingAccountService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SavingAccountService,
      ],
    }).compile();

    service = module.get<SavingAccountService>(SavingAccountService);
  });

  afterEach(() => {
    // Reset service state between tests
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================
  // createAccount Tests
  // ============================================

  describe('createAccount', () => {
    it('should create an account with zero balance when no initial deposit', async () => {
      const account = await service.createAccount('Test Savings');

      expect(account).toBeDefined();
      expect(account.accountName).toBe('Test Savings');
      expect(account.balance).toBe(0);
      expect(account.currency).toBe('USD');
      expect(account.accountNumber).toMatch(/^SA-\d{8}-\d{5}$/);
      expect(account.id).toBeDefined();
      expect(account.createdAt).toBeInstanceOf(Date);
      expect(account.updatedAt).toBeInstanceOf(Date);
    });

    it('should create an account with correct initial deposit', async () => {
      const account = await service.createAccount('Premium Savings', 1000);

      expect(account).toBeDefined();
      expect(account.accountName).toBe('Premium Savings');
      expect(account.balance).toBe(1000);
      expect(account.currency).toBe('USD');
    });

    it('should create multiple accounts with unique IDs and numbers', async () => {
      const account1 = await service.createAccount('Account 1', 500);
      const account2 = await service.createAccount('Account 2', 1000);

      expect(account1.id).not.toBe(account2.id);
      expect(account1.accountNumber).not.toBe(account2.accountNumber);
    });

    it('should handle large initial deposit correctly', async () => {
      const account = await service.createAccount('High Roller', 999999999.99);

      expect(account.balance).toBe(999999999.99);
    });

    it('should create account with very long account name', async () => {
      const longName = 'A'.repeat(1000);
      const account = await service.createAccount(longName);

      expect(account.accountName).toBe(longName);
      expect(account.balance).toBe(0);
    });

    it('should throw error for empty account name', async () => {
      await expect(service.createAccount('')).rejects.toThrow(
        'Account name is required',
      );
    });

    it('should throw error for whitespace-only account name', async () => {
      await expect(service.createAccount('   ')).rejects.toThrow(
        'Account name is required',
      );
    });

    it('should throw error for negative initial deposit', async () => {
      await expect(service.createAccount('Test', -100)).rejects.toThrow(
        'Initial deposit cannot be negative',
      );
    });
  });

  // ============================================
  // deposit Tests
  // ============================================

  describe('deposit', () => {
    it('should deposit successfully and update balance', async () => {
      const account = await service.createAccount('Test Deposit', 100);
      const initialBalance = account.balance;

      const transaction = await service.deposit(account.id, 50, 'Test deposit');

      expect(transaction).toBeDefined();
      expect(transaction.type).toBe('deposit');
      expect(transaction.amount).toBe(50);
      expect(transaction.balanceAfter).toBe(initialBalance + 50);
      expect(transaction.description).toBe('Test deposit');
      expect(transaction.savingAccountId).toBe(account.id);
      expect(transaction.id).toBeDefined();
      expect(transaction.createdAt).toBeInstanceOf(Date);
    });

    it('should deposit with default description when not provided', async () => {
      const account = await service.createAccount('Test Deposit');
      const transaction = await service.deposit(account.id, 100);

      expect(transaction.description).toBe('Deposit');
    });

    it('should update account balance after deposit', async () => {
      const account = await service.createAccount('Test Deposit', 100);
      await service.deposit(account.id, 50);

      const updatedAccount = await service.getAccount(account.id);
      expect(updatedAccount?.balance).toBe(150);
    });

    it('should handle decimal deposit amounts correctly', async () => {
      const account = await service.createAccount('Test Deposit', 100.5);
      const transaction = await service.deposit(account.id, 50.25);

      expect(transaction.balanceAfter).toBe(150.75);
    });

    it('should throw error for zero deposit amount', async () => {
      const account = await service.createAccount('Test Deposit');

      await expect(service.deposit(account.id, 0)).rejects.toThrow(
        'Invalid account ID or amount',
      );
    });

    it('should throw error for negative deposit amount', async () => {
      const account = await service.createAccount('Test Deposit');

      await expect(service.deposit(account.id, -50)).rejects.toThrow(
        'Invalid account ID or amount',
      );
    });

    it('should throw error for deposit to non-existent account', async () => {
      await expect(
        service.deposit('non-existent-id', 100),
      ).rejects.toThrow('Account not found');
    });
  });

  // ============================================
  // withdraw Tests
  // ============================================

  describe('withdraw', () => {
    it('should withdraw successfully and update balance', async () => {
      const account = await service.createAccount('Test Withdraw', 100);
      const initialBalance = account.balance;

      const transaction = await service.withdraw(account.id, 30, 'Test withdrawal');

      expect(transaction).toBeDefined();
      expect(transaction.type).toBe('withdrawal');
      expect(transaction.amount).toBe(30);
      expect(transaction.balanceAfter).toBe(initialBalance - 30);
      expect(transaction.description).toBe('Test withdrawal');
      expect(transaction.savingAccountId).toBe(account.id);
    });

    it('should withdraw with default description when not provided', async () => {
      const account = await service.createAccount('Test Withdraw', 100);
      const transaction = await service.withdraw(account.id, 50);

      expect(transaction.description).toBe('Withdrawal');
    });

    it('should update account balance after withdrawal', async () => {
      const account = await service.createAccount('Test Withdraw', 100);
      await service.withdraw(account.id, 40);

      const updatedAccount = await service.getAccount(account.id);
      expect(updatedAccount?.balance).toBe(60);
    });

    it('should throw error for insufficient funds', async () => {
      const account = await service.createAccount('Test Withdraw', 100);

      await expect(service.withdraw(account.id, 150)).rejects.toThrow(
        'Insufficient balance',
      );
    });

    it('should throw error when balance equals withdrawal amount', async () => {
      const account = await service.createAccount('Test Withdraw', 100);

      const transaction = await service.withdraw(account.id, 100);

      expect(transaction.balanceAfter).toBe(0);
    });

    it('should throw error for zero withdrawal amount', async () => {
      const account = await service.createAccount('Test Withdraw', 100);

      await expect(service.withdraw(account.id, 0)).rejects.toThrow(
        'Invalid account ID or amount',
      );
    });

    it('should throw error for negative withdrawal amount', async () => {
      const account = await service.createAccount('Test Withdraw', 100);

      await expect(service.withdraw(account.id, -50)).rejects.toThrow(
        'Invalid account ID or amount',
      );
    });

    it('should throw error for withdrawal from non-existent account', async () => {
      await expect(
        service.withdraw('non-existent-id', 100),
      ).rejects.toThrow('Account not found');
    });

    it('should handle decimal withdrawal amounts correctly', async () => {
      const account = await service.createAccount('Test Withdraw', 100.5);
      const transaction = await service.withdraw(account.id, 50.25);

      expect(transaction.balanceAfter).toBe(50.25);
    });
  });

  // ============================================
  // getAccount Tests
  // ============================================

  describe('getAccount', () => {
    it('should return account when it exists', async () => {
      const created = await service.createAccount('Test GetAccount', 250);

      const account = await service.getAccount(created.id);

      expect(account).toBeDefined();
      expect(account?.id).toBe(created.id);
      expect(account?.accountName).toBe('Test GetAccount');
      expect(account?.balance).toBe(250);
      expect(account?.currency).toBe('USD');
    });

    it('should return null when account does not exist', async () => {
      const account = await service.getAccount('non-existent-id');

      expect(account).toBeNull();
    });

    it('should return account with updated balance after transactions', async () => {
      const account = await service.createAccount('Test GetAccount', 100);
      await service.deposit(account.id, 50);
      await service.withdraw(account.id, 30);

      const updated = await service.getAccount(account.id);

      expect(updated?.balance).toBe(120);
    });

    it('should return account with correct timestamps', async () => {
      const beforeCreate = new Date();
      const account = await service.createAccount('Test Timestamps');
      const afterCreate = new Date();

      expect(account.createdAt.getTime()).toBeGreaterThanOrEqual(
        beforeCreate.getTime(),
      );
      expect(account.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
    });

    it('should throw error for empty account ID', async () => {
      await expect(service.getAccount('')).rejects.toThrow(
        'Account ID is required',
      );
    });
  });

  // ============================================
  // getBalance Tests
  // ============================================

  describe('getBalance', () => {
    it('should return correct balance for account with initial deposit', async () => {
      const account = await service.createAccount('Test GetBalance', 500);

      const balance = await service.getBalance(account.id);

      expect(balance).toBe(500);
    });

    it('should return zero balance for account without initial deposit', async () => {
      const account = await service.createAccount('Test GetBalance');

      const balance = await service.getBalance(account.id);

      expect(balance).toBe(0);
    });

    it('should return updated balance after deposit', async () => {
      const account = await service.createAccount('Test GetBalance', 100);
      await service.deposit(account.id, 200);

      const balance = await service.getBalance(account.id);

      expect(balance).toBe(300);
    });

    it('should return updated balance after withdrawal', async () => {
      const account = await service.createAccount('Test GetBalance', 100);
      await service.withdraw(account.id, 60);

      const balance = await service.getBalance(account.id);

      expect(balance).toBe(40);
    });

    it('should return correct balance after multiple transactions', async () => {
      const account = await service.createAccount('Test GetBalance', 100);
      await service.deposit(account.id, 50);
      await service.withdraw(account.id, 30);
      await service.deposit(account.id, 20);

      const balance = await service.getBalance(account.id);

      expect(balance).toBe(140);
    });

    it('should throw error for non-existent account', async () => {
      await expect(service.getBalance('non-existent-id')).rejects.toThrow(
        'Account not found',
      );
    });

    it('should throw error for empty account ID', async () => {
      await expect(service.getBalance('')).rejects.toThrow(
        'Account ID is required',
      );
    });
  });

  // ============================================
  // getTransactions Tests
  // ============================================

  describe('getTransactions', () => {
    it('should return transactions in descending order by date', async () => {
      const account = await service.createAccount('Test GetTransactions', 100);
      await service.deposit(account.id, 50, 'First');
      await service.withdraw(account.id, 20, 'Second');
      await service.deposit(account.id, 30, 'Third');

      const transactions = await service.getTransactions(account.id);

      expect(transactions.length).toBe(3);
      expect(transactions[0].description).toBe('Third');
      expect(transactions[1].description).toBe('Second');
      expect(transactions[2].description).toBe('First');
    });

    it('should respect limit parameter', async () => {
      const account = await service.createAccount('Test GetTransactions', 100);
      await service.deposit(account.id, 50, 'First');
      await service.withdraw(account.id, 20, 'Second');
      await service.deposit(account.id, 30, 'Third');

      const transactions = await service.getTransactions(account.id, 2);

      expect(transactions.length).toBe(2);
      expect(transactions[0].description).toBe('Third');
      expect(transactions[1].description).toBe('Second');
    });

    it('should return all transactions when limit is not specified', async () => {
      const account = await service.createAccount('Test GetTransactions', 100);
      for (let i = 1; i <= 5; i++) {
        await service.deposit(account.id, i * 10, `Transaction ${i}`);
      }

      const transactions = await service.getTransactions(account.id);

      expect(transactions.length).toBe(5);
    });

    it('should include correct transaction details', async () => {
      const account = await service.createAccount('Test GetTransactions', 100);
      const transaction = await service.deposit(account.id, 75, 'Detailed transaction');

      const transactions = await service.getTransactions(account.id);

      expect(transactions[0]).toHaveProperty('id');
      expect(transactions[0]).toHaveProperty('savingAccountId', account.id);
      expect(transactions[0]).toHaveProperty('type', 'deposit');
      expect(transactions[0]).toHaveProperty('amount', 75);
      expect(transactions[0]).toHaveProperty('balanceAfter', 175);
      expect(transactions[0]).toHaveProperty('description', 'Detailed transaction');
      expect(transactions[0]).toHaveProperty('createdAt');
    });

    it('should handle deposit and withdrawal types correctly', async () => {
      const account = await service.createAccount('Test GetTransactions', 100);
      await service.deposit(account.id, 50);
      await service.withdraw(account.id, 30);

      const transactions = await service.getTransactions(account.id);

      expect(transactions[0].type).toBe('withdrawal');
      expect(transactions[1].type).toBe('deposit');
    });

    it('should throw error for non-existent account', async () => {
      await expect(service.getTransactions('non-existent-id')).rejects.toThrow(
        'Account not found',
      );
    });

    it('should throw error for empty account ID', async () => {
      await expect(service.getTransactions('')).rejects.toThrow(
        'Account ID is required',
      );
    });
  });

  // ============================================
  // getAccountReport Tests
  // ============================================

  describe('getAccountReport', () => {
    it('should return complete report structure for account with transactions', async () => {
      const account = await service.createAccount('Test Report', 100);
      await service.deposit(account.id, 50, 'Deposit 1');
      await service.withdraw(account.id, 30, 'Withdraw 1');

      const report = await service.getAccountReport(account.id);

      // Verify top-level structure
      expect(report).toBeDefined();
      expect(report.accountId).toBe(account.id);
      expect(report.accountNumber).toBe(account.accountNumber);
      expect(report.accountName).toBe('Test Report');
      expect(report.balance).toBe(120); // 100 + 50 - 30
      expect(report.currency).toBe('USD');
      expect(report.createdAt).toBeInstanceOf(Date);
      expect(report.updatedAt).toBeInstanceOf(Date);

      // Verify transaction summary structure
      expect(report.transactionSummary).toBeDefined();
      expect(report.transactionSummary.totalDeposits).toBe(150); // 100 + 50 (initial + deposit)
      expect(report.transactionSummary.totalWithdrawals).toBe(30);
      expect(report.transactionSummary.transactionCount).toBe(2);

      // Verify recent transactions structure
      expect(report.recentTransactions).toBeDefined();
      expect(Array.isArray(report.recentTransactions)).toBe(true);
    });

    it('should return zero transaction summary for empty account', async () => {
      const account = await service.createAccount('Empty Report');

      const report = await service.getAccountReport(account.id);

      expect(report.accountId).toBe(account.id);
      expect(report.balance).toBe(0);
      expect(report.transactionSummary.totalDeposits).toBe(0);
      expect(report.transactionSummary.totalWithdrawals).toBe(0);
      expect(report.transactionSummary.transactionCount).toBe(0);
      expect(report.recentTransactions).toEqual([]);
    });

    it('should correctly aggregate deposits only', async () => {
      const account = await service.createAccount('Deposits Only', 100);
      await service.deposit(account.id, 50, 'Deposit 1');
      await service.deposit(account.id, 75, 'Deposit 2');

      const report = await service.getAccountReport(account.id);

      expect(report.transactionSummary.totalDeposits).toBe(225); // 100 + 50 + 75
      expect(report.transactionSummary.totalWithdrawals).toBe(0);
      expect(report.transactionSummary.transactionCount).toBe(2);
      expect(report.balance).toBe(225);
    });

    it('should correctly aggregate withdrawals only', async () => {
      const account = await service.createAccount('Withdrawals Only', 200);
      await service.withdraw(account.id, 50, 'Withdraw 1');
      await service.withdraw(account.id, 75, 'Withdraw 2');

      const report = await service.getAccountReport(account.id);

      expect(report.transactionSummary.totalDeposits).toBe(200); // Initial deposit
      expect(report.transactionSummary.totalWithdrawals).toBe(125); // 50 + 75
      expect(report.transactionSummary.transactionCount).toBe(2);
      expect(report.balance).toBe(75); // 200 - 50 - 75
    });

    it('should correctly aggregate mixed transactions', async () => {
      const account = await service.createAccount('Mixed Transactions', 100);
      await service.deposit(account.id, 100, 'Deposit 1');
      await service.withdraw(account.id, 50, 'Withdraw 1');
      await service.deposit(account.id, 75, 'Deposit 2');
      await service.withdraw(account.id, 25, 'Withdraw 2');

      const report = await service.getAccountReport(account.id);

      expect(report.transactionSummary.totalDeposits).toBe(275); // 100 + 100 + 75
      expect(report.transactionSummary.totalWithdrawals).toBe(75); // 50 + 25
      expect(report.transactionSummary.transactionCount).toBe(4);
      expect(report.balance).toBe(200); // 100 + 100 - 50 + 75 - 25
    });

    it('should return only last 10 recent transactions', async () => {
      const account = await service.createAccount('Many Transactions', 0);
      // Create 15 transactions
      for (let i = 1; i <= 15; i++) {
        await service.deposit(account.id, i * 10, `Transaction ${i}`);
      }

      const report = await service.getAccountReport(account.id);

      expect(report.recentTransactions.length).toBe(10);
      // Most recent should be Transaction 15 (highest amount)
      expect(report.recentTransactions[0].description).toBe('Transaction 15');
      // Oldest of the recent 10 should be Transaction 6
      expect(report.recentTransactions[9].description).toBe('Transaction 6');
    });

    it('should return transactions in descending order by date', async () => {
      const account = await service.createAccount('Ordered Report', 100);
      await service.deposit(account.id, 10, 'First');
      await service.deposit(account.id, 20, 'Second');
      await service.deposit(account.id, 30, 'Third');

      const report = await service.getAccountReport(account.id);

      expect(report.recentTransactions[0].description).toBe('Third');
      expect(report.recentTransactions[1].description).toBe('Second');
      expect(report.recentTransactions[2].description).toBe('First');
    });

    it('should include initial deposit in transaction summary', async () => {
      const account = await service.createAccount('With Initial', 500);

      const report = await service.getAccountReport(account.id);

      expect(report.transactionSummary.totalDeposits).toBe(500);
      expect(report.transactionSummary.totalWithdrawals).toBe(0);
      expect(report.transactionSummary.transactionCount).toBe(0); // No actual transactions yet
      expect(report.recentTransactions.length).toBe(0);
    });

    it('should include correct transaction details in recentTransactions', async () => {
      const account = await service.createAccount('Detailed Report', 100);
      const depositTxn = await service.deposit(account.id, 50, 'Detailed deposit');
      const withdrawTxn = await service.withdraw(account.id, 25, 'Detailed withdrawal');

      const report = await service.getAccountReport(account.id);

      // Find the deposit transaction in recentTransactions
      const depositInReport = report.recentTransactions.find(
        (t) => t.id === depositTxn.id,
      );
      expect(depositInReport).toBeDefined();
      expect(depositInReport?.type).toBe('deposit');
      expect(depositInReport?.amount).toBe(50);
      expect(depositInReport?.balanceAfter).toBe(150);
      expect(depositInReport?.description).toBe('Detailed deposit');

      // Find the withdrawal transaction in recentTransactions
      const withdrawInReport = report.recentTransactions.find(
        (t) => t.id === withdrawTxn.id,
      );
      expect(withdrawInReport).toBeDefined();
      expect(withdrawInReport?.type).toBe('withdrawal');
      expect(withdrawInReport?.amount).toBe(25);
      expect(withdrawInReport?.balanceAfter).toBe(125);
      expect(withdrawInReport?.description).toBe('Detailed withdrawal');
    });

    it('should throw error for non-existent account', async () => {
      await expect(service.getAccountReport('non-existent-id')).rejects.toThrow(
        'Account not found',
      );
    });

    it('should throw error for empty account ID', async () => {
      await expect(service.getAccountReport('')).rejects.toThrow(
        'Account ID is required',
      );
    });

    it('should handle decimal amounts correctly in summary', async () => {
      const account = await service.createAccount('Decimal Report', 100.5);
      await service.deposit(account.id, 50.25, 'Decimal deposit');
      await service.withdraw(account.id, 25.75, 'Decimal withdrawal');

      const report = await service.getAccountReport(account.id);

      expect(report.balance).toBe(125); // 100.5 + 50.25 - 25.75 = 125
      expect(report.transactionSummary.totalDeposits).toBe(150.75); // 100.5 + 50.25
      expect(report.transactionSummary.totalWithdrawals).toBe(25.75);
    });

    it('should handle large transaction amounts', async () => {
      const account = await service.createAccount('Large Amounts', 0);
      await service.deposit(account.id, 999999999.99, 'Huge deposit');

      const report = await service.getAccountReport(account.id);

      expect(report.balance).toBe(999999999.99);
      expect(report.transactionSummary.totalDeposits).toBe(999999999.99);
    });
  });

  // ============================================
  // Integration Tests
  // ============================================

  describe('Integration Tests', () => {
    it('should handle complete account lifecycle', async () => {
      // Create account
      const account = await service.createAccount('Lifecycle Account', 1000);
      expect(account.balance).toBe(1000);
      expect(account.accountNumber).toMatch(/^SA-\d{8}-\d{5}$/);

      // Make several transactions
      await service.deposit(account.id, 500, 'First deposit');
      await service.withdraw(account.id, 200, 'First withdrawal');
      await service.deposit(account.id, 300, 'Second deposit');

      // Verify final state
      const finalAccount = await service.getAccount(account.id);
      expect(finalAccount?.balance).toBe(1600);

      const transactions = await service.getTransactions(account.id);
      expect(transactions.length).toBe(3);

      const balance = await service.getBalance(account.id);
      expect(balance).toBe(1600);
    });

    it('should track balance correctly through complex transaction history', async () => {
      const account = await service.createAccount('Complex History', 100);

      const transactions = [
        { type: 'deposit', amount: 50 },
        { type: 'withdrawal', amount: 30 },
        { type: 'deposit', amount: 100 },
        { type: 'withdrawal', amount: 80 },
        { type: 'deposit', amount: 25 },
      ];

      let expectedBalance = 100;
      for (const txn of transactions) {
        if (txn.type === 'deposit') {
          await service.deposit(account.id, txn.amount);
          expectedBalance += txn.amount;
        } else {
          await service.withdraw(account.id, txn.amount);
          expectedBalance -= txn.amount;
        }
      }

      const finalBalance = await service.getBalance(account.id);
      expect(finalBalance).toBe(expectedBalance);

      const accountBalance = (await service.getAccount(account.id))?.balance;
      expect(accountBalance).toBe(expectedBalance);
    });

    it('should generate unique account numbers in correct format', async () => {
      const account1 = await service.createAccount('Account 1');
      const account2 = await service.createAccount('Account 2');
      const account3 = await service.createAccount('Account 3');

      expect(account1.accountNumber).toMatch(/^SA-\d{8}-\d{5}$/);
      expect(account2.accountNumber).toMatch(/^SA-\d{8}-\d{5}$/);
      expect(account3.accountNumber).toMatch(/^SA-\d{8}-\d{5}$/);

      // Each account number should be unique
      expect(account1.accountNumber).not.toBe(account2.accountNumber);
      expect(account2.accountNumber).not.toBe(account3.accountNumber);
      expect(account1.accountNumber).not.toBe(account3.accountNumber);
    });

    it('should generate correct report through complete account lifecycle', async () => {
      // Create account with initial deposit
      const account = await service.createAccount('Report Lifecycle', 1000);
      expect(account.balance).toBe(1000);

      // Make several transactions
      await service.deposit(account.id, 500, 'First deposit');
      await service.withdraw(account.id, 200, 'First withdrawal');
      await service.deposit(account.id, 300, 'Second deposit');

      // Get the account report
      const report = await service.getAccountReport(account.id);

      // Verify report reflects complete lifecycle
      expect(report.accountId).toBe(account.id);
      expect(report.accountName).toBe('Report Lifecycle');
      expect(report.balance).toBe(1600); // 1000 + 500 - 200 + 300
      expect(report.transactionSummary.totalDeposits).toBe(1800); // 1000 + 500 + 300
      expect(report.transactionSummary.totalWithdrawals).toBe(200);
      expect(report.transactionSummary.transactionCount).toBe(3);
      expect(report.recentTransactions.length).toBe(3);
    });

    it('should track financial summary correctly through complex transactions', async () => {
      const account = await service.createAccount('Financial Summary', 100);

      const transactionPlan = [
        { type: 'deposit', amount: 50 },
        { type: 'withdrawal', amount: 30 },
        { type: 'deposit', amount: 100 },
        { type: 'withdrawal', amount: 80 },
        { type: 'deposit', amount: 25 },
      ];

      let expectedDeposits = 100; // Initial
      let expectedWithdrawals = 0;

      for (const txn of transactionPlan) {
        if (txn.type === 'deposit') {
          await service.deposit(account.id, txn.amount);
          expectedDeposits += txn.amount;
        } else {
          await service.withdraw(account.id, txn.amount);
          expectedWithdrawals += txn.amount;
        }
      }

      const report = await service.getAccountReport(account.id);

      expect(report.transactionSummary.totalDeposits).toBe(expectedDeposits);
      expect(report.transactionSummary.totalWithdrawals).toBe(expectedWithdrawals);
      expect(report.transactionSummary.transactionCount).toBe(5);
      expect(report.balance).toBe(expectedDeposits - expectedWithdrawals);
    });
  });
});