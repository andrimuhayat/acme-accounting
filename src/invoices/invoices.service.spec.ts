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
    save: jest.fn(),
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
    describe('happy path', () => {
      it('should create invoice with items and calculate totals correctly', async () => {
        // Arrange
        const items: InvoiceItemDto[] = [
          { description: 'Item 1', quantity: 2, unitPrice: 50 },
          { description: 'Item 2', quantity: 1, unitPrice: 75 },
        ];
        const createDto: CreateInvoiceDto = {
          items,
          dueDate: '2026-05-13',
        };

        const createdInvoice = {
          ...mockInvoice,
          id: 1,
          invoiceNumber: 'INV-20260413-0001',
          items: [
            { id: 1, description: 'Item 1', quantity: 2, unitPrice: 50, amount: 100 },
            { id: 2, description: 'Item 2', quantity: 1, unitPrice: 75, amount: 75 },
          ],
        };

        mockInvoiceModel.create.mockResolvedValue(createdInvoice);
        mockInvoiceItemModel.create
          .mockResolvedValueOnce({
            id: 1,
            invoiceId: 1,
            description: 'Item 1',
            quantity: 2,
            unitPrice: 50,
            amount: 100,
          })
          .mockResolvedValueOnce({
            id: 2,
            invoiceId: 1,
            description: 'Item 2',
            quantity: 1,
            unitPrice: 75,
            amount: 75,
          });
        mockInvoiceModel.findAll.mockResolvedValue([]);

        // Act
        const result = await service.createInvoice(1, createDto);

        // Assert
        expect(result).toBeDefined();
        expect(result.subtotal).toBe(175);
        expect(result.tax).toBe(17.5);
        expect(result.total).toBe(192.5);
        expect(result.status).toBe(InvoiceStatus.DRAFT);
        expect(result.items).toHaveLength(2);
      });

      it('should auto-generate invoice number with correct format INV-YYYYMMDD-XXXX', async () => {
        // Arrange
        const items: InvoiceItemDto[] = [
          { description: 'Item 1', quantity: 1, unitPrice: 100 },
        ];
        const createDto: CreateInvoiceDto = { items };

        const createdInvoice = {
          ...mockInvoice,
          id: 1,
          invoiceNumber: 'INV-20260413-0001',
        };

        mockInvoiceModel.create.mockResolvedValue(createdInvoice);
        mockInvoiceItemModel.create.mockResolvedValue({
          id: 1,
          invoiceId: 1,
          description: 'Item 1',
          quantity: 1,
          unitPrice: 100,
          amount: 100,
        });
        mockInvoiceModel.findAll.mockResolvedValue([]);

        // Act
        await service.createInvoice(1, createDto);

        // Assert
        expect(mockInvoiceModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            invoiceNumber: expect.stringMatching(/^INV-\d{8}-\d{4}$/),
          }),
        );
      });

      it('should set createdAt and updatedAt timestamps', async () => {
        // Arrange
        const items: InvoiceItemDto[] = [
          { description: 'Item 1', quantity: 1, unitPrice: 100 },
        ];
        const createDto: CreateInvoiceDto = { items };

        const now = new Date();
        const createdInvoice = {
          ...mockInvoice,
          id: 1,
          createdAt: now,
          updatedAt: now,
        };

        mockInvoiceModel.create.mockResolvedValue(createdInvoice);
        mockInvoiceItemModel.create.mockResolvedValue({
          id: 1,
          invoiceId: 1,
          description: 'Item 1',
          quantity: 1,
          unitPrice: 100,
          amount: 100,
        });
        mockInvoiceModel.findAll.mockResolvedValue([]);

        // Act
        const result = await service.createInvoice(1, createDto);

        // Assert
        expect(result.createdAt).toBeDefined();
        expect(result.updatedAt).toBeDefined();
      });

      it('should handle single item order', async () => {
        // Arrange
        const items: InvoiceItemDto[] = [
          { description: 'Item 1', quantity: 5, unitPrice: 19.99 },
        ];
        const createDto: CreateInvoiceDto = { items };

        const createdInvoice = {
          ...mockInvoice,
          id: 1,
          subtotal: 99.95,
          tax: 10,
          total: 109.95,
        };

        mockInvoiceModel.create.mockResolvedValue(createdInvoice);
        mockInvoiceItemModel.create.mockResolvedValue({
          id: 1,
          invoiceId: 1,
          description: 'Item 1',
          quantity: 5,
          unitPrice: 19.99,
          amount: 99.95,
        });
        mockInvoiceModel.findAll.mockResolvedValue([]);

        // Act
        const result = await service.createInvoice(1, createDto);

        // Assert
        expect(result.items).toHaveLength(1);
        expect(result.total).toBe(109.95);
      });

      it('should handle decimal prices correctly', async () => {
        // Arrange
        const items: InvoiceItemDto[] = [
          { description: 'Item 1', quantity: 3, unitPrice: 33.33 },
        ];
        const createDto: CreateInvoiceDto = { items };

        const createdInvoice = {
          ...mockInvoice,
          id: 1,
          subtotal: 99.99,
          tax: 10,
          total: 109.99,
        };

        mockInvoiceModel.create.mockResolvedValue(createdInvoice);
        mockInvoiceItemModel.create.mockResolvedValue({
          id: 1,
          invoiceId: 1,
          description: 'Item 1',
          quantity: 3,
          unitPrice: 33.33,
          amount: 99.99,
        });
        mockInvoiceModel.findAll.mockResolvedValue([]);

        // Act
        const result = await service.createInvoice(1, createDto);

        // Assert
        expect(result.subtotal).toBe(99.99);
      });

      it('should handle zero price items', async () => {
        // Arrange
        const items: InvoiceItemDto[] = [
          { description: 'Free Item', quantity: 1, unitPrice: 0 },
        ];
        const createDto: CreateInvoiceDto = { items };

        const createdInvoice = {
          ...mockInvoice,
          id: 1,
          subtotal: 0,
          tax: 0,
          total: 0,
        };

        mockInvoiceModel.create.mockResolvedValue(createdInvoice);
        mockInvoiceItemModel.create.mockResolvedValue({
          id: 1,
          invoiceId: 1,
          description: 'Free Item',
          quantity: 1,
          unitPrice: 0,
          amount: 0,
        });
        mockInvoiceModel.findAll.mockResolvedValue([]);

        // Act
        const result = await service.createInvoice(1, createDto);

        // Assert
        expect(result.total).toBe(0);
      });

      it('should calculate default due date when not provided', async () => {
        // Arrange
        const items: InvoiceItemDto[] = [
          { description: 'Item 1', quantity: 1, unitPrice: 100 },
        ];
        const createDto: CreateInvoiceDto = { items };

        const createdInvoice = {
          ...mockInvoice,
          id: 1,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        };

        mockInvoiceModel.create.mockResolvedValue(createdInvoice);
        mockInvoiceItemModel.create.mockResolvedValue({
          id: 1,
          invoiceId: 1,
          description: 'Item 1',
          quantity: 1,
          unitPrice: 100,
          amount: 100,
        });
        mockInvoiceModel.findAll.mockResolvedValue([]);

        // Act
        await service.createInvoice(1, createDto);

        // Assert
        expect(mockInvoiceModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            dueDate: expect.any(Date),
          }),
        );
      });

      it('should handle multiple items with large quantities', async () => {
        // Arrange
        const items: InvoiceItemDto[] = [
          { description: 'Bulk Item', quantity: 9999, unitPrice: 1.99 },
        ];
        const createDto: CreateInvoiceDto = { items };

        const createdInvoice = {
          ...mockInvoice,
          id: 1,
          subtotal: 19998.01,
          tax: 1999.8,
          total: 21997.81,
        };

        mockInvoiceModel.create.mockResolvedValue(createdInvoice);
        mockInvoiceItemModel.create.mockResolvedValue({
          id: 1,
          invoiceId: 1,
          description: 'Bulk Item',
          quantity: 9999,
          unitPrice: 1.99,
          amount: 19998.01,
        });
        mockInvoiceModel.findAll.mockResolvedValue([]);

        // Act
        const result = await service.createInvoice(1, createDto);

        // Assert
        expect(result.items[0].quantity).toBe(9999);
      });
    });

    describe('error cases', () => {
      it('should throw BadRequestException for empty items array', async () => {
        // Arrange
        const emptyDto: CreateInvoiceDto = { items: [] };

        // Act & Assert
        await expect(service.createInvoice(1, emptyDto)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should throw BadRequestException for null items', async () => {
        // Arrange
        const nullDto = { items: null } as any;

        // Act & Assert
        await expect(service.createInvoice(1, nullDto)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should throw BadRequestException for undefined items', async () => {
        // Arrange
        const undefinedDto = {} as CreateInvoiceDto;

        // Act & Assert
        await expect(service.createInvoice(1, undefinedDto)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should throw BadRequestException for negative quantity', async () => {
        // Arrange
        const items: InvoiceItemDto[] = [
          { description: 'Item', quantity: -1, unitPrice: 50 },
        ];
        const dto: CreateInvoiceDto = { items };

        // Act & Assert
        await expect(service.createInvoice(1, dto)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should throw BadRequestException for zero quantity', async () => {
        // Arrange
        const items: InvoiceItemDto[] = [
          { description: 'Item', quantity: 0, unitPrice: 50 },
        ];
        const dto: CreateInvoiceDto = { items };

        // Act & Assert
        await expect(service.createInvoice(1, dto)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should throw BadRequestException for negative unit price', async () => {
        // Arrange
        const items: InvoiceItemDto[] = [
          { description: 'Item', quantity: 1, unitPrice: -10 },
        ];
        const dto: CreateInvoiceDto = { items };

        // Act & Assert
        await expect(service.createInvoice(1, dto)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should throw BadRequestException for missing description', async () => {
        // Arrange
        const items: any[] = [{ quantity: 1, unitPrice: 50 }];
        const dto: CreateInvoiceDto = { items };

        // Act & Assert
        await expect(service.createInvoice(1, dto)).rejects.toThrow();
      });

      it('should throw BadRequestException for empty description', async () => {
        // Arrange
        const items: InvoiceItemDto[] = [
          { description: '', quantity: 1, unitPrice: 50 },
        ];
        const dto: CreateInvoiceDto = { items };

        // Act & Assert
        await expect(service.createInvoice(1, dto)).rejects.toThrow();
      });
    });
  });

  describe('calculateTotals', () => {
    describe('happy path', () => {
      it('should calculate totals correctly for multiple items', () => {
        // Arrange
        const items: InvoiceItemDto[] = [
          { description: 'Item 1', quantity: 2, unitPrice: 50 },  // 100
          { description: 'Item 2', quantity: 1, unitPrice: 75 },  // 75
          { description: 'Item 3', quantity: 3, unitPrice: 10 },  // 30
        ];
        // subtotal = 205, tax = 20.5, total = 225.5

        // Act
        const result = service.calculateTotals(items);

        // Assert
        expect(result.subtotal).toBe(205);
        expect(result.tax).toBe(20.5);
        expect(result.total).toBe(225.5);
      });

      it('should handle single item correctly', () => {
        // Arrange
        const items: InvoiceItemDto[] = [
          { description: 'Item 1', quantity: 1, unitPrice: 100 },
        ];
        // subtotal = 100, tax = 10, total = 110

        // Act
        const result = service.calculateTotals(items);

        // Assert
        expect(result.subtotal).toBe(100);
        expect(result.tax).toBe(10);
        expect(result.total).toBe(110);
      });

      it('should handle zero price items', () => {
        // Arrange
        const items: InvoiceItemDto[] = [
          { description: 'Item 1', quantity: 10, unitPrice: 0 },
        ];
        // subtotal = 0, tax = 0, total = 0

        // Act
        const result = service.calculateTotals(items);

        // Assert
        expect(result.subtotal).toBe(0);
        expect(result.tax).toBe(0);
        expect(result.total).toBe(0);
      });

      it('should handle decimal prices correctly', () => {
        // Arrange
        const items: InvoiceItemDto[] = [
          { description: 'Item 1', quantity: 2, unitPrice: 9.99 },
          { description: 'Item 2', quantity: 1, unitPrice: 15.5 },
        ];
        // subtotal = 34.98, tax = 3.498, total = 38.478 -> rounded

        // Act
        const result = service.calculateTotals(items);

        // Assert
        expect(result.subtotal).toBe(34.98);
        expect(result.tax).toBe(3.5);
        expect(result.total).toBe(38.48);
      });

      it('should apply 10% tax rate correctly', () => {
        // Arrange
        const items: InvoiceItemDto[] = [
          { description: 'Item 1', quantity: 1, unitPrice: 1000 },
        ];
        // subtotal = 1000, tax = 100, total = 1100

        // Act
        const result = service.calculateTotals(items);

        // Assert
        expect(result.subtotal).toBe(1000);
        expect(result.tax).toBe(100);
        expect(result.total).toBe(1100);
      });
    });

    describe('edge cases', () => {
      it('should return zero totals for empty items array', () => {
        // Act
        const result = service.calculateTotals([]);

        // Assert
        expect(result.subtotal).toBe(0);
        expect(result.tax).toBe(0);
        expect(result.total).toBe(0);
      });

      it('should handle null items gracefully', () => {
        // Act
        const result = service.calculateTotals(null as any);

        // Assert
        expect(result.subtotal).toBe(0);
        expect(result.tax).toBe(0);
        expect(result.total).toBe(0);
      });

      it('should handle large numbers correctly', () => {
        // Arrange
        const items: InvoiceItemDto[] = [
          { description: 'Expensive Item', quantity: 10000, unitPrice: 99999.99 },
        ];

        // Act
        const result = service.calculateTotals(items);

        // Assert
        expect(result.subtotal).toBe(999999900);
        expect(result.tax).toBe(99999990);
        expect(result.total).toBe(1099999890);
      });
    });
  });

  describe('getInvoicesByUser', () => {
    describe('happy path', () => {
      it('should return paginated user invoices', async () => {
        // Arrange
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
        mockRepository.findByUser.mockResolvedValue(paginatedResult);
        mockInvoiceModel.findAll.mockResolvedValue([]);

        // Act
        const result = await service.getInvoicesByUser(userId, 1, 10);

        // Assert
        expect(result).toBeDefined();
        expect(result.data).toHaveLength(1);
        expect(result.pagination.page).toBe(1);
        expect(result.pagination.limit).toBe(10);
        expect(mockRepository.findByUser).toHaveBeenCalledWith(userId, {
          page: 1,
          limit: 10,
        });
      });

      it('should return only user invoices', async () => {
        // Arrange
        const userId = 1;
        const otherUserInvoice = { ...mockInvoice, id: 2, userId: 2 };
        const paginatedResult = {
          data: [mockInvoice],
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        };
        mockRepository.findByUser.mockResolvedValue(paginatedResult);
        mockInvoiceModel.findAll.mockResolvedValue([]);

        // Act
        const result = await service.getInvoicesByUser(userId);

        // Assert
        expect(result.data.every((inv) => inv.userId === userId)).toBe(true);
      });

      it('should return empty array for user with no invoices', async () => {
        // Arrange
        const paginatedResult = {
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        };
        mockRepository.findByUser.mockResolvedValue(paginatedResult);

        // Act
        const result = await service.getInvoicesByUser(999);

        // Assert
        expect(result.data).toHaveLength(0);
      });

      it('should use default pagination values when not provided', async () => {
        // Arrange
        const paginatedResult = {
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        };
        mockRepository.findByUser.mockResolvedValue(paginatedResult);

        // Act
        await service.getInvoicesByUser(1);

        // Assert
        expect(mockRepository.findByUser).toHaveBeenCalledWith(1, {
          page: 1,
          limit: 10,
        });
      });

      it('should return invoices in descending creation order', async () => {
        // Arrange
        const invoice1 = { ...mockInvoice, id: 1, createdAt: new Date('2026-01-01') };
        const invoice2 = { ...mockInvoice, id: 2, createdAt: new Date('2026-01-02') };
        const paginatedResult = {
          data: [invoice2, invoice1],
          pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
        };
        mockRepository.findByUser.mockResolvedValue(paginatedResult);
        mockInvoiceModel.findAll.mockResolvedValue([]);

        // Act
        const result = await service.getInvoicesByUser(1);

        // Assert
        expect(result.data[0].id).toBe(2);
        expect(result.data[1].id).toBe(1);
      });
    });

    describe('error cases', () => {
      it('should return empty array for invalid userId', async () => {
        // Arrange
        const paginatedResult = {
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        };
        mockRepository.findByUser.mockResolvedValue(paginatedResult);

        // Act
        const result = await service.getInvoicesByUser(-1);

        // Assert
        expect(result.data).toHaveLength(0);
      });

      it('should return empty array for zero userId', async () => {
        // Arrange
        const paginatedResult = {
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        };
        mockRepository.findByUser.mockResolvedValue(paginatedResult);

        // Act
        const result = await service.getInvoicesByUser(0);

        // Assert
        expect(result.data).toHaveLength(0);
      });

      it('should handle repository error gracefully', async () => {
        // Arrange
        mockRepository.findByUser.mockRejectedValue(new Error('DB error'));

        // Act & Assert
        await expect(service.getInvoicesByUser(1)).rejects.toThrow('DB error');
      });
    });
  });

  describe('getInvoiceById', () => {
    describe('happy path', () => {
      it('should find invoice by id for owner', async () => {
        // Arrange
        const invoiceId = 1;
        const userId = 1;
        mockRepository.findById.mockResolvedValue(mockInvoice);

        // Act
        const result = await service.getInvoiceById(invoiceId, userId);

        // Assert
        expect(result).toBeDefined();
        expect(result.id).toBe(invoiceId);
        expect(result.userId).toBe(userId);
      });

      it('should return invoice with correct structure', async () => {
        // Arrange
        const invoice = {
          ...mockInvoice,
          items: [{ id: 1, description: 'Item', quantity: 2, unitPrice: 50, amount: 100 }],
        };
        mockRepository.findById.mockResolvedValue(invoice);

        // Act
        const result = await service.getInvoiceById(1, 1);

        // Assert
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('invoiceNumber');
        expect(result).toHaveProperty('userId');
        expect(result).toHaveProperty('items');
        expect(result).toHaveProperty('subtotal');
        expect(result).toHaveProperty('tax');
        expect(result).toHaveProperty('total');
        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('dueDate');
        expect(result).toHaveProperty('createdAt');
        expect(result).toHaveProperty('updatedAt');
      });

      it('should auto-transition to OVERDUE when past due date with PENDING status', async () => {
        // Arrange
        const overdueInvoice = {
          ...mockInvoice,
          status: InvoiceStatus.PENDING,
          dueDate: new Date('2020-01-01'),
          save: jest.fn(),
        };
        mockRepository.findById.mockResolvedValue(overdueInvoice);

        // Act
        await service.getInvoiceById(1, 1);

        // Assert
        expect(overdueInvoice.save).toHaveBeenCalled();
      });
    });

    describe('error cases', () => {
      it('should throw NotFoundException for non-existent invoice', async () => {
        // Arrange
        mockRepository.findById.mockResolvedValue(null);

        // Act & Assert
        await expect(service.getInvoiceById(999, 1)).rejects.toThrow(
          NotFoundException,
        );
      });

      it('should throw ForbiddenException for non-owner', async () => {
        // Arrange
        mockRepository.findById.mockResolvedValue(mockInvoice);

        // Act & Assert
        await expect(service.getInvoiceById(1, 999)).rejects.toThrow(
          ForbiddenException,
        );
      });

      it('should throw NotFoundException for invalid id (negative)', async () => {
        // Arrange
        mockRepository.findById.mockResolvedValue(null);

        // Act & Assert
        await expect(service.getInvoiceById(-1, 1)).rejects.toThrow(
          NotFoundException,
        );
      });

      it('should throw NotFoundException for invalid id (zero)', async () => {
        // Arrange
        mockRepository.findById.mockResolvedValue(null);

        // Act & Assert
        await expect(service.getInvoiceById(0, 1)).rejects.toThrow(
          NotFoundException,
        );
      });

      it('should throw NotFoundException for null id', async () => {
        // Arrange
        mockRepository.findById.mockResolvedValue(null);

        // Act & Assert
        await expect(service.getInvoiceById(null as any, 1)).rejects.toThrow(
          NotFoundException,
        );
      });

      it('should throw ForbiddenException when userId is null', async () => {
        // Arrange
        mockRepository.findById.mockResolvedValue(mockInvoice);

        // Act & Assert
        await expect(service.getInvoiceById(1, null as any)).rejects.toThrow(
          ForbiddenException,
        );
      });
    });
  });

  describe('updateInvoice', () => {
    describe('happy path', () => {
      it('should update invoice items for owner', async () => {
        // Arrange
        const invoiceId = 1;
        const userId = 1;
        const updateDto: UpdateInvoiceDto = {
          items: [{ description: 'Updated Item', quantity: 1, unitPrice: 75 }],
        };
        const updatedInvoice = {
          ...mockInvoice,
          subtotal: 75,
          tax: 7.5,
          total: 82.5,
          items: [{ id: 1, description: 'Updated Item', quantity: 1, unitPrice: 75, amount: 75 }],
          save: jest.fn(),
        };
        mockRepository.findById.mockResolvedValue(updatedInvoice);
        mockInvoiceItemModel.destroy.mockResolvedValue(1);
        mockInvoiceItemModel.create.mockResolvedValue({
          id: 1,
          invoiceId: 1,
          description: 'Updated Item',
          quantity: 1,
          unitPrice: 75,
          amount: 75,
        });

        // Act
        const result = await service.updateInvoice(invoiceId, userId, updateDto);

        // Assert
        expect(result).toBeDefined();
        expect(mockInvoiceItemModel.destroy).toHaveBeenCalled();
        expect(mockInvoiceItemModel.create).toHaveBeenCalled();
      });

      it('should update dueDate when provided', async () => {
        // Arrange
        const invoiceId = 1;
        const userId = 1;
        const newDueDate = '2026-06-13';
        const updateDto: UpdateInvoiceDto = { dueDate: newDueDate };
        const updatedInvoice = {
          ...mockInvoice,
          dueDate: new Date(newDueDate),
          save: jest.fn(),
        };
        mockRepository.findById.mockResolvedValue(updatedInvoice);

        // Act
        await service.updateInvoice(invoiceId, userId, updateDto);

        // Assert
        expect(updatedInvoice.dueDate).toEqual(new Date(newDueDate));
      });

      it('should recalculate totals when items are updated', async () => {
        // Arrange
        const invoiceId = 1;
        const userId = 1;
        const updateDto: UpdateInvoiceDto = {
          items: [
            { description: 'Item 1', quantity: 5, unitPrice: 20 },
            { description: 'Item 2', quantity: 2, unitPrice: 25 },
          ],
        };
        const updatedInvoice = {
          ...mockInvoice,
          subtotal: 150,
          tax: 15,
          total: 165,
          items: [],
          save: jest.fn(),
        };
        mockRepository.findById.mockResolvedValue(updatedInvoice);
        mockInvoiceItemModel.destroy.mockResolvedValue(2);
        mockInvoiceItemModel.create
          .mockResolvedValueOnce({
            id: 1, description: 'Item 1', quantity: 5, unitPrice: 20, amount: 100,
          })
          .mockResolvedValueOnce({
            id: 2, description: 'Item 2', quantity: 2, unitPrice: 25, amount: 50,
          });

        // Act
        const result = await service.updateInvoice(invoiceId, userId, updateDto);

        // Assert
        expect(result.subtotal).toBe(150);
        expect(result.tax).toBe(15);
        expect(result.total).toBe(165);
      });

      it('should not update if only dueDate is changed without items', async () => {
        // Arrange
        const invoiceId = 1;
        const userId = 1;
        const updateDto: UpdateInvoiceDto = { dueDate: '2026-06-13' };
        const updatedInvoice = {
          ...mockInvoice,
          dueDate: new Date('2026-06-13'),
          save: jest.fn(),
        };
        mockRepository.findById.mockResolvedValue(updatedInvoice);

        // Act
        await service.updateInvoice(invoiceId, userId, updateDto);

        // Assert
        expect(mockInvoiceItemModel.destroy).not.toHaveBeenCalled();
      });
    });

    describe('error cases', () => {
      it('should throw NotFoundException for non-existent invoice', async () => {
        // Arrange
        mockRepository.findById.mockResolvedValue(null);

        // Act & Assert
        await expect(
          service.updateInvoice(999, 1, { items: [] }),
        ).rejects.toThrow(NotFoundException);
      });

      it('should throw ForbiddenException for non-owner', async () => {
        // Arrange
        mockRepository.findById.mockResolvedValue(mockInvoice);

        // Act & Assert
        await expect(
          service.updateInvoice(1, 999, { items: [] }),
        ).rejects.toThrow(ForbiddenException);
      });

      it('should throw BadRequestException for cancelled invoice', async () => {
        // Arrange
        const cancelledInvoice = {
          ...mockInvoice,
          status: InvoiceStatus.CANCELLED,
        };
        mockRepository.findById.mockResolvedValue(cancelledInvoice);

        // Act & Assert
        await expect(
          service.updateInvoice(1, 1, { items: [] }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException for paid invoice', async () => {
        // Arrange
        const paidInvoice = {
          ...mockInvoice,
          status: InvoiceStatus.PAID,
        };
        mockRepository.findById.mockResolvedValue(paidInvoice);

        // Act & Assert
        await expect(
          service.updateInvoice(1, 1, { items: [] }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException for overdue invoice', async () => {
        // Arrange
        const overdueInvoice = {
          ...mockInvoice,
          status: InvoiceStatus.OVERDUE,
        };
        mockRepository.findById.mockResolvedValue(overdueInvoice);

        // Act & Assert
        await expect(
          service.updateInvoice(1, 1, { items: [] }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when updating with empty items array', async () => {
        // Arrange
        mockRepository.findById.mockResolvedValue(mockInvoice);

        // Act & Assert
        await expect(
          service.updateInvoice(1, 1, { items: [] }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException for invalid userId', async () => {
        // Arrange
        mockRepository.findById.mockResolvedValue(mockInvoice);

        // Act & Assert
        await expect(
          service.updateInvoice(1, -1, { items: [] }),
        ).rejects.toThrow(ForbiddenException);
      });
    });
  });

  describe('updateInvoiceStatus', () => {
    describe('happy path', () => {
      it('should update status for valid transition DRAFT -> PENDING', async () => {
        // Arrange
        const invoiceId = 1;
        const draftInvoice = {
          ...mockInvoice,
          status: InvoiceStatus.DRAFT,
          save: jest.fn(),
        };
        mockRepository.findById.mockResolvedValue(draftInvoice);

        // Act
        const result = await service.updateInvoiceStatus(invoiceId, {
          status: InvoiceStatus.PENDING,
        });

        // Assert
        expect(result.status).toBe(InvoiceStatus.PENDING);
        expect(draftInvoice.save).toHaveBeenCalled();
      });

      it('should update status for valid transition DRAFT -> CANCELLED', async () => {
        // Arrange
        const invoiceId = 1;
        const draftInvoice = {
          ...mockInvoice,
          status: InvoiceStatus.DRAFT,
          save: jest.fn(),
        };
        mockRepository.findById.mockResolvedValue(draftInvoice);

        // Act
        const result = await service.updateInvoiceStatus(invoiceId, {
          status: InvoiceStatus.CANCELLED,
        });

        // Assert
        expect(result.status).toBe(InvoiceStatus.CANCELLED);
      });

      it('should update status for valid transition PENDING -> PAID', async () => {
        // Arrange
        const invoiceId = 1;
        const pendingInvoice = {
          ...mockInvoice,
          status: InvoiceStatus.PENDING,
          save: jest.fn(),
        };
        mockRepository.findById.mockResolvedValue(pendingInvoice);

        // Act
        const result = await service.updateInvoiceStatus(invoiceId, {
          status: InvoiceStatus.PAID,
        });

        // Assert
        expect(result.status).toBe(InvoiceStatus.PAID);
      });

      it('should update status for valid transition PENDING -> OVERDUE', async () => {
        // Arrange
        const invoiceId = 1;
        const pendingInvoice = {
          ...mockInvoice,
          status: InvoiceStatus.PENDING,
          save: jest.fn(),
        };
        mockRepository.findById.mockResolvedValue(pendingInvoice);

        // Act
        const result = await service.updateInvoiceStatus(invoiceId, {
          status: InvoiceStatus.OVERDUE,
        });

        // Assert
        expect(result.status).toBe(InvoiceStatus.OVERDUE);
      });

      it('should update status for valid transition PENDING -> CANCELLED', async () => {
        // Arrange
        const invoiceId = 1;
        const pendingInvoice = {
          ...mockInvoice,
          status: InvoiceStatus.PENDING,
          save: jest.fn(),
        };
        mockRepository.findById.mockResolvedValue(pendingInvoice);

        // Act
        const result = await service.updateInvoiceStatus(invoiceId, {
          status: InvoiceStatus.CANCELLED,
        });

        // Assert
        expect(result.status).toBe(InvoiceStatus.CANCELLED);
      });

      it('should update status for valid transition OVERDUE -> PAID', async () => {
        // Arrange
        const invoiceId = 1;
        const overdueInvoice = {
          ...mockInvoice,
          status: InvoiceStatus.OVERDUE,
          save: jest.fn(),
        };
        mockRepository.findById.mockResolvedValue(overdueInvoice);

        // Act
        const result = await service.updateInvoiceStatus(invoiceId, {
          status: InvoiceStatus.PAID,
        });

        // Assert
        expect(result.status).toBe(InvoiceStatus.PAID);
      });

      it('should update status for valid transition OVERDUE -> CANCELLED', async () => {
        // Arrange
        const invoiceId = 1;
        const overdueInvoice = {
          ...mockInvoice,
          status: InvoiceStatus.OVERDUE,
          save: jest.fn(),
        };
        mockRepository.findById.mockResolvedValue(overdueInvoice);

        // Act
        const result = await service.updateInvoiceStatus(invoiceId, {
          status: InvoiceStatus.CANCELLED,
        });

        // Assert
        expect(result.status).toBe(InvoiceStatus.CANCELLED);
      });

      it('should update timestamp when status changes', async () => {
        // Arrange
        const invoiceId = 1;
        const originalUpdatedAt = new Date('2026-01-01');
        const draftInvoice = {
          ...mockInvoice,
          status: InvoiceStatus.DRAFT,
          updatedAt: originalUpdatedAt,
          save: jest.fn(),
        };
        mockRepository.findById.mockResolvedValue(draftInvoice);

        // Act
        await service.updateInvoiceStatus(invoiceId, {
          status: InvoiceStatus.PENDING,
        });

        // Assert
        expect(draftInvoice.save).toHaveBeenCalled();
      });
    });

    describe('error cases', () => {
      it('should throw NotFoundException for non-existent invoice', async () => {
        // Arrange
        mockRepository.findById.mockResolvedValue(null);

        // Act & Assert
        await expect(
          service.updateInvoiceStatus(999, { status: InvoiceStatus.PAID }),
        ).rejects.toThrow(NotFoundException);
      });

      it('should throw BadRequestException for invalid transition PAID -> DRAFT', async () => {
        // Arrange
        const paidInvoice = {
          ...mockInvoice,
          status: InvoiceStatus.PAID,
          save: jest.fn(),
        };
        mockRepository.findById.mockResolvedValue(paidInvoice);

        // Act & Assert
        await expect(
          service.updateInvoiceStatus(1, { status: InvoiceStatus.DRAFT }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException for invalid transition PAID -> CANCELLED', async () => {
        // Arrange
        const paidInvoice = {
          ...mockInvoice,
          status: InvoiceStatus.PAID,
        };
        mockRepository.findById.mockResolvedValue(paidInvoice);

        // Act & Assert
        await expect(
          service.updateInvoiceStatus(1, { status: InvoiceStatus.CANCELLED }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException for invalid transition CANCELLED -> DRAFT', async () => {
        // Arrange
        const cancelledInvoice = {
          ...mockInvoice,
          status: InvoiceStatus.CANCELLED,
        };
        mockRepository.findById.mockResolvedValue(cancelledInvoice);

        // Act & Assert
        await expect(
          service.updateInvoiceStatus(1, { status: InvoiceStatus.DRAFT }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException for invalid transition CANCELLED -> PENDING', async () => {
        // Arrange
        const cancelledInvoice = {
          ...mockInvoice,
          status: InvoiceStatus.CANCELLED,
        };
        mockRepository.findById.mockResolvedValue(cancelledInvoice);

        // Act & Assert
        await expect(
          service.updateInvoiceStatus(1, { status: InvoiceStatus.PENDING }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException for invalid transition PENDING -> DRAFT', async () => {
        // Arrange
        const pendingInvoice = {
          ...mockInvoice,
          status: InvoiceStatus.PENDING,
        };
        mockRepository.findById.mockResolvedValue(pendingInvoice);

        // Act & Assert
        await expect(
          service.updateInvoiceStatus(1, { status: InvoiceStatus.DRAFT }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException for invalid transition OVERDUE -> PENDING', async () => {
        // Arrange
        const overdueInvoice = {
          ...mockInvoice,
          status: InvoiceStatus.OVERDUE,
        };
        mockRepository.findById.mockResolvedValue(overdueInvoice);

        // Act & Assert
        await expect(
          service.updateInvoiceStatus(1, { status: InvoiceStatus.PENDING }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException for same status transition', async () => {
        // Arrange
        const pendingInvoice = {
          ...mockInvoice,
          status: InvoiceStatus.PENDING,
        };
        mockRepository.findById.mockResolvedValue(pendingInvoice);

        // Act & Assert
        await expect(
          service.updateInvoiceStatus(1, { status: InvoiceStatus.PENDING }),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  describe('isOverdue', () => {
    describe('happy path', () => {
      it('should return true for past due date with PENDING status', () => {
        // Arrange
        const invoice = {
          ...mockInvoice,
          status: InvoiceStatus.PENDING,
          dueDate: new Date('2020-01-01'),
        };

        // Act
        const result = service.isOverdue(invoice as any);

        // Assert
        expect(result).toBe(true);
      });

      it('should return false for future due date with PENDING status', () => {
        // Arrange
        const invoice = {
          ...mockInvoice,
          status: InvoiceStatus.PENDING,
          dueDate: new Date('2030-01-01'),
        };

        // Act
        const result = service.isOverdue(invoice as any);

        // Assert
        expect(result).toBe(false);
      });

      it('should return false for past due date with DRAFT status', () => {
        // Arrange
        const invoice = {
          ...mockInvoice,
          status: InvoiceStatus.DRAFT,
          dueDate: new Date('2020-01-01'),
        };

        // Act
        const result = service.isOverdue(invoice as any);

        // Assert
        expect(result).toBe(false);
      });

      it('should return false for past due date with PAID status', () => {
        // Arrange
        const invoice = {
          ...mockInvoice,
          status: InvoiceStatus.PAID,
          dueDate: new Date('2020-01-01'),
        };

        // Act
        const result = service.isOverdue(invoice as any);

        // Assert
        expect(result).toBe(false);
      });

      it('should return false for past due date with OVERDUE status', () => {
        // Arrange
        const invoice = {
          ...mockInvoice,
          status: InvoiceStatus.OVERDUE,
          dueDate: new Date('2020-01-01'),
        };

        // Act
        const result = service.isOverdue(invoice as any);

        // Assert
        expect(result).toBe(false);
      });

      it('should return false for past due date with CANCELLED status', () => {
        // Arrange
        const invoice = {
          ...mockInvoice,
          status: InvoiceStatus.CANCELLED,
          dueDate: new Date('2020-01-01'),
        };

        // Act
        const result = service.isOverdue(invoice as any);

        // Assert
        expect(result).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should return false for null dueDate', () => {
        // Arrange
        const invoice = {
          ...mockInvoice,
          status: InvoiceStatus.PENDING,
          dueDate: null,
        };

        // Act
        const result = service.isOverdue(invoice as any);

        // Assert
        expect(result).toBe(false);
      });

      it('should return false for undefined dueDate', () => {
        // Arrange
        const invoice = {
          ...mockInvoice,
          status: InvoiceStatus.PENDING,
          dueDate: undefined,
        };

        // Act
        const result = service.isOverdue(invoice as any);

        // Assert
        expect(result).toBe(false);
      });

      it('should handle exact current date as not overdue', () => {
        // Arrange
        const now = new Date();
        const invoice = {
          ...mockInvoice,
          status: InvoiceStatus.PENDING,
          dueDate: now,
        };

        // Act
        const result = service.isOverdue(invoice as any);

        // Assert
        expect(result).toBe(false);
      });

      it('should handle one day past due as overdue', () => {
        // Arrange
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const invoice = {
          ...mockInvoice,
          status: InvoiceStatus.PENDING,
          dueDate: yesterday,
        };

        // Act
        const result = service.isOverdue(invoice as any);

        // Assert
        expect(result).toBe(true);
      });
    });
  });

  describe('getAllInvoices', () => {
    describe('happy path', () => {
      it('should return paginated all invoices', async () => {
        // Arrange
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
        mockInvoiceModel.findAll.mockResolvedValue([]);

        // Act
        const result = await service.getAllInvoices(1, 10);

        // Assert
        expect(result).toBeDefined();
        expect(result.data).toHaveLength(1);
        expect(mockRepository.findAll).toHaveBeenCalledWith({
          page: 1,
          limit: 10,
        });
      });

      it('should return empty array when no invoices', async () => {
        // Arrange
        const paginatedResult = {
          data: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
          },
        };
        mockRepository.findAll.mockResolvedValue(paginatedResult);

        // Act
        const result = await service.getAllInvoices();

        // Assert
        expect(result.data).toHaveLength(0);
      });

      it('should use default pagination values', async () => {
        // Arrange
        const paginatedResult = {
          data: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
          },
        };
        mockRepository.findAll.mockResolvedValue(paginatedResult);

        // Act
        await service.getAllInvoices();

        // Assert
        expect(mockRepository.findAll).toHaveBeenCalledWith({
          page: 1,
          limit: 10,
        });
      });

      it('should check and update overdue invoices', async () => {
        // Arrange
        const overdueInvoice = {
          ...mockInvoice,
          status: InvoiceStatus.PENDING,
          dueDate: new Date('2020-01-01'),
          save: jest.fn(),
        };
        const paginatedResult = {
          data: [overdueInvoice],
          pagination: {
            page: 1,
            limit: 10,
            total: 1,
            totalPages: 1,
          },
        };
        mockRepository.findAll.mockResolvedValue(paginatedResult);

        // Act
        await service.getAllInvoices();

        // Assert
        expect(overdueInvoice.save).toHaveBeenCalled();
      });
    });

    describe('error cases', () => {
      it('should handle repository error', async () => {
        // Arrange
        mockRepository.findAll.mockRejectedValue(new Error('DB error'));

        // Act & Assert
        await expect(service.getAllInvoices()).rejects.toThrow('DB error');
      });
    });
  });

  describe('integration tests', () => {
    it('should handle complete invoice lifecycle', async () => {
      // Create invoice
      const createDto: CreateInvoiceDto = {
        items: [
          { description: 'Item 1', quantity: 2, unitPrice: 50 },
          { description: 'Item 2', quantity: 1, unitPrice: 75 },
        ],
      };

      const createdInvoice = {
        ...mockInvoice,
        id: 1,
        status: InvoiceStatus.DRAFT,
        subtotal: 175,
        tax: 17.5,
        total: 192.5,
        items: [
          { id: 1, description: 'Item 1', quantity: 2, unitPrice: 50, amount: 100 },
          { id: 2, description: 'Item 2', quantity: 1, unitPrice: 75, amount: 75 },
        ],
        save: jest.fn(),
      };

      mockInvoiceModel.create.mockResolvedValue(createdInvoice);
      mockInvoiceItemModel.create
        .mockResolvedValueOnce({
          id: 1, description: 'Item 1', quantity: 2, unitPrice: 50, amount: 100,
        })
        .mockResolvedValueOnce({
          id: 2, description: 'Item 2', quantity: 1, unitPrice: 75, amount: 75,
        });
      mockInvoiceModel.findAll.mockResolvedValue([]);

      const created = await service.createInvoice(1, createDto);
      expect(created.status).toBe(InvoiceStatus.DRAFT);
      expect(created.total).toBe(192.5);

      // Update status to PENDING
      mockRepository.findById.mockResolvedValue(createdInvoice);
      const pendingInvoice = { ...createdInvoice, status: InvoiceStatus.PENDING, save: jest.fn() };
      mockRepository.findById.mockResolvedValue(pendingInvoice);

      const pending = await service.updateInvoiceStatus(created.id, {
        status: InvoiceStatus.PENDING,
      });
      expect(pending.status).toBe(InvoiceStatus.PENDING);

      // Cannot update cancelled or paid invoice
      const paidInvoice = { ...createdInvoice, status: InvoiceStatus.PAID, save: jest.fn() };
      mockRepository.findById.mockResolvedValue(paidInvoice);

      await expect(
        service.updateInvoice(created.id, 1, {
          items: [{ description: 'New Item', quantity: 1, unitPrice: 100 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle invoice with multiple status transitions', async () => {
      // Create invoice in DRAFT
      const invoice = {
        ...mockInvoice,
        id: 1,
        status: InvoiceStatus.DRAFT,
        subtotal: 100,
        tax: 10,
        total: 110,
        save: jest.fn(),
      };

      // DRAFT -> PENDING
      mockRepository.findById.mockResolvedValue(invoice);
      const result1 = await service.updateInvoiceStatus(1, {
        status: InvoiceStatus.PENDING,
      });
      expect(result1.status).toBe(InvoiceStatus.PENDING);

      // PENDING -> OVERDUE
      const overdueInvoice = { ...invoice, status: InvoiceStatus.PENDING, save: jest.fn() };
      mockRepository.findById.mockResolvedValue(overdueInvoice);
      const result2 = await service.updateInvoiceStatus(1, {
        status: InvoiceStatus.OVERDUE,
      });
      expect(result2.status).toBe(InvoiceStatus.OVERDUE);

      // OVERDUE -> PAID
      const paidInvoice = { ...overdueInvoice, status: InvoiceStatus.PAID, save: jest.fn() };
      mockRepository.findById.mockResolvedValue(paidInvoice);
      const result3 = await service.updateInvoiceStatus(1, {
        status: InvoiceStatus.PAID,
      });
      expect(result3.status).toBe(InvoiceStatus.PAID);

      // Cannot transition from PAID (terminal)
      const terminalInvoice = { ...paidInvoice, save: jest.fn() };
      mockRepository.findById.mockResolvedValue(terminalInvoice);
      await expect(
        service.updateInvoiceStatus(1, { status: InvoiceStatus.CANCELLED }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle user isolation correctly', async () => {
      // Create invoices for user 1
      const user1Invoice = { ...mockInvoice, id: 1, userId: 1 };
      mockRepository.findByUser.mockResolvedValue({
        data: [user1Invoice],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });
      mockInvoiceModel.findAll.mockResolvedValue([]);

      const user1Invoices = await service.getInvoicesByUser(1);
      expect(user1Invoices.data).toHaveLength(1);
      expect(user1Invoices.data[0].userId).toBe(1);

      // User 2 cannot access user 1's invoice
      mockRepository.findById.mockResolvedValue(user1Invoice);
      await expect(service.getInvoiceById(1, 2)).rejects.toThrow(ForbiddenException);
    });

    it('should handle overdue invoice auto-detection on getInvoiceById', async () => {
      const overdueInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.PENDING,
        dueDate: new Date('2020-01-01'),
        save: jest.fn(),
      };
      mockRepository.findById.mockResolvedValue(overdueInvoice);

      await service.getInvoiceById(1, 1);

      expect(overdueInvoice.status).toBe(InvoiceStatus.OVERDUE);
      expect(overdueInvoice.save).toHaveBeenCalled();
    });

    it('should handle overdue invoice auto-detection on getInvoicesByUser', async () => {
      const overdueInvoice = {
        ...mockInvoice,
        id: 1,
        status: InvoiceStatus.PENDING,
        dueDate: new Date('2020-01-01'),
        save: jest.fn(),
      };
      const pendingInvoice = {
        ...mockInvoice,
        id: 2,
        status: InvoiceStatus.PENDING,
        dueDate: new Date('2030-01-01'),
        save: jest.fn(),
      };

      mockRepository.findByUser.mockResolvedValue({
        data: [overdueInvoice, pendingInvoice],
        pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
      });

      await service.getInvoicesByUser(1);

      // Only overdue should be updated
      expect(overdueInvoice.save).toHaveBeenCalled();
      expect(pendingInvoice.save).not.toHaveBeenCalled();
    });

    it('should handle recalculation when updating invoice items', async () => {
      const invoice = {
        ...mockInvoice,
        id: 1,
        status: InvoiceStatus.DRAFT,
        subtotal: 100,
        tax: 10,
        total: 110,
        items: [{ id: 1, description: 'Old Item', quantity: 1, unitPrice: 100, amount: 100 }],
        save: jest.fn(),
      };

      mockRepository.findById.mockResolvedValue(invoice);
      mockInvoiceItemModel.destroy.mockResolvedValue(1);
      mockInvoiceItemModel.create.mockResolvedValue({
        id: 2,
        description: 'New Item 1',
        quantity: 2,
        unitPrice: 50,
        amount: 100,
      });

      const updateDto: UpdateInvoiceDto = {
        items: [
          { description: 'New Item 1', quantity: 2, unitPrice: 50 },
        ],
      };

      const result = await service.updateInvoice(1, 1, updateDto);

      // Totals should be recalculated
      expect(result.subtotal).toBe(100);
      expect(result.tax).toBe(10);
      expect(result.total).toBe(110);
    });
  });

  describe('status transition validation', () => {
    // Test all valid transitions
      it.each([
        [InvoiceStatus.DRAFT, InvoiceStatus.PENDING],
        [InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED],
        [InvoiceStatus.PENDING, InvoiceStatus.PAID],
        [InvoiceStatus.PENDING, InvoiceStatus.OVERDUE],
        [InvoiceStatus.PENDING, InvoiceStatus.CANCELLED],
        [InvoiceStatus.OVERDUE, InvoiceStatus.PAID],
        [InvoiceStatus.OVERDUE, InvoiceStatus.CANCELLED],
      ])('should allow valid transition from %s to %s', async (fromStatus, toStatus) => {
        // Arrange
        const invoice = {
          ...mockInvoice,
          status: fromStatus,
          save: jest.fn(),
        };
        mockRepository.findById.mockResolvedValue(invoice);

        // Act
        const result = await service.updateInvoiceStatus(1, { status: toStatus });

        // Assert
        expect(result.status).toBe(toStatus);
      });

      // Test all invalid transitions from terminal states
      it.each([
        [InvoiceStatus.PAID, InvoiceStatus.DRAFT],
        [InvoiceStatus.PAID, InvoiceStatus.PENDING],
        [InvoiceStatus.PAID, InvoiceStatus.OVERDUE],
        [InvoiceStatus.PAID, InvoiceStatus.CANCELLED],
        [InvoiceStatus.CANCELLED, InvoiceStatus.DRAFT],
        [InvoiceStatus.CANCELLED, InvoiceStatus.PENDING],
        [InvoiceStatus.CANCELLED, InvoiceStatus.PAID],
        [InvoiceStatus.CANCELLED, InvoiceStatus.OVERDUE],
      ])('should reject invalid transition from %s to %s', async (fromStatus, toStatus) => {
        // Arrange
        const invoice = {
          ...mockInvoice,
          status: fromStatus,
        };
        mockRepository.findById.mockResolvedValue(invoice);

        // Act & Assert
        await expect(
          service.updateInvoiceStatus(1, { status: toStatus }),
        ).rejects.toThrow(BadRequestException);
      });

      // Test invalid transitions from non-terminal states
      it.each([
        [InvoiceStatus.DRAFT, InvoiceStatus.PAID],
        [InvoiceStatus.DRAFT, InvoiceStatus.OVERDUE],
        [InvoiceStatus.PENDING, InvoiceStatus.DRAFT],
        [InvoiceStatus.PENDING, InvoiceStatus.CONFIRMED as any],
        [InvoiceStatus.OVERDUE, InvoiceStatus.PENDING],
      ])('should reject invalid transition from %s to %s', async (fromStatus, toStatus) => {
        // Arrange
        const invoice = {
          ...mockInvoice,
          status: fromStatus,
        };
        mockRepository.findById.mockResolvedValue(invoice);

        // Act & Assert
        await expect(
          service.updateInvoiceStatus(1, { status: toStatus }),
        ).rejects.toThrow(BadRequestException);
      });
  });
});