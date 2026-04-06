import { IsEnum, IsString, IsNotEmpty, IsOptional } from 'class-validator';

/**
 * Import mode enumeration - currently only LOCAL mode is supported
 */
export enum ImportMode {
  LOCAL = 'local',
}

/**
 * Duplicate handling strategy for import operations
 * - SKIP: Skip existing accounts (default)
 * - UPSERT: Update existing accounts
 * - ERROR: Fail on duplicates
 */
export enum DuplicateStrategy {
  SKIP = 'skip',
  UPSERT = 'upsert',
  ERROR = 'error',
}

/**
 * Import request DTO for saving account data
 * Used to validate incoming import requests
 */
export class ImportSavingAccountDto {
  @IsEnum(ImportMode)
  mode: ImportMode;

  @IsString()
  @IsNotEmpty()
  local_path: string;

  @IsEnum(DuplicateStrategy)
  @IsOptional()
  duplicateStrategy?: DuplicateStrategy = DuplicateStrategy.SKIP;
}

/**
 * Import result DTO - Result of import operation
 */
export class ImportResultDto {
  imported: number;
  failed: number;
  errors: string[];
}