import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsArray,
  ValidateNested,
  IsOptional,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class InvoiceItemDto {
  @IsNotEmpty({ message: 'Description is required' })
  @IsString()
  @MinLength(1)
  description: string;

  @IsNotEmpty()
  @IsNumber({}, { message: 'Quantity must be a number' })
  @Min(1, { message: 'Quantity must be at least 1' })
  quantity: number;

  @IsNotEmpty()
  @IsNumber({}, { message: 'Unit price must be a number' })
  @Min(0, { message: 'Unit price cannot be negative' })
  unitPrice: number;
}

export class CreateInvoiceDto {
  @IsNotEmpty({ message: 'Items array is required' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];

  @IsOptional()
  @IsNumber()
  orderId?: number;

  @IsOptional()
  @IsString()
  dueDate?: string;
}