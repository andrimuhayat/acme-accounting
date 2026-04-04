import {
  Table,
  Column,
  Model,
  HasMany,
  PrimaryKey,
  Default,
} from 'sequelize-typescript';
import { Transaction } from './Transaction';

@Table({ tableName: 'saving_accounts' })
export class SavingAccount extends Model {
  @PrimaryKey
  @Column
  declare id: string;

  @Column
  declare accountNumber: string;

  @Column
  declare accountName: string;

  @Default(0)
  @Column
  declare balance: number;

  @Default('USD')
  @Column
  declare currency: string;

  @Column
  declare createdAt: Date;

  @Column
  declare updatedAt: Date;

  @HasMany(() => Transaction)
  transactions: Transaction[];
}