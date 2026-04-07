import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { User } from '../../db/models/User';
import { Company } from '../../db/models/Company';

@Module({
  imports: [SequelizeModule.forFeature([User, Company])],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}