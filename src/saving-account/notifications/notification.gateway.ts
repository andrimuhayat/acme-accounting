import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

/**
 * NotificationGateway - WebSocket gateway for real-time notifications
 * 
 * Namespace: /ws/notifications
 * 
 * Events (server → client):
 * - notification:new - New notification created
 * - notification:read - Notification marked as read
 * - notification:unread_count - Unread count update
 * 
 * Events (client → server):
 * - notification:subscribe - Subscribe to user notifications
 * - notification:unsubscribe - Unsubscribe from notifications
 */
@WebSocketGateway({
  namespace: '/ws/notifications',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  // Map of userId -> Set of socket IDs
  private userSockets: Map<string, Set<string>> = new Map();

  /**
   * Handle new client connection
   * Time complexity: O(1)
   */
  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
  }

  /**
   * Handle client disconnection
   * Time complexity: O(1) for socket removal
   */
  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.removeSocketFromAllUsers(client.id);
  }

  /**
   * Subscribe to notifications for a specific user
   * Time complexity: O(1) for map operations
   */
  @SubscribeMessage('notification:subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ): void {
    const { userId } = data;
    
    if (!userId) {
      client.emit('error', { message: 'userId is required' });
      return;
    }

    // Add socket to user's subscription list
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(client.id);

    this.logger.log(`Client ${client.id} subscribed to notifications for user ${userId}`);
    client.emit('notification:subscribed', { userId, success: true });
  }

  /**
   * Unsubscribe from notifications
   * Time complexity: O(1) for socket removal
   */
  @SubscribeMessage('notification:unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ): void {
    const { userId } = data;
    
    if (!userId) {
      client.emit('error', { message: 'userId is required' });
      return;
    }

    this.removeSocketFromUser(userId, client.id);
    this.logger.log(`Client ${client.id} unsubscribed from notifications for user ${userId}`);
    client.emit('notification:unsubscribed', { userId, success: true });
  }

  /**
   * Emit a new notification to a specific user
   * Time complexity: O(1) for socket lookup + O(n) for emission where n = socket count
   * 
   * @param userId - Target user ID
   * @param notification - Notification data to emit
   */
  emitToUser(userId: string, notification: any): void {
    const sockets = this.userSockets.get(userId);
    
    if (!sockets || sockets.size === 0) {
      this.logger.debug(`No active sockets for user ${userId}`);
      return;
    }

    sockets.forEach(socketId => {
      this.server.to(socketId).emit('notification:new', notification);
    });

    this.logger.debug(`Emitted notification:new to user ${userId}`);
  }

  /**
   * Emit read event for a notification
   * Time complexity: O(1) for socket lookup + O(n) for emission
   * 
   * @param userId - Target user ID
   * @param notificationId - ID of the notification that was read
   */
  emitRead(userId: string, notificationId: string): void {
    const sockets = this.userSockets.get(userId);
    
    if (!sockets || sockets.size === 0) {
      return;
    }

    sockets.forEach(socketId => {
      this.server.to(socketId).emit('notification:read', { notificationId });
    });

    this.logger.debug(`Emitted notification:read to user ${userId}`);
  }

  /**
   * Emit unread count update to a specific user
   * Time complexity: O(1) for socket lookup + O(n) for emission
   * 
   * @param userId - Target user ID
   * @param count - New unread count
   */
  emitUnreadCount(userId: string, count: number): void {
    const sockets = this.userSockets.get(userId);
    
    if (!sockets || sockets.size === 0) {
      return;
    }

    sockets.forEach(socketId => {
      this.server.to(socketId).emit('notification:unread_count', { count });
    });

    this.logger.debug(`Emitted notification:unread_count (${count}) to user ${userId}`);
  }

  /**
   * Remove a socket from a specific user's subscription
   * Time complexity: O(1)
   */
  private removeSocketFromUser(userId: string, socketId: string): void {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }
  }

  /**
   * Remove a socket from all user subscriptions (on disconnect)
   * Time complexity: O(n) where n = number of users
   */
  private removeSocketFromAllUsers(socketId: string): void {
    for (const [userId, sockets] of this.userSockets.entries()) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }
  }

  /**
   * Get the number of active subscriptions for a user
   * Time complexity: O(1)
   */
  getSubscriptionCount(userId: string): number {
    return this.userSockets.get(userId)?.size || 0;
  }

  /**
   * Get total number of subscribed users
   * Time complexity: O(n) where n = number of users
   */
  getTotalSubscribedUsers(): number {
    return this.userSockets.size;
  }
}
