import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SavingAccountService, SavingAccount, Transaction } from './saving-account.service';

/**
 * Request DTOs for Saving Account API
 */
export interface CreateAccountRequest {
  accountName: string;
  initialDeposit?: number;
}

export interface DepositRequest {
  amount: number;
  description?: string;
}

export interface WithdrawRequest {
  amount: number;
  description?: string;
}

/**
 * Response DTOs for Saving Account API
 */
export interface AccountResponse {
  id: string;
  accountNumber: string;
  accountName: string;
  balance: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransactionResponse {
  id: string;
  savingAccountId: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: Date;
}

export interface BalanceResponse {
  accountId: string;
  balance: number;
  currency: string;
}

export interface TransactionsResponse {
  accountId: string;
  transactions: TransactionResponse[];
  count: number;
}

/**
 * Saving Account Controller
 * 
 * Provides REST API endpoints for basic accounting savings account operations:
 * - Create new savings account
 * - Deposit funds
 * - Withdraw funds
 * - Get account details
 * - Get account balance
 * - Get transaction history
 * 
 * All operations are O(1) time complexity except getTransactions which is O(n).
 */
@Controller('api/v1/saving-account')
export class SavingAccountController {
  constructor(private readonly savingAccountService: SavingAccountService) {}

  /**
   * Create a new savings account
   * POST /api/v1/saving-account
   * 
   * @param request - { accountName: string, initialDeposit?: number }
   * @returns Created account details
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createAccount(@Body() request: CreateAccountRequest): Promise<AccountResponse> {
    try {
      const account = await this.savingAccountService.createAccount(
        request.accountName,
        request.initialDeposit,
      );
      return this.toAccountResponse(account);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to create account',
      );
    }
  }

  /**
   * Get account details by ID
   * GET /api/v1/saving-account/:accountId
   * 
   * @param accountId - The unique account identifier
   * @returns Account details or 404 if not found
   */
  @Get(':accountId')
  async getAccount(@Param('accountId') accountId: string): Promise<AccountResponse> {
    const account = await this.savingAccountService.getAccount(accountId);
    if (!account) {
      throw new NotFoundException(`Account with ID ${accountId} not found`);
    }
    return this.toAccountResponse(account);
  }

  /**
   * Get account balance
   * GET /api/v1/saving-account/:accountId/balance
   * 
   * @param accountId - The unique account identifier
   * @returns Current balance
   */
  @Get(':accountId/balance')
  async getBalance(@Param('accountId') accountId: string): Promise<BalanceResponse> {
    try {
      const account = await this.savingAccountService.getAccount(accountId);
      if (!account) {
        throw new NotFoundException(`Account with ID ${accountId} not found`);
      }
      return {
        accountId: account.id,
        balance: account.balance,
        currency: account.currency,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to get balance',
      );
    }
  }

  /**
   * Get transaction history for an account
   * GET /api/v1/saving-account/:accountId/transactions
   * 
   * @param accountId - The unique account identifier
   * @param limit - Optional limit on number of transactions (most recent first)
   * @returns List of transactions
   */
  @Get(':accountId/transactions')
  async getTransactions(
    @Param('accountId') accountId: string,
  ): Promise<TransactionsResponse> {
    try {
      const account = await this.savingAccountService.getAccount(accountId);
      if (!account) {
        throw new NotFoundException(`Account with ID ${accountId} not found`);
      }

      const transactions = await this.savingAccountService.getTransactions(accountId);
      return {
        accountId,
        transactions: transactions.map((txn) => this.toTransactionResponse(txn)),
        count: transactions.length,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to get transactions',
      );
    }
  }

  /**
   * Deposit funds into an account
   * POST /api/v1/saving-account/:accountId/deposit
   * 
   * @param accountId - The unique account identifier
   * @param request - { amount: number, description?: string }
   * @returns Transaction record
   */
  @Post(':accountId/deposit')
  @HttpCode(HttpStatus.OK)
  async deposit(
    @Param('accountId') accountId: string,
    @Body() request: DepositRequest,
  ): Promise<TransactionResponse> {
    try {
      const transaction = await this.savingAccountService.deposit(
        accountId,
        request.amount,
        request.description,
      );
      return this.toTransactionResponse(transaction);
    } catch (error) {
      if (error instanceof Error && error.message === 'Account not found') {
        throw new NotFoundException(`Account with ID ${accountId} not found`);
      }
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to deposit',
      );
    }
  }

  /**
   * Withdraw funds from an account
   * POST /api/v1/saving-account/:accountId/withdraw
   * 
   * @param accountId - The unique account identifier
   * @param request - { amount: number, description?: string }
   * @returns Transaction record
   */
  @Post(':accountId/withdraw')
  @HttpCode(HttpStatus.OK)
  async withdraw(
    @Param('accountId') accountId: string,
    @Body() request: WithdrawRequest,
  ): Promise<TransactionResponse> {
    try {
      const transaction = await this.savingAccountService.withdraw(
        accountId,
        request.amount,
        request.description,
      );
      return this.toTransactionResponse(transaction);
    } catch (error) {
      if (error instanceof Error && error.message === 'Account not found') {
        throw new NotFoundException(`Account with ID ${accountId} not found`);
      }
      if (error instanceof Error && error.message === 'Insufficient balance') {
        throw new BadRequestException('Insufficient balance for withdrawal');
      }
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to withdraw',
      );
    }
  }

  /**
   * Transform SavingAccount to AccountResponse
   * O(1) time complexity
   */
  private toAccountResponse(account: SavingAccount): AccountResponse {
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
   * Transform Transaction to TransactionResponse
   * O(1) time complexity
   */
  private toTransactionResponse(transaction: Transaction): TransactionResponse {
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
}
