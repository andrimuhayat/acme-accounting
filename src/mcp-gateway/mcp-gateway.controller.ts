import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { McpGatewayService } from './mcp-gateway.service';

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

@Controller('api/v1/mcp-gateway')
export class McpGatewayController {
  constructor(private readonly mcpGatewayService: McpGatewayService) {}

  @Post('categorize')
  @HttpCode(HttpStatus.OK)
  async categorize(@Body() request: CategorizeRequest): Promise<CategorizeResponse> {
    return this.mcpGatewayService.categorize(request);
  }

  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  async analyze(@Body() request: AnalyzeRequest): Promise<AnalyzeResponse> {
    return this.mcpGatewayService.analyze(request);
  }

  @Post('insights')
  @HttpCode(HttpStatus.OK)
  async insights(@Body() request: InsightsRequest): Promise<InsightsResponse> {
    return this.mcpGatewayService.getInsights(request);
  }

  @Get('status')
  async getStatus(): Promise<StatusResponse> {
    return this.mcpGatewayService.getStatus();
  }
}