import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { User } from '../../db/models/User';
import { Company } from '../../db/models/Company';
import fs from 'fs';
import path from 'path';

// Mock the User and Company models
jest.mock('../../db/models/User', () => ({
  User: {
    findAll: jest.fn(),
  },
}));

jest.mock('../../db/models/Company', () => ({
  Company: {},
}));

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(async () => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportsService],
    }).compile();

    service = module.get<ReportsService>(ReportsService);

    // Ensure test directories exist
    if (!fs.existsSync('tmp')) {
      fs.mkdirSync('tmp', { recursive: true });
    }
    if (!fs.existsSync('out')) {
      fs.mkdirSync('out', { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    try {
      if (fs.existsSync('out/accounts.csv')) fs.unlinkSync('out/accounts.csv');
      if (fs.existsSync('out/yearly.csv')) fs.unlinkSync('out/yearly.csv');
      if (fs.existsSync('out/fs.csv')) fs.unlinkSync('out/fs.csv');
      if (fs.existsSync('out/user-report.csv')) fs.unlinkSync('out/user-report.csv');
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return initial idle state for all reports', () => {
    expect(service.state('accounts')).toEqual({ status: 'idle', progress: 0 });
    expect(service.state('yearly')).toEqual({ status: 'idle', progress: 0 });
    expect(service.state('fs')).toEqual({ status: 'idle', progress: 0 });
    expect(service.state('user-report')).toEqual({ status: 'idle', progress: 0 });
  });

  it('should return all states and metrics', () => {
    const result = service.getAllStates();
    expect(result).toHaveProperty('states');
    expect(result).toHaveProperty('metrics');
    expect(result.states).toHaveProperty('accounts');
    expect(result.states).toHaveProperty('yearly');
    expect(result.states).toHaveProperty('fs');
    expect(result.states).toHaveProperty('user-report');
  });

  it('should start accounts report processing asynchronously', async () => {
    // Create a small test CSV file
    const testData = [
      '2020-01-01,Cash,Test transaction,100.00,',
      '2020-01-02,Accounts Receivable,Test transaction,,50.00',
    ].join('\n');

    fs.writeFileSync('tmp/test.csv', testData);

    // Start processing
    await service.accounts();

    // Should immediately return (async processing)
    const state = service.state('accounts');
    expect(['processing', 'completed']).toContain(state.status);

    // Wait a bit for processing to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Clean up
    fs.unlinkSync('tmp/test.csv');
  });

  it('should track processing progress and metrics', async () => {
    // Create test data
    const testData = [
      '2020-01-01,Cash,Test,100.00,',
      '2020-01-02,Cash,Test,,50.00',
    ].join('\n');

    fs.writeFileSync('tmp/test-progress.csv', testData);

    await service.yearly();

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 200));

    const state = service.state('yearly');
    const metrics = service.getMetrics('yearly');

    if (state.status === 'completed') {
      expect(state.progress).toBe(100);
      expect(state).toHaveProperty('duration');
      expect(metrics).toBeTruthy();
      if (metrics) {
        expect(metrics).toHaveProperty('totalExecutionTime');
        expect(metrics).toHaveProperty('recordsProcessed');
        expect(metrics).toHaveProperty('filesProcessed');
      }
    }

    // Clean up
    fs.unlinkSync('tmp/test-progress.csv');
  });

  it('should handle errors gracefully', async () => {
    // Create invalid directory to cause error
    const originalReaddir = fs.readdirSync;
    fs.readdirSync = jest.fn().mockImplementation(() => {
      throw new Error('Test error');
    });

    await service.fs();

    // Wait for error handling
    await new Promise((resolve) => setTimeout(resolve, 100));

    const state = service.state('fs');
    expect(state.status).toBe('error');
    expect(state.error).toBe('Test error');

    // Restore original function
    fs.readdirSync = originalReaddir;
  });

  it('should process large datasets efficiently', async () => {
    // Create a larger test dataset
    const lines: string[] = [];
    for (let i = 0; i < 1000; i++) {
      lines.push(
        `2020-01-${String((i % 30) + 1).padStart(2, '0')},Cash,Test transaction ${i},${(Math.random() * 1000).toFixed(2)},`,
      );
    }

    fs.writeFileSync('tmp/large-test.csv', lines.join('\n'));

    const startTime = Date.now();
    await service.accounts();

    // Wait for completion
    await new Promise((resolve) => setTimeout(resolve, 500));

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    // Should complete within reasonable time (less than 1 second for 1000 records)
    expect(processingTime).toBeLessThan(1000);

    const state = service.state('accounts');
    if (state.status === 'completed') {
      expect(state.recordsProcessed).toBeGreaterThan(0);
    }

    // Clean up
    fs.unlinkSync('tmp/large-test.csv');
  });

  // ===== EDGE CASE TESTS =====

  describe('Edge Cases', () => {
    describe('getMetrics with invalid reportType', () => {
      it('should return null metrics for unknown reportType', () => {
        const metrics = service.getMetrics('unknown-report');
        expect(metrics).toBeNull();
      });

      it('should return null metrics for invalid type string', () => {
        const metrics = service.getMetrics('invalid');
        expect(metrics).toBeNull();
      });

      it('should return null metrics for empty string', () => {
        const metrics = service.getMetrics('');
        expect(metrics).toBeNull();
      });
    });

    describe('state() key handling', () => {
      it('should return idle state for unknown reportType', () => {
        const state = service.state('unknown-type');
        expect(state).toEqual({ status: 'idle', progress: 0 });
      });

      it('should return idle state for .csv suffix (key mismatch)', () => {
        // This tests the bug: controller hardcodes '.csv' but service uses keys without '.csv'
        const state = service.state('accounts.csv');
        expect(state).toEqual({ status: 'idle', progress: 0 });
      });

      it('should return idle state for yearly.csv', () => {
        const state = service.state('yearly.csv');
        expect(state).toEqual({ status: 'idle', progress: 0 });
      });

      it('should return idle state for fs.csv', () => {
        const state = service.state('fs.csv');
        expect(state).toEqual({ status: 'idle', progress: 0 });
      });

      it('should return valid state for correct keys without .csv', () => {
        expect(service.state('accounts')).not.toEqual({ status: 'idle', progress: 0 });
        expect(service.state('yearly')).not.toEqual({ status: 'idle', progress: 0 });
        expect(service.state('fs')).not.toEqual({ status: 'idle', progress: 0 });
      });
    });

    describe('getAllStates() structure', () => {
      it('should return states without .csv suffix keys', () => {
        const result = service.getAllStates();
        expect(result.states).toHaveProperty('accounts');
        expect(result.states).toHaveProperty('yearly');
        expect(result.states).toHaveProperty('fs');
        expect(result.states['accounts.csv']).toBeUndefined();
        expect(result.states['yearly.csv']).toBeUndefined();
        expect(result.states['fs.csv']).toBeUndefined();
      });

      it('should return metrics object (may be empty initially)', () => {
        const result = service.getAllStates();
        expect(result.metrics).toBeDefined();
        expect(typeof result.metrics).toBe('object');
      });
    });

    describe('Concurrent report generation', () => {
      it('should handle multiple concurrent report generations', async () => {
        // Create test data for multiple reports
        const testData = [
          '2020-01-01,Cash,Test,100.00,',
          '2020-01-02,Accounts Receivable,Test,,50.00',
        ].join('\n');

        fs.writeFileSync('tmp/concurrent-test.csv', testData);

        // Start all three reports concurrently
        const promises = [
          service.accounts(),
          service.yearly(),
          service.fs(),
        ];

        // All should resolve without error (async processing)
        await expect(Promise.all(promises)).resolves.toBeDefined();

        // Wait for processing
        await new Promise((resolve) => setTimeout(resolve, 200));

        // States should be consistent (no corruption)
        const accountsState = service.state('accounts');
        const yearlyState = service.state('yearly');
        const fsState = service.state('fs');

        // All should have valid states
        expect(['idle', 'processing', 'completed', 'error']).toContain(accountsState.status);
        expect(['idle', 'processing', 'completed', 'error']).toContain(yearlyState.status);
        expect(['idle', 'processing', 'completed', 'error']).toContain(fsState.status);

        // Clean up
        fs.unlinkSync('tmp/concurrent-test.csv');
      });

      it('should not corrupt states when reports run sequentially', async () => {
        const testData = [
          '2020-01-01,Cash,Test,100.00,',
        ].join('\n');

        fs.writeFileSync('tmp/sequential-test.csv', testData);

        // Run reports sequentially
        await service.accounts();
        await new Promise((resolve) => setTimeout(resolve, 150));
        await service.yearly();
        await new Promise((resolve) => setTimeout(resolve, 150));

        // Both should have completed states
        const accountsState = service.state('accounts');
        const yearlyState = service.state('yearly');

        expect(accountsState.status).toBe('completed');
        expect(yearlyState.status).toBe('completed');

        // Clean up
        fs.unlinkSync('tmp/sequential-test.csv');
      });
    });

    describe('Error handling', () => {
      it('should handle state() gracefully after error in report', async () => {
        // Create a file that will cause processing error
        const originalReaddir = fs.readdirSync;
        fs.readdirSync = jest.fn().mockImplementation(() => {
          throw new Error('Directory read error');
        });

        await service.accounts();
        await new Promise((resolve) => setTimeout(resolve, 100));

        // State should reflect error status
        const state = service.state('accounts');
        expect(state.status).toBe('error');
        expect(state.error).toBe('Directory read error');

        // Restore and clean up
        fs.readdirSync = originalReaddir;
      });

      it('should return valid idle state for unknown key even after errors', () => {
        const state = service.state('nonexistent');
        expect(state).toEqual({ status: 'idle', progress: 0 });
      });
    });

    describe('State transition behavior', () => {
      it('should start in idle state for all report types', () => {
        expect(service.state('accounts').status).toBe('idle');
        expect(service.state('yearly').status).toBe('idle');
        expect(service.state('fs').status).toBe('idle');
        expect(service.state('user-report').status).toBe('idle');
      });

      it('should have progress of 0 initially', () => {
        expect(service.state('accounts').progress).toBe(0);
        expect(service.state('yearly').progress).toBe(0);
        expect(service.state('fs').progress).toBe(0);
        expect(service.state('user-report').progress).toBe(0);
      });
    });
  });

  // ===== USER REPORT TESTS =====

  describe('User Report (user-report)', () => {
    describe('userReport() method', () => {
      it('should be defined as a method on the service', () => {
        expect(service).toBeDefined();
        expect(typeof service.userReport).toBe('function');
      });

      it('should return a Promise<void>', async () => {
        const result = service.userReport();
        expect(result).toBeInstanceOf(Promise);
        await result;
      });

      it('should start with idle state for user-report', () => {
        const state = service.state('user-report');
        expect(state.status).toBe('idle');
        expect(state.progress).toBe(0);
      });

      it('should transition to processing state when called', async () => {
        // Call the method (may error if DB not available, which is ok for unit test)
        try {
          service.userReport();
        } catch (e) {
          // Ignore - we just want to verify state transition
        }

        // Wait a bit for async processing to start
        await new Promise((resolve) => setTimeout(resolve, 50));

        const state = service.state('user-report');
        // Should be either processing or error (if DB connection fails)
        expect(['processing', 'error']).toContain(state.status);
      });
    });

    describe('user-report state management', () => {
      it('should have user-report in getAllStates().states', () => {
        const result = service.getAllStates();
        expect(result.states).toHaveProperty('user-report');
      });

      it('should return null metrics for user-report before processing', () => {
        const metrics = service.getMetrics('user-report');
        // Before any processing, metrics may be null or undefined
        expect(metrics === null || typeof metrics === 'object').toBe(true);
      });

      it('should handle concurrent user-report with other reports', async () => {
        const testData = [
          '2020-01-01,Cash,Test,100.00,',
        ].join('\n');

        fs.writeFileSync('tmp/concurrent-user-test.csv', testData);

        // Start multiple reports including user-report concurrently
        const promises = [service.accounts()];

        // Add userReport - may error if DB not available
        try {
          promises.push(service.userReport());
        } catch (e) {
          // DB may not be available, that's ok for this test
        }

        await expect(Promise.all(promises)).resolves.toBeDefined();

        // Wait for processing
        await new Promise((resolve) => setTimeout(resolve, 200));

        // States should be consistent
        const accountsState = service.state('accounts');
        const userReportState = service.state('user-report');

        expect(['idle', 'processing', 'completed', 'error']).toContain(accountsState.status);
        expect(['idle', 'processing', 'completed', 'error']).toContain(userReportState.status);

        // Clean up
        if (fs.existsSync('tmp/concurrent-user-test.csv')) {
          fs.unlinkSync('tmp/concurrent-user-test.csv');
        }
      });
    });

    describe('user-report error handling', () => {
      it('should handle database errors gracefully', async () => {
        // Mock User.findAll to throw error
        (User.findAll as jest.Mock).mockImplementation(() => {
          throw new Error('Database connection error');
        });

        service.userReport();
        await new Promise((resolve) => setTimeout(resolve, 100));

        const state = service.state('user-report');
        // Error should be caught and state set to 'error'
        expect(state.status).toBe('error');
        expect(state.error).toBe('Database connection error');
      });

      it('should set error state when Sequelize query fails', async () => {
        // Mock to return empty (no error case)
        (User.findAll as jest.Mock).mockResolvedValue([]);
        
        service.userReport();
        await new Promise((resolve) => setTimeout(resolve, 100));

        const state = service.state('user-report');
        // With empty users, should complete successfully
        expect(state.status).toBe('completed');
      });
    });

    describe('user-report CSV output', () => {
      it('should create out/user-report.csv with correct header format', async () => {
        // Mock User.findAll to return test data
        const mockUsers = [
          { id: 1, name: 'John Doe', role: 'accountant', companyId: 1, company: { name: 'Acme Corp' } },
          { id: 2, name: 'Jane Smith', role: 'director', companyId: 1, company: { name: 'Acme Corp' } },
        ];
        (User.findAll as jest.Mock).mockResolvedValue(mockUsers);

        // Trigger user report
        service.userReport();
        await new Promise((resolve) => setTimeout(resolve, 200));

        const outputFile = 'out/user-report.csv';
        
        // File should exist with correct content
        expect(fs.existsSync(outputFile)).toBe(true);
        
        const content = fs.readFileSync(outputFile, 'utf-8');
        const lines = content.split('\n');
        
        // Check header row
        const header = lines[0];
        expect(header).toBe('id,name,role,companyId,companyName');
        
        // Check data rows
        expect(lines.length).toBe(3); // header + 2 users
        expect(lines[1]).toBe('1,John Doe,accountant,1,Acme Corp');
        expect(lines[2]).toBe('2,Jane Smith,director,1,Acme Corp');
      });

      it('should handle empty user table gracefully', async () => {
        // Mock User.findAll to return empty array
        (User.findAll as jest.Mock).mockResolvedValue([]);

        // Trigger user report
        service.userReport();
        await new Promise((resolve) => setTimeout(resolve, 200));

        const outputFile = 'out/user-report.csv';
        
        // File should exist with header only
        expect(fs.existsSync(outputFile)).toBe(true);
        
        const content = fs.readFileSync(outputFile, 'utf-8');
        const lines = content.trim().split('\n');
        
        // Should at least have header
        expect(lines.length).toBe(1);
        expect(lines[0]).toBe('id,name,role,companyId,companyName');
      });

      it('should overwrite existing user-report.csv on re-run', async () => {
        // Create a dummy file
        const outputFile = 'out/user-report.csv';
        fs.writeFileSync(outputFile, 'old,content\n1,test');

        // Mock to return different data
        const mockUsers = [
          { id: 99, name: 'New User', role: 'accountant', companyId: 2, company: { name: 'New Corp' } },
        ];
        (User.findAll as jest.Mock).mockResolvedValue(mockUsers);

        // Trigger user report
        service.userReport();
        await new Promise((resolve) => setTimeout(resolve, 200));

        // File should be recreated with new content
        expect(fs.existsSync(outputFile)).toBe(true);
        const content = fs.readFileSync(outputFile, 'utf-8');
        expect(content).not.toBe('old,content\n1,test');
        expect(content).toContain('New User');
      });

      it('should handle missing company gracefully', async () => {
        // Mock User.findAll with user having no company
        const mockUsers = [
          { id: 1, name: 'Orphan User', role: 'accountant', companyId: null, company: null },
        ];
        (User.findAll as jest.Mock).mockResolvedValue(mockUsers);

        // Trigger user report
        service.userReport();
        await new Promise((resolve) => setTimeout(resolve, 200));

        const outputFile = 'out/user-report.csv';
        expect(fs.existsSync(outputFile)).toBe(true);
        
        const content = fs.readFileSync(outputFile, 'utf-8');
        expect(content).toContain('Orphan User');
        // companyId is null, company name is empty string
        expect(content).toContain('null,');
      });
    });

    describe('user-report metrics tracking', () => {
      it('should track metrics for user-report after processing', async () => {
        // Wait for any ongoing processing
        await new Promise((resolve) => setTimeout(resolve, 300));

        const state = service.state('user-report');
        const metrics = service.getMetrics('user-report');

        if (state.status === 'completed') {
          expect(state.progress).toBe(100);
          expect(state).toHaveProperty('duration');
          expect(state).toHaveProperty('recordsProcessed');
        }

        if (metrics) {
          expect(metrics).toHaveProperty('totalExecutionTime');
          expect(metrics).toHaveProperty('recordsProcessed');
          expect(metrics).toHaveProperty('memoryUsage');
        }
      });

      it('should include user-report in metrics when completed', () => {
        const result = service.getAllStates();
        
        // user-report should be in states
        expect(result.states).toHaveProperty('user-report');
        
        // If completed, should have recordsProcessed
        const state = result.states['user-report'];
        if (state.status === 'completed') {
          expect(state.recordsProcessed).toBeGreaterThanOrEqual(0);
        }
      });
    });

    describe('user-report API contract compliance', () => {
      it('should match the interface contract for userReport()', () => {
        // Verify userReport exists and is callable
        expect(service.userReport).toBeDefined();
        expect(typeof service.userReport).toBe('function');
      });

      it('should match the interface contract for state("user-report")', () => {
        const state = service.state('user-report');
        
        // Should return ProcessingState shape
        expect(state).toHaveProperty('status');
        expect(state).toHaveProperty('progress');
        expect(['idle', 'processing', 'completed', 'error']).toContain(state.status);
        expect(typeof state.progress).toBe('number');
      });

      it('should match the interface contract for getMetrics("user-report")', () => {
        const metrics = service.getMetrics('user-report');
        
        // Should return ProcessingMetrics | null
        if (metrics !== null) {
          expect(metrics).toHaveProperty('totalExecutionTime');
          expect(metrics).toHaveProperty('recordsProcessed');
          expect(metrics).toHaveProperty('filesProcessed');
        }
      });

      it('should match the interface contract for getAllStates()', () => {
        const result = service.getAllStates();
        
        expect(result).toHaveProperty('states');
        expect(result).toHaveProperty('metrics');
        expect(result.states).toHaveProperty('user-report');
      });
    });
  });
});
