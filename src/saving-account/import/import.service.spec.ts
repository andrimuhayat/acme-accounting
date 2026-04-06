import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import * as fs from 'fs';
import * as path from 'path';
import { ImportService, DuplicateStrategy, ImportRow, ImportResult } from './import.service';
import { ImportSavingAccountDto, ImportMode } from '../dto/import-saving-account.dto';
import { SavingAccount } from '../../db/models/SavingAccount';
import { Transaction } from '../../db/models/Transaction';
import { AuditLogService } from '../audit/audit-log.service';

describe('ImportService', () => {
  let service: ImportService;
  let mockSavingAccountModel: any;
  let mockTransactionModel: any;
  let mockAuditLogService: any;

  // Test file paths
  const TEST_EXCEL_FILE = path.join(__dirname, 'test-accounts.xlsx');
  const TEST_CSV_FILE = path.join(__dirname, 'test-accounts.csv');
  const TEST_INVALID_FILE = path.join(__dirname, 'test-accounts.txt');
  const TEST_NONEXISTENT_FILE = path.join(__dirname, 'nonexistent.xlsx');

  beforeEach(async () => {
    // Mock models
    mockSavingAccountModel = {
      findOne: jest.fn(),
      create: jest.fn(),
      findAll: jest.fn(),
    };

    mockTransactionModel = {
      create: jest.fn(),
    };

    mockAuditLogService = {
      log: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportService,
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

    service = module.get<ImportService>(ImportService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Clean up test files
    [TEST_EXCEL_FILE, TEST_CSV_FILE].forEach((filePath) => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  });

  // ============================================
  // validateFile Tests - Happy Paths
  // ============================================

  describe('validateFile', () => {
    describe('Basic Validation Scenarios', () => {
      it('should return valid=true for existing .xlsx file', async () => => {
        // Arrange - Create a valid Excel file
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Accounts');
        sheet.addRow(['ACC-001', 'Test Account', 1000, 'USD']);
        await workbook.xlsx.writeFile(TEST_EXCEL_FILE);

        // Act
        const result = await service.validateFile(TEST_EXCEL_FILE);

        // Assert
        expect(result.valid).toBe(true);
        expect(result.format).toBe('xlsx');
      });

      it('should return valid=true for existing .csv file', async () => {
        // Arrange - Create a valid CSV file
        fs.writeFileSync(TEST_CSV_FILE, 'ACC-001,Test Account,1000,USD\n');

        // Act
        const result = await service.validateFile(TEST_CSV_FILE);

        // Assert
        expect(result.valid).toBe(true);
        expect(result.format).toBe('csv');
      });
    });

    // ============================================
    // validateFile Tests - Edge Cases
    // ============================================

    describe('Edge Cases', () => {
      it('should return valid=false for non-existent file', async () => {
        // Act
        const result = await service.validateFile(TEST_NONEXISTENT_FILE);

        // Assert
        expect(result.valid).toBe(false);
        expect(result.format).toBeNull();
      });

      it('should return valid=false for unsupported file extension', async () => {
        // Arrange - Create a text file with wrong extension
        fs.writeFileSync(TEST_INVALID_FILE, 'some content');

        // Act
        const result = await service.validateFile(TEST_INVALID_FILE);

        // Assert
        expect(result.valid).toBe(false);
        expect(result.format).toBeNull();

        // Cleanup
        fs.unlinkSync(TEST_INVALID_FILE);
      });

      it('should return valid=false for file without extension', async () => {
        // Arrange
        const noExtFile = path.join(__dirname, 'filewithoutExtension');
        fs.writeFileSync(noExtFile, 'some content');

        // Act
        const result = await service.validateFile(noExtFile);

        // Assert
        expect(result.valid).toBe(false);
        expect(result.format).toBeNull();

        // Cleanup
        fs.unlinkSync(noExtFile);
      });
    });
  });

  // ============================================
  // parseExcel Tests - Happy Paths
  // ============================================

  describe('parseExcel', () => {
    describe('Basic Parsing Scenarios', () => {
      it('should parse valid Excel file and return ImportRow array', async () => {
        // Arrange - Create a valid Excel file with proper data
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Accounts');
        sheet.columns = [
          { header: 'Account Number', key: 'accountNumber' },
          { header: 'Account Name', key: 'accountName' },
          { header: 'Balance', key: 'balance' },
          { header: 'Currency', key: 'currency' },
        ];
        sheet.addRow(['ACC-001', 'Test Account 1', 1000, 'USD']);
        sheet.addRow(['ACC-002', 'Test Account 2', 2000, 'EUR']);
        await workbook.xlsx.writeFile(TEST_EXCEL_FILE);

        // Act
        const result = await service.parseExcel(TEST_EXCEL_FILE);

        // Assert
        expect(result).toHaveLength(2);
        expect(result[0].accountNumber).toBe('ACC-001');
        expect(result[0].accountName).toBe('Test Account 1');
        expect(result[0].balance).toBe(1000);
        expect(result[0].currency).toBe('USD');
        expect(result[1].accountNumber).toBe('ACC-002');
        expect(result[1].balance).toBe(2000);
        expect(result[1].currency).toBe('EUR');
      });

      it('should use default currency USD when not provided', async () => {
        // Arrange - Excel file without currency column
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Accounts');
        sheet.columns = [
          { header: 'Account Number', key: 'accountNumber' },
          { header: 'Account Name', key: 'accountName' },
          { header: 'Balance', key: 'balance' },
        ];
        sheet.addRow(['ACC-001', 'Test Account', 500]);
        await workbook.xlsx.writeFile(TEST_EXCEL_FILE);

        // Act
        const result = await service.parseExcel(TEST_EXCEL_FILE);

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0].currency).toBe('USD');
      });
    });

    // ============================================
    // parseExcel Tests - Edge Cases
    // ============================================

    describe('Edge Cases', () => {
      it('should return empty array for empty Excel file', async () => {
        // Arrange - Create empty Excel file
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Accounts');
        sheet.columns = [
          { header: 'Account Number', key: 'accountNumber' },
          { header: 'Account Name', key: 'accountName' },
          { header: 'Balance', key: 'balance' },
          { header: 'Currency', key: 'currency' },
        ];
        await workbook.xlsx.writeFile(TEST_EXCEL_FILE);

        // Act
        const result = await service.parseExcel(TEST_EXCEL_FILE);

        // Assert
        expect(result).toHaveLength(0);
      });

      it('should skip rows with missing required fields', async () => {
        // Arrange - Excel with malformed rows
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Accounts');
        sheet.columns = [
          { header: 'Account Number', key: 'accountNumber' },
          { header: 'Account Name', key: 'accountName' },
          { header: 'Balance', key: 'balance' },
          { header: 'Currency', key: 'currency' },
        ];
        sheet.addRow(['ACC-001', 'Valid Account', 1000, 'USD']);
        sheet.addRow([null, 'Missing Account Number', 2000, 'USD']); // Invalid - missing accountNumber
        sheet.addRow(['ACC-003', 'Valid Account 2', 3000, 'USD']);
        await workbook.xlsx.writeFile(TEST_EXCEL_FILE);

        // Act
        const result = await service.parseExcel(TEST_EXCEL_FILE);

        // Assert - Should only return valid rows
        expect(result).toHaveLength(2);
        expect(result[0].accountNumber).toBe('ACC-001');
        expect(result[1].accountNumber).toBe('ACC-003');
      });

      it('should skip rows with invalid balance values', async () => {
        // Arrange - Excel with invalid balance
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Accounts');
        sheet.columns = [
          { header: 'Account Number', key: 'accountNumber' },
          { header: 'Account Name', key: 'accountName' },
          { header: 'Balance', key: 'balance' },
          { header: 'Currency', key: 'currency' },
        ];
        sheet.addRow(['ACC-001', 'Valid Account', 1000, 'USD']);
        sheet.addRow(['ACC-002', 'Invalid Balance', 'not-a-number', 'USD']);
        sheet.addRow(['ACC-003', 'Another Valid', 3000, 'USD']);
        await workbook.xlsx.writeFile(TEST_EXCEL_FILE);

        // Act
        const result = await service.parseExcel(TEST_EXCEL_FILE);

        // Assert - Should skip invalid balance row
        expect(result).toHaveLength(2);
      });
    });
  });

  // ============================================
  // processBatch Tests - Happy Paths
  // ============================================

  describe('processBatch', () => {
    describe('Basic Batch Processing', () => {
      it('should create new accounts when no duplicates exist', async () => {
        // Arrange
        const rows: ImportRow[] = [
          { accountNumber: 'ACC-001', accountName: 'New Account 1', balance: 1000 },
          { accountNumber: 'ACC-002', accountName: 'New Account 2', balance: 2000 },
        ];
        mockSavingAccountModel.findOne.mockResolvedValue(null);
        mockSavingAccountModel.create.mockResolvedValue({
          id: 'generated-id',
          accountNumber: 'ACC-001',
          accountName: 'New Account 1',
          balance: 1000,
          currency: 'USD',
        });

        // Act
        const result = await service.processBatch(rows, DuplicateStrategy.SKIP);

        // Assert
        expect(result.imported).toBe(2);
        expect(result.failed).toBe(0);
        expect(result.errors).toHaveLength(0);
        expect(mockSavingAccountModel.create).toHaveBeenCalledTimes(2);
      });
    });

    // ============================================
    // processBatch Tests - Duplicate Handling
    // ============================================

    describe('Duplicate Handling', () => {
      const existingAccount = {
        id: 'existing-id',
        accountNumber: 'ACC-001',
        accountName: 'Existing Account',
        balance: 500,
        currency: 'USD',
      };

      it('should skip existing accounts when strategy is SKIP', async () => {
        // Arrange
        const rows: ImportRow[] = [
          { accountNumber: 'ACC-001', accountName: 'Updated Name', balance: 1500 },
        ];
        mockSavingAccountModel.findOne.mockResolvedValue(existingAccount);

        // Act
        const result = await service.processBatch(rows, DuplicateStrategy.SKIP);

        // Assert
        expect(result.imported).toBe(0);
        expect(result.failed).toBe(0);
        expect(result.errors).toHaveLength(0);
        expect(mockSavingAccountModel.create).not.toHaveBeenCalled();
      });

      it('should upsert existing accounts when strategy is UPSERT', async () => {
        // Arrange
        const rows: ImportRow[] = [
          { accountNumber: 'ACC-001', accountName: 'Updated Name', balance: 1500 },
        ];
        mockSavingAccountModel.findOne.mockResolvedValue(existingAccount);
        mockSavingAccountModel.create.mockResolvedValue({
          ...existingAccount,
          balance: 1500,
          accountName: 'Updated Name',
        });

        // Act
        const result = await service.processBatch(rows, DuplicateStrategy.UPSERT);

        // Assert
        expect(result.imported).toBe(1);
        expect(result.failed).toBe(0);
        expect(mockSavingAccountModel.create).toHaveBeenCalled();
      });

      it('should add to errors when strategy is ERROR and duplicate exists', async () => {
        // Arrange
        const rows: ImportRow[] = [
          { accountNumber: 'ACC-001', accountName: 'Duplicate Account', balance: 1500 },
        ];
        mockSavingAccountModel.findOne.mockResolvedValue(existingAccount);

        // Act
        const result = await service.processBatch(rows, DuplicateStrategy.ERROR);

        // Assert
        expect(result.imported).toBe(0);
        expect(result.failed).toBe(1);
        expect(result.errors).toContain('Duplicate account found: ACC-001');
      });
    });

    // ============================================
    // processBatch Tests - Batch Size
    // ============================================

    describe('Batch Processing Size', () => {
      it('should process accounts in batches of 100', async () => {
        // Arrange - Create 150 accounts (should require 2 batches)
        const rows: ImportRow[] = Array.from({ length: 150 }, (_, i) => ({
          accountNumber: `ACC-${String(i).padStart(3, '0')}`,
          accountName: `Account ${i}`,
          balance: 1000 * (i + 1),
        }));
        mockSavingAccountModel.findOne.mockResolvedValue(null);
        mockSavingAccountModel.create.mockImplementation((data) =>
          Promise.resolve({ id: `id-${data.accountNumber}`, ...data }),
        );

        // Act
        const result = await service.processBatch(rows, DuplicateStrategy.SKIP);

        // Assert
        expect(result.imported).toBe(150);
        expect(result.failed).toBe(0);
        // Verify batches were processed (calls should be batched)
        expect(mockSavingAccountModel.create).toHaveBeenCalledTimes(150);
      });

      it('should handle exactly 100 accounts in single batch', async () => {
        // Arrange - Create exactly 100 accounts
        const rows: ImportRow[] = Array.from({ length: 100 }, (_, i) => ({
          accountNumber: `ACC-${String(i).padStart(3, '0')}`,
          accountName: `Account ${i}`,
          balance: 1000,
        }));
        mockSavingAccountModel.findOne.mockResolvedValue(null);
        mockSavingAccountModel.create.mockImplementation((data) =>
          Promise.resolve({ id: `id-${data.accountNumber}`, ...data }),
        );

        // Act
        const result = await service.processBatch(rows, DuplicateStrategy.SKIP);

        // Assert
        expect(result.imported).toBe(100);
        expect(result.failed).toBe(0);
      });
    });

    // ============================================
    // processBatch Tests - Error Handling
    // ============================================

    describe('Error Handling', () => {
      it('should continue processing when one row fails', async () => {
        // Arrange
        const rows: ImportRow[] = [
          { accountNumber: 'ACC-001', accountName: 'Valid Account', balance: 1000 },
          { accountNumber: 'ACC-002', accountName: 'Invalid Account', balance: -500 }, // Might fail validation
          { accountNumber: 'ACC-003', accountName: 'Another Valid', balance: 3000 },
        ];
        mockSavingAccountModel.findOne
          .mockResolvedValueOnce(null)
          .mockRejectedValueOnce(new Error('Database error'))
          .mockResolvedValueOnce(null);
        mockSavingAccountModel.create.mockImplementation((data) => {
          if (data.accountNumber === 'ACC-002') {
            return Promise.reject(new Error('Database error'));
          }
          return Promise.resolve({ id: `id-${data.accountNumber}`, ...data });
        });

        // Act
        const result = await service.processBatch(rows, DuplicateStrategy.SKIP);

        // Assert - Should still import valid accounts
        expect(result.imported).toBe(2);
        expect(result.failed).toBe(1);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should log each operation via AuditLogService', async () => {
        // Arrange
        const rows: ImportRow[] = [
          { accountNumber: 'ACC-001', accountName: 'Test Account', balance: 1000 },
        ];
        mockSavingAccountModel.findOne.mockResolvedValue(null);
        mockSavingAccountModel.create.mockResolvedValue({
          id: 'new-id',
          accountNumber: 'ACC-001',
          accountName: 'Test Account',
          balance: 1000,
        });

        // Act
        await service.processBatch(rows, DuplicateStrategy.SKIP);

        // Assert
        expect(mockAuditLogService.log).toHaveBeenCalled();
      });
    });
  });

  // ============================================
  // importFromLocalFile Tests - Happy Paths
  // ============================================

  describe('importFromLocalFile', () => {
    describe('Basic Import Scenarios', () => {
      it('should import accounts from valid Excel file successfully', async () => {
        // Arrange - Create valid Excel file
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Accounts');
        sheet.columns = [
          { header: 'Account Number', key: 'accountNumber' },
          { header: 'Account Name', key: 'accountName' },
          { header: 'Balance', key: 'balance' },
          { header: 'Currency', key: 'currency' },
        ];
        sheet.addRow(['ACC-001', 'Test Account 1', 1000, 'USD']);
        sheet.addRow(['ACC-002', 'Test Account 2', 2000, 'EUR']);
        await workbook.xlsx.writeFile(TEST_EXCEL_FILE);

        const dto: ImportSavingAccountDto = {
          mode: ImportMode.LOCAL,
          local_path: TEST_EXCEL_FILE,
          duplicateStrategy: DuplicateStrategy.SKIP,
        };

        mockSavingAccountModel.findOne.mockResolvedValue(null);
        mockSavingAccountModel.create.mockImplementation((data) =>
          Promise.resolve({ id: `id-${data.accountNumber}`, ...data }),
        );

        // Act
        const result = await service.importFromLocalFile(dto);

        // Assert
        expect(result.imported).toBe(2);
        expect(result.failed).toBe(0);
        expect(result.errors).toHaveLength(0);
      });

      it('should use default SKIP strategy when duplicateStrategy not provided', async () => {
        // Arrange
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Accounts');
        sheet.columns = [
          { header: 'Account Number', key: 'accountNumber' },
          { header: 'Account Name', key: 'accountName' },
          { header: 'Balance', key: 'balance' },
          { header: 'Currency', key: 'currency' },
        ];
        sheet.addRow(['ACC-001', 'Test Account', 1000, 'USD']);
        await workbook.xlsx.writeFile(TEST_EXCEL_FILE);

        const dto: ImportSavingAccountDto = {
          mode: ImportMode.LOCAL,
          local_path: TEST_EXCEL_FILE,
        };

        mockSavingAccountModel.findOne.mockResolvedValue({
          id: 'existing-id',
          accountNumber: 'ACC-001',
          accountName: 'Existing',
          balance: 500,
        });

        // Act
        const result = await service.importFromLocalFile(dto);

        // Assert
        expect(result.imported).toBe(0); // Should skip
        expect(result.failed).toBe(0);
      });
    });

    // ============================================
    // importFromLocalFile Tests - Edge Cases
    // ============================================

    describe('Edge Cases', () => {
      it('should return zero counts for empty file', async () => {
        // Arrange - Create empty Excel file
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Accounts');
        sheet.columns = [
          { header: 'Account Number', key: 'accountNumber' },
          { header: 'Account Name', key: 'accountName' },
          { header: 'Balance', key: 'balance' },
          { header: 'Currency', key: 'currency' },
        ];
        await workbook.xlsx.writeFile(TEST_EXCEL_FILE);

        const dto: ImportSavingAccountDto = {
          mode: ImportMode.LOCAL,
          local_path: TEST_EXCEL_FILE,
        };

        // Act
        const result = await service.importFromLocalFile(dto);

        // Assert
        expect(result.imported).toBe(0);
        expect(result.failed).toBe(0);
        expect(result.errors).toHaveLength(0);
      });

      it('should throw FileNotFoundException for non-existent file', async () => {
        // Arrange
        const dto: ImportSavingAccountDto = {
          mode: ImportMode.LOCAL,
          local_path: '/non/existent/path/file.xlsx',
        };

        // Act & Assert
        await expect(service.importFromLocalFile(dto)).rejects.toThrow();
      });

      it('should throw BadRequestException for invalid file extension', async () => {
        // Arrange - Create file with wrong extension
        fs.writeFileSync(TEST_INVALID_FILE, 'some content');

        const dto: ImportSavingAccountDto = {
          mode: ImportMode.LOCAL,
          local_path: TEST_INVALID_FILE,
        };

        // Act & Assert
        await expect(service.importFromLocalFile(dto)).rejects.toThrow();

        // Cleanup
        fs.unlinkSync(TEST_INVALID_FILE);
      });
    });

    // ============================================
    // importFromLocalFile Tests - Audit Logging
    // ============================================

    describe('Audit Trail Integration', () => {
      it('should log IMPORT action on successful import', async () => {
        // Arrange
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Accounts');
        sheet.columns = [
          { header: 'Account Number', key: 'accountNumber' },
          { header: 'Account Name', key: 'accountName' },
          { header: 'Balance', key: 'balance' },
          { header: 'Currency', key: 'currency' },
        ];
        sheet.addRow(['ACC-001', 'Test Account', 1000, 'USD']);
        await workbook.xlsx.writeFile(TEST_EXCEL_FILE);

        const dto: ImportSavingAccountDto = {
          mode: ImportMode.LOCAL,
          local_path: TEST_EXCEL_FILE,
        };

        mockSavingAccountModel.findOne.mockResolvedValue(null);
        mockSavingAccountModel.create.mockResolvedValue({
          id: 'new-id',
          accountNumber: 'ACC-001',
        });

        // Act
        await service.importFromLocalFile(dto);

        // Assert
        expect(mockAuditLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'IMPORT',
            entityType: 'SavingAccount',
          }),
        );
      });

      it('should log IMPORT action with FAILED entityId on error', async () => {
        // Arrange
        const dto: ImportSavingAccountDto = {
          mode: ImportMode.LOCAL,
          local_path: '/non/existent/file.xlsx',
        };

        // Act & Assert
        await expect(service.importFromLocalFile(dto)).rejects.toThrow();
        expect(mockAuditLogService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'IMPORT',
            entityType: 'SavingAccount',
            entityId: 'FAILED',
          }),
        );
      });
    });

    // ============================================
    // importFromLocalFile Tests - Duplicate Strategies
    // ============================================

    describe('Duplicate Strategies', () => {
      const existingAccount = {
        id: 'existing-id',
        accountNumber: 'ACC-001',
        accountName: 'Existing Account',
        balance: 500,
        currency: 'USD',
      };

      it('should skip duplicates with SKIP strategy', async () => {
        // Arrange
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Accounts');
        sheet.columns = [
          { header: 'Account Number', key: 'accountNumber' },
          { header: 'Account Name', key: 'accountName' },
          { header: 'Balance', key: 'balance' },
          { header: 'Currency', key: 'currency' },
        ];
        sheet.addRow(['ACC-001', 'Updated Name', 1500, 'USD']);
        await workbook.xlsx.writeFile(TEST_EXCEL_FILE);

        const dto: ImportSavingAccountDto = {
          mode: ImportMode.LOCAL,
          local_path: TEST_EXCEL_FILE,
          duplicateStrategy: DuplicateStrategy.SKIP,
        };

        mockSavingAccountModel.findOne.mockResolvedValue(existingAccount);

        // Act
        const result = await service.importFromLocalFile(dto);

        // Assert
        expect(result.imported).toBe(0);
        expect(mockSavingAccountModel.create).not.toHaveBeenCalled();
      });

      it('should upsert duplicates with UPSERT strategy', async () => {
        // Arrange
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Accounts');
        sheet.columns = [
          { header: 'Account Number', key: 'accountNumber' },
          { header: 'Account Name', key: 'accountName' },
          { header: 'Balance', key: 'balance' },
          { header: 'Currency', key: 'currency' },
        ];
        sheet.addRow(['ACC-001', 'Updated Name', 1500, 'USD']);
        await workbook.xlsx.writeFile(TEST_EXCEL_FILE);

        const dto: ImportSavingAccountDto = {
          mode: ImportMode.LOCAL,
          local_path: TEST_EXCEL_FILE,
          duplicateStrategy: DuplicateStrategy.UPSERT,
        };

        mockSavingAccountModel.findOne.mockResolvedValue(existingAccount);
        mockSavingAccountModel.create.mockResolvedValue({
          ...existingAccount,
          balance: 1500,
        });

        // Act
        const result = await service.importFromLocalFile(dto);

        // Assert
        expect(result.imported).toBe(1);
        expect(mockSavingAccountModel.create).toHaveBeenCalled();
      });

      it('should error on duplicates with ERROR strategy', async () => {
        // Arrange
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Accounts');
        sheet.columns = [
          { header: 'Account Number', key: 'accountNumber' },
          { header: 'Account Name', key: 'accountName' },
          { header: 'Balance', key: 'balance' },
          { header: 'Currency', key: 'currency' },
        ];
        sheet.addRow(['ACC-001', 'Duplicate Account', 1500, 'USD']);
        await workbook.xlsx.writeFile(TEST_EXCEL_FILE);

        const dto: ImportSavingAccountDto = {
          mode: ImportMode.LOCAL,
          local_path: TEST_EXCEL_FILE,
          duplicateStrategy: DuplicateStrategy.ERROR,
        };

        mockSavingAccountModel.findOne.mockResolvedValue(existingAccount);

        // Act
        const result = await service.importFromLocalFile(dto);

        // Assert
        expect(result.imported).toBe(0);
        expect(result.failed).toBe(1);
        expect(result.errors).toContain('Duplicate account found: ACC-001');
      });
    });

    // ============================================
    // Interface Contract Tests
    // ============================================

    describe('Interface Contract', () => {
      it('should return ImportResult with all required fields', async () => {
        // Arrange
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Accounts');
        sheet.columns = [
          { header: 'Account Number', key: 'accountNumber' },
          { header: 'Account Name', key: 'accountName' },
          { header: 'Balance', key: 'balance' },
          { header: 'Currency', key: 'currency' },
        ];
        sheet.addRow(['ACC-001', 'Test Account', 1000, 'USD']);
        await workbook.xlsx.writeFile(TEST_EXCEL_FILE);

        const dto: ImportSavingAccountDto = {
          mode: ImportMode.LOCAL,
          local_path: TEST_EXCEL_FILE,
        };

        mockSavingAccountModel.findOne.mockResolvedValue(null);
        mockSavingAccountModel.create.mockResolvedValue({
          id: 'new-id',
          accountNumber: 'ACC-001',
        });

        // Act
        const result = await service.importFromLocalFile(dto);

        // Assert - Verify all required fields per interface contract:
        // ImportResult { imported: number, failed: number, errors: string[] }
        expect(result).toHaveProperty('imported');
        expect(result).toHaveProperty('failed');
        expect(result).toHaveProperty('errors');

        expect(typeof result.imported).toBe('number');
        expect(typeof result.failed).toBe('number');
        expect(Array.isArray(result.errors)).toBe(true);
      });

      it('should accept ImportSavingAccountDto with all fields', async () => {
        // Arrange
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Accounts');
        sheet.columns = [
          { header: 'Account Number', key: 'accountNumber' },
          { header: 'Account Name', key: 'accountName' },
          { header: 'Balance', key: 'balance' },
          { header: 'Currency', key: 'currency' },
        ];
        sheet.addRow(['ACC-001', 'Test Account', 1000, 'USD']);
        await workbook.xlsx.writeFile(TEST_EXCEL_FILE);

        const dto: ImportSavingAccountDto = {
          mode: ImportMode.LOCAL,
          local_path: TEST_EXCEL_FILE,
          duplicateStrategy: DuplicateStrategy.UPSERT,
        };

        mockSavingAccountModel.findOne.mockResolvedValue(null);
        mockSavingAccountModel.create.mockResolvedValue({
          id: 'new-id',
        });

        // Act
        const result = await service.importFromLocalFile(dto);

        // Assert
        expect(result.imported).toBe(1);
      });

      it('should handle large files with batch processing', async () => {
        // Arrange - Create large Excel file with 250 accounts
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Accounts');
        sheet.columns = [
          { header: 'Account Number', key: 'accountNumber' },
          { header: 'Account Name', key: 'accountName' },
          { header: 'Balance', key: 'balance' },
          { header: 'Currency', key: 'currency' },
        ];
        for (let i = 0; i < 250; i++) {
          sheet.addRow([`ACC-${String(i).padStart(3, '0')}`, `Account ${i}`, 1000, 'USD']);
        }
        await workbook.xlsx.writeFile(TEST_EXCEL_FILE);

        const dto: ImportSavingAccountDto = {
          mode: ImportMode.LOCAL,
          local_path: TEST_EXCEL_FILE,
        };

        mockSavingAccountModel.findOne.mockResolvedValue(null);
        mockSavingAccountModel.create.mockImplementation((data) =>
          Promise.resolve({ id: `id-${data.accountNumber}`, ...data }),
        );

        // Act
        const result = await service.importFromLocalFile(dto);

        // Assert
        expect(result.imported).toBe(250);
        expect(result.failed).toBe(0);
      });
    });
  });
});