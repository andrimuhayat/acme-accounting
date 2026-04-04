import {
  Table,
  Column,
  Model,
  PrimaryKey,
  AutoIncrement,
  CreatedAt,
  UpdatedAt,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { AuthUser } from './AuthUser';

export enum TaskStatus {
  pending = 'pending',
  in_progress = 'in_progress',
  completed = 'completed',
}

@Table({ tableName: 'tasks' })
export class Task extends Model {
  @AutoIncrement
  @PrimaryKey
  @Column
  declare id: number;

  @Column
  declare title: string;

  @Column
  declare description: string;

  @Column
  declare status: TaskStatus;

  @ForeignKey(() => AuthUser)
  @Column
  declare userId: number;

  @BelongsTo(() => AuthUser)
  user: AuthUser;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}