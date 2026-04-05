import { Table, Column, Model, DataType, CreatedAt, UpdatedAt } from 'sequelize-typescript';

/**
 * AuditLog - Tracks all financial operations for compliance and security
 * 
 * Records:
 * - Account creation, deposits, withdrawals
 * - User actions (login, logout, password changes)
 * - Admin operations
 */
@Table({
  tableName: 'audit_logs',
  timestamps: true,
  createdAt: 'logged_at',
  updatedAt: false,
})
export class AuditLog extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  id!: string;

  /**
   * Type of action performed
   */
  @Column({
    type: DataType.ENUM('ACCOUNT_CREATE', 'ACCOUNT_DELETE', 'DEPOSIT', 'WITHDRAWAL', 'LOGIN', 'LOGOUT', 'PASSWORD_CHANGE', 'PASSWORD_RESET', 'TRANSFER', 'ADMIN_ACTION'),
    allowNull: false,
  })
  action!: string;

  /**
   * Entity type affected (e.g., 'SavingAccount', 'User', 'Transaction')
   */
  @Column({
    type: DataType.STRING(50),
    allowNull: false,
  })
  entityType!: string;

  /**
   * ID of the entity affected
   */
  @Column({
    type: DataType.STRING(100),
    allowNull: true,
  })
  entityId!: string | null;

  /**
   * User who performed the action (if applicable)
   */
  @Column({
    type: DataType.STRING(100),
    allowNull: true,
  })
  userId!: string | null;

  /**
   * IP address of the requestor
   */
  @Column({
    type: DataType.INET,
    allowNull: true,
  })
  ipAddress!: string | null;

  /**
   * User agent / client info
   */
  @Column({
    type: DataType.STRING(500),
    allowNull: true,
  })
  userAgent!: string | null;

  /**
   * Request metadata (amount, old balance, new balance, etc.)
   */
  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  metadata!: Record<string, any> | null;

  /**
   * Success or failure
   */
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
  })
  success!: boolean;

  /**
   * Error message if failed
   */
  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  errorMessage!: string | null;

  /**
   * Timestamp when the action occurred
   */
  @CreatedAt
  @Column({
    type: DataType.DATE,
    field: 'logged_at',
  })
  loggedAt!: Date;
}