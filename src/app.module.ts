import { Module } from '@nestjs/common';
import { DbModule } from './db.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { TaskModule } from './task/task.module';
import { TicketsController } from './tickets/tickets.controller';
import { ReportsController } from './reports/reports.controller';
import { HealthcheckController } from './healthcheck/healthcheck.controller';
import { PasswordResetController } from './password-reset/password-reset.controller';
import { ReportsService } from './reports/reports.service';
import { SavingAccountModule } from './saving-account/saving-account.module';

@Module({
  imports: [DbModule, AuthModule, UserModule, TaskModule, SavingAccountModule],
  controllers: [TicketsController, ReportsController, HealthcheckController, PasswordResetController],
  providers: [ReportsService],
})
export class AppModule {}