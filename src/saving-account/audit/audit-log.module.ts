import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuditLog } from './audit-log.model';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';

@Module({
  imports: [SequelizeModule.forFeature([AuditLog])],
  controllers: [AuditLogController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}

// Re-export for convenience
export { AuditLogService, AuditAction, AuditLogEntry, AuditLogResponse, AuditLogQuery } from './audit-log.service';
export { AuditLog } from './audit-log.model';
export { AuditLogController } from './audit-log.controller';