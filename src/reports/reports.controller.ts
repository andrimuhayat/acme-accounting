import { Controller, Get, Post, HttpCode, Param, Query, NotFoundException, BadRequestException } from '@nestjs/common';
import { ReportsService } from './reports.service';

// Shared constant - single source of truth for valid report types
export const REPORT_TYPES = ['accounts', 'yearly', 'fs', 'user-report'] as const;
export type ReportType = typeof REPORT_TYPES[number];

@Controller('api/v1/reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  /**
   * GET /api/v1/reports
   * Returns all report statuses keyed by report type (WITHOUT .csv suffix)
   * O(n) - iterates over dynamic keys from service state
   */
  @Get()
  getReportStatus() {
    // FIX: Dynamically source keys from service state (no hardcoded .csv)
    const states = this.reportsService.getAllStates().states;
    const result: Record<string, typeof states[string]> = {};
    for (const key of Object.keys(states)) {
      result[key] = this.reportsService.state(key);
    }
    return result;
  }

  /**
   * GET /api/v1/reports/status
   * Returns detailed states + metrics for all reports
   */
  @Get('status')
  getDetailedStatus() {
    return this.reportsService.getAllStates();
  }

  /**
   * GET /api/v1/reports/status/:reportType
   * Returns specific report status and metrics
   * @throws NotFoundException if reportType is invalid
   */
  @Get('status/:reportType')
  getSpecificReportStatus(@Param('reportType') reportType: string) {
    // FIX: Validate reportType and return 404 for invalid
    if (!REPORT_TYPES.includes(reportType as ReportType)) {
      throw new NotFoundException(
        `Invalid report type: ${reportType}. Valid types: ${REPORT_TYPES.join(', ')}`,
      );
    }
    const state = this.reportsService.state(reportType);
    const metrics = this.reportsService.getMetrics(reportType);
    return { state, metrics };
  }

  /**
   * POST /api/v1/reports?reports=accounts,yearly
   * Generate all reports or specified reports
   * @throws BadRequestException if any report type is invalid
   */
  @Post()
  @HttpCode(202) // 202 Accepted for async processing
  async generateReports(@Query('reports') reports?: string) {
    const startTime = Date.now();

    // Default to all reports if none specified
    const reportsToGenerate = reports
      ? reports.split(',').map((r) => r.trim())
      : [...REPORT_TYPES];

    // FIX: Validate all report types before starting any generation
    const invalidReports = reportsToGenerate.filter(
      (r) => !REPORT_TYPES.includes(r as ReportType),
    );
    if (invalidReports.length > 0) {
      throw new BadRequestException(
        `Invalid report types: ${invalidReports.join(', ')}. Valid types: ${REPORT_TYPES.join(', ')}`,
      );
    }

    // Start all requested reports asynchronously (non-blocking)
    // Uses Promise.all to start all in parallel, but doesn't await completion
    const promises: Promise<void>[] = [];

    if (reportsToGenerate.includes('accounts')) {
      promises.push(this.reportsService.accounts());
    }
    if (reportsToGenerate.includes('yearly')) {
      promises.push(this.reportsService.yearly());
    }
    if (reportsToGenerate.includes('fs')) {
      promises.push(this.reportsService.fs());
    }

    // Fire and forget - start all promises without awaiting
    // The actual processing happens asynchronously via setImmediate in service
    Promise.all(promises).catch((err) => {
      // Log but don't block - async errors are tracked in state
      console.error('Report generation error:', err);
    });

    // Return immediately with processing status
    return {
      message: 'Report generation started',
      status: 'processing',
      reportsRequested: reportsToGenerate,
      timestamp: new Date().toISOString(),
      checkStatusAt: '/api/v1/reports/status',
    };
  }

  /**
   * POST /api/v1/reports/:reportType
   * Generate a specific report type
   * @throws NotFoundException if reportType is invalid
   */
  @Post(':reportType')
  @HttpCode(202)
  async generateSpecificReport(@Param('reportType') reportType: string) {
    // FIX: Validate and throw proper exception instead of returning error object
    if (!REPORT_TYPES.includes(reportType as ReportType)) {
      throw new NotFoundException(
        `Invalid report type: ${reportType}. Valid types: ${REPORT_TYPES.join(', ')}`,
      );
    }

    // Start specific report generation (non-blocking)
    switch (reportType) {
      case 'accounts':
        this.reportsService.accounts(); // Fire and forget
        break;
      case 'yearly':
        this.reportsService.yearly();
        break;
      case 'fs':
        this.reportsService.fs();
        break;
      case 'user-report':
        this.reportsService.userReport();
        break;
    }

    return {
      message: `${reportType} report generation started`,
      status: 'processing',
      timestamp: new Date().toISOString(),
      checkStatusAt: `/api/v1/reports/status/${reportType}`,
    };
  }
}