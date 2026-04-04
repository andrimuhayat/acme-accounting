import {
  Table,
  Column,
  Model,
  BelongsTo,
  ForeignKey,
  PrimaryKey,
} from 'sequelize-typescript';
import { SavingAccount } from './SavingAccount';

export enum TransactionType {
  deposit = 'deposit',
  withdrawal = 'withdrawal',
}

@Table({ tableName: 'transactions' })
export class Transaction extends Model {
  @PrimaryKey
  @Column
  declare id: string;

  @ForeignKey(() => SavingAccount)
  @Column
  declare savingAccountId: string;

  @Column
  declare type: TransactionType;

  @Column
  declare amount: number;

  @Column
  declare balanceAfter: number;

  @Column
  declare description: string;

  @Column
  declare createdAt: Date;

  @BelongsTo(() => SavingAccount)
  savingAccount: SavingAccount;
}