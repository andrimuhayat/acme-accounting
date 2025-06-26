import { Controller, Get, Post, HttpCode, Param, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('api/v1/reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get()
  getReportStatus() {
    return {
      'accounts.csv': this.reportsService.state('accounts'),
      'yearly.csv': this.reportsService.state('yearly'),
      'fs.csv': this.reportsService.state('fs'),
    };
  }

  @Get('status')
  getDetailedStatus() {
    return this.reportsService.getAllStates();
  }

  @Get('status/:reportType')
  getSpecificReportStatus(@Param('reportType') reportType: string) {
    const state = this.reportsService.state(reportType);
    const metrics = this.reportsService.getMetrics(reportType);
    return {
      state,
      metrics,
    };
  }

  @Post()
  @HttpCode(202) // Changed to 202 Accepted for async processing
  async generateReports(@Query('reports') reports?: string) {
    const startTime = Date.now();

    // Parse which reports to generate (default: all)
    const reportsToGenerate = reports ? reports.split(',') : ['accounts', 'yearly', 'fs'];

    // Start all requested reports asynchronously
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

    // Return immediately with processing status
    return {
      message: 'Report generation started',
      status: 'processing',
      reportsRequested: reportsToGenerate,
      timestamp: new Date().toISOString(),
      checkStatusAt: '/api/v1/reports/status',
    };
  }

  @Post(':reportType')
  @HttpCode(202)
  async generateSpecificReport(@Param('reportType') reportType: string) {
    const validReports = ['accounts', 'yearly', 'fs'];

    if (!validReports.includes(reportType)) {
      return {
        error: 'Invalid report type',
        validTypes: validReports,
      };
    }

    // Start specific report generation
    switch (reportType) {
      case 'accounts':
        await this.reportsService.accounts();
        break;
      case 'yearly':
        await this.reportsService.yearly();
        break;
      case 'fs':
        await this.reportsService.fs();
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
