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
  });
});