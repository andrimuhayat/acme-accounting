import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SavingAccountController } from './saving-account.controller';
import { SavingAccountService } from './saving-account.service';
import { ExportModule } from './export/export.module';
import { SavingAccount } from '../db/models/SavingAccount';
import { Transaction } from '../db/models/Transaction';
import { AuditLogModule } from './audit/audit-log.module';

@Module({
  imports: [
    SequelizeModule.forFeature([SavingAccount, Transaction]),
    AuditLogModule,
    ExportModule,
  ],
  controllers: [SavingAccountController],
  providers: [SavingAccountService],
  exports: [SavingAccountService],
})
export class SavingAccountModule {}