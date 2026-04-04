import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './notification.gateway';
import {
  NotificationType,
  NotificationCreateDto,
  NotificationQuery,
  NotificationResponse,
  NotificationListResponse,
} from './notification.model';

/**
 * NotificationController - REST API for managing notifications
 *
 * Endpoints:
 * GET /api/v1/notifications                    - List notifications (with filters)
 * GET /api/v1/notifications/unread-count      - Get unread notification count
 * PATCH /api/v1/notifications/:id/read        - Mark notification as read
 * POST /api/v1/notifications/create            - Create a new notification
 */
@Controller('api/v1/notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  /**
   * List notifications with optional filters
   * GET /api/v1/notifications?userId=&type=&read=&limit=&offset=
   */
  @Get()
  async getNotifications(
    @Query('userId') userId?: string,
    @Query('type') type?: NotificationType,
    @Query('read') read?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<NotificationListResponse> {
    try {
      const query: NotificationQuery = {
        userId,
        type,
        read: read !== undefined ? read === 'true' : undefined,
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
      };

      return await this.notificationService.getForUser(query);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to get notifications',
      );
    }
  }

  /**
   * Get unread notification count for a user
   * GET /api/v1/notifications/unread-count?userId=
   */
  @Get('unread-count')
  async getUnreadCount(
    @Query('userId') userId: string,
  ): Promise<{ unreadCount: number }> {
    try {
      if (!userId) {
        throw new BadRequestException('userId is required');
      }
      const count = await this.notificationService.getUnreadCount(userId);
      return { unreadCount: count };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to get unread count',
      );
    }
  }

  /**
   * Mark a notification as read
   * PATCH /api/v1/notifications/:id/read
   */
  @Patch(':id/read')
  async markAsRead(
    @Param('id') id: string,
  ): Promise<NotificationResponse | null> {
    try {
      if (!id) {
        throw new BadRequestException('Notification ID is required');
      }
      const notification = await this.notificationService.markAsRead(id);
      if (notification) {
        // Emit read event via WebSocket
        this.notificationGateway.emitRead(notification.userId, notification.id);
        // Emit updated unread count
        const unreadCount = await this.notificationService.getUnreadCount(notification.userId);
        this.notificationGateway.emitUnreadCount(notification.userId, unreadCount);
      }
      return notification;
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to mark notification as read',
      );
    }
  }

  /**
   * Create a new notification
   * POST /api/v1/notifications/create
   */
  @Post('create')
  async createNotification(
    @Body() createDto: NotificationCreateDto,
  ): Promise<NotificationResponse> {
    try {
      // Validate required fields
      if (!createDto.userId) {
        throw new BadRequestException('userId is required');
      }
      if (!createDto.type) {
        throw new BadRequestException('type is required');
      }
      if (!createDto.title) {
        throw new BadRequestException('title is required');
      }
      if (!createDto.message) {
        throw new BadRequestException('message is required');
      }

      const notification = await this.notificationService.create(createDto);

      // Emit new notification event via WebSocket
      this.notificationGateway.emitToUser(notification.userId, notification);

      return notification;
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to create notification',
      );
    }
  }
}