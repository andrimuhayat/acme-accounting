import { Module } from '@nestjs/common';
import { DbModule } from './db.module';
import { TicketsController } from './tickets/tickets.controller';
import { ReportsController } from './reports/reports.controller';
import { HealthcheckController } from './healthcheck/healthcheck.controller';
import { PasswordResetController } from './password-reset/password-reset.controller';
import { ReportsService } from './reports/reports.service';

@Module({
  imports: [DbModule],
  controllers: [TicketsController, ReportsController, HealthcheckController, PasswordResetController],
  providers: [ReportsService],
})
export class AppModule {}
