import { Injectable } from '@nestjs/common';
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

export interface ProcessingState {
  status: 'idle' | 'processing' | 'completed' | 'error';
  progress: number;
  startTime?: number;
  endTime?: number;
  duration?: string;
  error?: string;
  recordsProcessed?: number;
  totalRecords?: number;
}

export interface ProcessingMetrics {
  totalExecutionTime: number;
  recordsProcessed: number;
  filesProcessed: number;
  memoryUsage: NodeJS.MemoryUsage;
  averageRecordsPerSecond: number;
}

@Injectable()
export class ReportsService {
  private states: Record<string, ProcessingState> = {
    accounts: { status: 'idle', progress: 0 },
    yearly: { status: 'idle', progress: 0 },
    fs: { status: 'idle', progress: 0 },
  };

  private metrics: Record<string, ProcessingMetrics> = {};

  state(scope: string): ProcessingState {
    return this.states[scope] || { status: 'idle', progress: 0 };
  }

  getMetrics(scope: string): ProcessingMetrics | null {
    return this.metrics[scope] || null;
  }

  getAllStates() {
    return {
      states: this.states,
      metrics: this.metrics,
    };
  }

  async accounts(): Promise<void> {
    return this.processReportAsync('accounts', this.processAccountsReport.bind(this));
  }

  private async processAccountsReport(): Promise<void> {
    const tmpDir = 'tmp';
    const outputFile = 'out/accounts.csv';
    const accountBalances: Record<string, number> = {};

    const files = fs.readdirSync(tmpDir).filter(file => file.endsWith('.csv'));
    const totalFiles = files.length;
    let processedFiles = 0;
    let totalRecords = 0;

    // Ensure output directory exists
    if (!fs.existsSync('out')) {
      fs.mkdirSync('out', { recursive: true });
    }

    for (const file of files) {
      await this.processFileStreamOptimized(
        path.join(tmpDir, file),
        (line, lineNumber) => {
          const [, account, , debit, credit] = line.split(',');
          if (account && account.trim()) {
            if (!accountBalances[account]) {
              accountBalances[account] = 0;
            }
            const debitVal = parseFloat(String(debit || 0));
            const creditVal = parseFloat(String(credit || 0));
            accountBalances[account] += debitVal - creditVal;
            totalRecords++;
          }
        }
      );

      processedFiles++;
      this.updateProgress('accounts', (processedFiles / totalFiles) * 100, totalRecords);

      // Allow other operations to run
      await this.sleep(1);
    }

    // Write output
    const output = ['Account,Balance'];
    for (const [account, balance] of Object.entries(accountBalances)) {
      output.push(`${account},${balance.toFixed(2)}`);
    }

    await fs.promises.writeFile(outputFile, output.join('\n'));
  }

  async yearly(): Promise<void> {
    return this.processReportAsync('yearly', this.processYearlyReport.bind(this));
  }

  private async processYearlyReport(): Promise<void> {
    const tmpDir = 'tmp';
    const outputFile = 'out/yearly.csv';
    const cashByYear: Record<string, number> = {};

    const files = fs.readdirSync(tmpDir).filter(file =>
      file.endsWith('.csv') && file !== 'yearly.csv'
    );
    const totalFiles = files.length;
    let processedFiles = 0;
    let totalRecords = 0;

    // Ensure output directory exists
    if (!fs.existsSync('out')) {
      fs.mkdirSync('out', { recursive: true });
    }

    for (const file of files) {
      await this.processFileStreamOptimized(
        path.join(tmpDir, file),
        (line, lineNumber) => {
          const [date, account, , debit, credit] = line.split(',');
          if (account === 'Cash' && date) {
            const year = new Date(date).getFullYear();
            if (!isNaN(year)) {
              if (!cashByYear[year]) {
                cashByYear[year] = 0;
              }
              const debitVal = parseFloat(String(debit || 0));
              const creditVal = parseFloat(String(credit || 0));
              cashByYear[year] += debitVal - creditVal;
              totalRecords++;
            }
          }
        }
      );

      processedFiles++;
      this.updateProgress('yearly', (processedFiles / totalFiles) * 100, totalRecords);

      // Allow other operations to run
      await this.sleep(1);
    }

    // Write output
    const output = ['Financial Year,Cash Balance'];
    Object.keys(cashByYear)
      .sort()
      .forEach((year) => {
        output.push(`${year},${cashByYear[year].toFixed(2)}`);
      });

    await fs.promises.writeFile(outputFile, output.join('\n'));
  }

  async fs(): Promise<void> {
    return this.processReportAsync('fs', this.processFinancialStatementReport.bind(this));
  }

  private async processFinancialStatementReport(): Promise<void> {
    const tmpDir = 'tmp';
    const outputFile = 'out/fs.csv';
    const categories = {
      'Income Statement': {
        Revenues: ['Sales Revenue'],
        Expenses: [
          'Cost of Goods Sold',
          'Salaries Expense',
          'Rent Expense',
          'Utilities Expense',
          'Interest Expense',
          'Tax Expense',
        ],
      },
      'Balance Sheet': {
        Assets: [
          'Cash',
          'Accounts Receivable',
          'Inventory',
          'Fixed Assets',
          'Prepaid Expenses',
        ],
        Liabilities: [
          'Accounts Payable',
          'Loan Payable',
          'Sales Tax Payable',
          'Accrued Liabilities',
          'Unearned Revenue',
          'Dividends Payable',
        ],
        Equity: ['Common Stock', 'Retained Earnings'],
      },
    };

    const balances: Record<string, number> = {};
    for (const section of Object.values(categories)) {
      for (const group of Object.values(section)) {
        for (const account of group) {
          balances[account] = 0;
        }
      }
    }

    const files = fs.readdirSync(tmpDir).filter(file =>
      file.endsWith('.csv') && file !== 'fs.csv'
    );
    const totalFiles = files.length;
    let processedFiles = 0;
    let totalRecords = 0;

    // Ensure output directory exists
    if (!fs.existsSync('out')) {
      fs.mkdirSync('out', { recursive: true });
    }

    for (const file of files) {
      await this.processFileStreamOptimized(
        path.join(tmpDir, file),
        (line, lineNumber) => {
          const [, account, , debit, credit] = line.split(',');
          if (balances.hasOwnProperty(account)) {
            const debitVal = parseFloat(String(debit || 0));
            const creditVal = parseFloat(String(credit || 0));
            balances[account] += debitVal - creditVal;
            totalRecords++;
          }
        }
      );

      processedFiles++;
      this.updateProgress('fs', (processedFiles / totalFiles) * 100, totalRecords);

      // Allow other operations to run
      await this.sleep(1);
    }

    // Generate financial statement output
    const output: string[] = [];
    output.push('Basic Financial Statement');
    output.push('');
    output.push('Income Statement');
    let totalRevenue = 0;
    let totalExpenses = 0;
    for (const account of categories['Income Statement']['Revenues']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalRevenue += value;
    }
    for (const account of categories['Income Statement']['Expenses']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalExpenses += value;
    }
    output.push(`Net Income,${(totalRevenue - totalExpenses).toFixed(2)}`);
    output.push('');
    output.push('Balance Sheet');
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    output.push('Assets');
    for (const account of categories['Balance Sheet']['Assets']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalAssets += value;
    }
    output.push(`Total Assets,${totalAssets.toFixed(2)}`);
    output.push('');
    output.push('Liabilities');
    for (const account of categories['Balance Sheet']['Liabilities']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalLiabilities += value;
    }
    output.push(`Total Liabilities,${totalLiabilities.toFixed(2)}`);
    output.push('');
    output.push('Equity');
    for (const account of categories['Balance Sheet']['Equity']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalEquity += value;
    }
    output.push(
      `Retained Earnings (Net Income),${(totalRevenue - totalExpenses).toFixed(2)}`,
    );
    totalEquity += totalRevenue - totalExpenses;
    output.push(`Total Equity,${totalEquity.toFixed(2)}`);
    output.push('');
    output.push(
      `Assets = Liabilities + Equity, ${totalAssets.toFixed(2)} = ${(totalLiabilities + totalEquity).toFixed(2)}`,
    );

    await fs.promises.writeFile(outputFile, output.join('\n'));
  }

  // Helper Methods for Optimization
  private async processReportAsync(
    reportType: string,
    processor: () => Promise<void>
  ): Promise<void> {
    try {
      this.states[reportType] = {
        status: 'processing',
        progress: 0,
        startTime: performance.now(),
        recordsProcessed: 0,
      };

      const startMemory = process.memoryUsage();
      const startTime = performance.now();

      // Run processor in background (non-blocking)
      setImmediate(async () => {
        try {
          await processor();

          const endTime = performance.now();
          const duration = ((endTime - startTime) / 1000).toFixed(2);
          const endMemory = process.memoryUsage();

          this.states[reportType] = {
            status: 'completed',
            progress: 100,
            startTime,
            endTime,
            duration: `${duration}s`,
            recordsProcessed: this.states[reportType].recordsProcessed || 0,
          };

          // Store metrics
          this.metrics[reportType] = {
            totalExecutionTime: parseFloat(duration),
            recordsProcessed: this.states[reportType].recordsProcessed || 0,
            filesProcessed: fs.readdirSync('tmp').filter(f => f.endsWith('.csv')).length,
            memoryUsage: endMemory,
            averageRecordsPerSecond: Math.round((this.states[reportType].recordsProcessed || 0) / parseFloat(duration)),
          };

        } catch (error) {
          this.states[reportType] = {
            status: 'error',
            progress: 0,
            error: error.message,
            endTime: performance.now(),
          };
        }
      });

    } catch (error) {
      this.states[reportType] = {
        status: 'error',
        progress: 0,
        error: error.message,
      };
    }
  }

  private async processFileStreamOptimized(
    filePath: string,
    lineProcessor: (line: string, lineNumber: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const fileStream = createReadStream(filePath);
      const rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      });

      let lineNumber = 0;

      rl.on('line', (line) => {
        try {
          lineNumber++;
          if (line.trim()) {
            lineProcessor(line, lineNumber);
          }
        } catch (error) {
          rl.close();
          reject(error);
        }
      });

      rl.on('close', () => {
        resolve();
      });

      rl.on('error', (error) => {
        reject(error);
      });
    });
  }

  private updateProgress(reportType: string, progress: number, recordsProcessed?: number): void {
    if (this.states[reportType]) {
      this.states[reportType].progress = Math.round(progress);
      if (recordsProcessed !== undefined) {
        this.states[reportType].recordsProcessed = recordsProcessed;
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
