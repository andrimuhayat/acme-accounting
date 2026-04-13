import {
  Table,
  Column,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  HasMany,
  CreatedAt,
  UpdatedAt,
  DataType,
} from 'sequelize-typescript';
import { AuthUser } from './AuthUser';
import { Order } from './Order';

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

@Table({ tableName: 'invoices' })
export class Invoice extends Model {
  @AutoIncrement
  @PrimaryKey
  @Column
  declare id: number;

  @Column({ unique: true })
  declare invoiceNumber: string;

  @ForeignKey(() => AuthUser)
  @Column
  declare userId: number;

  @BelongsTo(() => AuthUser)
  user: AuthUser;

  @ForeignKey(() => Order)
  @Column
  declare orderId?: number;

  @BelongsTo(() => Order)
  order: Order;

  @HasMany(() => InvoiceItem)
  items: InvoiceItem[];

  @Column({ type: DataType.DECIMAL(10, 2), defaultValue: 0 })
  declare subtotal: number;

  @Column({ type: DataType.DECIMAL(10, 2), defaultValue: 0 })
  declare tax: number;

  @Column({ type: DataType.DECIMAL(10, 2), defaultValue: 0 })
  declare total: number;

  @Column({
    type: DataType.ENUM(...Object.values(InvoiceStatus)),
    defaultValue: InvoiceStatus.DRAFT,
  })
  declare status: InvoiceStatus;

  @Column
  declare dueDate: Date;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}

@Table({ tableName: 'invoice_items' })
export class InvoiceItem extends Model {
  @AutoIncrement
  @PrimaryKey
  @Column
  declare id: number;

  @ForeignKey(() => Invoice)
  @Column
  declare invoiceId: number;

  @BelongsTo(() => Invoice)
  invoice: Invoice;

  @Column
  declare description: string;

  @Column
  declare quantity: number;

  @Column({ type: DataType.DECIMAL(10, 2) })
  declare unitPrice: number;

  @Column({ type: DataType.DECIMAL(10, 2) })
  declare amount: number; // quantity * unitPrice

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}