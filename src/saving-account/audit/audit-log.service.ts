import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AuditLog } from './audit-log.model';

export type AuditAction = 
  | 'ACCOUNT_CREATE' 
  | 'ACCOUNT_DELETE' 
  | 'DEPOSIT' 
  | 'WITHDRAWAL' 
  | 'LOGIN' 
  | 'LOGOUT' 
  | 'PASSWORD_CHANGE' 
  | 'PASSWORD_RESET' 
  | 'TRANSFER' 
  | 'ADMIN_ACTION';

export interface AuditLogEntry {
  action: AuditAction;
  entityType: string;
  entityId?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  success?: boolean;
  errorMessage?: string;
}

export interface AuditLogResponse {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  userId: string | null;
  ipAddress: string | null;
  metadata: Record<string, any> | null;
  success: boolean;
  errorMessage: string | null;
  loggedAt: Date;
}

export interface AuditLogQuery {
  action?: AuditAction;
  entityType?: string;
  entityId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

/**
 * AuditLogService - Records and queries audit trail for all financial operations
 * 
 * Features:
 * - O(1) log creation for every operation
 * - Queryable by action, entity, user, date range
 * - Immutable records (append-only)
 * 
 * Usage:
 * - Inject into any service that needs audit logging
 * - Call log() after each significant operation
 */
@Injectable()
export class AuditLogService {
  constructor(
    @InjectModel(AuditLog)
    private readonly auditLogModel: typeof AuditLog,
  ) {}

  /**
   * Log an audit event
   * Time complexity: O(1) for insert
   */
  async log(entry: AuditLogEntry): Promise<AuditLogResponse> {
    const auditLog = await this.auditLogModel.create({
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId || null,
      userId: entry.userId || null,
      ipAddress: entry.ipAddress || null,
      userAgent: entry.userAgent || null,
      metadata: entry.metadata || null,
      success: entry.success !== false,
      errorMessage: entry.errorMessage || null,
    });

    return this.toResponse(auditLog);
  }

  /**
   * Log a successful operation
   */
  async logSuccess(
    action: AuditAction,
    entityType: string,
    entityId: string,
    metadata?: Record<string, any>,
  ): Promise<AuditLogResponse> {
    return this.log({
      action,
      entityType,
      entityId,
      metadata,
      success: true,
    });
  }

  /**
   * Log a failed operation
   */
  async logFailure(
    action: AuditAction,
    entityType: string,
    entityId: string,
    errorMessage: string,
    metadata?: Record<string, any>,
  ): Promise<AuditLogResponse> {
    return this.log({
      action,
      entityType,
      entityId,
      metadata,
      success: false,
      errorMessage,
    });
  }

  /**
   * Query audit logs with filters
   * Time complexity: O(n) where n = number of matching records
   */
  async query(query: AuditLogQuery): Promise<AuditLogResponse[]> {
    const where: any = {};

    if (query.action) {
      where.action = query.action;
    }
    if (query.entityType) {
      where.entityType = query.entityType;
    }
    if (query.entityId) {
      where.entityId = query.entityId;
    }
    if (query.userId) {
      where.userId = query.userId;
    }
    if (query.startDate || query.endDate) {
      where.loggedAt = {};
      if (query.startDate) {
        where.loggedAt.gte = query.startDate;
      }
      if (query.endDate) {
        where.loggedAt.lte = query.endDate;
      }
    }

    const logs = await this.auditLogModel.findAll({
      where,
      order: [['loggedAt', 'DESC']],
      limit: query.limit || 100,
    });

    return logs.map(log => this.toResponse(log));
  }

  /**
   * Get all logs for a specific entity
   */
  async getLogsForEntity(entityType: string, entityId: string, limit?: number): Promise<AuditLogResponse[]> {
    return this.query({
      entityType,
      entityId,
      limit,
    });
  }

  /**
   * Get all logs for a specific user
   */
  async getLogsForUser(userId: string, limit?: number): Promise<AuditLogResponse[]> {
    return this.query({
      userId,
      limit,
    });
  }

  /**
   * Get logs by action type
   */
  async getLogsByAction(action: AuditAction, limit?: number): Promise<AuditLogResponse[]> {
    return this.query({
      action,
      limit,
    });
  }

  /**
   * Get recent logs
   */
  async getRecentLogs(limit: number = 50): Promise<AuditLogResponse[]> {
    return this.query({ limit });
  }

  /**
   * Convert model to response DTO
   */
  private toResponse(log: AuditLog): AuditLogResponse {
    return {
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      userId: log.userId,
      ipAddress: log.ipAddress,
      metadata: log.metadata,
      success: log.success,
      errorMessage: log.errorMessage,
      loggedAt: log.loggedAt,
    };
  }
}