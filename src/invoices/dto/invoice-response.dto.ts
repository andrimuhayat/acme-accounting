import { InvoiceStatus } from '../../../db/models/Invoice';

export class InvoiceItemResponseDto {
  id: number;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export class InvoiceResponseDto {
  id: number;
  invoiceNumber: string;
  userId: number;
  orderId?: number;
  items: InvoiceItemResponseDto[];
  subtotal: number;
  tax: number;
  total: number;
  status: InvoiceStatus;
  dueDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class UpdateInvoiceStatusDto {
  status: InvoiceStatus;
}