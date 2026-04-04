import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SavingAccountController } from './saving-account.controller';
import { SavingAccountService } from './saving-account.service';
import { SavingAccount } from '../db/models/SavingAccount';
import { Transaction } from '../db/models/Transaction';

@Module({
  imports: [SequelizeModule.forFeature([SavingAccount, Transaction])],
  controllers: [SavingAccountController],
  providers: [SavingAccountService],
  exports: [SavingAccountService],
})
export class SavingAccountModule {}