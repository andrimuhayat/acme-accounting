import { IsString, IsOptional, IsEnum, MinLength } from 'class-validator';
import { TaskStatus } from '../../db/models/Task';

export class CreateTaskDto {
  @IsString()
  @MinLength(1, { message: 'Title is required' })
  title: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateTaskDto {
  @IsString()
  @IsOptional()
  @MinLength(1, { message: 'Title cannot be empty' })
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;
}