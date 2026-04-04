import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SavingsAccountService, SavingsAccount } from './savings-account.service';

/**
 * Request DTOs for Savings Account API
 */
export interface CreateAccountRequest {
  accountName: string;
  initialDeposit: number;
  interestRate: number;
}

export interface DepositRequest {
  amount: number;
}

export interface WithdrawRequest {
  amount: number;
}

/**
 * Response DTOs for Savings Account API
 */
export interface AccountResponse {
  id: number;
  accountNumber: string;
  accountName: string;
  balance: number;
  interestRate: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BalanceResponse {
  accountId: number;
  balance: number;
}

export interface InterestResponse {
  accountId: number;
  interest: number;
  interestRate: number;
}

/**
 * Savings Account Controller
 *
 * Provides REST API endpoints for savings account operations with interest calculation:
 * - Create new savings account with interest rate
 * - Deposit funds
 * - Withdraw funds
 * - Get account details
 * - Get account balance
 * - Calculate interest
 *
 * All operations are O(1) time complexity.
 */
@Controller('api/v1/savings-account')
export class SavingsAccountController {
  constructor(private readonly savingsAccountService: SavingsAccountService) {}

  /**
   * Create a new savings account
   * POST /api/v1/savings-account
   *
   * @param request - { accountName: string, initialDeposit: number, interestRate: number }
   * @returns Created account details
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createAccount(@Body() request: CreateAccountRequest): Promise<AccountResponse> {
    try {
      const account = await this.savingsAccountService.createAccount(
        request.accountName,
        request.initialDeposit,
        request.interestRate,
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
   * GET /api/v1/savings-account/:id
   *
   * @param id - The unique account identifier
   * @returns Account details or 404 if not found
   */
  @Get(':id')
  async getAccount(@Param('id', ParseIntPipe) id: number): Promise<AccountResponse> {
    const account = await this.savingsAccountService.getAccount(id);
    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }
    return this.toAccountResponse(account);
  }

  /**
   * Get account balance
   * GET /api/v1/savings-account/:id/balance
   *
   * @param id - The unique account identifier
   * @returns Current balance
   */
  @Get(':id/balance')
  async getBalance(@Param('id', ParseIntPipe) id: number): Promise<BalanceResponse> {
    try {
      const balance = await this.savingsAccountService.getBalance(id);
      return {
        accountId: id,
        balance,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new NotFoundException(`Account with ID ${id} not found`);
      }
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to get balance',
      );
    }
  }

  /**
   * Calculate interest for account
   * GET /api/v1/savings-account/:id/interest
   *
   * @param id - The unique account identifier
   * @returns Calculated interest and interest rate
   */
  @Get(':id/interest')
  async calculateInterest(@Param('id', ParseIntPipe) id: number): Promise<InterestResponse> {
    try {
      const account = await this.savingsAccountService.getAccount(id);
      if (!account) {
        throw new NotFoundException(`Account with ID ${id} not found`);
      }
      const interest = await this.savingsAccountService.calculateInterest(id);
      return {
        accountId: id,
        interest,
        interestRate: account.interestRate,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to calculate interest',
      );
    }
  }

  /**
   * Deposit funds into an account
   * POST /api/v1/savings-account/:id/deposit
   *
   * @param id - The unique account identifier
   * @param request - { amount: number }
   * @returns Updated account
   */
  @Post(':id/deposit')
  @HttpCode(HttpStatus.OK)
  async deposit(
    @Param('id', ParseIntPipe) id: number,
    @Body() request: DepositRequest,
  ): Promise<AccountResponse> {
    try {
      const account = await this.savingsAccountService.deposit(id, request.amount);
      return this.toAccountResponse(account);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new NotFoundException(`Account with ID ${id} not found`);
      }
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to deposit',
      );
    }
  }

  /**
   * Withdraw funds from an account
   * POST /api/v1/savings-account/:id/withdraw
   *
   * @param id - The unique account identifier
   * @param request - { amount: number }
   * @returns Updated account
   */
  @Post(':id/withdraw')
  @HttpCode(HttpStatus.OK)
  async withdraw(
    @Param('id', ParseIntPipe) id: number,
    @Body() request: WithdrawRequest,
  ): Promise<AccountResponse> {
    try {
      const account = await this.savingsAccountService.withdraw(id, request.amount);
      return this.toAccountResponse(account);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new NotFoundException(`Account with ID ${id} not found`);
      }
      if (error instanceof Error && error.message === 'Insufficient funds') {
        throw new BadRequestException('Insufficient funds for withdrawal');
      }
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to withdraw',
      );
    }
  }

  /**
   * Transform SavingsAccount to AccountResponse
   * O(1) time complexity
   */
  private toAccountResponse(account: SavingsAccount): AccountResponse {
    return {
      id: account.id,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      balance: account.balance,
      interestRate: account.interestRate,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }
}
