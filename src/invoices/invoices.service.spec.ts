import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicesRepository } from './invoices.repository';
import { Invoice, InvoiceItem, InvoiceStatus } from '../../db/models/Invoice';
import { CreateInvoiceDto, InvoiceItemDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { UpdateInvoiceStatusDto } from './dto/invoice-response.dto';

describe('InvoicesService', () => {
  let service: InvoicesService;
  let mockInvoiceModel: any;
  let mockInvoiceItemModel: any;
  let mockRepository: any;

  const mockInvoice = {
    id: 1,
    invoiceNumber: 'INV-20260413-0001',
    userId: 1,
    orderId: null,
    subtotal: 100,
    tax: 10,
    total: 110,
    status: InvoiceStatus.DRAFT,
    dueDate: new Date('2026-05-13'),
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [
      {
        id: 1,
        invoiceId: 1,
        description: 'Test Item',
        quantity: 2,
        unitPrice: 50,
        amount: 100,
      },
    ],
  };

  beforeEach(async () => {
    mockInvoiceModel = {
      create: jest.fn(),
      findOne: jest.fn(),
      findAll: jest.fn(),
      findByPk: jest.fn(),
    };

    mockInvoiceItemModel = {
      create: jest.fn(),
      destroy: jest.fn(),
    };

    mockRepository = {
      findByUser: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByInvoiceNumber: jest.fn(),
      create: jest.fn(),
      createItem: jest.fn(),
      updateStatus: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getPaginationOptions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        {
          provide: getModelToken(Invoice),
          useValue: mockInvoiceModel,
        },
        {
          provide: getModelToken(InvoiceItem),
          useValue: mockInvoiceItemModel,
        },
        {
          provide: InvoicesRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createInvoice', () => {
    const userId = 1;
    const createDto: CreateInvoiceDto = {
      items: [
        { description: 'Test Item', quantity: 2, unitPrice: 50 },
      ],
      dueDate: '2026-05-13',
    };

    it('should create an invoice with calculated totals', async () => {
      const createdInvoice = {
        ...mockInvoice,
        id: 1,
        invoiceNumber: 'INV-20260413-0001',
      };

      mockInvoiceModel.create.mockResolvedValue(createdInvoice);
      mockInvoiceItemModel.create.mockResolvedValue({
        id: 1,
        invoiceId: 1,
        description: 'Test Item',
        quantity: 2,
        unitPrice: 50,
        amount: 100,
      });

      const result = await service.createInvoice(userId, createDto);

      expect(result).toBeDefined();
      expect(result.subtotal).toBe(100);
      expect(result.tax).toBe(10);
      expect(result.total).toBe(110);
      expect(result.status).toBe(InvoiceStatus.DRAFT);
      expect(mockInvoiceModel.create).toHaveBeenCalled();
      expect(mockInvoiceItemModel.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty items array', async () => {
      const emptyDto = { items: [] };

      await expect(service.createInvoice(userId, emptyDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for null items', async () => {
      const nullDto = { items: null } as any;

      await expect(service.createInvoice(userId, nullDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should generate unique invoice number', async () => {
      const createdInvoice = { ...mockInvoice };
      mockInvoiceModel.create.mockResolvedValue(createdInvoice);
      mockInvoiceItemModel.create.mockResolvedValue({
        id: 1,
        description: 'Test Item',
        quantity: 2,
        unitPrice: 50,
        amount: 100,
      });

      mockInvoiceModel.findAll.mockResolvedValue([]);
      mockInvoiceItemModel.findAll = jest.fn().mockResolvedValue([]);

      await service.createInvoice(userId, createDto);

      expect(mockInvoiceModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceNumber: expect.stringMatching(/^INV-\d{8}-\d{4}$/),
        }),
      );
    });
  });

  describe('getInvoicesByUser', () => {
    const userId = 1;
    const paginatedResult = {
      data: [mockInvoice],
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    };

    it('should return paginated user invoices', async () => {
      mockRepository.findByUser.mockResolvedValue(paginatedResult);
      mockInvoiceModel.findAll = jest.fn().mockResolvedValue([]);

      const result = await service.getInvoicesByUser(userId, 1, 10);

      expect(result).toBeDefined();
      expect(result.data).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
      expect(mockRepository.findByUser).toHaveBeenCalledWith(userId, {
        page: 1,
        limit: 10,
      });
    });

    it('should use default pagination values', async () => {
      mockRepository.findByUser.mockResolvedValue(paginatedResult);
      mockInvoiceModel.findAll = jest.fn().mockResolvedValue([]);

      await service.getInvoicesByUser(userId);

      expect(mockRepository.findByUser).toHaveBeenCalledWith(userId, {
        page: 1,
        limit: 10,
      });
    });
  });

  describe('getInvoiceById', () => {
    const userId = 1;
    const invoiceId = 1;

    it('should return invoice for owner', async () => {
      mockRepository.findById.mockResolvedValue(mockInvoice);

      const result = await service.getInvoiceById(invoiceId, userId);

      expect(result).toBeDefined();
      expect(result.id).toBe(invoiceId);
      expect(result.userId).toBe(userId);
    });

    it('should throw NotFoundException for non-existent invoice', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.getInvoiceById(invoiceId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException for non-owner', async () => {
      mockRepository.findById.mockResolvedValue(mockInvoice);

      await expect(
        service.getInvoiceById(invoiceId, 999),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should auto-transition to OVERDUE when past due date', async () => {
      const overdueInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.PENDING,
        dueDate: new Date('2020-01-01'), // Past date
      };
      mockRepository.findById.mockResolvedValue(overdueInvoice);
      mockInvoiceModel.findOne.mockResolvedValue(overdueInvoice);

      await service.getInvoiceById(invoiceId, userId);

      expect(overdueInvoice.status).toBe(InvoiceStatus.OVERDUE);
    });
  });

  describe('updateInvoice', () => {
    const userId = 1;
    const invoiceId = 1;
    const updateDto: UpdateInvoiceDto = {
      items: [{ description: 'Updated Item', quantity: 1, unitPrice: 75 }],
      dueDate: '2026-06-13',
    };

    it('should update invoice for owner', async () => {
      const updatedInvoice = {
        ...mockInvoice,
        subtotal: 75,
        tax: 7.5,
        total: 82.5,
        dueDate: new Date('2026-06-13'),
      };
      mockRepository.findById.mockResolvedValue(updatedInvoice);
      mockInvoiceItemModel.destroy.mockResolvedValue(1);
      mockInvoiceItemModel.create.mockResolvedValue({
        id: 1,
        description: 'Updated Item',
        quantity: 1,
        unitPrice: 75,
        amount: 75,
      });

      const result = await service.updateInvoice(invoiceId, userId, updateDto);

      expect(result).toBeDefined();
      expect(mockInvoiceItemModel.destroy).toHaveBeenCalled();
      expect(mockInvoiceItemModel.create).toHaveBeenCalled();
    });

    it('should throw ForbiddenException for non-owner', async () => {
      mockRepository.findById.mockResolvedValue(mockInvoice);

      await expect(
        service.updateInvoice(invoiceId, 999, updateDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException for cancelled invoice', async () => {
      const cancelledInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.CANCELLED,
      };
      mockRepository.findById.mockResolvedValue(cancelledInvoice);

      await expect(
        service.updateInvoice(invoiceId, userId, updateDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for paid invoice', async () => {
      const paidInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.PAID,
      };
      mockRepository.findById.mockResolvedValue(paidInvoice);

      await expect(
        service.updateInvoice(invoiceId, userId, updateDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateInvoiceStatus', () => {
    const invoiceId = 1;
    const updateStatusDto: UpdateInvoiceStatusDto = {
      status: InvoiceStatus.PENDING,
    };

    it('should update status for valid transition', async () => {
      const draftInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.DRAFT,
      };
      mockRepository.findById.mockResolvedValue(draftInvoice);

      const result = await service.updateInvoiceStatus(invoiceId, updateStatusDto);

      expect(result.status).toBe(InvoiceStatus.PENDING);
    });

    it('should throw BadRequestException for invalid transition', async () => {
      const paidInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.PAID,
      };
      mockRepository.findById.mockResolvedValue(paidInvoice);

      await expect(
        service.updateInvoiceStatus(invoiceId, updateStatusDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent invoice', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateInvoiceStatus(invoiceId, updateStatusDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('calculateTotals', () => {
    it('should calculate correct totals for multiple items', () => {
      const items: InvoiceItemDto[] = [
        { description: 'Item 1', quantity: 2, unitPrice: 50 },  // 100
        { description: 'Item 2', quantity: 1, unitPrice: 75 },  // 75
        { description: 'Item 3', quantity: 3, unitPrice: 10 },  // 30
      ];
      // subtotal = 205, tax = 20.5, total = 225.5

      const result = service.calculateTotals(items);

      expect(result.subtotal).toBe(205);
      expect(result.tax).toBe(20.5);
      expect(result.total).toBe(225.5);
    });

    it('should handle single item', () => {
      const items: InvoiceItemDto[] = [
        { description: 'Item 1', quantity: 1, unitPrice: 100 },
      ];
      // subtotal = 100, tax = 10, total = 110

      const result = service.calculateTotals(items);

      expect(result.subtotal).toBe(100);
      expect(result.tax).toBe(10);
      expect(result.total).toBe(110);
    });

    it('should handle zero items', () => {
      const items: InvoiceItemDto[] = [];
      // subtotal = 0, tax = 0, total = 0

      const result = service.calculateTotals(items);

      expect(result.subtotal).toBe(0);
      expect(result.tax).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should handle decimal prices', () => {
      const items: InvoiceItemDto[] = [
        { description: 'Item 1', quantity: 3, unitPrice: 33.33 },  // 99.99
      ];
      // subtotal = 99.99, tax = 9.999, total = 109.989 -> rounded to 109.99

      const result = service.calculateTotals(items);

      expect(result.subtotal).toBe(99.99);
      expect(result.tax).toBe(9.999);
      expect(result.total).toBe(109.989);
    });
  });

  describe('isOverdue', () => {
    it('should return true for past due date with PENDING status', () => {
      const invoice = {
        ...mockInvoice,
        status: InvoiceStatus.PENDING,
        dueDate: new Date('2020-01-01'),
      };

      expect(service.isOverdue(invoice as any)).toBe(true);
    });

    it('should return false for future due date with PENDING status', () => {
      const invoice = {
        ...mockInvoice,
        status: InvoiceStatus.PENDING,
        dueDate: new Date('2030-01-01'),
      };

      expect(service.isOverdue(invoice as any)).toBe(false);
    });

    it('should return false for past due date with non-PENDING status', () => {
      const invoice = {
        ...mockInvoice,
        status: InvoiceStatus.PAID,
        dueDate: new Date('2020-01-01'),
      };

      expect(service.isOverdue(invoice as any)).toBe(false);
    });

    it('should return false for null dueDate', () => {
      const invoice = {
        ...mockInvoice,
        status: InvoiceStatus.PENDING,
        dueDate: null,
      };

      expect(service.isOverdue(invoice as any)).toBe(false);
    });
  });

  describe('status transitions', () => {
    it('should allow DRAFT -> PENDING', () => {
      const draftInvoice = { ...mockInvoice, status: InvoiceStatus.DRAFT };
      mockRepository.findById.mockResolvedValue(draftInvoice);

      expect(
        service.updateInvoiceStatus(1, { status: InvoiceStatus.PENDING }),
      ).resolves.not.toThrow();
    });

    it('should allow DRAFT -> CANCELLED', () => {
      const draftInvoice = { ...mockInvoice, status: InvoiceStatus.DRAFT };
      mockRepository.findById.mockResolvedValue(draftInvoice);

      expect(
        service.updateInvoiceStatus(1, { status: InvoiceStatus.CANCELLED }),
      ).resolves.not.toThrow();
    });

    it('should allow PENDING -> PAID', () => {
      const pendingInvoice = { ...mockInvoice, status: InvoiceStatus.PENDING };
      mockRepository.findById.mockResolvedValue(pendingInvoice);

      expect(
        service.updateInvoiceStatus(1, { status: InvoiceStatus.PAID }),
      ).resolves.not.toThrow();
    });

    it('should allow PENDING -> OVERDUE', () => {
      const pendingInvoice = { ...mockInvoice, status: InvoiceStatus.PENDING };
      mockRepository.findById.mockResolvedValue(pendingInvoice);

      expect(
        service.updateInvoiceStatus(1, { status: InvoiceStatus.OVERDUE }),
      ).resolves.not.toThrow();
    });

    it('should allow OVERDUE -> PAID', () => {
      const overdueInvoice = { ...mockInvoice, status: InvoiceStatus.OVERDUE };
      mockRepository.findById.mockResolvedValue(overdueInvoice);

      expect(
        service.updateInvoiceStatus(1, { status: InvoiceStatus.PAID }),
      ).resolves.not.toThrow();
    });

    it('should not allow PAID -> any status (terminal)', () => {
      const paidInvoice = { ...mockInvoice, status: InvoiceStatus.PAID };
      mockRepository.findById.mockResolvedValue(paidInvoice);

      expect(
        service.updateInvoiceStatus(1, { status: InvoiceStatus.DRAFT }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should not allow CANCELLED -> any status (terminal)', () => {
      const cancelledInvoice = { ...mockInvoice, status: InvoiceStatus.CANCELLED };
      mockRepository.findById.mockResolvedValue(cancelledInvoice);

      expect(
        service.updateInvoiceStatus(1, { status: InvoiceStatus.DRAFT }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should not allow PENDING -> DRAFT (invalid)', () => {
      const pendingInvoice = { ...mockInvoice, status: InvoiceStatus.PENDING };
      mockRepository.findById.mockResolvedValue(pendingInvoice);

      expect(
        service.updateInvoiceStatus(1, { status: InvoiceStatus.DRAFT }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAllInvoices', () => {
    it('should return paginated all invoices', async () => {
      const paginatedResult = {
        data: [mockInvoice],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      };
      mockRepository.findAll.mockResolvedValue(paginatedResult);
      mockInvoiceModel.findAll = jest.fn().mockResolvedValue([]);

      const result = await service.getAllInvoices(1, 10);

      expect(result).toBeDefined();
      expect(result.data).toHaveLength(1);
      expect(mockRepository.findAll).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
      });
    });
  });
});