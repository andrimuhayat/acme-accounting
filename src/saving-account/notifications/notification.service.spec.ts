import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './notification.gateway';
import { Notification, NotificationType, NotificationCreateDto, NotificationQuery } from './notification.model';

// Mock the Notification model
jest.mock('./notification.model', () => ({
  Notification: {
    create: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
  },
}));

// Mock the NotificationGateway
jest.mock('./notification.gateway', () => ({
  NotificationGateway: jest.fn().mockImplementation(() => ({
    emitToUser: jest.fn(),
    emitRead: jest.fn(),
    emitUnreadCount: jest.fn(),
  })),
}));

describe('NotificationService', () => {
  let service: NotificationService;
  let mockNotificationModel: typeof Notification;
  let mockGateway: NotificationGateway;

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: NotificationGateway,
          useValue: {
            emitToUser: jest.fn(),
            emitRead: jest.fn(),
            emitUnreadCount: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    mockNotificationModel = Notification as unknown as typeof Notification;
    mockGateway = module.get<NotificationGateway>(NotificationGateway);
  });

  afterEach(() => {
    // Reset any mocked state
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================
  // create Tests
  // ============================================
  describe('create', () => {
    const mockNotificationResponse = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      userId: 'user-123',
      type: NotificationType.DEPOSIT,
      title: 'Deposit Successful',
      message: 'Your deposit of $100 was successful',
      metadata: { amount: 100, transactionId: 'txn-123' },
      read: false,
      createdAt: new Date(),
    };

    it('should create a notification with all required fields', async () => {
      const createDto: NotificationCreateDto = {
        userId: 'user-123',
        type: NotificationType.DEPOSIT,
        title: 'Deposit Successful',
        message: 'Your deposit of $100 was successful',
        metadata: { amount: 100, transactionId: 'txn-123' },
      };

      (mockNotificationModel.create as jest.Mock).mockResolvedValue(mockNotificationResponse);

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockNotificationResponse.id);
      expect(result.userId).toBe('user-123');
      expect(result.type).toBe(NotificationType.DEPOSIT);
      expect(result.title).toBe('Deposit Successful');
      expect(result.message).toBe('Your deposit of $100 was successful');
      expect(result.metadata).toEqual({ amount: 100, transactionId: 'txn-123' });
      expect(result.read).toBe(false);
      expect(mockNotificationModel.create).toHaveBeenCalledWith({
        userId: createDto.userId,
        type: createDto.type,
        title: createDto.title,
        message: createDto.message,
        metadata: createDto.metadata,
        read: false,
      });
    });

    it('should create a notification without optional metadata', async () => {
      const createDto: NotificationCreateDto = {
        userId: 'user-456',
        type: NotificationType.SECURITY_ALERT,
        title: 'New Login Detected',
        message: 'A new login was detected from an unknown device',
      };

      const responseWithoutMeta = { ...mockNotificationResponse, metadata: null };
      (mockNotificationModel.create as jest.Mock).mockResolvedValue(responseWithoutMeta);

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.metadata).toBeNull();
    });

    it('should create notification with SYSTEM type', async () => {
      const createDto: NotificationCreateDto = {
        userId: 'system-user',
        type: NotificationType.SYSTEM,
        title: 'System Maintenance',
        message: 'Scheduled maintenance at midnight',
      };

      const systemResponse = { ...mockNotificationResponse, type: NotificationType.SYSTEM };
      (mockNotificationModel.create as jest.Mock).mockResolvedValue(systemResponse);

      const result = await service.create(createDto);

      expect(result.type).toBe(NotificationType.SYSTEM);
    });

    it('should create notification with TRANSFER type', async () => {
      const createDto: NotificationCreateDto = {
        userId: 'user-789',
        type: NotificationType.TRANSFER,
        title: 'Transfer Complete',
        message: 'You have sent $500 to John Doe',
        metadata: { amount: 500, recipient: 'John Doe' },
      };

      const transferResponse = { ...mockNotificationResponse, type: NotificationType.TRANSFER };
      (mockNotificationModel.create as jest.Mock).mockResolvedValue(transferResponse);

      const result = await service.create(createDto);

      expect(result.type).toBe(NotificationType.TRANSFER);
    });

    it('should create notification with ACCOUNT_UPDATE type', async () => {
      const createDto: NotificationCreateDto = {
        userId: 'user-101',
        type: NotificationType.ACCOUNT_UPDATE,
        title: 'Account Updated',
        message: 'Your account name has been changed',
        metadata: { field: 'accountName', oldValue: 'Old Name', newValue: 'New Name' },
      };

      const updateResponse = { ...mockNotificationResponse, type: NotificationType.ACCOUNT_UPDATE };
      (mockNotificationModel.create as jest.Mock).mockResolvedValue(updateResponse);

      const result = await service.create(createDto);

      expect(result.type).toBe(NotificationType.ACCOUNT_UPDATE);
    });

    it('should throw error when userId is missing', async () => {
      const createDto = {
        type: NotificationType.DEPOSIT,
        title: 'Test',
        message: 'Test message',
      } as NotificationCreateDto;

      await expect(service.create(createDto)).rejects.toThrow();
    });

    it('should throw error when type is missing', async () => {
      const createDto = {
        userId: 'user-123',
        title: 'Test',
        message: 'Test message',
      } as NotificationCreateDto;

      await expect(service.create(createDto)).rejects.toThrow();
    });

    it('should throw error when database fails', async () => {
      const createDto: NotificationCreateDto = {
        userId: 'user-123',
        type: NotificationType.DEPOSIT,
        title: 'Test',
        message: 'Test message',
      };

      (mockNotificationModel.create as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      await expect(service.create(createDto)).rejects.toThrow('Database connection failed');
    });
  });

  // ============================================
  // markAsRead Tests
  // ============================================
  describe('markAsRead', () => {
    const mockNotification = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      userId: 'user-123',
      type: NotificationType.DEPOSIT,
      title: 'Deposit Successful',
      message: 'Your deposit was successful',
      metadata: null,
      read: false,
      createdAt: new Date(),
      update: jest.fn(),
    };

    it('should mark notification as read successfully', async () => {
      const updatedNotification = { ...mockNotification, read: true };
      (mockNotificationModel.findByPk as jest.Mock).mockResolvedValue(mockNotification);
      mockNotification.update.mockResolvedValue(updatedNotification);

      const result = await service.markAsRead(mockNotification.id);

      expect(result).toBeDefined();
      expect(result?.read).toBe(true);
      expect(mockNotificationModel.findByPk).toHaveBeenCalledWith(mockNotification.id);
    });

    it('should return null when notification does not exist', async () => {
      (mockNotificationModel.findByPk as jest.Mock).mockResolvedValue(null);

      const result = await service.markAsRead('non-existent-id');

      expect(result).toBeNull();
    });

    it('should return null when notification is already read', async () => {
      const readNotification = { ...mockNotification, read: true };
      (mockNotificationModel.findByPk as jest.Mock).mockResolvedValue(readNotification);

      const result = await service.markAsRead(readNotification.id);

      expect(result).toBeNull();
      expect(readNotification.update).not.toHaveBeenCalled();
    });

    it('should handle database error during markAsRead', async () => {
      (mockNotificationModel.findByPk as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.markAsRead('some-id')).rejects.toThrow('Database error');
    });

    it('should handle update failure after find', async () => {
      (mockNotificationModel.findByPk as jest.Mock).mockResolvedValue(mockNotification);
      mockNotification.update.mockRejectedValue(new Error('Update failed'));

      await expect(service.markAsRead(mockNotification.id)).rejects.toThrow('Update failed');
    });
  });

  // ============================================
  // markAllAsRead Tests
  // ============================================
  describe('markAllAsRead', () => {
    it('should mark multiple notifications as read', async () => {
      const ids = ['id-1', 'id-2', 'id-3'];
      const mockNotifications = ids.map((id, index) => ({
        id,
        userId: 'user-123',
        type: NotificationType.DEPOSIT,
        title: `Notification ${index}`,
        message: 'Message',
        metadata: null,
        read: false,
        createdAt: new Date(),
        update: jest.fn().mockResolvedValue({ ...{}, read: true }),
      }));

      (mockNotificationModel.findByPk as jest.Mock)
        .mockResolvedValueOnce(mockNotifications[0])
        .mockResolvedValueOnce(mockNotifications[1])
        .mockResolvedValueOnce(mockNotifications[2]);

      const result = await service.markAllAsRead(ids);

      expect(result).toBe(3);
      expect(mockNotifications[0].update).toHaveBeenCalled();
      expect(mockNotifications[1].update).toHaveBeenCalled();
      expect(mockNotifications[2].update).toHaveBeenCalled();
    });

    it('should return 0 when ids array is empty', async () => {
      const result = await service.markAllAsRead([]);

      expect(result).toBe(0);
    });

    it('should handle partial not-found notifications', async () => {
      const ids = ['id-1', 'id-2', 'id-3'];
      const foundNotification = {
        id: 'id-1',
        userId: 'user-123',
        type: NotificationType.DEPOSIT,
        title: 'Notification 1',
        message: 'Message',
        metadata: null,
        read: false,
        createdAt: new Date(),
        update: jest.fn().mockResolvedValue({ ...{}, read: true }),
      };

      (mockNotificationModel.findByPk as jest.Mock)
        .mockResolvedValueOnce(foundNotification)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await service.markAllAsRead(ids);

      expect(result).toBe(1);
    });

    it('should return count of successfully marked notifications', async () => {
      const ids = ['id-1', 'id-2'];
      const notification1 = {
        id: 'id-1',
        read: false,
        update: jest.fn().mockResolvedValue({ ...{}, read: true }),
      };
      const notification2 = {
        id: 'id-2',
        read: false,
        update: jest.fn().mockRejectedValue(new Error('Update failed')),
      };

      (mockNotificationModel.findByPk as jest.Mock)
        .mockResolvedValueOnce(notification1)
        .mockResolvedValueOnce(notification2);

      const result = await service.markAllAsRead(ids);

      expect(result).toBe(1);
    });
  });

  // ============================================
  // getForUser Tests
  // ============================================
  describe('getForUser', () => {
    const mockNotifications = [
      {
        id: 'id-1',
        userId: 'user-123',
        type: NotificationType.DEPOSIT,
        title: 'Deposit 1',
        message: 'First deposit',
        metadata: null,
        read: false,
        createdAt: new Date(),
      },
      {
        id: 'id-2',
        userId: 'user-123',
        type: NotificationType.WITHDRAWAL,
        title: 'Withdrawal 1',
        message: 'First withdrawal',
        metadata: null,
        read: true,
        createdAt: new Date(),
      },
    ];

    it('should return paginated notifications for a user', async () => {
      const query: NotificationQuery = {
        userId: 'user-123',
        limit: 10,
        offset: 0,
      };

      (mockNotificationModel.findAll as jest.Mock).mockResolvedValue(mockNotifications);
      
      // Mock count as well
      const countResult = [{ count: 2 }];
      (mockNotificationModel.findAll as jest.Mock)
        .mockResolvedValueOnce(mockNotifications)
        .mockResolvedValueOnce(countResult);

      const result = await service.getForUser(query);

      expect(result).toBeDefined();
      expect(result.notifications).toHaveLength(2);
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(0);
    });

    it('should filter notifications by type', async () => {
      const query: NotificationQuery = {
        userId: 'user-123',
        type: NotificationType.DEPOSIT,
        limit: 10,
        offset: 0,
      };

      (mockNotificationModel.findAll as jest.Mock).mockResolvedValue([mockNotifications[0]]);
      (mockNotificationModel.findAll as jest.Mock)
        .mockResolvedValueOnce([mockNotifications[0]])
        .mockResolvedValueOnce([{ count: 1 }]);

      const result = await service.getForUser(query);

      expect(result.notifications[0].type).toBe(NotificationType.DEPOSIT);
    });

    it('should filter notifications by read status', async () => {
      const query: NotificationQuery = {
        userId: 'user-123',
        read: false,
        limit: 10,
        offset: 0,
      };

      (mockNotificationModel.findAll as jest.Mock).mockResolvedValue([mockNotifications[0]]);
      (mockNotificationModel.findAll as jest.Mock)
        .mockResolvedValueOnce([mockNotifications[0]])
        .mockResolvedValueOnce([{ count: 1 }]);

      const result = await service.getForUser(query);

      expect(result.notifications[0].read).toBe(false);
    });

    it('should respect limit and offset parameters', async () => {
      const query: NotificationQuery = {
        userId: 'user-123',
        limit: 1,
        offset: 1,
      };

      (mockNotificationModel.findAll as jest.Mock).mockResolvedValue([mockNotifications[1]]);
      (mockNotificationModel.findAll as jest.Mock)
        .mockResolvedValueOnce([mockNotifications[1]])
        .mockResolvedValueOnce([{ count: 2 }]);

      const result = await service.getForUser(query);

      expect(result.limit).toBe(1);
      expect(result.offset).toBe(1);
    });

    it('should return empty array when no notifications found', async () => {
      const query: NotificationQuery = {
        userId: 'non-existent-user',
        limit: 10,
        offset: 0,
      };

      (mockNotificationModel.findAll as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getForUser(query);

      expect(result.notifications).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should throw error when database query fails', async () => {
      const query: NotificationQuery = {
        userId: 'user-123',
        limit: 10,
        offset: 0,
      };

      (mockNotificationModel.findAll as jest.Mock).mockRejectedValue(new Error('Query failed'));

      await expect(service.getForUser(query)).rejects.toThrow('Query failed');
    });

    it('should return all notification types correctly', async () => {
      const allTypesNotifications = Object.values(NotificationType).map((type, index) => ({
        id: `id-${index}`,
        userId: 'user-123',
        type,
        title: `${type} Notification`,
        message: `Message for ${type}`,
        metadata: null,
        read: false,
        createdAt: new Date(),
      }));

      const query: NotificationQuery = {
        userId: 'user-123',
        limit: 100,
        offset: 0,
      };

      (mockNotificationModel.findAll as jest.Mock)
        .mockResolvedValueOnce(allTypesNotifications)
        .mockResolvedValueOnce([{ count: allTypesNotifications.length }]);

      const result = await service.getForUser(query);

      expect(result.notifications).toHaveLength(Object.values(NotificationType).length);
    });
  });

  // ============================================
  // getUnreadCount Tests
  // ============================================
  describe('getUnreadCount', () => {
    it('should return correct unread count for user', async () => {
      const mockCountResult = [{ count: 5 }];
      (mockNotificationModel.findAll as jest.Mock).mockResolvedValue(mockCountResult);

      const result = await service.getUnreadCount('user-123');

      expect(result).toBe(5);
    });

    it('should return 0 when user has no unread notifications', async () => {
      (mockNotificationModel.findAll as jest.Mock).mockResolvedValue([{ count: 0 }]);

      const result = await service.getUnreadCount('user-with-no-unread');

      expect(result).toBe(0);
    });

    it('should return 0 when user has no notifications at all', async () => {
      (mockNotificationModel.findAll as jest.Mock).mockResolvedValue([{ count: 0 }]);

      const result = await service.getUnreadCount('new-user');

      expect(result).toBe(0);
    });

    it('should throw error when database query fails', async () => {
      (mockNotificationModel.findAll as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.getUnreadCount('user-123')).rejects.toThrow('Database error');
    });

    it('should handle large unread counts', async () => {
      (mockNotificationModel.findAll as jest.Mock).mockResolvedValue([{ count: 999999 }]);

      const result = await service.getUnreadCount('active-user');

      expect(result).toBe(999999);
    });
  });

  // ============================================
  // findById Tests
  // ============================================
  describe('findById', () => {
    const mockNotification = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      userId: 'user-123',
      type: NotificationType.DEPOSIT,
      title: 'Deposit Successful',
      message: 'Your deposit was successful',
      metadata: { amount: 100 },
      read: false,
      createdAt: new Date(),
    };

    it('should return notification when found', async () => {
      (mockNotificationModel.findByPk as jest.Mock).mockResolvedValue(mockNotification);

      const result = await service.findById(mockNotification.id);

      expect(result).toBeDefined();
      expect(result?.id).toBe(mockNotification.id);
      expect(result?.title).toBe('Deposit Successful');
    });

    it('should return null when notification does not exist', async () => {
      (mockNotificationModel.findByPk as jest.Mock).mockResolvedValue(null);

      const result = await service.findById('non-existent-id');

      expect(result).toBeNull();
    });

    it('should return notification with all fields correctly populated', async () => {
      (mockNotificationModel.findByPk as jest.Mock).mockResolvedValue(mockNotification);

      const result = await service.findById(mockNotification.id);

      expect(result).toEqual(expect.objectContaining({
        id: mockNotification.id,
        userId: mockNotification.userId,
        type: mockNotification.type,
        title: mockNotification.title,
        message: mockNotification.message,
        metadata: mockNotification.metadata,
        read: mockNotification.read,
      }));
    });

    it('should throw error when database lookup fails', async () => {
      (mockNotificationModel.findByPk as jest.Mock).mockRejectedValue(new Error('Database unavailable'));

      await expect(service.findById('some-id')).rejects.toThrow('Database unavailable');
    });

    it('should handle notification with null metadata', async () => {
      const notificationWithNullMeta = { ...mockNotification, metadata: null };
      (mockNotificationModel.findByPk as jest.Mock).mockResolvedValue(notificationWithNullMeta);

      const result = await service.findById(mockNotification.id);

      expect(result?.metadata).toBeNull();
    });
  });

  // ============================================
  // delete Tests
  // ============================================
  describe('delete', () => {
    it('should return true when notification is deleted successfully', async () => {
      const mockNotification = {
        id: 'to-delete-id',
        destroy: jest.fn().mockResolvedValue(true),
      };
      (mockNotificationModel.findByPk as jest.Mock).mockResolvedValue(mockNotification);

      const result = await service.delete('to-delete-id');

      expect(result).toBe(true);
      expect(mockNotification.destroy).toHaveBeenCalled();
    });

    it('should return false when notification does not exist', async () => {
      (mockNotificationModel.findByPk as jest.Mock).mockResolvedValue(null);

      const result = await service.delete('non-existent-id');

      expect(result).toBe(false);
    });

    it('should return false when notification was already deleted', async () => {
      const mockNotification = {
        id: 'already-deleted-id',
        destroy: jest.fn().mockRejectedValue(new Error('Already deleted')),
      };
      (mockNotificationModel.findByPk as jest.Mock).mockResolvedValue(mockNotification);

      const result = await service.delete('already-deleted-id');

      expect(result).toBe(false);
    });

    it('should throw error when database operation fails', async () => {
      (mockNotificationModel.findByPk as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.delete('some-id')).rejects.toThrow('Database error');
    });

    it('should delete notification and return true for valid id', async () => {
      const mockNotification = {
        id: 'valid-delete-id',
        userId: 'user-123',
        type: NotificationType.DEPOSIT,
        title: 'To Delete',
        message: 'Will be deleted',
        metadata: null,
        read: false,
        createdAt: new Date(),
        destroy: jest.fn().mockResolvedValue(true),
      };
      (mockNotificationModel.findByPk as jest.Mock).mockResolvedValue(mockNotification);

      const result = await service.delete('valid-delete-id');

      expect(result).toBe(true);
      expect(mockNotification.destroy).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================
  // Integration Tests
  // ============================================
  describe('Integration Tests', () => {
    it('should create notification and emit via WebSocket gateway', async () => {
      const createDto: NotificationCreateDto = {
        userId: 'user-123',
        type: NotificationType.DEPOSIT,
        title: 'Integration Test',
        message: 'Testing WebSocket emission',
        metadata: { amount: 100 },
      };

      const mockResponse = {
        id: 'integration-test-id',
        ...createDto,
        read: false,
        createdAt: new Date(),
      };

      (mockNotificationModel.create as jest.Mock).mockResolvedValue(mockResponse);

      await service.create(createDto);

      expect(mockGateway.emitToUser).toHaveBeenCalledWith('user-123', mockResponse);
    });

    it('should mark as read and emit updated unread count', async () => {
      const mockNotification = {
        id: 'test-id',
        userId: 'user-123',
        type: NotificationType.DEPOSIT,
        title: 'Test',
        message: 'Test message',
        metadata: null,
        read: false,
        createdAt: new Date(),
        update: jest.fn().mockResolvedValue({ ...{}, read: true }),
      };

      (mockNotificationModel.findByPk as jest.Mock).mockResolvedValue(mockNotification);
      (mockNotificationModel.findAll as jest.Mock).mockResolvedValue([{ count: 0 }]);

      await service.markAsRead('test-id');

      expect(mockGateway.emitRead).toHaveBeenCalledWith('user-123', 'test-id');
      expect(mockGateway.emitUnreadCount).toHaveBeenCalledWith('user-123', 0);
    });

    it('should handle complete notification lifecycle', async () => {
      // Create
      const createDto: NotificationCreateDto = {
        userId: 'lifecycle-user',
        type: NotificationType.TRANSFER,
        title: 'Transfer Sent',
        message: 'You sent $200',
        metadata: { amount: 200, recipient: 'Jane' },
      };

      const createdNotification = {
        id: 'lifecycle-id',
        ...createDto,
        read: false,
        createdAt: new Date(),
      };

      (mockNotificationModel.create as jest.Mock).mockResolvedValue(createdNotification);

      const created = await service.create(createDto);
      expect(created.id).toBe('lifecycle-id');

      // Find
      (mockNotificationModel.findByPk as jest.Mock).mockResolvedValue(createdNotification);
      const found = await service.findById('lifecycle-id');
      expect(found?.id).toBe('lifecycle-id');

      // Get unread count
      (mockNotificationModel.findAll as jest.Mock).mockResolvedValue([{ count: 1 }]);
      const count = await service.getUnreadCount('lifecycle-user');
      expect(count).toBe(1);

      // Mark as read
      const readNotification = { ...createdNotification, read: true };
      (mockNotificationModel.findByPk as jest.Mock).mockResolvedValue(createdNotification);
      (mockNotificationModel.findAll as jest.Mock).mockResolvedValue([{ count: 0 }]);
      await service.markAsRead('lifecycle-id');

      // Delete
      const deleteNotification = { ...createdNotification, destroy: jest.fn().mockResolvedValue(true) };
      (mockNotificationModel.findByPk as jest.Mock).mockResolvedValue(deleteNotification);
      const deleted = await service.delete('lifecycle-id');
      expect(deleted).toBe(true);
    });

    it('should get notifications with multiple filters applied', async () => {
      const query: NotificationQuery = {
        userId: 'multi-filter-user',
        type: NotificationType.DEPOSIT,
        read: false,
        limit: 5,
        offset: 10,
      };

      const filteredNotifications = [
        {
          id: 'filtered-1',
          userId: 'multi-filter-user',
          type: NotificationType.DEPOSIT,
          title: 'Filtered Deposit',
          message: 'Filtered message',
          metadata: null,
          read: false,
          createdAt: new Date(),
        },
      ];

      (mockNotificationModel.findAll as jest.Mock)
        .mockResolvedValueOnce(filteredNotifications)
        .mockResolvedValueOnce([{ count: 15 }]);

      const result = await service.getForUser(query);

      expect(result.notifications).toHaveLength(1);
      expect(result.limit).toBe(5);
      expect(result.offset).toBe(10);
    });
  });
});