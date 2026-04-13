import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Invoice, InvoiceItem, InvoiceStatus } from '../../db/models/Invoice';
import { InvoicesRepository, PaginatedResult } from './invoices.repository';
import {
  CreateInvoiceDto,
  InvoiceItemDto,
} from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { UpdateInvoiceStatusDto, InvoiceResponseDto } from './dto/invoice-response.dto';

/**
 * Tax rate constant (10%)
 * O(1) lookup
 */
const TAX_RATE = 0.1;

/**
 * Valid status transitions map
 * O(1) lookup per status
 */
const VALID_STATUS_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  [InvoiceStatus.DRAFT]: [InvoiceStatus.PENDING, InvoiceStatus.CANCELLED],
  [InvoiceStatus.PENDING]: [InvoiceStatus.PAID, InvoiceStatus.OVERDUE, InvoiceStatus.CANCELLED],
  [InvoiceStatus.PAID]: [], // Terminal state
  [InvoiceStatus.OVERDUE]: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED],
  [InvoiceStatus.CANCELLED]: [], // Terminal state
};

@Injectable()
export class InvoicesService {
  private readonly DEFAULT_PAGE = 1;
  private readonly DEFAULT_LIMIT = 10;
  private readonly MAX_LIMIT = 100;

  constructor(
    @InjectModel(Invoice)
    private invoiceModel: typeof Invoice,
    @InjectModel(InvoiceItem)
    private invoiceItemModel: typeof InvoiceItem,
    private readonly invoicesRepository: InvoicesRepository,
  ) {}

  /**
   * Create a new invoice for authenticated user
   * Time Complexity: O(n) where n is number of items
   * @param userId - User ID creating the invoice
   * @param createInvoiceDto - Invoice creation data with items
   * @returns Created invoice with calculated totals
   */
  async createInvoice(
    userId: number,
    createInvoiceDto: CreateInvoiceDto,
  ): Promise<InvoiceResponseDto> {
    // Validate items
    if (!createInvoiceDto.items || createInvoiceDto.items.length === 0) {
      throw new BadRequestException('Invoice must contain at least one item');
    }

    // Calculate totals - O(n) where n is number of items
    const { subtotal, tax, total } = this.calculateTotals(createInvoiceDto.items);

    // Generate unique invoice number - O(1)
    const invoiceNumber = await this.generateInvoiceNumber();

    // Create invoice
    const invoice = await this.invoiceModel.create({
      userId,
      invoiceNumber,
      subtotal,
      tax,
      total,
      status: InvoiceStatus.DRAFT,
      dueDate: createInvoiceDto.dueDate
        ? new Date(createInvoiceDto.dueDate)
        : this.calculateDefaultDueDate(),
    });

    // Create invoice items - O(n)
    const items: any[] = [];
    for (const item of createInvoiceDto.items) {
      const invoiceItem = await this.invoiceItemModel.create({
        invoiceId: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.quantity * item.unitPrice,
      });
      items.push({
        id: invoiceItem.id,
        description: invoiceItem.description,
        quantity: invoiceItem.quantity,
        unitPrice: Number(invoiceItem.unitPrice),
        amount: Number(invoiceItem.amount),
      });
    }

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      userId: invoice.userId,
      orderId: invoice.orderId,
      items,
      subtotal: Number(invoice.subtotal),
      tax: Number(invoice.tax),
      total: Number(invoice.total),
      status: invoice.status,
      dueDate: invoice.dueDate,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    };
  }

  /**
   * Get all invoices for authenticated user with pagination
   * Time Complexity: O(n) where n is number of user invoices
   * @param userId - User ID to fetch invoices for
   * @param page - Page number
   * @param limit - Items per page
   * @returns Paginated list of user's invoices
   */
  async getInvoicesByUser(
    userId: number,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResult<InvoiceResponseDto>> {
    const options = this.getPaginationOptions(page, limit);
    const result = await this.invoicesRepository.findByUser(userId, options);

    // Auto-detect and update overdue invoices - O(n)
    const invoicesWithOverdueCheck = await this.checkAndUpdateOverdueInvoices(
      result.data,
    );

    return {
      data: invoicesWithOverdueCheck.map((invoice) =>
        this.formatInvoiceResponse(invoice),
      ),
      pagination: result.pagination,
    };
  }

  /**
   * Get single invoice by ID (owner only)
   * Time Complexity: O(1) lookup + O(m) where m is number of items
   * @param invoiceId - Invoice ID to fetch
   * @param userId - User ID requesting (for ownership check)
   * @returns Invoice details if owner
   */
  async getInvoiceById(
    invoiceId: number,
    userId: number,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.invoicesRepository.findById(invoiceId);

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${invoiceId} not found`);
    }

    // Check ownership
    if (invoice.userId !== userId) {
      throw new ForbiddenException('You can only view your own invoices');
    }

    // Check and update if overdue
    if (this.isOverdue(invoice)) {
      invoice.status = InvoiceStatus.OVERDUE;
      await invoice.save();
    }

    return this.formatInvoiceResponse(invoice);
  }

  /**
   * Update invoice (owner only)
   * Time Complexity: O(n) where n is number of items to update
   * @param invoiceId - Invoice ID to update
   * @param userId - User ID requesting (for ownership check)
   * @param updateInvoiceDto - Update data
   * @returns Updated invoice with recalculated totals
   */
  async updateInvoice(
    invoiceId: number,
    userId: number,
    updateInvoiceDto: UpdateInvoiceDto,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.invoicesRepository.findById(invoiceId);

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${invoiceId} not found`);
    }

    // Check ownership
    if (invoice.userId !== userId) {
      throw new ForbiddenException('You can only update your own invoices');
    }

    // Cannot update cancelled or paid invoices
    if (
      invoice.status === InvoiceStatus.PAID ||
      invoice.status === InvoiceStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot update invoice with status ${invoice.status}`,
      );
    }

    // Update items if provided - O(n)
    if (updateInvoiceDto.items && updateInvoiceDto.items.length > 0) {
      // Delete existing items
      await this.invoiceItemModel.destroy({
        where: { invoiceId: invoice.id },
      });

      // Create new items
      const items: any[] = [];
      for (const item of updateInvoiceDto.items) {
        const invoiceItem = await this.invoiceItemModel.create({
          invoiceId: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.quantity * item.unitPrice,
        });
        items.push({
          id: invoiceItem.id,
          description: invoiceItem.description,
          quantity: invoiceItem.quantity,
          unitPrice: Number(invoiceItem.unitPrice),
          amount: Number(invoiceItem.amount),
        });
      }
      invoice.items = items as any;
    }

    // Recalculate totals if items changed - O(n)
    if (updateInvoiceDto.items) {
      const { subtotal, tax, total } = this.calculateTotals(updateInvoiceDto.items);
      invoice.subtotal = subtotal;
      invoice.tax = tax;
      invoice.total = total;
    }

    // Update due date if provided
    if (updateInvoiceDto.dueDate) {
      invoice.dueDate = new Date(updateInvoiceDto.dueDate);
    }

    await invoice.save();

    return this.formatInvoiceResponse(invoice);
  }

  /**
   * Update invoice status (admin only)
   * Time Complexity: O(1)
   * @param invoiceId - Invoice ID to update
   * @param updateStatusDto - New status
   * @returns Updated invoice
   */
  async updateInvoiceStatus(
    invoiceId: number,
    updateStatusDto: UpdateInvoiceStatusDto,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.invoicesRepository.findById(invoiceId);

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${invoiceId} not found`);
    }

    // Validate status transition
    if (!this.isValidStatusTransition(invoice.status, updateStatusDto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${invoice.status} to ${updateStatusDto.status}`,
      );
    }

    invoice.status = updateStatusDto.status;
    await invoice.save();

    return this.formatInvoiceResponse(invoice);
  }

  /**
   * Get all invoices in the system (admin only)
   * Time Complexity: O(n) where n is number of all invoices
   * @param page - Page number
   * @param limit - Items per page
   * @returns Paginated list of all invoices
   */
  async getAllInvoices(
    page?: number,
    limit?: number,
  ): Promise<PaginatedResult<InvoiceResponseDto>> {
    const options = this.getPaginationOptions(page, limit);
    const result = await this.invoicesRepository.findAll(options);

    // Auto-detect and update overdue invoices - O(n)
    const invoicesWithOverdueCheck = await this.checkAndUpdateOverdueInvoices(
      result.data,
    );

    return {
      data: invoicesWithOverdueCheck.map((invoice) =>
        this.formatInvoiceResponse(invoice),
      ),
      pagination: result.pagination,
    };
  }

  /**
   * Calculate invoice totals from items
   * Time Complexity: O(n) where n is number of items
   * @param items - Array of invoice items
   * @returns Object with subtotal, tax, and total
   */
  calculateTotals(items: InvoiceItemDto[]): {
    subtotal: number;
    tax: number;
    total: number;
  } {
    // Calculate subtotal: sum of all item amounts - O(n)
    const subtotal = items.reduce((sum, item) => {
      const amount = item.quantity * item.unitPrice;
      return sum + amount;
    }, 0);

    // Calculate tax: subtotal * TAX_RATE - O(1)
    const tax = subtotal * TAX_RATE;

    // Calculate total: subtotal + tax - O(1)
    const total = subtotal + tax;

    return {
      subtotal: Number(subtotal.toFixed(2)),
      tax: Number(tax.toFixed(2)),
      total: Number(total.toFixed(2)),
    };
  }

  /**
   * Check if an invoice is overdue
   * Time Complexity: O(1)
   * @param invoice - Invoice to check
   * @returns true if invoice is overdue
   */
  isOverdue(invoice: Invoice): boolean {
    if (!invoice.dueDate) return false;
    const now = new Date();
    const dueDate = new Date(invoice.dueDate);
    return dueDate < now && invoice.status === InvoiceStatus.PENDING;
  }

  /**
   * Get pagination options from query parameters
   * Validates and ensures page >= 1 and limit is between 1 and MAX_LIMIT
   * Time Complexity: O(1)
   */
  private getPaginationOptions(page?: number, limit?: number): {
    page: number;
    limit: number;
  } {
    const pageNum = Math.max(1, parseInt(String(page)) || this.DEFAULT_PAGE);
    const limitNum = Math.min(
      this.MAX_LIMIT,
      Math.max(1, parseInt(String(limit)) || this.DEFAULT_LIMIT),
    );

    return { page: pageNum, limit: limitNum };
  }

  /**
   * Validate status transition
   * Time Complexity: O(1)
   */
  private isValidStatusTransition(
    currentStatus: InvoiceStatus,
    newStatus: InvoiceStatus,
  ): boolean {
    return VALID_STATUS_TRANSITIONS[currentStatus].includes(newStatus);
  }

  /**
   * Generate unique invoice number
   * Format: INV-{YYYYMMDD}-{4-digit-sequence}
   * Time Complexity: O(n) where n is number of invoices on same day
   */
  private async generateInvoiceNumber(): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD

    // Find the highest sequence number for today - O(n)
    const todayStart = new Date(date.setHours(0, 0, 0, 0));
    const todayEnd = new Date(date.setHours(23, 59, 59, 999));

    const todayInvoices = await this.invoiceModel.findAll({
      where: {
        createdAt: {
          [Op.between]: [todayStart, todayEnd],
        },
      },
      order: [['createdAt', 'DESC']],
    });

    let sequence = 1;
    if (todayInvoices.length > 0) {
      // Extract sequence from last invoice: INV-YYYYMMDD-XXXX
      const lastInvoice = todayInvoices[0];
      const lastSequence = parseInt(
        lastInvoice.invoiceNumber.split('-')[2],
        10,
      );
      sequence = lastSequence + 1;
    }

    return `INV-${dateStr}-${sequence.toString().padStart(4, '0')}`;
  }

  /**
   * Calculate default due date (30 days from now)
   * Time Complexity: O(1)
   */
  private calculateDefaultDueDate(): Date {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    return dueDate;
  }

  /**
   * Check and update overdue invoices
   * Time Complexity: O(n) where n is number of invoices
   */
  private async checkAndUpdateOverdueInvoices(
    invoices: Invoice[],
  ): Promise<Invoice[]> {
    const now = new Date();
    const updatedInvoices: Invoice[] = [];

    for (const invoice of invoices) {
      if (
        invoice.dueDate &&
        new Date(invoice.dueDate) < now &&
        invoice.status === InvoiceStatus.PENDING
      ) {
        invoice.status = InvoiceStatus.OVERDUE;
        await invoice.save();
      }
      updatedInvoices.push(invoice);
    }

    return updatedInvoices;
  }

  /**
   * Format invoice response with proper type casting
   * Time Complexity: O(m) where m is number of items
   * @param invoice - Invoice model instance
   * @returns Formatted invoice response DTO
   */
  private formatInvoiceResponse(invoice: any): InvoiceResponseDto {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      userId: invoice.userId,
      orderId: invoice.orderId,
      items:
        invoice.items?.map((item: any) => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          amount: Number(item.amount),
        })) || [],
      subtotal: Number(invoice.subtotal),
      tax: Number(invoice.tax),
      total: Number(invoice.total),
      status: invoice.status,
      dueDate: invoice.dueDate,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    };
  }
}