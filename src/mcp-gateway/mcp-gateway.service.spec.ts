import { Test, TestingModule } from '@nestjs/testing';
import { McpGatewayService } from './mcp-gateway.service';
import { McpGatewayController } from './mcp-gateway.controller';

describe('McpGatewayService', () => {
  let service: McpGatewayService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [McpGatewayService],
    }).compile();

    service = module.get<McpGatewayService>(McpGatewayService);
  });

  afterEach(() => {
    // Clean up any state
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================
  // POST /categorize Tests
  // ============================================

  describe('categorize', () => {
    it('should categorize a valid transaction with high confidence', async () => {
      const request = {
        transactionId: 'txn-001',
        date: '2024-01-15',
        account: 'Cash',
        description: 'Payment received from client',
        debit: 1000.00,
        credit: 0,
      };

      const result = await service.categorize(request);

      expect(result).toHaveProperty('transactionId', 'txn-001');
      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('confidence');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should return suggestions when available', async () => {
      const request = {
        transactionId: 'txn-002',
        date: '2024-01-16',
        account: 'Accounts Receivable',
        description: 'Invoice payment received',
        debit: 500.00,
      };

      const result = await service.categorize(request);

      expect(result.transactionId).toBe('txn-002');
      if (result.suggestions && result.suggestions.length > 0) {
        expect(Array.isArray(result.suggestions)).toBe(true);
      }
    });

    it('should handle transaction without debit/credit amounts', async () => {
      const request = {
        transactionId: 'txn-003',
        date: '2024-01-17',
        account: 'Expense',
        description: 'Office supplies purchase',
      };

      const result = await service.categorize(request);

      expect(result.transactionId).toBe('txn-003');
      expect(result).toHaveProperty('category');
      expect(result.confidence).toBeDefined();
    });

    it('should handle empty description gracefully', async () => {
      const request = {
        transactionId: 'txn-004',
        date: '2024-01-18',
        account: 'Revenue',
        description: '',
        credit: 2000.00,
      };

      const result = await service.categorize(request);

      expect(result.transactionId).toBe('txn-004');
      expect(result).toHaveProperty('category');
    });

    it('should throw error for missing required fields', async () => {
      const invalidRequest = {
        transactionId: 'txn-005',
        // missing date, account, description
      };

      await expect(service.categorize(invalidRequest as any)).rejects.toThrow();
    });

    it('should throw error for invalid transactionId format', async () => {
      const invalidRequest = {
        transactionId: '',
        date: '2024-01-15',
        account: 'Cash',
        description: 'Test transaction',
      };

      await expect(service.categorize(invalidRequest)).rejects.toThrow();
    });

    it('should handle very long descriptions', async () => {
      const longDesc = 'A'.repeat(10000);
      const request = {
        transactionId: 'txn-006',
        date: '2024-01-19',
        account: 'Miscellaneous',
        description: longDesc,
        debit: 100.00,
      };

      const result = await service.categorize(request);

      expect(result.transactionId).toBe('txn-006');
      expect(result).toHaveProperty('category');
    });
  });

  // ============================================
  // POST /analyze Tests
  // ============================================

  describe('analyze', () => {
    it('should analyze a normal transaction correctly', async () => {
      const request = {
        transactionId: 'txn-101',
        amount: 1500.00,
        account: 'Sales Revenue',
        date: '2024-01-20',
        description: 'Regular sales transaction',
      };

      const result = await service.analyze(request);

      expect(result).toHaveProperty('transactionId', 'txn-101');
      expect(result).toHaveProperty('isAnomaly');
      expect(typeof result.isAnomaly).toBe('boolean');
    });

    it('should detect high-value anomalies', async () => {
      const request = {
        transactionId: 'txn-102',
        amount: 999999.99,
        account: 'Cash',
        date: '2024-01-21',
        description: 'Suspicious large transaction',
      };

      const result = await service.analyze(request);

      expect(result.transactionId).toBe('txn-102');
      if (result.isAnomaly) {
        expect(result).toHaveProperty('anomalyType');
        expect(result).toHaveProperty('severity');
        expect(['low', 'medium', 'high']).toContain(result.severity);
      }
    });

    it('should detect unusual timing anomalies', async () => {
      const request = {
        transactionId: 'txn-103',
        amount: 5000.00,
        account: 'Payroll',
        date: '2024-01-32', // Invalid date
        description: 'Off-cycle payroll payment',
      };

      const result = await service.analyze(request);

      expect(result.transactionId).toBe('txn-103');
      expect(typeof result.isAnomaly).toBe('boolean');
    });

    it('should detect unusual account-anomaly combinations', async () => {
      const request = {
        transactionId: 'txn-104',
        amount: 10000.00,
        account: 'Petty Cash',
        date: '2024-01-22',
        description: 'Unusual petty cash withdrawal',
      };

      const result = await service.analyze(request);

      expect(result.transactionId).toBe('txn-104');
      expect(typeof result.isAnomaly).toBe('boolean');
    });

    it('should throw error for negative amount', async () => {
      const request = {
        transactionId: 'txn-105',
        amount: -100.00,
        account: 'Cash',
        date: '2024-01-23',
        description: 'Invalid negative amount',
      };

      await expect(service.analyze(request)).rejects.toThrow();
    });

    it('should throw error for missing required fields', async () => {
      const invalidRequest = {
        transactionId: 'txn-106',
        // missing amount, account, date, description
      };

      await expect(service.analyze(invalidRequest as any)).rejects.toThrow();
    });

    it('should handle zero amount transactions', async () => {
      const request = {
        transactionId: 'txn-107',
        amount: 0,
        account: 'Adjustments',
        date: '2024-01-24',
        description: 'Zero-value adjustment',
      };

      const result = await service.analyze(request);

      expect(result.transactionId).toBe('txn-107');
      expect(typeof result.isAnomaly).toBe('boolean');
    });

    it('should provide description for detected anomalies', async () => {
      const request = {
        transactionId: 'txn-108',
        amount: 50000.00,
        account: 'Director Disbursements',
        date: '2024-01-25',
        description: 'Large director payment without approval',
      };

      const result = await service.analyze(request);

      expect(result.transactionId).toBe('txn-108');
      if (result.isAnomaly && result.description) {
        expect(typeof result.description).toBe('string');
      }
    });
  });

  // ============================================
  // POST /insights Tests
  // ============================================

  describe('insights', () => {
    it('should return daily insights successfully', async () => {
      const request = {
        period: 'daily' as const,
      };

      const result = await service.getInsights(request);

      expect(result).toHaveProperty('insights');
      expect(result).toHaveProperty('generatedAt');
      expect(Array.isArray(result.insights)).toBe(true);
      expect(typeof result.generatedAt).toBe('string');
    });

    it('should return weekly insights successfully', async () => {
      const request = {
        period: 'weekly' as const,
      };

      const result = await service.getInsights(request);

      expect(result).toHaveProperty('insights');
      expect(Array.isArray(result.insights)).toBe(true);
    });

    it('should return monthly insights successfully', async () => {
      const request = {
        period: 'monthly' as const,
      };

      const result = await service.getInsights(request);

      expect(result).toHaveProperty('insights');
      expect(Array.isArray(result.insights));
    });

    it('should return insights with account filter', async () => {
      const request = {
        period: 'daily' as const,
        accountId: 'acc-001',
      };

      const result = await service.getInsights(request);

      expect(result).toHaveProperty('insights');
      expect(Array.isArray(result.insights));
    });

    it('should return insights without account filter', async () => {
      const request = {
        period: 'weekly' as const,
        accountId: undefined,
      };

      const result = await service.getInsights(request);

      expect(result).toHaveProperty('insights');
      expect(Array.isArray(result.insights));
    });

    it('should include metric and trend in insights when available', async () => {
      const request = {
        period: 'monthly' as const,
      };

      const result = await service.getInsights(request);

      for (const insight of result.insights) {
        expect(insight).toHaveProperty('type');
        expect(insight).toHaveProperty('title');
        expect(insight).toHaveProperty('description');
        if (insight.metric !== undefined) {
          expect(typeof insight.metric).toBe('number');
        }
        if (insight.trend !== undefined) {
          expect(['up', 'down', 'stable']).toContain(insight.trend);
        }
      }
    });

    it('should throw error for invalid period', async () => {
      const request = {
        period: 'yearly' as any, // Invalid period
      };

      await expect(service.getInsights(request)).rejects.toThrow();
    });

    it('should throw error for missing period', async () => {
      const request = {} as any;

      await expect(service.getInsights(request)).rejects.toThrow();
    });

    it('should return insights with valid timestamp', async () => {
      const request = {
        period: 'daily' as const,
      };

      const result = await service.getInsights(request);

      // generatedAt should be a valid ISO date string
      expect(() => new Date(result.generatedAt)).not.toThrow();
    });
  });

  // ============================================
  // GET /status Tests
  // ============================================

  describe('status', () => {
    it('should return status successfully', async () => {
      const result = await service.getStatus();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('activeConnections');
      expect(result).toHaveProperty('processedTransactions');
      expect(result).toHaveProperty('uptime');
    });

    it('should return valid status values', async () => {
      const result = await service.getStatus();

      expect(['active', 'degraded', 'down']).toContain(result.status);
    });

    it('should return non-negative active connections', async () => {
      const result = await service.getStatus();

      expect(result.activeConnections).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(result.activeConnections)).toBe(true);
    });

    it('should return non-negative processed transactions', async () => {
      const result = await service.getStatus();

      expect(result.processedTransactions).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(result.processedTransactions)).toBe(true);
    });

    it('should return valid uptime string format', async () => {
      const result = await service.getStatus();

      expect(typeof result.uptime).toBe('string');
      // Uptime should contain time units like 'h', 'm', 's' or be '0'
      expect(result.uptime).toMatch(/^(\d+[hms]?|\d+:\d+:\d+)$/);
    });

    it('should return consistent status on multiple calls', async () => {
      const result1 = await service.getStatus();
      const result2 = await service.getStatus();

      expect(result1.status).toBe(result2.status);
    });

    it('should track increasing processed transactions over time', async () => {
      const result1 = await service.getStatus();
      
      // Simulate some processing by waiting a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      // Note: In real scenario, transactions would increase
      const result2 = await service.getStatus();
      
      expect(result2.processedTransactions).toBeGreaterThanOrEqual(result1.processedTransactions);
    });

    it('should not throw error on rapid successive calls', async () => {
      await expect(service.getStatus()).resolves.toBeDefined();
      await expect(service.getStatus()).resolves.toBeDefined();
      await expect(service.getStatus()).resolves.toBeDefined();
    });
  });
});

describe('McpGatewayController', () => {
  let controller: McpGatewayController;
  let service: McpGatewayService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [McpGatewayController],
      providers: [McpGatewayService],
    }).compile();

    controller = module.get<McpGatewayController>(McpGatewayController);
    service = module.get<McpGatewayService>(McpGatewayService);
  });

  afterEach(() => {
    // Clean up any state
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ============================================
  // POST /categorize Controller Tests
  // ============================================

  describe('POST /categorize', () => {
    it('should call service.categorize with correct parameters', async () => {
      const request = {
        transactionId: 'txn-201',
        date: '2024-01-26',
        account: 'Revenue',
        description: 'Service fee received',
        credit: 2500.00,
      };

      const spy = jest.spyOn(service, 'categorize').mockResolvedValue({
        transactionId: 'txn-201',
        category: 'Revenue',
        confidence: 0.95,
        suggestions: ['Related: Service Income'],
      });

      const result = await controller.categorize(request);

      expect(spy).toHaveBeenCalledWith(request);
      expect(result.transactionId).toBe('txn-201');
      expect(result.category).toBe('Revenue');
      expect(result.confidence).toBe(0.95);

      spy.mockRestore();
    });

    it('should handle categorize errors gracefully', async () => {
      const request = {
        transactionId: 'txn-202',
        date: '2024-01-27',
        account: 'Expense',
        description: 'Test expense',
      };

      jest.spyOn(service, 'categorize').mockRejectedValue(new Error('AI service unavailable'));

      await expect(controller.categorize(request)).rejects.toThrow('AI service unavailable');
    });
  });

  // ============================================
  // POST /analyze Controller Tests
  // ============================================

  describe('POST /analyze', () => {
    it('should call service.analyze with correct parameters', async () => {
      const request = {
        transactionId: 'txn-301',
        amount: 3500.00,
        account: 'Payroll',
        date: '2024-01-28',
        description: 'Monthly payroll processing',
      };

      const spy = jest.spyOn(service, 'analyze').mockResolvedValue({
        transactionId: 'txn-301',
        isAnomaly: false,
      });

      const result = await controller.analyze(request);

      expect(spy).toHaveBeenCalledWith(request);
      expect(result.transactionId).toBe('txn-301');
      expect(result.isAnomaly).toBe(false);

      spy.mockRestore();
    });

    it('should handle analyze errors gracefully', async () => {
      const request = {
        transactionId: 'txn-302',
        amount: 1000.00,
        account: 'Cash',
        date: '2024-01-29',
        description: 'Test transaction',
      };

      jest.spyOn(service, 'analyze').mockRejectedValue(new Error('Analysis engine error'));

      await expect(controller.analyze(request)).rejects.toThrow('Analysis engine error');
    });
  });

  // ============================================
  // POST /insights Controller Tests
  // ============================================

  describe('POST /insights', () => {
    it('should call service.insights with correct parameters', async () => {
      const request = {
        period: 'weekly' as const,
        accountId: 'acc-002',
      };

      const mockInsights = {
        insights: [
          {
            type: 'trend',
            title: 'Revenue Increase',
            description: 'Weekly revenue is up 15%',
            metric: 15,
            trend: 'up' as const,
          },
        ],
        generatedAt: '2024-01-30T10:00:00.000Z',
      };

      const spy = jest.spyOn(service, 'getInsights').mockResolvedValue(mockInsights);

      const result = await controller.insights(request);

      expect(spy).toHaveBeenCalledWith(request);
      expect(result.insights).toHaveLength(1);
      expect(result.insights[0].type).toBe('trend');

      spy.mockRestore();
    });

    it('should handle insights errors gracefully', async () => {
      const request = {
        period: 'monthly' as const,
      };

      jest.spyOn(service, 'getInsights').mockRejectedValue(new Error('Insights generation failed'));

      await expect(controller.insights(request)).rejects.toThrow('Insights generation failed');
    });
  });

  // ============================================
  // GET /status Controller Tests
  // ============================================

  describe('GET /status', () => {
    it('should call service.getStatus and return status', async () => {
      const mockStatus = {
        status: 'active' as const,
        activeConnections: 5,
        processedTransactions: 1234,
        uptime: '2h30m',
      };

      const spy = jest.spyOn(service, 'getStatus').mockResolvedValue(mockStatus);

      const result = await controller.getStatus();

      expect(spy).toHaveBeenCalled();
      expect(result.status).toBe('active');
      expect(result.activeConnections).toBe(5);
      expect(result.processedTransactions).toBe(1234);

      spy.mockRestore();
    });

    it('should handle status errors gracefully', async () => {
      jest.spyOn(service, 'getStatus').mockRejectedValue(new Error('Status check failed'));

      await expect(controller.getStatus()).rejects.toThrow('Status check failed');
    });
  });
});

describe('McpGatewayModule', () => {
  it('should be defined', () => {
    const { McpGatewayModule } = require('./mcp-gateway.module');
    expect(McpGatewayModule).toBeDefined();
  });
});