import { Test, TestingModule } from '@nestjs/testing';
import { SavingsAccountService, SavingsAccountServiceInterface } from './savings-account.service';
import { SavingsAccount } from '../db/models/SavingsAccount';

/**
 * Mock SavingsAccount model for testing
 */
const createMockSavingsAccount = (overrides?: Partial<SavingsAccount>): SavingsAccount => {
  const mockAccount = {
    id: 1,
    accountNumber: 'SAV-00000001',
    accountName: 'Test Savings',
    balance: 100,
    interestRate: 2.5,
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn().mockResolvedValue(this),
    ...overrides,
  } as unknown as SavingsAccount;
  return mockAccount;
};

describe('SavingsAccountService', () => {
  let service: SavingsAccountServiceInterface;
  let mockSavingsAccountModel: {
    create: jest.Mock;
    findByPk: jest.Mock;
  };

  beforeEach(async () => {
    // Create mock model methods
    mockSavingsAccountModel = {
      create: jest.fn(),
      findByPk: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SavingsAccountService,
        {
          provide: SavingsAccount,
          useValue: mockSavingsAccountModel,
        },
      ],
    }).compile();

    service = module.get<SavingsAccountService>(SavingsAccountService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================
  // createAccount Tests
  // ============================================

  describe('createAccount', () => {
    it('should create an account with zero balance when no initial deposit', async () => {
      const mockAccount = createMockSavingsAccount({
        accountName: 'Test Savings',
        balance: 0,
        interestRate: 2.5,
      });
      mockSavingsAccountModel.create.mockResolvedValue(mockAccount);

      const account = await service.createAccount('Test Savings', 0, 2.5);

      expect(account).toBeDefined();
      expect(account.accountName).toBe('Test Savings');
      expect(account.balance).toBe(0);
      expect(account.interestRate).toBe(2.5);
      expect(account.accountNumber).toMatch(/^SAV-\d{8}$/);
      expect(mockSavingsAccountModel.create).toHaveBeenCalledWith({
        accountNumber: expect.stringMatching(/^SAV-\d{8}$/),
        accountName: 'Test Savings',
        balance: 0,
        interestRate: 2.5,
      });
    });

    it('should create an account with correct initial deposit', async () => {
      const mockAccount = createMockSavingsAccount({
        accountName: 'Premium Savings',
        balance: 1000,
        interestRate: 3.5,
      });
      mockSavingsAccountModel.create.mockResolvedValue(mockAccount);

      const account = await service.createAccount('Premium Savings', 1000, 3.5);

      expect(account).toBeDefined();
      expect(account.accountName).toBe('Premium Savings');
      expect(account.balance).toBe(1000);
      expect(account.interestRate).toBe(3.5);
    });

    it('should create multiple accounts with unique IDs and numbers', async () => {
      const mockAccount1 = createMockSavingsAccount({ id: 1, accountNumber: 'SAV-00000001' });
      const mockAccount2 = createMockSavingsAccount({ id: 2, accountNumber: 'SAV-00000002' });
      mockSavingsAccountModel.create.mockResolvedValueOnce(mockAccount1);
      mockSavingsAccountModel.create.mockResolvedValueOnce(mockAccount2);

      const account1 = await service.createAccount('Account 1', 500, 2.5);
      const account2 = await service.createAccount('Account 2', 1000, 3.0);

      expect(account1.id).not.toBe(account2.id);
      expect(account1.accountNumber).not.toBe(account2.accountNumber);
    });

    it('should handle large initial deposit correctly', async () => {
      const mockAccount = createMockSavingsAccount({
        balance: 999999999.99,
      });
      mockSavingsAccountModel.create.mockResolvedValue(mockAccount);

      const account = await service.createAccount('High Roller', 999999999.99, 5.0);

      expect(account.balance).toBe(999999999.99);
    });

    it('should handle zero interest rate', async () => {
      const mockAccount = createMockSavingsAccount({
        interestRate: 0,
      });
      mockSavingsAccountModel.create.mockResolvedValue(mockAccount);

      const account = await service.createAccount('No Interest', 1000, 0);

      expect(account.interestRate).toBe(0);
    });

    it('should throw error for empty account name', async () => {
      await expect(service.createAccount('', 100, 2.5)).rejects.toThrow(
        'Account name is required',
      );
    });

    it('should throw error for whitespace-only account name', async () => {
      await expect(service.createAccount('   ', 100, 2.5)).rejects.toThrow(
        'Account name is required',
      );
    });

    it('should throw error for negative initial deposit', async () => {
      await expect(service.createAccount('Test', -100, 2.5)).rejects.toThrow(
        'Initial deposit cannot be negative',
      );
    });

    it('should throw error for negative interest rate', async () => {
      await expect(service.createAccount('Test', 100, -2.5)).rejects.toThrow(
        'Interest rate cannot be negative',
      );
    });

    it('should trim whitespace from account name', async () => {
      const mockAccount = createMockSavingsAccount({
        accountName: 'Trimmed Name',
      });
      mockSavingsAccountModel.create.mockResolvedValue(mockAccount);

      await service.createAccount('  Trimmed Name  ', 100, 2.5);

      expect(mockSavingsAccountModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          accountName: 'Trimmed Name',
        }),
      );
    });
  });

  // ============================================
  // deposit Tests
  // ============================================

  describe('deposit', () => {
    it('should deposit successfully and return updated account', async () => {
      const mockAccount = createMockSavingsAccount({
        id: 1,
        balance: 150,
      });
      mockSavingsAccountModel.findByPk.mockResolvedValue(mockAccount);

      const result = await service.deposit(1, 50);

      expect(result).toBeDefined();
      expect(result.balance).toBe(150);
      expect(mockAccount.save).toHaveBeenCalled();
    });

    it('should update account balance after deposit', async () => {
      const mockAccount = createMockSavingsAccount({
        id: 1,
        balance: 100,
      });
      mockSavingsAccountModel.findByPk.mockResolvedValue(mockAccount);

      await service.deposit(1, 50);

      expect(mockAccount.balance).toBe(150);
    });

    it('should handle decimal deposit amounts correctly', async () => {
      const mockAccount = createMockSavingsAccount({
        balance: 100.5,
      });
      mockSavingsAccountModel.findByPk.mockResolvedValue(mockAccount);

      await service.deposit(1, 50.25);

      expect(mockAccount.balance).toBe(150.75);
    });

    it('should throw error for zero deposit amount', async () => {
      await expect(service.deposit(1, 0)).rejects.toThrow(
        'Deposit amount must be greater than zero',
      );
    });

    it('should throw error for negative deposit amount', async () => {
      await expect(service.deposit(1, -50)).rejects.toThrow(
        'Deposit amount must be greater than zero',
      );
    });

    it('should throw error for deposit to non-existent account', async () => {
      mockSavingsAccountModel.findByPk.mockResolvedValue(null);

      await expect(service.deposit(999, 100)).rejects.toThrow(
        'Account with ID 999 not found',
      );
    });

    it('should throw error for missing account ID', async () => {
      await expect(service.deposit(null as any, 100)).rejects.toThrow(
        'Invalid account ID or amount',
      );
    });
  });

  // ============================================
  // withdraw Tests
  // ============================================

  describe('withdraw', () => {
    it('should withdraw successfully and return updated account', async () => {
      const mockAccount = createMockSavingsAccount({
        id: 1,
        balance: 70,
      });
      mockSavingsAccountModel.findByPk.mockResolvedValue(mockAccount);

      const result = await service.withdraw(1, 30);

      expect(result).toBeDefined();
      expect(result.balance).toBe(70);
      expect(mockAccount.save).toHaveBeenCalled();
    });

    it('should update account balance after withdrawal', async () => {
      const mockAccount = createMockSavingsAccount({
        id: 1,
        balance: 100,
      });
      mockSavingsAccountModel.findByPk.mockResolvedValue(mockAccount);

      await service.withdraw(1, 40);

      expect(mockAccount.balance).toBe(60);
    });

    it('should allow withdrawal when balance equals withdrawal amount', async () => {
      const mockAccount = createMockSavingsAccount({
        id: 1,
        balance: 100,
      });
      mockSavingsAccountModel.findByPk.mockResolvedValue(mockAccount);

      await service.withdraw(1, 100);

      expect(mockAccount.balance).toBe(0);
    });

    it('should throw error for insufficient funds', async () => {
      const mockAccount = createMockSavingsAccount({
        id: 1,
        balance: 100,
      });
      mockSavingsAccountModel.findByPk.mockResolvedValue(mockAccount);

      await expect(service.withdraw(1, 150)).rejects.toThrow('Insufficient funds');
    });

    it('should throw error for zero withdrawal amount', async () => {
      await expect(service.withdraw(1, 0)).rejects.toThrow(
        'Withdrawal amount must be greater than zero',
      );
    });

    it('should throw error for negative withdrawal amount', async () => {
      await expect(service.withdraw(1, -50)).rejects.toThrow(
        'Withdrawal amount must be greater than zero',
      );
    });

    it('should throw error for withdrawal from non-existent account', async () => {
      mockSavingsAccountModel.findByPk.mockResolvedValue(null);

      await expect(service.withdraw(999, 100)).rejects.toThrow(
        'Account with ID 999 not found',
      );
    });

    it('should handle decimal withdrawal amounts correctly', async () => {
      const mockAccount = createMockSavingsAccount({
        balance: 100.5,
      });
      mockSavingsAccountModel.findByPk.mockResolvedValue(mockAccount);

      await service.withdraw(1, 50.25);

      expect(mockAccount.balance).toBe(50.25);
    });
  });

  // ============================================
  // getAccount Tests
  // ============================================

  describe('getAccount', () => {
    it('should return account when it exists', async () => {
      const mockAccount = createMockSavingsAccount({
        id: 1,
        accountName: 'Test Account',
        balance: 250,
        interestRate: 2.5,
      });
      mockSavingsAccountModel.findByPk.mockResolvedValue(mockAccount);

      const account = await service.getAccount(1);

      expect(account).toBeDefined();
      expect(account?.id).toBe(1);
      expect(account?.accountName).toBe('Test Account');
      expect(account?.balance).toBe(250);
      expect(account?.interestRate).toBe(2.5);
    });

    it('should return null when account does not exist', async () => {
      mockSavingsAccountModel.findByPk.mockResolvedValue(null);

      const account = await service.getAccount(999);

      expect(account).toBeNull();
    });

    it('should return account with updated balance after transactions', async () => {
      const mockAccount = createMockSavingsAccount({
        balance: 120,
      });
      mockSavingsAccountModel.findByPk.mockResolvedValue(mockAccount);

      const updated = await service.getAccount(1);

      expect(updated?.balance).toBe(120);
    });

    it('should return account with correct interest rate', async () => {
      const mockAccount = createMockSavingsAccount({
        interestRate: 5.25,
      });
      mockSavingsAccountModel.findByPk.mockResolvedValue(mockAccount);

      const account = await service.getAccount(1);

      expect(account?.interestRate).toBe(5.25);
    });
  });

  // ============================================
  // getBalance Tests
  // ============================================

  describe('getBalance', () => {
    it('should return correct balance for account with initial deposit', async () => {
      const mockAccount = createMockSavingsAccount({ balance: 500 });
      mockSavingsAccountModel.findByPk.mockResolvedValue(mockAccount);

      const balance = await service.getBalance(1);

      expect(balance).toBe(500);
    });

    it('should return zero balance for account without initial deposit', async () => {
      const mockAccount = createMockSavingsAccount({ balance: 0 });
      mockSavingsAccountModel.findByPk.mockResolvedValue(mockAccount);

      const balance = await service.getBalance(1);

      expect(balance).toBe(0);
    });

    it('should return updated balance after deposit', async () => {
      const mockAccount = createMockSavingsAccount({ balance: 300 });
      mockSavingsAccountModel.findByPk.mockResolvedValue(mockAccount);

      const balance = await service.getBalance(1);

      expect(balance).toBe(300);
    });

    it('should return updated balance after withdrawal', async () => {
      const mockAccount = createMockSavingsAccount({ balance: 40 });
      mockSavingsAccountModel.findByPk.mockResolvedValue(mockAccount);

      const balance = await service.getBalance(1);

      expect(balance).toBe(40);
    });

    it('should throw error for non-existent account', async () => {
      mockSavingsAccountModel.findByPk.mockResolvedValue(null);

      await expect(service.getBalance(999)).rejects.toThrow(
        'Account with ID 999 not found',
      );
    });

    it('should return correct balance after multiple transactions', async () => {
      const mockAccount = createMockSavingsAccount({ balance: 140 });
      mockSavingsAccountModel.findByPk.mockResolvedValue(mockAccount);

      const balance = await service.getBalance(1);

      expect(balance).toBe(140);
    });
  });

  // ============================================
  // calculateInterest Tests
  // ============================================

  describe('calculateInterest', () => {
    it('should calculate interest correctly with standard rate', async () => {
      const mockAccount = createMockSavingsAccount({
        balance: 1000,
        interestRate: 2.5,
      });
      mockSavingsAccountModel.findByPk.mockResolvedValue(mockAccount);

      const interest = await service.calculateInterest(1);

      expect(interest).toBe(25); // 1000 * (2.5/100) = 25
    });

    it('should calculate interest correctly with high rate', async () => {
      const mockAccount = createMockSavingsAccount({
        balance: 10000,
        interestRate: 5.0,
      });
      mockSavingsAccountModel.findByPk.mockResolvedValue(mockAccount);

      const interest = await service.calculateInterest(1);

      expect(interest).toBe(500); // 10000 * (5/100) = 500
    });

    it('should calculate interest correctly with decimal balance', async () => {
      const mockAccount = createMockSavingsAccount({
        balance: 1234.56,
        interestRate: 3.75,
      });
      mockSavingsAccountModel.findByPk.mockResolvedValue(mockAccount);

      const interest = await service.calculateInterest(1);

      expect(interest).toBe(46.3); // 1234.56 * (3.75/100) = 46.296, rounded to 46.3
    });

    it('should return zero interest for zero balance', async () => {
      const mockAccount = createMockSavingsAccount({
        balance: 0,
        interestRate: 2.5,
      });
      mockSavingsAccountModel.findByPk.mockResolvedValue(mockAccount);

      const interest = await service.calculateInterest(1);

      expect(interest).toBe(0);
    });

    it('should return zero interest for zero interest rate', async () => {
      const mockAccount = createMockSavingsAccount({
        balance: 1000,
        interestRate: 0,
      });
      mockSavingsAccountModel.findByPk.mockResolvedValue(mockAccount);

      const interest = await service.calculateInterest(1);

      expect(interest).toBe(0);
    });

    it('should throw error for non-existent account', async () => {
      mockSavingsAccountModel.findByPk.mockResolvedValue(null);

      await expect(service.calculateInterest(999)).rejects.toThrow(
        'Account with ID 999 not found',
      );
    });

    it('should round interest to 2 decimal places', async () => {
      const mockAccount = createMockSavingsAccount({
        balance: 333.33,
        interestRate: 3.33,
      });
      mockSavingsAccountModel.findByPk.mockResolvedValue(mockAccount);

      const interest = await service.calculateInterest(1);

      // 333.33 * (3.33/100) = 11.099889, rounded to 11.1
      expect(interest).toBe(11.1);
    });
  });

  // ============================================
  // Integration Tests
  // ============================================

  describe('Integration Tests', () => {
    it('should handle complete account lifecycle', async () => {
      // Create account
      const createdAccount = createMockSavingsAccount({
        id: 1,
        accountNumber: 'SAV-00000001',
        accountName: 'Lifecycle Account',
        balance: 1000,
        interestRate: 2.5,
      });
      mockSavingsAccountModel.create.mockResolvedValue(createdAccount);

      const account = await service.createAccount('Lifecycle Account', 1000, 2.5);
      expect(account.balance).toBe(1000);
      expect(account.accountNumber).toMatch(/^SAV-\d{8}$/);

      // Simulate balance changes after transactions
      createdAccount.balance = 1600;
      mockSavingsAccountModel.findByPk.mockResolvedValue(createdAccount);

      // Get account and verify balance
      const finalAccount = await service.getAccount(1);
      expect(finalAccount?.balance).toBe(1600);

      // Get balance
      const balance = await service.getBalance(1);
      expect(balance).toBe(1600);
    });

    it('should track balance correctly through transactions', async () => {
      let mockAccount = createMockSavingsAccount({ balance: 100 });
      mockSavingsAccountModel.findByPk.mockResolvedValue(mockAccount);

      // Deposit
      mockAccount.balance = 150;
      await service.deposit(1, 50);

      // Withdraw
      mockAccount.balance = 120;
      await service.withdraw(1, 30);

      // Calculate interest
      mockAccount.interestRate = 2.5;
      const interest = await service.calculateInterest(1);

      expect(interest).toBe(3); // 120 * (2.5/100) = 3
    });

    it('should generate unique account numbers for multiple accounts', async () => {
      const accountNumbers: string[] = [];
      
      for (let i = 0; i < 3; i++) {
        const mockAccount = createMockSavingsAccount({
          id: i + 1,
          accountNumber: `SAV-${String(i + 1).padStart(8, '0')}`,
        });
        mockSavingsAccountModel.create.mockResolvedValue(mockAccount);

        const account = await service.createAccount(`Account ${i + 1}`, 100 * (i + 1), 2.5);
        accountNumbers.push(account.accountNumber);
      }

      // All account numbers should be unique
      expect(new Set(accountNumbers).size).toBe(3);
    });

    it('should handle multiple accounts with different interest rates', async () => {
      const rates = [1.5, 2.5, 5.0];
      const balances = [1000, 2000, 3000];

      for (let i = 0; i < 3; i++) {
        const mockAccount = createMockSavingsAccount({
          balance: balances[i],
          interestRate: rates[i],
        });
        mockSavingsAccountModel.findByPk.mockResolvedValue(mockAccount);

        const interest = await service.calculateInterest(i + 1);
        const expectedInterest = Math.round(balances[i] * (rates[i] / 100) * 100) / 100;
        expect(interest).toBe(expectedInterest);
      }
    });
  });
});