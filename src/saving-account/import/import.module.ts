import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ImportService } from './import.service';
import { SavingAccount } from '../../../db/models/SavingAccount';
import { Transaction } from '../../../db/models/Transaction';
import { AuditLogModule } from '../audit/audit-log.module';

/**
 * ImportModule - Handles Excel/CSV import functionality for saving accounts
 *
 * This module encapsulates all import-related services and their dependencies:
 * - ImportService: Core file parsing and database operations
 * - SequelizeModule: Database access for SavingAccount and Transaction models
 * - AuditLogModule: Compliance logging for import operations
 *
 * Usage:
 * Import this module in SavingAccountModule to expose import functionality
 */
@Module({
  imports: [
    SequelizeModule.forFeature([SavingAccount, Transaction]),
    AuditLogModule,
  ],
  providers: [ImportService],
  exports: [ImportService],
})
export class ImportModule {}
