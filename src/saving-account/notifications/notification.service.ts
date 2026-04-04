import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Notification, NotificationType, NotificationCreateDto, NotificationQuery, NotificationResponse, NotificationListResponse } from './notification.model';

/**
 * NotificationService - Handles CRUD operations for notifications
 * 
 * Time Complexity:
 * - create(): O(1) for insert
 * - findById(): O(1) for primary key lookup
 * - getForUser(): O(n) where n = matching records
 * - getUnreadCount(): O(n) indexed query
 * - markAsRead(): O(1) for primary key lookup + update
 */
@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(Notification)
    private readonly notificationModel: typeof Notification,
  ) {}

  // Cache for unread counts per user (TTL: 30 seconds)
  private unreadCountCache: Map<string, { count: number; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 30000;

  /**
   * Create a new notification
   * Time complexity: O(1) for insert
   */
  async create(dto: NotificationCreateDto): Promise<NotificationResponse> {
    const notification = await this.notificationModel.create({
      userId: dto.userId,
      type: dto.type,
      title: dto.title,
      message: dto.message,
      metadata: dto.metadata || null,
      read: false,
    });

    // Invalidate cache for this user
    this.invalidateCache(dto.userId);

    return this.toResponse(notification);
  }

  /**
   * Find notification by ID
   * Time complexity: O(1) for primary key lookup
   */
  async findById(id: string): Promise<NotificationResponse | null> {
    const notification = await this.notificationModel.findByPk(id);
    return notification ? this.toResponse(notification) : null;
  }

  /**
   * Mark a notification as read
   * Time complexity: O(1) for primary key lookup + O(1) for update
   */
  async markAsRead(id: string): Promise<NotificationResponse | null> {
    const notification = await this.notificationModel.findByPk(id);
    
    if (!notification) {
      return null;
    }

    notification.read = true;
    await notification.save();

    // Invalidate cache for this user
    this.invalidateCache(notification.userId);

    return this.toResponse(notification);
  }

  /**
   * Mark multiple notifications as read
   * Time complexity: O(n) where n = number of IDs
   */
  async markAllAsRead(ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    // Get affected userIds before update for cache invalidation
    const notifications = await this.notificationModel.findAll({
      where: { id: ids },
      attributes: ['userId'],
    });

    const userIds = [...new Set(notifications.map(n => n.userId))];

    const [affectedCount] = await this.notificationModel.update(
      { read: true },
      { where: { id: ids } },
    );

    // Invalidate cache for affected users
    userIds.forEach(userId => this.invalidateCache(userId));

    return affectedCount;
  }

  /**
   * Get notifications for a user with optional filters
   * Time complexity: O(n) where n = matching records
   */
  async getForUser(query: NotificationQuery): Promise<NotificationListResponse> {
    const where: any = {};

    if (query.userId) {
      where.userId = query.userId;
    }
    if (query.type) {
      where.type = query.type;
    }
    if (query.read !== undefined) {
      where.read = query.read;
    }

    const limit = query.limit || 50;
    const offset = query.offset || 0;

    // Get total count for pagination
    const total = await this.notificationModel.count({ where });

    const notifications = await this.notificationModel.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return {
      notifications: notifications.map(n => this.toResponse(n)),
      total,
      limit,
      offset,
    };
  }

  /**
   * Get unread notification count for a user
   * Time complexity: O(n) indexed query (cached)
   */
  async getUnreadCount(userId: string): Promise<number> {
    // Check cache first
    const cached = this.unreadCountCache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.count;
    }

    const count = await this.notificationModel.count({
      where: {
        userId,
        read: false,
      },
    });

    // Update cache
    this.unreadCountCache.set(userId, { count, timestamp: Date.now() });

    return count;
  }

  /**
   * Delete a notification
   * Time complexity: O(1) for primary key lookup + delete
   */
  async delete(id: string): Promise<boolean> {
    const notification = await this.notificationModel.findByPk(id);
    
    if (!notification) {
      return false;
    }

    const userId = notification.userId;
    await notification.destroy();

    // Invalidate cache for this user
    this.invalidateCache(userId);

    return true;
  }

  /**
   * Convert model to response DTO
   */
  private toResponse(notification: Notification): NotificationResponse {
    return {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      metadata: notification.metadata,
      read: notification.read,
      createdAt: notification.createdAt,
    };
  }

  /**
   * Invalidate cache for a user
   */
  private invalidateCache(userId: string): void {
    this.unreadCountCache.delete(userId);
  }
}
