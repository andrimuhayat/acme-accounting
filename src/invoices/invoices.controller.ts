import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { UpdateInvoiceStatusDto, InvoiceResponseDto } from './dto/invoice-response.dto';

interface RequestWithUser extends Request {
  user: {
    userId: number;
    [key: string]: any;
  };
}

interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  /**
   * Create a new invoice
   * POST /invoices
   * Time Complexity: O(n) where n is number of items
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateInvoiceDto,
    @Request() req: RequestWithUser,
  ): Promise<InvoiceResponseDto> {
    return this.invoicesService.createInvoice(req.user.userId, dto);
  }

  /**
   * Get all invoices for authenticated user (paginated)
   * GET /invoices?page=1&limit=10
   * Time Complexity: O(n) where n is number of user invoices
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Request() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<PaginatedResult<InvoiceResponseDto>> {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.invoicesService.getInvoicesByUser(req.user.userId, pageNum, limitNum);
  }

  /**
   * Get single invoice by ID (owner only)
   * GET /invoices/:id
   * Time Complexity: O(1) lookup + O(m) where m is number of items
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: RequestWithUser,
  ): Promise<InvoiceResponseDto> {
    return this.invoicesService.getInvoiceById(id, req.user.userId);
  }

  /**
   * Update invoice (owner only)
   * PATCH /invoices/:id
   * Time Complexity: O(n) where n is number of items to update
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInvoiceDto,
    @Request() req: RequestWithUser,
  ): Promise<InvoiceResponseDto> {
    return this.invoicesService.updateInvoice(id, req.user.userId, dto);
  }

  /**
   * Update invoice status (admin only)
   * PATCH /invoices/:id/status
   * Time Complexity: O(1)
   */
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInvoiceStatusDto,
    @Request() req: RequestWithUser,
  ): Promise<InvoiceResponseDto> {
    return this.invoicesService.updateInvoiceStatus(id, dto);
  }
}