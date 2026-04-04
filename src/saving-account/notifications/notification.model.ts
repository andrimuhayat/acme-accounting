import { Table, Column, Model, DataType, CreatedAt } from 'sequelize-typescript';

/**
 * NotificationType - Enum for notification categories
 */
export enum NotificationType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  TRANSFER = 'TRANSFER',
  ACCOUNT_UPDATE = 'ACCOUNT_UPDATE',
  SECURITY_ALERT = 'SECURITY_ALERT',
  SYSTEM = 'SYSTEM',
}

/**
 * Notification - Real-time notification model for user alerts
 * 
 * Tracks:
 * - Financial events (deposits, withdrawals, transfers)
 * - Account changes
 * - Security alerts
 * - System notifications
 */
@Table({
  tableName: 'notifications',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
})
export class Notification extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  id!: string;

  /**
   * User who receives the notification
   */
  @Column({
    type: DataType.STRING(100),
    allowNull: false,
  })
  userId!: string;

  /**
   * Type of notification (e.g., DEPOSIT, WITHDRAWAL, TRANSFER)
   */
  @Column({
    type: DataType.ENUM(...Object.values(NotificationType)),
    allowNull: false,
  })
  type!: NotificationType;

  /**
   * Short title for the notification
   */
  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  title!: string;

  /**
   * Detailed notification message
   */
  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  message!: string;

  /**
   * Additional metadata (amount, transaction ID, etc.)
   * Time complexity: O(1) for read, O(n) for nested queries
   */
  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  metadata!: Record<string, any> | null;

  /**
   * Read status - indexed for fast unread count queries
   * Time complexity: O(1) for status check
   */
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  read!: boolean;

  /**
   * Timestamp when notification was created
   */
  @CreatedAt
  @Column({
    type: DataType.DATE,
    field: 'created_at',
  })
  createdAt!: Date;
}

/**
 * DTO for creating a new notification
 */
export class NotificationCreateDto {
  userId!: string;
  type!: NotificationType;
  title!: string;
  message!: string;
  metadata?: Record<string, any>;
}

/**
 * DTO for querying notifications
 */
export class NotificationQuery {
  type?: NotificationType;
  userId?: string;
  read?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Response DTO for notification
 */
export interface NotificationResponse {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata: Record<string, any> | null;
  read: boolean;
  createdAt: Date;
}

/**
 * Response DTO for paginated notification list
 */
export interface NotificationListResponse {
  notifications: NotificationResponse[];
  total: number;
  limit: number;
  offset: number;
}
