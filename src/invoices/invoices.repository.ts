import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Invoice, InvoiceItem, InvoiceStatus } from '../../db/models/Invoice';
import { Op } from 'sequelize';

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class InvoicesRepository {
  private readonly DEFAULT_PAGE = 1;
  private readonly DEFAULT_LIMIT = 10;
  private readonly MAX_LIMIT = 100;

  constructor(
    @InjectModel(Invoice) private readonly invoiceModel: typeof Invoice,
    @InjectModel(InvoiceItem) private readonly invoiceItemModel: typeof InvoiceItem,
  ) {}

  /**
   * Find all invoices for a specific user with pagination
   * Time Complexity: O(n) where n is the number of user invoices
   */
  async findByUser(
    userId: number,
    options: PaginationOptions,
  ): Promise<PaginatedResult<Invoice>> {
    const { page, limit } = options;
    const offset = (page - 1) * limit;

    const { count, rows } = await this.invoiceModel.findAndCountAll({
      where: { userId },
      include: [{ model: this.invoiceItemModel, as: 'items' }],
      offset,
      limit,
      order: [['createdAt', 'DESC']],
    });

    return {
      data: rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  /**
   * Find all invoices with pagination (admin view)
   * Time Complexity: O(n) where n is the number of all invoices
   */
  async findAll(options: PaginationOptions): Promise<PaginatedResult<Invoice>> {
    const { page, limit } = options;
    const offset = (page - 1) * limit;

    const { count, rows } = await this.invoiceModel.findAndCountAll({
      include: [{ model: this.invoiceItemModel, as: 'items' }],
      offset,
      limit,
      order: [['createdAt', 'DESC']],
    });

    return {
      data: rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  /**
   * Find invoice by ID with items
   * Time Complexity: O(1) lookup + O(m) where m is number of items
   */
  async findById(invoiceId: number): Promise<Invoice | null> {
    return await this.invoiceModel.findOne({
      where: { id: invoiceId },
      include: [{ model: this.invoiceItemModel, as: 'items' }],
    });
  }

  /**
   * Find invoice by invoice number
   * Time Complexity: O(1) lookup
   */
  async findByInvoiceNumber(invoiceNumber: string): Promise<Invoice | null> {
    return await this.invoiceModel.findOne({
      where: { invoiceNumber },
    });
  }

  /**
   * Create new invoice
   * Time Complexity: O(1)
   */
  async create(invoiceData: any): Promise<Invoice> {
    return await this.invoiceModel.create(invoiceData);
  }

  /**
   * Create invoice item
   * Time Complexity: O(1)
   */
  async createItem(itemData: any): Promise<InvoiceItem> {
    return await this.invoiceItemModel.create(itemData);
  }

  /**
   * Update invoice status
   * Time Complexity: O(1)
   */
  async updateStatus(
    invoiceId: number,
    status: InvoiceStatus,
  ): Promise<Invoice | null> {
    const invoice = await this.invoiceModel.findByPk(invoiceId);
    if (!invoice) {
      return null;
    }
    invoice.status = status;
    await invoice.save();
    return invoice;
  }

  /**
   * Update invoice
   * Time Complexity: O(m) where m is number of items to update
   */
  async update(invoiceId: number, updateData: any): Promise<Invoice | null> {
    const invoice = await this.invoiceModel.findByPk(invoiceId, {
      include: [{ model: this.invoiceItemModel, as: 'items' }],
    });
    if (!invoice) {
      return null;
    }
    await invoice.update(updateData);
    return invoice;
  }

  /**
   * Delete invoice (cascades to items via database)
   * Time Complexity: O(m) where m is number of items
   */
  async delete(invoiceId: number): Promise<number> {
    return await this.invoiceModel.destroy({
      where: { id: invoiceId },
    });
  }

  /**
   * Get pagination options with validation
   * Ensures page >= 1 and limit is between 1 and MAX_LIMIT
   */
  getPaginationOptions(page?: number, limit?: number): PaginationOptions {
    const pageNum = Math.max(1, parseInt(String(page)) || this.DEFAULT_PAGE);
    const limitNum = Math.min(
      this.MAX_LIMIT,
      Math.max(1, parseInt(String(limit)) || this.DEFAULT_LIMIT),
    );

    return { page: pageNum, limit: limitNum };
  }
}