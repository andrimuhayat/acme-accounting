import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ExportService } from './export.service';
import { SavingAccount } from '../../db/models/SavingAccount';
import { Transaction } from '../../db/models/Transaction';
import { AuditLogModule } from '../audit/audit-log.module';

/**
 * ExportModule - Handles Excel export functionality for saving accounts
 *
 * This module encapsulates all export-related services and their dependencies:
 * - ExportService: Core Excel generation and file system operations
 * - SequelizeModule: Database access for SavingAccount and Transaction models
 * - AuditLogModule: Compliance logging for export operations
 *
 * Usage:
 * Import this module in SavingAccountModule to expose export functionality
 */
@Module({
  imports: [
    SequelizeModule.forFeature([SavingAccount, Transaction]),
    AuditLogModule,
  ],
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule {}