import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import * as fs from 'fs';
import * as path from 'path';
import { ExportService, ExportQuery, ExportResult } from './export.service';
import { SavingAccount } from '../../db/models/SavingAccount';
import { Transaction, TransactionType } from '../../db/models/Transaction';
import { AuditLogService } from '../audit/audit-log.service';

describe('ExportService', () => {
  let service: ExportService;
  let mockSavingAccountModel: any;
  let mockTransactionModel: any;
  let mockAuditLogService: any;

  beforeEach(async () => {
    // Mock models
    mockSavingAccountModel = {
      findAll: jest.fn(),
    };

    mockTransactionModel = {
      findAll: jest.fn(),
    };

    mockAuditLogService = {
      log: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportService,
        {
          provide: getModelToken(SavingAccount),
          useValue: mockSavingAccountModel,
        },
        {
          provide: getModelToken(Transaction),
          useValue: mockTransactionModel,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    }).compile();

    service = module.get<ExportService>(ExportService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Clean up export files
    const exportDir = service.getExportDir();
    if (fs.existsSync(exportDir)) {
      const files = fs.readdirSync(exportDir);
      files.forEach((file) => {
        fs.unlinkSync(path.join(exportDir, file));
      });
    }
  });

  // ============================================
  // exportToExcel Tests - Happy Paths
  // ============================================

  describe('exportToExcel', () => {
    describe('Basic Export Scenarios', () => {
      it('should export all accounts when no accountId provided', async () => {
        // Arrange
        const mockAccounts = [
          {
            id: 'ACC-1',
            accountNumber: 'SA-20250101-00001',
            accountName: 'Test Account 1',
            balance: 1000,
            currency: 'USD',
            createdAt: new Date('2025-01-01'),
            updatedAt: new Date('2025-01-01'),
            transactions: [],
          },
          {
            id: 'ACC-2',
            accountNumber: 'SA-20250101-00002',
            accountName: 'Test Account 2',
            balance: 2000,
            currency: 'USD',
            createdAt: new Date('2025-01-02'),
            updatedAt: new Date('2025-01-02'),
            transactions: [],
          },
        ];

        mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);

        // Act
        const result = await service.exportToExcel();

        // Assert
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.filePath).toMatch(/accounts-export-.*\.xlsx$/);
        expect(result.recordCount).toBe(2);
        expect(fs.existsSync(result.filePath)).toBe(true);
        expect(mockAuditLogService.log).toHaveBeenCalled();
      });

      it('should export single account when accountId provided', async () => {
        // Arrange
        const mockAccounts = [
          {
            id: 'ACC-1',
            accountNumber: 'SA-20250101-00001',
            accountName: 'Single Account',
            balance: 1500,
            currency: 'USD',
            createdAt: new Date('2025-01-01'),
            updatedAt: new Date('2025-01-01'),
            transactions: [
              {
                id: 'TXN-1',
                savingAccountId: 'ACC-1',
                type: TransactionType.deposit,
                amount: 500,
                balanceAfter: 500,
                description: 'Initial deposit',
                transactionDate: new Date('2025-01-01'),
              },
            ],
          },
        ];

        mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);

        // Act
        const result = await service.exportToExcel('ACC-1');

        // Assert
        expect(result.success).toBe(true);
        expect(result.recordCount).toBe(1);
        expect(fs.existsSync(result.filePath)).toBe(true);
        // Verify accountId filter was applied
        expect(mockSavingAccountModel.findAll).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'ACC-1' },
          }),
        );
      });

      it('should export accounts with transactions', async () => {
        // Arrange
        const mockAccounts = [
          {
            id: 'ACC-1',
            accountNumber: 'SA-20250101-00001',
            accountName: 'Account With Transactions',
            balance: 1000,
            currency: 'USD',
            createdAt: new Date('2025-01-01'),
            updatedAt: new Date('2025-01-01'),
            transactions: [
              {
                id: 'TXN-1',
                savingAccountId: 'ACC-1',
                type: TransactionType.deposit,
                amount: 500,
                balanceAfter: 500,
                description: 'First deposit',
                transactionDate: new Date('2025-01-01'),
              },
              {
                id: 'TXN-2',
                savingAccountId: 'ACC-1',
                type: TransactionType.withdrawal,
                amount: 200,
                balanceAfter: 300,
                description: 'Withdrawal',
                transactionDate: new Date('2025-01-02'),
              },
            ],
          },
        ];

        mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);

        // Act
        const result = await service.exportToExcel();

        // Assert
        expect(result.success).toBe(true);
        // Each transaction creates a separate row
        expect(result.recordCount).toBe(2);
        expect(fs.existsSync(result.filePath)).toBe(true);
      });
    });

    // ============================================
    // exportToExcel Tests - Edge Cases
    // ============================================

    describe('Edge Cases', () => {
      it('should return success=false when no accounts found', async () => {
        // Arrange
        mockSavingAccountModel.findAll.mockResolvedValue([]);

        // Act
        const result = await service.exportToExcel();

        // Assert
        expect(result).toBeDefined();
        expect(result.success).toBe(false);
        expect(result.filePath).toBe('');
        expect(result.recordCount).toBe(0);
      });

      it('should return success=false for specific accountId not found', async () => {
        // Arrange
        mockSavingAccountModel.findAll.mockResolvedValue([]);

        // Act
        const result = await service.exportToExcel('NON-EXISTENT');

        // Assert
        expect(result.success).toBe(false);
        expect(result.recordCount).toBe(0);
      });

      it('should handle account with no transactions', async () => {
        // Arrange
        const mockAccounts = [
          {
            id: 'ACC-1',
            accountNumber: 'SA-20250101-00001',
            accountName: 'No Transactions Account',
            balance: 500,
            currency: 'USD',
            createdAt: new Date('2025-01-01'),
            updatedAt: new Date('2025-01-01'),
            transactions: [],
          },
        ];

        mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);

        // Act
        const result = await service.exportToExcel();

        // Assert
        expect(result.success).toBe(true);
        expect(result.recordCount).toBe(1);
        expect(fs.existsSync(result.filePath)).toBe(true);
      });

      it('should generate valid Excel filename with timestamp', async () => {
        // Arrange
        const mockAccounts = [
          {
            id: 'ACC-1',
            accountNumber: 'SA-20250101-00001',
            accountName: 'Test',
            balance: 100,
            currency: 'USD',
            createdAt: new Date(),
            updatedAt: new Date(),
            transactions: [],
          },
        ];

        mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);

        // Act
        const result = await service.exportToExcel();

        // Assert
        expect(result.filePath).toMatch(/accounts-export-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.xlsx$/);
      });
    });

    // ============================================
    // exportToExcel Tests - Error Handling
    // ============================================

    describe('Error Handling', () => {
      it('should throw error on database query failure', async () => {
        // Arrange
        mockSavingAccountModel.findAll.mockRejectedValue(new Error('Database connection failed'));

        // Act & Assert
        await expect(service.exportToExcel()).rejects.toThrow(
          'Failed to export accounts: Database connection failed',
        );
        expect(mockAuditLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'EXPORT',
            entityType: 'SavingAccount',
            entityId: 'FAILED',
          }),
        );
      });

      it('should throw error on file write failure', async () => {
        // Arrange
        const originalMkdirSync = fs.mkdirSync;
        fs.mkdirSync = jest.fn().mockImplementation(() => {
          throw new Error('Permission denied');
        });

        mockSavingAccountModel.findAll.mockResolvedValue([
          {
            id: 'ACC-1',
            accountNumber: 'SA-20250101-00001',
            accountName: 'Test',
            balance: 100,
            currency: 'USD',
            createdAt: new Date(),
            updatedAt: new Date(),
            transactions: [],
          },
        ]);

        // Act & Assert
        await expect(service.exportToExcel()).rejects.toThrow();

        // Restore
        fs.mkdirSync = originalMkdirSync;
      });

      it('should throw error on transaction fetch failure', async () => {
        // Arrange
        mockSavingAccountModel.findAll.mockRejectedValue(new Error('Transaction query failed'));

        // Act & Assert
        await expect(service.exportToExcel('ACC-1')).rejects.toThrow(
          'Failed to export accounts: Transaction query failed',
        );
      });

      it('should handle unknown error types', async () => {
        // Arrange
        mockSavingAccountModel.findAll.mockRejectedValue('Unknown error string');

        // Act & Assert
        await expect(service.exportToExcel()).rejects.toThrow(
          'Failed to export accounts: Unknown error',
        );
      });
    });

    // ============================================
    // exportToExcel Tests - Audit Logging
    // ============================================

    describe('Audit Trail Integration', () => {
      it('should log EXPORT action on successful export', async () => {
        // Arrange
        const mockAccounts = [
          {
            id: 'ACC-1',
            accountNumber: 'SA-20250101-00001',
            accountName: 'Test',
            balance: 1000,
            currency: 'USD',
            createdAt: new Date(),
            updatedAt: new Date(),
            transactions: [],
          },
        ];

        mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);

        // Act
        await service.exportToExcel();

        // Assert
        expect(mockAuditLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'EXPORT',
            entityType: 'SavingAccount',
          }),
        );
      });

      it('should log audit with file details on success', async () => {
        // Arrange
        const mockAccounts = [
          {
            id: 'ACC-1',
            accountNumber: 'SA-20250101-00001',
            accountName: 'Test Account',
            balance: 500,
            currency: 'USD',
            createdAt: new Date(),
            updatedAt: new Date(),
            transactions: [],
          },
        ];

        mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);

        // Act
        const result = await service.exportToExcel();

        // Assert
        expect(mockAuditLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'EXPORT',
            entityType: 'SavingAccount',
            metadata: expect.objectContaining({
              fileName: expect.any(String),
              accountCount: 1,
              recordCount: expect.any(Number),
              accountId: 'ALL',
            }),
          }),
        );
      });

      it('should log audit with specific accountId when filtering', async () => {
        // Arrange
        const mockAccounts = [
          {
            id: 'ACC-1',
            accountNumber: 'SA-20250101-00001',
            accountName: 'Specific Account',
            balance: 1000,
            currency: 'USD',
            createdAt: new Date(),
            updatedAt: new Date(),
            transactions: [],
          },
        ];

        mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);

        // Act
        await service.exportToExcel('ACC-1');

        // Assert
        expect(mockAuditLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: expect.objectContaining({
              accountId: 'ACC-1',
            }),
          }),
        );
      });

      it('should log EXPORT action with FAILED entityId on error', async () => {
        // Arrange
        mockSavingAccountModel.findAll.mockRejectedValue(new Error('DB Error'));

        // Act & Assert
        await expect(service.exportToExcel()).rejects.toThrow();
        expect(mockAuditLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'EXPORT',
            entityType: 'SavingAccount',
            entityId: 'FAILED',
          }),
        );
      });
    });

    // ============================================
    // exportToExcel Tests - Excel File Content
    // ============================================

    describe('Excel File Content', () => {
      it('should create Excel file with correct columns', async () => {
        // Arrange
        const ExcelJS = require('exceljs');
        const mockAccounts = [
          {
            id: 'ACC-1',
            accountNumber: 'SA-20250101-00001',
            accountName: 'Content Test Account',
            balance: 1234.56,
            currency: 'USD',
            createdAt: new Date('2025-01-01'),
            updatedAt: new Date('2025-01-01'),
            transactions: [],
          },
        ];

        mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);

        // Act
        const result = await service.exportToExcel();

        // Assert - Read back the Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(result.filePath);

        const sheet = workbook.getWorksheet('Accounts & Transactions');
        expect(sheet).toBeDefined();

        // Check header row - columns per spec:
        // Account Number | Account Name | Balance | Currency | Created At | Transaction Type | Amount | Balance After | Description | Transaction Date
        const headerRow = sheet.getRow(1);
        expect(headerRow.getCell(1).value).toBe('Account Number');
        expect(headerRow.getCell(2).value).toBe('Account Name');
        expect(headerRow.getCell(3).value).toBe('Balance');
        expect(headerRow.getCell(4).value).toBe('Currency');
        expect(headerRow.getCell(5).value).toBe('Created At');
        expect(headerRow.getCell(6).value).toBe('Transaction Type');
        expect(headerRow.getCell(7).value).toBe('Amount');
        expect(headerRow.getCell(8).value).toBe('Balance After');
        expect(headerRow.getCell(9).value).toBe('Description');
        expect(headerRow.getCell(10).value).toBe('Transaction Date');
      });

      it('should include transaction data in correct columns', async () => {
        // Arrange
        const ExcelJS = require('exceljs');
        const mockAccounts = [
          {
            id: 'ACC-1',
            accountNumber: 'SA-20250101-00001',
            accountName: 'Transaction Test',
            balance: 1000,
            currency: 'USD',
            createdAt: new Date('2025-01-01'),
            updatedAt: new Date('2025-01-01'),
            transactions: [
              {
                id: 'TXN-1',
                savingAccountId: 'ACC-1',
                type: TransactionType.deposit,
                amount: 500,
                balanceAfter: 500,
                description: 'Test deposit',
                transactionDate: new Date('2025-01-15'),
              },
            ],
          },
        ];

        mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);

        // Act
        const result = await service.exportToExcel();

        // Assert
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(result.filePath);

        const sheet = workbook.getWorksheet('Accounts & Transactions');
        const dataRow = sheet.getRow(2); // Row 1 is header

        expect(dataRow.getCell(1).value).toBe('SA-20250101-00001'); // Account Number
        expect(dataRow.getCell(2).value).toBe('Transaction Test'); // Account Name
        expect(dataRow.getCell(3).value).toBe(1000); // Balance
        expect(dataRow.getCell(4).value).toBe('USD'); // Currency
        expect(dataRow.getCell(6).value).toBe(TransactionType.deposit); // Transaction Type
        expect(dataRow.getCell(7).value).toBe(500); // Amount
        expect(dataRow.getCell(8).value).toBe(500); // Balance After
        expect(dataRow.getCell(9).value).toBe('Test deposit'); // Description
      });

      it('should apply formatting to header row', async () => {
        // Arrange
        const ExcelJS = require('exceljs');
        const mockAccounts = [
          {
            id: 'ACC-1',
            accountNumber: 'SA-20250101-00001',
            accountName: 'Format Test',
            balance: 100,
            currency: 'USD',
            createdAt: new Date(),
            updatedAt: new Date(),
            transactions: [],
          },
        ];

        mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);

        // Act
        const result = await service.exportToExcel();

        // Assert
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(result.filePath);

        const sheet = workbook.getWorksheet('Accounts & Transactions');
        const headerRow = sheet.getRow(1);

        // Check bold font
        expect(headerRow.font.bold).toBe(true);
      });

      it('should format currency columns with #,##0.00', async () => {
        // Arrange
        const ExcelJS = require('exceljs');
        const mockAccounts = [
          {
            id: 'ACC-1',
            accountNumber: 'SA-20250101-00001',
            accountName: 'Currency Format Test',
            balance: 1234.56,
            currency: 'USD',
            createdAt: new Date(),
            updatedAt: new Date(),
            transactions: [],
          },
        ];

        mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);

        // Act
        const result = await service.exportToExcel();

        // Assert
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(result.filePath);

        const sheet = workbook.getWorksheet('Accounts & Transactions');
        
        // Check column formatting is applied
        const balanceCol = sheet.getColumn('balance');
        expect(balanceCol.numFmt).toBe('#,##0.00');
        
        const amountCol = sheet.getColumn('amount');
        expect(amountCol.numFmt).toBe('#,##0.00');
        
        const balanceAfterCol = sheet.getColumn('balanceAfter');
        expect(balanceAfterCol.numFmt).toBe('#,##0.00');
      });
    });

    // ============================================
    // deleteExport Tests
    // ============================================

    describe('deleteExport', () => {
      it('should delete export file successfully', async () => {
        // Arrange
        const mockAccounts = [
          {
            id: 'ACC-1',
            accountNumber: 'SA-20250101-00001',
            accountName: 'Test',
            balance: 100,
            currency: 'USD',
            createdAt: new Date(),
            updatedAt: new Date(),
            transactions: [],
          },
        ];

        mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);
        const exportResult = await service.exportToExcel();
        const fileName = path.basename(exportResult.filePath);

        // Act
        await service.deleteExport(fileName);

        // Assert
        expect(fs.existsSync(exportResult.filePath)).toBe(false);
      });

      it('should handle deletion of non-existent file without error', async () => {
        // Act & Assert
        await expect(service.deleteExport('non-existent.xlsx')).resolves.not.toThrow();
      });

      it('should prevent directory traversal with ../', async () => {
        // Act & Assert
        await expect(service.deleteExport('../../../etc/passwd')).rejects.toThrow(
          'Invalid file path',
        );
      });

      it('should prevent absolute path traversal', async () => {
        // Act & Assert
        await expect(service.deleteExport('/etc/passwd')).rejects.toThrow(
          'Invalid file path',
        );
      });

      it('should only allow deletion within export directory', async () => {
        // Arrange - try to delete outside export dir
        const maliciousPath = '../../../tmp/malicious.txt';

        // Act & Assert
        await expect(service.deleteExport(maliciousPath)).rejects.toThrow(
          'Invalid file path',
        );
      });
    });

    // ============================================
    // getExportDir Tests
    // ============================================

    describe('getExportDir', () => {
      it('should return export directory path', () => {
        // Act
        const dir = service.getExportDir();

        // Assert
        expect(dir).toBeDefined();
        expect(dir).toContain('exports');
        expect(dir.endsWith('exports')).toBe(true);
      });

      it('should return consistent export directory', () => {
        // Act
        const dir1 = service.getExportDir();
        const dir2 = service.getExportDir();

        // Assert
        expect(dir1).toBe(dir2);
      });

      it('should create export directory if not exists', () => {
        // Arrange - Remove and verify recreation
        const exportDir = service.getExportDir();
        if (fs.existsSync(exportDir)) {
          const files = fs.readdirSync(exportDir);
          files.forEach((file) => {
            fs.unlinkSync(path.join(exportDir, file));
          });
        }

        // Act
        const dir = service.getExportDir();

        // Assert
        expect(fs.existsSync(dir)).toBe(true);
      });

      it('should return absolute path', () => {
        // Act
        const dir = service.getExportDir();

        // Assert
        expect(path.isAbsolute(dir)).toBe(true);
      });
    });

    // ============================================
    // Interface Contract Tests
    // ============================================

    describe('Interface Contract', () => {
      it('should return ExportResult with all required fields', async () => {
        // Arrange
        const mockAccounts = [
          {
            id: 'ACC-1',
            accountNumber: 'SA-20250101-00001',
            accountName: 'Test',
            balance: 1000,
            currency: 'USD',
            createdAt: new Date(),
            updatedAt: new Date(),
            transactions: [],
          },
        ];

        mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);

        // Act
        const result = await service.exportToExcel();

        // Assert - Verify all required fields per interface contract:
        // ExportResult { success: boolean, filePath: string, recordCount: number }
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('filePath');
        expect(result).toHaveProperty('recordCount');

        expect(typeof result.success).toBe('boolean');
        expect(typeof result.filePath).toBe('string');
        expect(typeof result.recordCount).toBe('number');
      });

      it('should accept optional accountId parameter', async () => {
        // Arrange
        const mockAccounts = [
          {
            id: 'ACC-1',
            accountNumber: 'SA-20250101-00001',
            accountName: 'Test',
            balance: 1000,
            currency: 'USD',
            createdAt: new Date(),
            updatedAt: new Date(),
            transactions: [],
          },
        ];

        mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);

        // Act - call without accountId
        const result1 = await service.exportToExcel();
        expect(result1.success).toBe(true);

        // Act - call with accountId
        const result2 = await service.exportToExcel('ACC-1');
        expect(result2.success).toBe(true);
      });

      it('should filter by accountId when provided', async () => {
        // Arrange
        mockSavingAccountModel.findAll.mockResolvedValue([]);

        // Act
        await service.exportToExcel('ACC-SPECIFIC');

        // Assert
        expect(mockSavingAccountModel.findAll).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'ACC-SPECIFIC' },
          }),
        );
      });
    });
  });
});