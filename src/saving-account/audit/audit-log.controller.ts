import { Controller, Get, Query, Param, BadRequestException } from '@nestjs/common';
import { AuditLogService, AuditAction, AuditLogResponse } from './audit-log.service';

/**
 * AuditLogController - REST API for querying audit logs
 * 
 * Endpoints:
 * GET /api/v1/audit-logs              - List all logs (with filters)
 * GET /api/v1/audit-logs/entity/:type/:id - Logs for specific entity
 * GET /api/v1/audit-logs/user/:userId    - Logs for specific user
 * GET /api/v1/audit-logs/actions/:action - Logs by action type
 */
@Controller('api/v1/audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  /**
   * List audit logs with optional filters
   * GET /api/v1/audit-logs?action=DEPOSIT&entityType=SavingAccount&limit=50
   */
  @Get()
  async listLogs(
    @Query('action') action?: AuditAction,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ): Promise<{ logs: AuditLogResponse[]; count: number }> {
    try {
      const logs = await this.auditLogService.query({
        action,
        entityType,
        entityId,
        userId,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        limit: limit ? parseInt(limit, 10) : 100,
      });

      return {
        logs,
        count: logs.length,
      };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to query audit logs',
      );
    }
  }

  /**
   * Get logs for a specific entity
   * GET /api/v1/audit-logs/entity/:entityType/:entityId
   */
  @Get('entity/:entityType/:entityId')
  async getLogsForEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('limit') limit?: string,
  ): Promise<{ logs: AuditLogResponse[]; count: number }> {
    const logs = await this.auditLogService.getLogsForEntity(
      entityType,
      entityId,
      limit ? parseInt(limit, 10) : 100,
    );

    return {
      logs,
      count: logs.length,
    };
  }

  /**
   * Get logs for a specific user
   * GET /api/v1/audit-logs/user/:userId
   */
  @Get('user/:userId')
  async getLogsForUser(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ): Promise<{ logs: AuditLogResponse[]; count: number }> {
    const logs = await this.auditLogService.getLogsForUser(
      userId,
      limit ? parseInt(limit, 10) : 100,
    );

    return {
      logs,
      count: logs.length,
    };
  }

  /**
   * Get logs by action type
   * GET /api/v1/audit-logs/actions/:action
   */
  @Get('actions/:action')
  async getLogsByAction(
    @Param('action') action: AuditAction,
    @Query('limit') limit?: string,
  ): Promise<{ logs: AuditLogResponse[]; count: number }> {
    const logs = await this.auditLogService.getLogsByAction(
      action,
      limit ? parseInt(limit, 10) : 100,
    );

    return {
      logs,
      count: logs.length,
    };
  }

  /**
   * Get recent logs
   * GET /api/v1/audit-logs/recent?limit=50
   */
  @Get('recent')
  async getRecentLogs(
    @Query('limit') limit?: string,
  ): Promise<{ logs: AuditLogResponse[]; count: number }> {
    const logs = await this.auditLogService.getRecentLogs(
      limit ? parseInt(limit, 10) : 50,
    );

    return {
      logs,
      count: logs.length,
    };
  }
}// test watcher
