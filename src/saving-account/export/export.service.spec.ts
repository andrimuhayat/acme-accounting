import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import * as fs from 'fs';
import * as path from 'path';
import { ExportService, ExportRequest, ExportResponse } from './export.service';
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
      logSuccess: jest.fn().mockResolvedValue({}),
      logFailure: jest.fn().mockResolvedValue({}),
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
  // exportAccounts Tests - Happy Paths
  // ============================================

  describe('exportAccounts', () => {
    describe('Basic Export Scenarios', () => {
      it('should export accounts without transactions', async () => {
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
          },
          {
            id: 'ACC-2',
            accountNumber: 'SA-20250101-00002',
            accountName: 'Test Account 2',
            balance: 2000,
            currency: 'USD',
            createdAt: new Date('2025-01-02'),
            updatedAt: new Date('2025-01-02'),
          },
        ];

        mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);

        // Act
        const result = await service.exportAccounts({ includeTransactions: false });

        // Assert
        expect(result).toBeDefined();
        expect(result.fileName).toMatch(/accounts-export-.*\.xlsx/);
        expect(result.recordCount).toBe(2);
        expect(result.transactionCount).toBe(0);
        expect(result.fileSize).toBeGreaterThan(0);
        expect(result.generatedAt).toBeInstanceOf(Date);
        expect(fs.existsSync(result.filePath)).toBe(true);
        expect(mockAuditLogService.logSuccess).toHaveBeenCalled();
      });

      it('should export accounts with transactions', async () => {
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
          },
        ];

        const mockTransactions = [
          {
            id: 'TXN-1',
            savingAccountId: 'ACC-1',
            type: TransactionType.deposit,
            amount: 500,
            balanceAfter: 500,
            description: 'Initial deposit',
            createdAt: new Date('2025-01-01'),
          },
          {
            id: 'TXN-2',
            savingAccountId: 'ACC-1',
            type: TransactionType.deposit,
            amount: 500,
            balanceAfter: 1000,
            description: 'Additional deposit',
            createdAt: new Date('2025-01-02'),
          },
        ];

        mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);
        mockTransactionModel.findAll.mockResolvedValue(mockTransactions);

        // Act
        const result = await service.exportAccounts({ includeTransactions: true });

        // Assert
        expect(result).toBeDefined();
        expect(result.recordCount).toBe(1);
        expect(result.transactionCount).toBe(2);
        expect(fs.existsSync(result.filePath)).toBe(true);
        expect(mockAuditLogService.logSuccess).toHaveBeenCalled();
      });

      it('should export specific accounts by ID filter', async () => {
        // Arrange
        const accountIds = ['ACC-1', 'ACC-2'];
        const mockAccounts = [
          {
            id: 'ACC-1',
            accountNumber: 'SA-20250101-00001',
            accountName: 'Test Account 1',
            balance: 1000,
            currency: 'USD',
            createdAt: new Date('2025-01-01'),
            updatedAt: new Date('2025-01-01'),
          },
        ];

        mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);

        // Act
        const result = await service.exportAccounts({
          accountIds,
          includeTransactions: false,
        });

        // Assert
        expect(result.recordCount).toBe(1);
        expect(mockSavingAccountModel.findAll).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: accountIds },
          }),
        );
      });

      it('should export all accounts when no filter provided', async () => {
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
          },
          {
            id: 'ACC-2',
            accountNumber: 'SA-20250101-00002',
            accountName: 'Test Account 2',
            balance: 2000,
            currency: 'USD',
            createdAt: new Date('2025-01-02'),
            updatedAt: new Date('2025-01-02'),
          },
          {
            id: 'ACC-3',
            accountNumber: 'SA-20250101-00003',
            accountName: 'Test Account 3',
            balance: 3000,
            currency: 'USD',
            createdAt: new Date('2025-01-03'),
            updatedAt: new Date('2025-01-03'),
          },
        ];

        mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);

        // Act
        const result = await service.exportAccounts({});

        // Assert
        expect(result.recordCount).toBe(3);
        expect(mockSavingAccountModel.findAll).toHaveBeenCalledWith(
          expect.not.objectContaining({ where: expect.anything() }),
        );
      });
    });

    // ============================================
    // exportAccounts Tests - Edge Cases
    // ============================================

    describe('Edge Cases', () => {
      it('should handle empty accounts array', async () => {
        // Arrange
        mockSavingAccountModel.findAll.mockResolvedValue([]);

        // Act
        const result = await service.exportAccounts({ includeTransactions: false });

        // Assert
        expect(result).toBeDefined();
        expect(result.recordCount).toBe(0);
        expect(result.transactionCount).toBe(0);
        expect(result.fileName).toMatch(/accounts-export-.*\.xlsx/);
        expect(fs.existsSync(result.filePath)).toBe(true);
      });

      it('should handle includeTransactions true but no transactions exist', async () => {
        // Arrange
        const mockAccounts = [
          {
            id: 'ACC-1',
            accountNumber: 'SA-20250101-00001',
            accountName: 'Empty Account',
            balance: 100,
            currency: 'USD',
            createdAt: new Date('2025-01-01'),
            updatedAt: new Date('2025-01-01'),
          },
        ];

        mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);
        mockTransactionModel.findAll.mockResolvedValue([]);

        // Act
        const result = await service.exportAccounts({ includeTransactions: true });

        // Assert
        expect(result.recordCount).toBe(1);
        expect(result.transactionCount).toBe(0);
        expect(fs.existsSync(result.filePath)).toBe(true);
      });

      it('should generate correct filename with timestamp', async () => {
        // Arrange
        const mockAccounts = [
          {
            id: 'ACC-1',
            accountNumber: 'SA-20250101-00001',
            accountName: 'Test Account',
            balance: 1000,
            currency: 'USD',
            createdAt: new Date('2025-01-01'),
            updatedAt: new Date('2025-01-01'),
          },
        ];

        mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);

        // Act
        const result = await service.exportAccounts({});

        // Assert
        expect(result.fileName).toMatch(/^accounts-export-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.xlsx$/);
      });

      it('should handle accountIds with empty array', async () => {
        // Arrange
        mockSavingAccountModel.findAll.mockResolvedValue([]);

        // Act
        const result = await service.exportAccounts({
          accountIds: [],
          includeTransactions: false,
        });

        // Assert
        expect(result.recordCount).toBe(0);
        // Empty array should be treated as no filter
        expect(mockSavingAccountModel.findAll).toHaveBeenCalledWith(
          expect.not.objectContaining({ where: expect.anything() }),
        );
      });
    });

    // ============================================
    // exportAccounts Tests - Error Handling
    // ============================================

    describe('Error Handling', () => {
      it('should handle database query failure', async () => {
        // Arrange
        mockSavingAccountModel.findAll.mockRejectedValue(new Error('Database error'));

        // Act & Assert
        await expect(service.exportAccounts({ includeTransactions: false })).rejects.toThrow(
          'Failed to export accounts: Database error',
        );
        expect(mockAuditLogService.logFailure).toHaveBeenCalled();
      });

      it('should handle file write permission denied', async () => {
        // Arrange - Create a mock that causes file write issues
        const originalMkdirSync = fs.mkdirSync;
        const originalWriteFileSync = fs.writeFileSync;

        // Make directory creation fail
        fs.mkdirSync = jest.fn().mockImplementation(() => {
          throw new Error('Permission denied: cannot create export directory');
        });

        mockSavingAccountModel.findAll.mockResolvedValue([
          {
            id: 'ACC-1',
            accountNumber: 'SA-20250101-00001',
            accountName: 'Test Account',
            balance: 1000,
            currency: 'USD',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        // Act & Assert
        await expect(service.exportAccounts({ includeTransactions: false })).rejects.toThrow();

        // Restore
        fs.mkdirSync = originalMkdirSync;
        fs.writeFileSync = originalWriteFileSync;
      });

      it('should handle transaction fetch failure', async () => {
        // Arrange
        const mockAccounts = [
          {
            id: 'ACC-1',
            accountNumber: 'SA-20250101-00001',
            accountName: 'Test Account',
            balance: 1000,
            currency: 'USD',
            createdAt: new Date('2025-01-01'),
            updatedAt: new Date('2025-01-01'),
          },
        ];

        mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);
        mockTransactionModel.findAll.mockRejectedValue(new Error('Transaction query failed'));

        // Act & Assert
        await expect(service.exportAccounts({ includeTransactions: true })).rejects.toThrow(
          'Failed to export accounts: Transaction query failed',
        );
        expect(mockAuditLogService.logFailure).toHaveBeenCalled();
      });

      it('should handle unknown error during export', async () => {
        // Arrange
        mockSavingAccountModel.findAll.mockRejectedValue('Unknown error type');

        // Act & Assert
        await expect(service.exportAccounts({ includeTransactions: false })).rejects.toThrow(
          'Failed to export accounts: Unknown error',
        );
      });
    });

    // ============================================
    // exportAccounts Tests - Batch Processing
    // ============================================

    describe('Batch Processing', () => {
      it('should handle batch processing for large datasets (250 accounts)', async () => {
        // Arrange - Create 250 mock accounts (more than batch size of 100)
        const mockAccounts = Array.from({ length: 250 }, (_, i) => ({
          id: `ACC-${i}`,
          accountNumber: `SA-20250101-${String(i).padStart(5, '0')}`,
          accountName: `Test Account ${i}`,
          balance: 1000 + i * 100,
          currency: 'USD',
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
        }));

        mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);

        // Act
        const result = await service.exportAccounts({ includeTransactions: false });

        // Assert
        expect(result.recordCount).toBe(250);
        expect(fs.existsSync(result.filePath)).toBe(true);
        expect(mockAuditLogService.logSuccess).toHaveBeenCalled();
      });

      it('should process exactly batch size accounts', async () => {
        // Arrange - 100 accounts equals one batch
        const mockAccounts = Array.from({ length: 100 }, (_, i) => ({
          id: `ACC-${i}`,
          accountNumber: `SA-20250101-${String(i).padStart(5, '0')}`,
          accountName: `Test Account ${i}`,
          balance: 1000 + i,
          currency: 'USD',
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
        }));

        mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);

        // Act
        const result = await service.exportAccounts({ includeTransactions: false });

        // Assert
        expect(result.recordCount).toBe(100);
        expect(fs.existsSync(result.filePath)).toBe(true);
      });

      it('should process partial batch at end', async () => {
        // Arrange - 150 accounts = 1 full batch (100) + 1 partial batch (50)
        const mockAccounts = Array.from({ length: 150 }, (_, i) => ({
          id: `ACC-${i}`,
          accountNumber: `SA-20250101-${String(i).padStart(5, '0')}`,
          accountName: `Test Account ${i}`,
          balance: 1000 + i,
          currency: 'USD',
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
        }));

        mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);

        // Act
        const result = await service.exportAccounts({ includeTransactions: false });

        // Assert
        expect(result.recordCount).toBe(150);
        expect(fs.existsSync(result.filePath)).toBe(true);
      });
    });

    // ============================================
    // exportAccounts Tests - Audit Logging
    // ============================================

    describe('Audit Trail Integration', () => {
      it('should log audit trail for successful export without transactions', async () => {
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
          },
        ];

        mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);

        // Act
        await service.exportAccounts({ includeTransactions: false });

        // Assert
        expect(mockAuditLogService.logSuccess).toHaveBeenCalledWith(
          'ACCOUNT_CREATE',
          'EXPORT',
          'BATCH_EXPORT',
          expect.objectContaining({
            accountCount: 1,
            transactionCount: 0,
            includeTransactions: false,
          }),
        );
      });

      it('should log audit trail for successful export with transactions', async () => {
        // Arrange
        const mockAccounts = [
          {
            id: 'ACC-1',
            accountNumber: 'SA-20250101-00001',
            accountName: 'Test Account 1',
            balance: 1500,
            currency: 'USD',
            createdAt: new Date('2025-01-01'),
            updatedAt: new Date('2025-01-01'),
          },
        ];

        const mockTransactions = [
          {
            id: 'TXN-1',
            savingAccountId: 'ACC-1',
            type: TransactionType.deposit,
            amount: 500,
            balanceAfter: 1500,
            description: 'Deposit',
            createdAt: new Date('2025-01-01'),
          },
        ];

        mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);
        mockTransactionModel.findAll.mockResolvedValue(mockTransactions);

        // Act
        await service.exportAccounts({ includeTransactions: true });

        // Assert
        expect(mockAuditLogService.logSuccess).toHaveBeenCalledWith(
          'ACCOUNT_CREATE',
          'EXPORT',
          'BATCH_EXPORT',
          expect.objectContaining({
            accountCount: 1,
            transactionCount: 1,
            includeTransactions: true,
          }),
        );
      });

      it('should log audit trail for failed export', async () => {
        // Arrange
        const errorMessage = 'Database connection failed';
        mockSavingAccountModel.findAll.mockRejectedValue(new Error(errorMessage));

        // Act & Assert
        await expect(service.exportAccounts({ includeTransactions: false })).rejects.toThrow();
        expect(mockAuditLogService.logFailure).toHaveBeenCalledWith(
          'ACCOUNT_CREATE',
          'EXPORT',
          'BATCH_EXPORT',
          errorMessage,
        );
      });
    });
  });

  // ============================================
  // deleteExport Tests
  // ============================================

  describe('deleteExport', () => {
    it('should delete export file successfully', async () => {
      // Arrange
      const fileName = 'test-export.xlsx';
      const filePath = path.join(service.getExportDir(), fileName);
      fs.writeFileSync(filePath, 'test content');

      // Act
      await service.deleteExport(fileName);

      // Assert
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should handle deletion of non-existent file without error', async () => {
      // Act & Assert
      await expect(service.deleteExport('non-existent.xlsx')).resolves.not.toThrow();
    });

    it('should prevent directory traversal attacks', async () => {
      // Act & Assert
      await expect(service.deleteExport('../../../etc/passwd')).rejects.toThrow(
        'Invalid file path',
      );
    });

    it('should prevent path traversal with null byte injection', async () => {
      // Act & Assert
      await expect(service.deleteExport('../../../etc/passwd\x00.xlsx')).rejects.toThrow();
    });

    it('should prevent absolute path traversal', async () => {
      // Act & Assert
      await expect(service.deleteExport('/etc/passwd')).rejects.toThrow(
        'Invalid file path',
      );
    });

    it('should only delete files within export directory', async () => {
      // Arrange
      const fileName = '../../../tmp/malicious.txt';
      
      // Act & Assert
      await expect(service.deleteExport(fileName)).rejects.toThrow(
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
      expect(fs.existsSync(dir)).toBe(true);
    });

    it('should return consistent export directory', () => {
      // Act
      const dir1 = service.getExportDir();
      const dir2 = service.getExportDir();

      // Assert
      expect(dir1).toBe(dir2);
    });

    it('should create export directory if not exists', () => {
      // Arrange - Remove export directory
      const exportDir = service.getExportDir();
      if (fs.existsSync(exportDir)) {
        const files = fs.readdirSync(exportDir);
        files.forEach((file) => {
          fs.unlinkSync(path.join(exportDir, file));
        });
        fs.rmdirSync(exportDir);
      }

      // Act
      const dir = service.getExportDir();

      // Assert
      expect(fs.existsSync(dir)).toBe(true);
    });
  });

  // ============================================
  // Performance Tests
  // ============================================

  describe('Performance characteristics', () => {
    it('should maintain constant memory for large datasets', async () => {
      // Arrange - Simulate large dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `ACC-${i}`,
        accountNumber: `SA-20250101-${String(i).padStart(5, '0')}`,
        accountName: `Test Account ${i}`,
        balance: 1000 + i * 100,
        currency: 'USD',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      }));

      mockSavingAccountModel.findAll.mockResolvedValue(largeDataset);

      // Act
      const startMemory = process.memoryUsage().heapUsed;
      const result = await service.exportAccounts({ includeTransactions: false });
      const endMemory = process.memoryUsage().heapUsed;

      // Assert
      expect(result.recordCount).toBe(1000);
      expect(fs.existsSync(result.filePath)).toBe(true);
      // Memory increase should be reasonable (less than 50MB for 1000 records)
      const memoryIncrease = (endMemory - startMemory) / 1024 / 1024;
      expect(memoryIncrease).toBeLessThan(50);
    });

    it('should process batches efficiently', async () => {
      // Arrange
      const mockAccounts = Array.from({ length: 250 }, (_, i) => ({
        id: `ACC-${i}`,
        accountNumber: `SA-20250101-${String(i).padStart(5, '0')}`,
        accountName: `Test Account ${i}`,
        balance: 1000 + i * 100,
        currency: 'USD',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
      }));

      mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);

      // Act
      const startTime = Date.now();
      await service.exportAccounts({ includeTransactions: false });
      const endTime = Date.now();

      // Assert
      const duration = endTime - startTime;
      // Should complete in reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000);
    });

    it('should handle large transaction counts per account', async () => {
      // Arrange
      const mockAccounts = [
        {
          id: 'ACC-1',
          accountNumber: 'SA-20250101-00001',
          accountName: 'Test Account',
          balance: 10000,
          currency: 'USD',
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
        },
      ];

      // Create 500 transactions for single account
      const mockTransactions = Array.from({ length: 500 }, (_, i) => ({
        id: `TXN-${i}`,
        savingAccountId: 'ACC-1',
        type: i % 2 === 0 ? TransactionType.deposit : TransactionType.withdrawal,
        amount: 100 + i,
        balanceAfter: 10000 - i,
        description: `Transaction ${i}`,
        createdAt: new Date('2025-01-01'),
      }));

      mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);
      mockTransactionModel.findAll.mockResolvedValue(mockTransactions);

      // Act
      const result = await service.exportAccounts({ includeTransactions: true });

      // Assert
      expect(result.recordCount).toBe(1);
      expect(result.transactionCount).toBe(500);
      expect(fs.existsSync(result.filePath)).toBe(true);
    });
  });

  // ============================================
  // Excel File Integrity Tests
  // ============================================

  describe('Excel File Integrity', () => {
    it('should create valid Excel file that can be read back', async () => {
      // This test verifies the Excel file is valid and contains expected data
      // Arrange
      const ExcelJS = require('exceljs');
      const mockAccounts = [
        {
          id: 'ACC-1',
          accountNumber: 'SA-20250101-00001',
          accountName: 'Integrity Test Account',
          balance: 1234.56,
          currency: 'USD',
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
        },
      ];

      mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);

      // Act
      const result = await service.exportAccounts({ includeTransactions: false });

      // Assert - Read back the Excel file
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(result.filePath);
      
      const accountsSheet = workbook.getWorksheet('Accounts');
      expect(accountsSheet).toBeDefined();
      
      // Check header row
      const headerRow = accountsSheet.getRow(1);
      expect(headerRow.getCell(1).value).toBe('Account ID');
      expect(headerRow.getCell(2).value).toBe('Account Number');
      expect(headerRow.getCell(3).value).toBe('Account Name');
      expect(headerRow.getCell(4).value).toBe('Balance');
      expect(headerRow.getCell(5).value).toBe('Currency');
      
      // Check data row
      const dataRow = accountsSheet.getRow(2);
      expect(dataRow.getCell(1).value).toBe('ACC-1');
      expect(dataRow.getCell(2).value).toBe('SA-20250101-00001');
      expect(dataRow.getCell(3).value).toBe('Integrity Test Account');
      expect(dataRow.getCell(4).value).toBe(1234.56);
      expect(dataRow.getCell(5).value).toBe('USD');
    });

    it('should include Transactions sheet when includeTransactions is true', async () => {
      // Arrange
      const ExcelJS = require('exceljs');
      const mockAccounts = [
        {
          id: 'ACC-1',
          accountNumber: 'SA-20250101-00001',
          accountName: 'Test Account',
          balance: 1000,
          currency: 'USD',
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
        },
      ];

      const mockTransactions = [
        {
          id: 'TXN-1',
          savingAccountId: 'ACC-1',
          type: TransactionType.deposit,
          amount: 500,
          balanceAfter: 500,
          description: 'Test deposit',
          createdAt: new Date('2025-01-01'),
        },
      ];

      mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);
      mockTransactionModel.findAll.mockResolvedValue(mockTransactions);

      // Act
      const result = await service.exportAccounts({ includeTransactions: true });

      // Assert
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(result.filePath);
      
      const transactionsSheet = workbook.getWorksheet('Transactions');
      expect(transactionsSheet).toBeDefined();
      
      // Check header row
      const headerRow = transactionsSheet.getRow(1);
      expect(headerRow.getCell(1).value).toBe('Transaction ID');
      expect(headerRow.getCell(2).value).toBe('Account ID');
      expect(headerRow.getCell(3).value).toBe('Type');
      expect(headerRow.getCell(4).value).toBe('Amount');
      expect(headerRow.getCell(5).value).toBe('Balance After');
      expect(headerRow.getCell(6).value).toBe('Description');
      
      // Check data row
      const dataRow = transactionsSheet.getRow(2);
      expect(dataRow.getCell(1).value).toBe('TXN-1');
      expect(dataRow.getCell(2).value).toBe('ACC-1');
      expect(dataRow.getCell(3).value).toBe(TransactionType.deposit);
      expect(dataRow.getCell(4).value).toBe(500);
      expect(dataRow.getCell(5).value).toBe(500);
      expect(dataRow.getCell(6).value).toBe('Test deposit');
    });

    it('should not include Transactions sheet when includeTransactions is false', async () => {
      // Arrange
      const ExcelJS = require('exceljs');
      const mockAccounts = [
        {
          id: 'ACC-1',
          accountNumber: 'SA-20250101-00001',
          accountName: 'Test Account',
          balance: 1000,
          currency: 'USD',
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
        },
      ];

      mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);

      // Act
      const result = await service.exportAccounts({ includeTransactions: false });

      // Assert
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(result.filePath);
      
      const transactionsSheet = workbook.getWorksheet('Transactions');
      expect(transactionsSheet).toBeUndefined();
    });
  });

  // ============================================
  // Interface Contract Tests
  // ============================================

  describe('Interface Contract', () => {
    it('should return ExportResponse with all required fields', async () => {
      // Arrange
      const mockAccounts = [
        {
          id: 'ACC-1',
          accountNumber: 'SA-20250101-00001',
          accountName: 'Test Account',
          balance: 1000,
          currency: 'USD',
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
        },
      ];

      mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);

      // Act
      const result = await service.exportAccounts({});

      // Assert - Verify all required fields per interface contract
      expect(result).toHaveProperty('fileName');
      expect(result).toHaveProperty('filePath');
      expect(result).toHaveProperty('recordCount');
      expect(result).toHaveProperty('transactionCount');
      expect(result).toHaveProperty('generatedAt');
      expect(result).toHaveProperty('fileSize');
      
      expect(typeof result.fileName).toBe('string');
      expect(typeof result.filePath).toBe('string');
      expect(typeof result.recordCount).toBe('number');
      expect(typeof result.transactionCount).toBe('number');
      expect(result.generatedAt).toBeInstanceOf(Date);
      expect(typeof result.fileSize).toBe('number');
    });

    it('should accept ExportRequest with all optional fields', async () => {
      // Arrange
      const mockAccounts = [];
      mockSavingAccountModel.findAll.mockResolvedValue(mockAccounts);

      const request: ExportRequest = {
        accountIds: ['ACC-1', 'ACC-2'],
        includeTransactions: true,
        format: 'xlsx',
      };

      // Act
      const result = await service.exportAccounts(request);

      // Assert
      expect(result).toBeDefined();
      expect(result.recordCount).toBe(0);
    });
  });
});