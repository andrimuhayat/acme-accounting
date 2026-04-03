import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { SavingsAccount } from '../../db/models/SavingsAccount';

export interface SavingsAccountInterface {
  id: number;
  accountNumber: string;
  accountName: string;
  balance: number;
  interestRate: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SavingsAccountServiceInterface {
  createAccount(
    accountName: string,
    initialDeposit: number,
    interestRate: number,
  ): Promise<SavingsAccount>;
  deposit(accountId: number, amount: number): Promise<SavingsAccount>;
  withdraw(accountId: number, amount: number): Promise<SavingsAccount>;
  getBalance(accountId: number): Promise<number>;
  getAccount(accountId: number): Promise<SavingsAccount | null>;
  calculateInterest(accountId: number): Promise<number>;
}

@Injectable()
export class SavingsAccountService implements SavingsAccountServiceInterface {
  // In-memory counter for account number generation
  // Time complexity: O(1) for account number generation
  private accountCounter = 0;

  constructor(
    @InjectModel(SavingsAccount)
    private readonly savingsAccountModel: typeof SavingsAccount,
  ) {}

  /**
   * Generate unique account number in format: SAV-XXXXXXXX
   * Time complexity: O(1)
   */
  private generateAccountNumber(): string {
    const sequence = String(++this.accountCounter).padStart(8, '0');
    return `SAV-${sequence}`;
  }

  /**
   * Create a new savings account with initial deposit and interest rate
   * Time complexity: O(1) for account creation
   * @param accountName - Name of the savings account
   * @param initialDeposit - Initial deposit amount (must be >= 0)
   * @param interestRate - Annual interest rate percentage (e.g., 2.5 for 2.5%)
   * @returns Created savings account
   * @throws Error if accountName is empty or initial deposit is negative
   */
  async createAccount(
    accountName: string,
    initialDeposit: number,
    interestRate: number,
  ): Promise<SavingsAccount> {
    // Validate account name
    if (!accountName || accountName.trim().length === 0) {
      throw new Error('Account name is required');
    }

    // Validate initial deposit (must be >= 0)
    if (initialDeposit < 0) {
      throw new Error('Initial deposit cannot be negative');
    }

    // Validate interest rate (must be >= 0)
    if (interestRate < 0) {
      throw new Error('Interest rate cannot be negative');
    }

    // Time complexity: O(1) for in-memory operation
    const account = await this.savingsAccountModel.create({
      accountNumber: this.generateAccountNumber(),
      accountName: accountName.trim(),
      balance: initialDeposit,
      interestRate,
    });

    return account;
  }

  /**
   * Deposit amount into savings account
   * Time complexity: O(1) for account lookup and update
   * @param accountId - ID of the savings account
   * @param amount - Amount to deposit (must be > 0)
   * @returns Updated savings account
   * @throws Error if account not found or amount is invalid
   */
  async deposit(accountId: number, amount: number): Promise<SavingsAccount> {
    // Validate amount
    if (amount <= 0) {
      throw new Error('Deposit amount must be greater than zero');
    }

    // Find account - Time complexity: O(1) for primary key lookup
    const account = await this.savingsAccountModel.findByPk(accountId);
    if (!account) {
      throw new Error(`Account with ID ${accountId} not found`);
    }

    // Update balance - Time complexity: O(1)
    account.balance += amount;
    await account.save();

    return account;
  }

  /**
   * Withdraw amount from savings account
   * Time complexity: O(1) for account lookup and update
   * @param accountId - ID of the savings account
   * @param amount - Amount to withdraw (must be > 0 and <= current balance)
   * @returns Updated savings account
   * @throws Error if account not found, insufficient funds, or amount is invalid
   */
  async withdraw(accountId: number, amount: number): Promise<SavingsAccount> {
    // Validate amount
    if (amount <= 0) {
      throw new Error('Withdrawal amount must be greater than zero');
    }

    // Find account - Time complexity: O(1) for primary key lookup
    const account = await this.savingsAccountModel.findByPk(accountId);
    if (!account) {
      throw new Error(`Account with ID ${accountId} not found`);
    }

    // Check sufficient funds
    if (account.balance < amount) {
      throw new Error('Insufficient funds');
    }

    // Update balance - Time complexity: O(1)
    account.balance -= amount;
    await account.save();

    return account;
  }

  /**
   * Get current balance of savings account
   * Time complexity: O(1) for primary key lookup
   * @param accountId - ID of the savings account
   * @returns Current balance
   * @throws Error if account not found
   */
  async getBalance(accountId: number): Promise<number> {
    const account = await this.savingsAccountModel.findByPk(accountId);
    if (!account) {
      throw new Error(`Account with ID ${accountId} not found`);
    }
    return account.balance;
  }

  /**
   * Get savings account by ID
   * Time complexity: O(1) for primary key lookup
   * @param accountId - ID of the savings account
   * @returns Savings account or null if not found
   */
  async getAccount(accountId: number): Promise<SavingsAccount | null> {
    // Time complexity: O(1) for primary key lookup
    return await this.savingsAccountModel.findByPk(accountId);
  }

  /**
   * Calculate simple interest for savings account
   * Formula: balance * (interestRate / 100)
   * Time complexity: O(1)
   * @param accountId - ID of the savings account
   * @returns Calculated interest amount
   * @throws Error if account not found
   */
  async calculateInterest(accountId: number): Promise<number> {
    const account = await this.savingsAccountModel.findByPk(accountId);
    if (!account) {
      throw new Error(`Account with ID ${accountId} not found`);
    }

    // Simple interest calculation: balance * (interestRate/100)
    // Time complexity: O(1)
    const interest = account.balance * (account.interestRate / 100);
    return Math.round(interest * 100) / 100; // Round to 2 decimal places
  }
}