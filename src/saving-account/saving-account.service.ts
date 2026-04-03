import { Injectable } from '@nestjs/common';

export interface SavingAccount {
  id: string;
  accountNumber: string;
  accountName: string;
  balance: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  savingAccountId: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: Date;
}

export interface SavingAccountServiceInterface {
  createAccount(accountName: string, initialDeposit?: number): Promise<SavingAccount>;
  deposit(accountId: string, amount: number, description?: string): Promise<Transaction>;
  withdraw(accountId: string, amount: number, description?: string): Promise<Transaction>;
  getAccount(accountId: string): Promise<SavingAccount | null>;
  getBalance(accountId: string): Promise<number>;
  getTransactions(accountId: string, limit?: number): Promise<Transaction[]>;
}

@Injectable()
export class SavingAccountService implements SavingAccountServiceInterface {
  // In-memory storage for accounts and transactions
  private accounts: Map<string, SavingAccount> = new Map();
  private transactions: Map<string, Transaction[]> = new Map();
  private accountCounter = 0;

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
   * Create a new saving account with optional initial deposit
   * Uses setImmediate for non-blocking operation (O(1))
   */
  async createAccount(accountName: string, initialDeposit?: number): Promise<SavingAccount> {
    if (!accountName || accountName.trim().length === 0) {
      throw new Error('Account name is required');
    }

    const initialAmount = initialDeposit ?? 0;
    if (initialAmount < 0) {
      throw new Error('Initial deposit cannot be negative');
    }

    return new Promise((resolve, reject) => {
      setImmediate(() => {
        try {
          const id = `ACC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const now = new Date();

          const account: SavingAccount = {
            id,
            accountNumber: this.generateAccountNumber(),
            accountName: accountName.trim(),
            balance: initialAmount,
            currency: 'USD',
            createdAt: now,
            updatedAt: now,
          };

          this.accounts.set(id, account);
          this.transactions.set(id, []);

          // If initial deposit > 0, create a transaction record
          if (initialAmount > 0) {
            const transaction: Transaction = {
              id: this.generateTransactionId(),
              savingAccountId: id,
              type: 'deposit',
              amount: initialAmount,
              balanceAfter: initialAmount,
              description: 'Initial deposit',
              createdAt: now,
            };
            this.transactions.get(id)!.push(transaction);
          }

          resolve(account);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Deposit amount into account
   * Time complexity: O(1) for account lookup, O(1) for transaction append
   */
  async deposit(accountId: string, amount: number, description?: string): Promise<Transaction> {
    if (!accountId || amount <= 0) {
      throw new Error('Invalid account ID or amount');
    }

    return new Promise((resolve, reject) => {
      setImmediate(() => {
        try {
          const account = this.accounts.get(accountId);
          if (!account) {
            throw new Error('Account not found');
          }

          const now = new Date();
          const newBalance = account.balance + amount;

          // Update account balance
          account.balance = newBalance;
          account.updatedAt = now;
          this.accounts.set(accountId, account);

          // Create transaction record
          const transaction: Transaction = {
            id: this.generateTransactionId(),
            savingAccountId: accountId,
            type: 'deposit',
            amount,
            balanceAfter: newBalance,
            description: description ?? 'Deposit',
            createdAt: now,
          };

          const accountTransactions = this.transactions.get(accountId) ?? [];
          accountTransactions.push(transaction);
          this.transactions.set(accountId, accountTransactions);

          resolve(transaction);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Withdraw amount from account (validates sufficient balance)
   * Time complexity: O(1) for account lookup, O(1) for validation
   */
  async withdraw(accountId: string, amount: number, description?: string): Promise<Transaction> {
    if (!accountId || amount <= 0) {
      throw new Error('Invalid account ID or amount');
    }

    return new Promise((resolve, reject) => {
      setImmediate(() => {
        try {
          const account = this.accounts.get(accountId);
          if (!account) {
            throw new Error('Account not found');
          }

          if (account.balance < amount) {
            throw new Error('Insufficient balance');
          }

          const now = new Date();
          const newBalance = account.balance - amount;

          // Update account balance
          account.balance = newBalance;
          account.updatedAt = now;
          this.accounts.set(accountId, account);

          // Create transaction record
          const transaction: Transaction = {
            id: this.generateTransactionId(),
            savingAccountId: accountId,
            type: 'withdrawal',
            amount,
            balanceAfter: newBalance,
            description: description ?? 'Withdrawal',
            createdAt: now,
          };

          const accountTransactions = this.transactions.get(accountId) ?? [];
          accountTransactions.push(transaction);
          this.transactions.set(accountId, accountTransactions);

          resolve(transaction);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Get account by ID
   * Time complexity: O(1) for Map lookup
   */
  async getAccount(accountId: string): Promise<SavingAccount | null> {
    if (!accountId) {
      throw new Error('Account ID is required');
    }

    return new Promise((resolve) => {
      setImmediate(() => {
        const account = this.accounts.get(accountId) ?? null;
        resolve(account);
      });
    });
  }

  /**
   * Get account balance
   * Time complexity: O(1) for Map lookup
   */
  async getBalance(accountId: string): Promise<number> {
    if (!accountId) {
      throw new Error('Account ID is required');
    }

    return new Promise((resolve, reject) => {
      setImmediate(() => {
        const account = this.accounts.get(accountId);
        if (!account) {
          reject(new Error('Account not found'));
          return;
        }
        resolve(account.balance);
      });
    });
  }

  /**
   * Get transactions for account (most recent first)
   * Time complexity: O(n) where n = number of transactions, due to sorting
   * Optional limit parameter reduces output size
   */
  async getTransactions(accountId: string, limit?: number): Promise<Transaction[]> {
    if (!accountId) {
      throw new Error('Account ID is required');
    }

    return new Promise((resolve, reject) => {
      setImmediate(() => {
        const account = this.accounts.get(accountId);
        if (!account) {
          reject(new Error('Account not found'));
          return;
        }

        const transactions = this.transactions.get(accountId) ?? [];
        
        // Sort by createdAt descending (most recent first)
        const sortedTransactions = [...transactions].sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        );

        // Apply limit if provided
        const limitedTransactions = limit ? sortedTransactions.slice(0, limit) : sortedTransactions;

        resolve(limitedTransactions);
      });
    });
  }
}
