import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { SavingAccount } from '../../db/models/SavingAccount';
import { Transaction, TransactionType } from '../../db/models/Transaction';

export interface SavingAccountDTO {
  id: string;
  accountNumber: string;
  accountName: string;
  balance: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransactionDTO {
  id: string;
  savingAccountId: string;
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: Date;
}

export interface SavingAccountServiceInterface {
  createAccount(accountName: string, initialDeposit?: number): Promise<SavingAccountDTO>;
  deposit(accountId: string, amount: number, description?: string): Promise<TransactionDTO>;
  withdraw(accountId: string, amount: number, description?: string): Promise<TransactionDTO>;
  getAccount(accountId: string): Promise<SavingAccountDTO | null>;
  getBalance(accountId: string): Promise<number>;
  getTransactions(accountId: string, limit?: number): Promise<TransactionDTO[]>;
}

@Injectable()
export class SavingAccountService implements SavingAccountServiceInterface {
  private accountCounter = 0;

  constructor(
    @InjectModel(SavingAccount)
    private readonly savingAccountModel: typeof SavingAccount,
    @InjectModel(Transaction)
    private readonly transactionModel: typeof Transaction,
  ) {}

  /**
   * Generate unique account number in format: SA-YYYYMMDD-XXXXX
   * Time complexity: O(1)
   */
  private generateAccountNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const sequence = String(++this.accountCounter).padStart(5, '0');
    return `SA-${year}${month}${day}-${sequence}`;
  }

  /**
   * Generate unique transaction ID
   * Time complexity: O(1)
   */
  private generateTransactionId(): string {
    return `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Convert SavingAccount model to DTO
   * Time complexity: O(1)
   */
  private toAccountDTO(account: SavingAccount): SavingAccountDTO {
    return {
      id: account.id,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      balance: account.balance,
      currency: account.currency,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  /**
   * Convert Transaction model to DTO
   * Time complexity: O(1)
   */
  private toTransactionDTO(transaction: Transaction): TransactionDTO {
    return {
      id: transaction.id,
      savingAccountId: transaction.savingAccountId,
      type: transaction.type,
      amount: transaction.amount,
      balanceAfter: transaction.balanceAfter,
      description: transaction.description,
      createdAt: transaction.createdAt,
    };
  }

  /**
   * Create a new saving account with optional initial deposit
   * Time complexity: O(1) for DB insert
   */
  async createAccount(accountName: string, initialDeposit?: number): Promise<SavingAccountDTO> {
    if (!accountName || accountName.trim().length === 0) {
      throw new Error('Account name is required');
    }

    const initialAmount = initialDeposit ?? 0;
    if (initialAmount < 0) {
      throw new Error('Initial deposit cannot be negative');
    }

    const id = `ACC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const account = await this.savingAccountModel.create({
      id,
      accountNumber: this.generateAccountNumber(),
      accountName: accountName.trim(),
      balance: initialAmount,
      currency: 'USD',
      createdAt: now,
      updatedAt: now,
    });

    // If initial deposit > 0, create a transaction record
    if (initialAmount > 0) {
      await this.transactionModel.create({
        id: this.generateTransactionId(),
        savingAccountId: id,
        type: TransactionType.deposit,
        amount: initialAmount,
        balanceAfter: initialAmount,
        description: 'Initial deposit',
        createdAt: now,
      });
    }

    return this.toAccountDTO(account);
  }

  /**
   * Deposit amount into account
   * Time complexity: O(1) for account lookup, O(1) for transaction append
   */
  async deposit(accountId: string, amount: number, description?: string): Promise<TransactionDTO> {
    if (!accountId) {
      throw new Error('Invalid account ID');
    }
    if (amount <= 0) {
      throw new Error('Deposit amount must be greater than zero');
    }

    const account = await this.savingAccountModel.findByPk(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    const now = new Date();
    const newBalance = account.balance + amount;

    // Update account balance
    await account.update({
      balance: newBalance,
      updatedAt: now,
    });

    // Create transaction record
    const transaction = await this.transactionModel.create({
      id: this.generateTransactionId(),
      savingAccountId: accountId,
      type: TransactionType.deposit,
      amount,
      balanceAfter: newBalance,
      description: description ?? 'Deposit',
      createdAt: now,
    });

    return this.toTransactionDTO(transaction);
  }

  /**
   * Withdraw amount from account (validates sufficient balance)
   * Time complexity: O(1) for account lookup, O(1) for validation
   */
  async withdraw(accountId: string, amount: number, description?: string): Promise<TransactionDTO> {
    if (!accountId) {
      throw new Error('Invalid account ID');
    }
    if (amount <= 0) {
      throw new Error('Withdrawal amount must be greater than zero');
    }

    const account = await this.savingAccountModel.findByPk(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    if (account.balance < amount) {
      throw new Error('Insufficient balance');
    }

    const now = new Date();
    const newBalance = account.balance - amount;

    // Update account balance
    await account.update({
      balance: newBalance,
      updatedAt: now,
    });

    // Create transaction record
    const transaction = await this.transactionModel.create({
      id: this.generateTransactionId(),
      savingAccountId: accountId,
      type: TransactionType.withdrawal,
      amount,
      balanceAfter: newBalance,
      description: description ?? 'Withdrawal',
      createdAt: now,
    });

    return this.toTransactionDTO(transaction);
  }

  /**
   * Get account by ID
   * Time complexity: O(1) for PK lookup
   */
  async getAccount(accountId: string): Promise<SavingAccountDTO | null> {
    if (!accountId) {
      throw new Error('Account ID is required');
    }

    const account = await this.savingAccountModel.findByPk(accountId);
    return account ? this.toAccountDTO(account) : null;
  }

  /**
   * Get account balance
   * Time complexity: O(1) for PK lookup
   */
  async getBalance(accountId: string): Promise<number> {
    if (!accountId) {
      throw new Error('Account ID is required');
    }

    const account = await this.savingAccountModel.findByPk(accountId);
    if (!account) {
      throw new Error('Account not found');
    }
    return account.balance;
  }

  /**
   * Get transactions for account (most recent first)
   * Time complexity: O(n) where n = number of transactions, due to sorting
   * Optional limit parameter reduces output size
   */
  async getTransactions(accountId: string, limit?: number): Promise<TransactionDTO[]> {
    if (!accountId) {
      throw new Error('Account ID is required');
    }

    const account = await this.savingAccountModel.findByPk(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    const transactions = await this.transactionModel.findAll({
      where: { savingAccountId: accountId },
      order: [['createdAt', 'DESC']],
    });

    const dtos = transactions.map((t) => this.toTransactionDTO(t));
    return limit ? dtos.slice(0, limit) : dtos;
  }
}