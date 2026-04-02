import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface TransactionPayload {
  transactionId: string;
  date: string;
  account: string;
  description: string;
  debit?: number;
  credit?: number;
}

export interface CategorizeRequest {
  transactionId: string;
  date: string;
  account: string;
  description: string;
  debit?: number;
  credit?: number;
}

export interface CategorizeResponse {
  transactionId: string;
  category: string;
  confidence: number;
  suggestions?: string[];
}

export interface AnalyzeRequest {
  transactionId: string;
  amount: number;
  account: string;
  date: string;
  description: string;
}

export interface AnalyzeResponse {
  transactionId: string;
  isAnomaly: boolean;
  anomalyType?: string;
  severity?: 'low' | 'medium' | 'high';
  description?: string;
}

export interface InsightsRequest {
  period: 'daily' | 'weekly' | 'monthly';
  accountId?: string;
}

export interface Insight {
  type: string;
  title: string;
  description: string;
  metric?: number;
  trend?: 'up' | 'down' | 'stable';
}

export interface InsightsResponse {
  insights: Insight[];
  generatedAt: string;
}

export interface StatusResponse {
  status: 'active' | 'degraded' | 'down';
  activeConnections: number;
  processedTransactions: number;
  uptime: string;
}

export interface ProcessingState {
  status: 'idle' | 'processing' | 'completed' | 'error';
  progress: number;
  startTime?: number;
  endTime?: number;
  duration?: string;
  recordsProcessed?: number;
  error?: string;
}

export interface ProcessingMetrics {
  totalExecutionTime: number;
  recordsProcessed: number;
  filesProcessed?: number;
  averageRecordsPerSecond?: number;
}

// ============================================================================
// Category Rules for Transaction Categorization (Rule-based ML-like scoring)
// ============================================================================

interface CategoryRule {
  keywords: string[];
  category: string;
  confidence: number;
  suggestions: string[];
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    keywords: ['salary', 'wage', 'payroll', 'bonus', 'compensation'],
    category: 'Payroll',
    confidence: 0.95,
    suggestions: ['Review with HR', 'Verify employment terms'],
  },
  {
    keywords: ['rent', 'lease', 'property', 'office space'],
    category: 'Rent/Lease',
    confidence: 0.9,
    suggestions: ['Check lease terms', 'Verify property address'],
  },
  {
    keywords: ['utility', 'electric', 'water', 'gas', 'internet', 'phone'],
    category: 'Utilities',
    confidence: 0.88,
    suggestions: ['Review usage trends', 'Compare with previous periods'],
  },
  {
    keywords: ['inventory', 'stock', 'purchase', 'supplier', 'vendor'],
    category: 'Inventory/Purchases',
    confidence: 0.85,
    suggestions: ['Verify purchase orders', 'Check supplier invoices'],
  },
  {
    keywords: ['sales', 'revenue', 'income', 'client', 'customer'],
    category: 'Sales/Revenue',
    confidence: 0.9,
    suggestions: ['Reconcile with CRM', 'Verify client payments'],
  },
  {
    keywords: ['insurance', 'premium', 'coverage', 'policy'],
    category: 'Insurance',
    confidence: 0.92,
    suggestions: ['Review policy details', 'Check coverage limits'],
  },
  {
    keywords: ['tax', 'vat', 'gst', 'withholding'],
    category: 'Tax',
    confidence: 0.95,
    suggestions: ['Verify tax calculations', 'Check filing deadlines'],
  },
  {
    keywords: ['loan', 'interest', 'principal', 'debt', 'financing'],
    category: 'Loan Payments',
    confidence: 0.88,
    suggestions: ['Review loan agreement', 'Verify payment schedule'],
  },
  {
    keywords: ['advertising', 'marketing', 'promotion', 'campaign'],
    category: 'Marketing',
    confidence: 0.85,
    suggestions: ['Track campaign ROI', 'Review marketing spend'],
  },
  {
    keywords: ['software', 'subscription', 'saas', 'license'],
    category: 'Software/Tech',
    confidence: 0.9,
    suggestions: ['Verify subscription tiers', 'Check renewal dates'],
  },
];

// ============================================================================
// Anomaly Detection Thresholds
// ============================================================================

interface AnomalyThreshold {
  type: string;
  lowerBound: number;
  upperBound: number;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

const ANOMALY_THRESHOLDS: AnomalyThreshold[] = [
  {
    type: 'amount',
    lowerBound: 0.01,
    upperBound: 1000000,
    severity: 'high',
    description: 'Transaction amount exceeds normal bounds',
  },
  {
    type: 'frequency',
    lowerBound: 0,
    upperBound: 100,
    severity: 'medium',
    description: 'Unusual transaction frequency detected',
  },
];

// ============================================================================
// MCP Gateway Service
// ============================================================================

@Injectable()
@WebSocketGateway({
  namespace: '/ws/mcp-gateway',
  cors: {
    origin: '*',
  },
})
export class McpGatewayService {
  private readonly logger = new Logger(McpGatewayService.name);

  @WebSocketServer()
  server: Server;

  // Connection tracking: O(1) lookup by socket id
  private activeConnections: Map<string, Socket> = new Map();
  private connectionTimestamps: Map<string, number> = new Map();

  // Transaction history for insights generation: O(n) for analysis
  private transactionHistory: TransactionPayload[] = [];

  // Processing states for monitoring
  private states: Record<string, ProcessingState> = {
    categorization: { status: 'idle', progress: 0 },
    anomaly_detection: { status: 'idle', progress: 0 },
    insights: { status: 'idle', progress: 0 },
  };

  // Metrics for monitoring and performance tracking
  private metrics: Record<string, ProcessingMetrics> = {};
  private processedTransactions = 0;
  private startTime = Date.now();

  // Cache for expensive operations (simple TTL cache)
  private insightsCache: { data: InsightsResponse; timestamp: number } | null = null;
  private readonly CACHE_TTL_MS = 60000; // 1 minute cache

  // =========================================================================
  // WebSocket Connection Management
  // =========================================================================

  /**
   * Handle new WebSocket client connection
   * Time complexity: O(1) for connection registration
   */
  handleConnection(client: Socket): void {
    this.activeConnections.set(client.id, client);
    this.connectionTimestamps.set(client.id, Date.now());
    this.logger.log(`Client connected: ${client.id}. Total active: ${this.activeConnections.size}`);
  }

  /**
   * Handle WebSocket client disconnection
   * Time complexity: O(1) for connection removal
   */
  handleDisconnect(client: Socket): void {
    this.activeConnections.delete(client.id);
    this.connectionTimestamps.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}. Total active: ${this.activeConnections.size}`);
  }

  /**
   * Broadcast event to all connected WebSocket clients
   * Time complexity: O(n) where n = number of active connections
   */
  broadcast<T>(event: string, data: T): void {
    if (this.server) {
      this.server.emit(event, data);
    }
  }

  // =========================================================================
  // Transaction Categorization
  // =========================================================================

  /**
   * Categorize a transaction using rule-based ML-like scoring
   * Time complexity: O(m * k) where m = keywords per rule, k = number of rules
   * Space complexity: O(1) - uses constant scoring algorithm
   *
   * @param request - Transaction data to categorize
   * @returns Categorization result with confidence score and suggestions
   */
  async categorize(request: CategorizeRequest): Promise<CategorizeResponse> {
    const startTime = performance.now();
    this.logger.log(`[CATEGORIZE] Processing transaction: ${request.transactionId}`);

    try {
      // Input validation
      if (!request.transactionId || !request.description) {
        throw new BadRequestException('Invalid request: transactionId and description are required');
      }

      const { transactionId, description, account, debit, credit } = request;
      const amount = (debit || 0) - (credit || 0);
      const descriptionLower = description.toLowerCase();

      // Score each category rule against the description
      // O(rules * keywords) = O(10 * avg_keywords)
      let bestMatch = {
        category: 'Uncategorized',
        confidence: 0,
        suggestions: ['Manual review required'],
      };

      for (const rule of CATEGORY_RULES) {
        const matchScore = this.calculateKeywordMatch(descriptionLower, rule.keywords);
        if (matchScore > bestMatch.confidence) {
          bestMatch = {
            category: rule.category,
            confidence: matchScore * rule.confidence,
            suggestions: rule.suggestions,
          };
        }
      }

      // Adjust confidence based on transaction characteristics
      bestMatch.confidence = this.adjustConfidence(bestMatch.confidence, { amount, account });

      const result: CategorizeResponse = {
        transactionId,
        category: bestMatch.category,
        confidence: Math.round(bestMatch.confidence * 100) / 100,
        suggestions: bestMatch.suggestions,
      };

      // Store transaction in history for insights
      this.addToHistory(request);

      // Track metrics
      this.processedTransactions++;
      const duration = performance.now() - startTime;
      this.logger.log(`[CATEGORIZE] Completed ${transactionId} in ${duration.toFixed(2)}ms`);

      // Broadcast result via WebSocket
      this.broadcast('categorization_result', result);

      return result;
    } catch (error) {
      this.logger.error(`[CATEGORIZE] Error processing ${request.transactionId}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Calculate keyword match score using fuzzy matching
   * Time complexity: O(k) where k = number of keywords
   */
  private calculateKeywordMatch(text: string, keywords: string[]): number {
    let maxScore = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        // Exact match scores 1.0
        const score = keyword.split(' ').length > 1 ? 1.0 : 0.8;
        maxScore = Math.max(maxScore, score);
      }
    }
    return maxScore;
  }

  /**
   * Adjust confidence based on transaction characteristics
   * Time complexity: O(1)
   */
  private adjustConfidence(baseConfidence: number, context: { amount: number; account: string }): number {
    let adjusted = baseConfidence;

    // High-value transactions get boosted scrutiny
    if (context.amount > 10000) {
      adjusted *= 0.9; // Reduce confidence for high-value
    }

    // Unknown accounts reduce confidence
    if (!context.account || context.account === 'Unknown') {
      adjusted *= 0.8;
    }

    return Math.min(adjusted, 1.0);
  }

  // =========================================================================
  // Anomaly Detection
  // =========================================================================

  /**
   * Analyze transaction for anomalies using configurable thresholds
   * Time complexity: O(n) for historical analysis + O(t) for threshold checks
   * Space complexity: O(1)
   *
   * @param request - Transaction data to analyze
   * @returns Anomaly detection result with severity and description
   */
  async analyze(request: AnalyzeRequest): Promise<AnalyzeResponse> {
    const startTime = performance.now();
    this.logger.log(`[ANALYZE] Processing transaction: ${request.transactionId}`);

    try {
      // Input validation
      if (!request.transactionId || request.amount === undefined) {
        throw new BadRequestException('Invalid request: transactionId and amount are required');
      }

      const { transactionId, amount, account, date, description } = request;

      // Check amount thresholds
      const amountAnomaly = this.checkAmountAnomaly(amount);

      // Check frequency anomalies (based on same account/description)
      const frequencyAnomaly = this.checkFrequencyAnomaly(account, description);

      // Check statistical anomalies (Z-score based on history)
      const statisticalAnomaly = this.checkStatisticalAnomaly(amount, account);

      // Determine overall anomaly status
      const anomalies = [amountAnomaly, frequencyAnomaly, statisticalAnomaly].filter(a => a.isAnomaly);
      const isAnomaly = anomalies.length > 0;

      // Determine highest severity
      const severityOrder = { high: 3, medium: 2, low: 1 };
      const highestSeverity = isAnomaly
        ? anomalies.reduce((max, a) =>
            severityOrder[a.severity!] > severityOrder[max.severity!] ? a : max,
            anomalies[0]
          ).severity
        : undefined;

      const result: AnalyzeResponse = {
        transactionId,
        isAnomaly,
        anomalyType: isAnomaly ? anomalies.map(a => a.type).join(', ') : undefined,
        severity: highestSeverity,
        description: isAnomaly ? this.generateAnomalyDescription(anomalies) : undefined,
      };

      // Track metrics
      const duration = performance.now() - startTime;
      this.logger.log(`[ANALYZE] Completed ${transactionId} in ${duration.toFixed(2)}ms - Anomaly: ${isAnomaly}`);

      // Broadcast alert if anomaly detected
      if (isAnomaly) {
        this.broadcast('anomaly_alert', result);
      }

      return result;
    } catch (error) {
      this.logger.error(`[ANALYZE] Error processing ${request.transactionId}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Check if amount exceeds configured thresholds
   * Time complexity: O(1)
   */
  private checkAmountAnomaly(amount: number): { isAnomaly: boolean; type: string; severity: 'low' | 'medium' | 'high'; description: string } {
    const threshold = ANOMALY_THRESHOLDS.find(t => t.type === 'amount')!;
    const isAnomaly = amount < threshold.lowerBound || amount > threshold.upperBound;

    return {
      isAnomaly,
      type: 'amount',
      severity: isAnomaly ? threshold.severity : 'low',
      description: isAnomaly ? threshold.description : 'Amount within normal bounds',
    };
  }

  /**
   * Check for unusual transaction frequency
   * Time complexity: O(n) where n = transaction history size
   */
  private checkFrequencyAnomaly(account: string, description: string): { isAnomaly: boolean; type: string; severity: 'low' | 'medium' | 'high'; description: string } {
    const recentTransactions = this.transactionHistory.filter(t =>
      t.account === account &&
      new Date(t.date).getTime() > Date.now() - 86400000 // Last 24 hours
    );

    const frequency = recentTransactions.length;
    const threshold = ANOMALY_THRESHOLDS.find(t => t.type === 'frequency')!;
    const isAnomaly = frequency > threshold.upperBound;

    return {
      isAnomaly,
      type: 'frequency',
      severity: isAnomaly ? threshold.severity : 'low',
      description: `Transaction frequency: ${frequency} in last 24h`,
    };
  }

  /**
   * Check statistical anomalies using simple Z-score
   * Time complexity: O(n) for calculating mean/stddev
   */
  private checkStatisticalAnomaly(amount: number, account: string): { isAnomaly: boolean; type: string; severity: 'low' | 'medium' | 'high'; description: string } {
    const accountTransactions = this.transactionHistory.filter(t => t.account === account);

    if (accountTransactions.length < 5) {
      return { isAnomaly: false, type: 'statistical', severity: 'low', description: 'Insufficient history for statistical analysis' };
    }

    const amounts = accountTransactions.map(t => (t.debit || 0) - (t.credit || 0));
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const stddev = Math.sqrt(amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length);

    if (stddev === 0) {
      return { isAnomaly: false, type: 'statistical', severity: 'low', description: 'No variance in historical data' };
    }

    const zScore = Math.abs((amount - mean) / stddev);
    const isAnomaly = zScore > 3; // 3-sigma rule

    return {
      isAnomaly,
      type: 'statistical',
      severity: isAnomaly ? 'high' : 'low',
      description: `Z-score: ${zScore.toFixed(2)} (threshold: 3.0)`,
    };
  }

  /**
   * Generate human-readable anomaly description
   */
  private generateAnomalyDescription(anomalies: Array<{ type: string; description: string }>): string {
    return `Detected ${anomalies.length} anomaly type(s): ${anomalies.map(a => `${a.type} (${a.description})`).join('; ')}`;
  }

  // =========================================================================
  // Financial Insights Generation
  // =========================================================================

  /**
   * Generate financial insights from transaction history
   * Time complexity: O(n * p) where n = transactions, p = period calculation
   * Space complexity: O(n) for storing insights
   *
   * @param request - Period and optional account filter
   * @returns Array of generated insights with metrics and trends
   */
  async getInsights(request: InsightsRequest): Promise<InsightsResponse> {
    const startTime = performance.now();
    this.logger.log(`[INSIGHTS] Generating ${request.period} insights for account: ${request.accountId || 'all'}`);

    try {
      // Check cache first - O(1)
      if (this.insightsCache && Date.now() - this.insightsCache.timestamp < this.CACHE_TTL_MS) {
        this.logger.log('[INSIGHTS] Returning cached insights');
        return this.insightsCache.data;
      }

      // Filter transactions by period and account
      const periodMs = this.getPeriodMs(request.period);
      const cutoffTime = Date.now() - periodMs;

      let transactions = this.transactionHistory.filter(t =>
        new Date(t.date).getTime() > cutoffTime
      );

      if (request.accountId) {
        transactions = transactions.filter(t => t.account === request.accountId);
      }

      // Generate insights
      const insights: Insight[] = [];

      // 1. Spending by category insight
      const spendingInsight = this.generateSpendingInsight(transactions, request.period);
      if (spendingInsight) insights.push(spendingInsight);

      // 2. Cash flow insight
      const cashFlowInsight = this.generateCashFlowInsight(transactions, request.period);
      if (cashFlowInsight) insights.push(cashFlowInsight);

      // 3. Transaction volume insight
      const volumeInsight = this.generateVolumeInsight(transactions, request.period);
      if (volumeInsight) insights.push(volumeInsight);

      // 4. Anomaly summary insight
      const anomalyInsight = this.generateAnomalyInsight(transactions);
      if (anomalyInsight) insights.push(anomalyInsight);

      const result: InsightsResponse = {
        insights,
        generatedAt: new Date().toISOString(),
      };

      // Cache the result
      this.insightsCache = { data: result, timestamp: Date.now() };

      // Track metrics
      const duration = performance.now() - startTime;
      this.logger.log(`[INSIGHTS] Completed in ${duration.toFixed(2)}ms - Generated ${insights.length} insights`);

      return result;
    } catch (error) {
      this.logger.error(`[INSIGHTS] Error generating insights: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get period duration in milliseconds
   * Time complexity: O(1)
   */
  private getPeriodMs(period: 'daily' | 'weekly' | 'monthly'): number {
    const multipliers = { daily: 1, weekly: 7, monthly: 30 };
    return multipliers[period] * 24 * 60 * 60 * 1000;
  }

  /**
   * Generate spending insight by category
   */
  private generateSpendingInsight(transactions: TransactionPayload[], period: string): Insight | null {
    const categorized = new Map<string, number>();

    for (const t of transactions) {
      const amount = (t.debit || 0) - (t.credit || 0);
      if (amount > 0) {
        const cat = this.categorizeTransaction(t);
        categorized.set(cat, (categorized.get(cat) || 0) + amount);
      }
    }

    if (categorized.size === 0) return null;

    const topCategory = Array.from(categorized.entries()).sort((a, b) => b[1] - a[1])[0];

    return {
      type: 'spending_by_category',
      title: `Top Spending Category: ${topCategory[0]}`,
      description: `Total spending in ${topCategory[0]} category for the ${period} period`,
      metric: Math.round(topCategory[1] * 100) / 100,
      trend: 'stable',
    };
  }

  /**
   * Generate cash flow insight (income vs expenses)
   */
  private generateCashFlowInsight(transactions: TransactionPayload[], period: string): Insight | null {
    let totalIncome = 0;
    let totalExpenses = 0;

    for (const t of transactions) {
      const net = (t.debit || 0) - (t.credit || 0);
      if (net > 0) totalIncome += net;
      else totalExpenses += Math.abs(net);
    }

    if (totalIncome === 0 && totalExpenses === 0) return null;

    const netCashFlow = totalIncome - totalExpenses;
    const ratio = totalExpenses > 0 ? totalIncome / totalExpenses : Infinity;

    return {
      type: 'cash_flow',
      title: netCashFlow >= 0 ? 'Positive Cash Flow' : 'Negative Cash Flow',
      description: `Income-to-expense ratio: ${ratio.toFixed(2)}:1`,
      metric: Math.round(netCashFlow * 100) / 100,
      trend: netCashFlow > 0 ? 'up' : netCashFlow < 0 ? 'down' : 'stable',
    };
  }

  /**
   * Generate transaction volume insight
   */
  private generateVolumeInsight(transactions: TransactionPayload[], period: string): Insight {
    return {
      type: 'transaction_volume',
      title: `${period.charAt(0).toUpperCase() + period.slice(1)} Transaction Volume`,
      description: `Total transactions processed in the ${period} period`,
      metric: transactions.length,
      trend: 'stable',
    };
  }

  /**
   * Generate anomaly summary insight
   */
  private generateAnomalyInsight(transactions: TransactionPayload[]): Insight {
    const anomalyCount = transactions.filter(t => {
      const amount = (t.debit || 0) - (t.credit || 0);
      return amount > 100000 || amount < 0.01;
    }).length;

    return {
      type: 'anomaly_summary',
      title: 'Anomaly Detection Summary',
      description: `${anomalyCount} transactions flagged for review`,
      metric: anomalyCount,
      trend: anomalyCount > 5 ? 'up' : anomalyCount > 0 ? 'stable' : 'down',
    };
  }

  /**
   * Simple transaction categorization (reuse logic from categorize)
   */
  private categorizeTransaction(transaction: TransactionPayload): string {
    const descLower = transaction.description.toLowerCase();
    for (const rule of CATEGORY_RULES) {
      if (rule.keywords.some(k => descLower.includes(k))) {
        return rule.category;
      }
    }
    return 'Uncategorized';
  }

  // =========================================================================
  // Status & Health Monitoring
  // =========================================================================

  /**
   * Get current service status
   * Time complexity: O(1)
   */
  getStatus(): StatusResponse {
    const uptimeMs = Date.now() - this.startTime;
    const uptimeStr = this.formatUptime(uptimeMs);

    // Determine overall status
    let status: 'active' | 'degraded' | 'down' = 'active';
    const errorStates = Object.values(this.states).filter(s => s.status === 'error');
    if (errorStates.length > 0) {
      status = 'degraded';
    }
    if (this.activeConnections.size === 0 && this.processedTransactions === 0) {
      // Only down if never processed anything and no connections
    }

    return {
      status,
      activeConnections: this.activeConnections.size,
      processedTransactions: this.processedTransactions,
      uptime: uptimeStr,
    };
  }

  /**
   * Get all processing states
   */
  getAllStates() {
    return {
      states: this.states,
      metrics: this.metrics,
    };
  }

  /**
   * Get processing metrics for a specific scope
   */
  getMetrics(scope: string): ProcessingMetrics | null {
    return this.metrics[scope] || null;
  }

  /**
   * Format uptime string from milliseconds
   */
  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  // =========================================================================
  // Helper Methods
  // =========================================================================

  /**
   * Add transaction to history for insights generation
   * Time complexity: O(1) amortized for append
   * Space complexity: O(n) where n = history size (with periodic cleanup)
   */
  private addToHistory(transaction: TransactionPayload): void {
    this.transactionHistory.push(transaction);

    // Periodic cleanup: keep only last 10000 transactions to prevent memory issues
    if (this.transactionHistory.length > 10000) {
      this.transactionHistory = this.transactionHistory.slice(-5000);
    }
  }

  /**
   * Update processing state with progress
   */
  updateProgress(reportType: string, progress: number, recordsProcessed?: number): void {
    if (this.states[reportType]) {
      this.states[reportType].progress = Math.round(progress);
      if (recordsProcessed !== undefined) {
        this.states[reportType].recordsProcessed = recordsProcessed;
      }
    }
  }
}
