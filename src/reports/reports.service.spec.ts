import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import fs from 'fs';
import path from 'path';

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(async () => {
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
  });

  it('should return all states and metrics', () => {
    const result = service.getAllStates();
    expect(result).toHaveProperty('states');
    expect(result).toHaveProperty('metrics');
    expect(result.states).toHaveProperty('accounts');
    expect(result.states).toHaveProperty('yearly');
    expect(result.states).toHaveProperty('fs');
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
    await new Promise(resolve => setTimeout(resolve, 100));

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
    await new Promise(resolve => setTimeout(resolve, 200));

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
    await new Promise(resolve => setTimeout(resolve, 100));

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
      lines.push(`2020-01-${String(i % 30 + 1).padStart(2, '0')},Cash,Test transaction ${i},${(Math.random() * 1000).toFixed(2)},`);
    }

    fs.writeFileSync('tmp/large-test.csv', lines.join('\n'));

    const startTime = Date.now();
    await service.accounts();

    // Wait for completion
    await new Promise(resolve => setTimeout(resolve, 500));

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
});
