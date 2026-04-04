import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Notification } from './notification.model';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationGateway } from './notification.gateway';

@Module({
  imports: [SequelizeModule.forFeature([Notification])],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationGateway],
  exports: [NotificationService],
})
export class NotificationModule {}

// Re-export for convenience
export { NotificationService } from './notification.service';
export { NotificationGateway } from './notification.gateway';
export { Notification } from './notification.model';
export {
  NotificationType,
  NotificationCreateDto,
  NotificationQuery,
  NotificationResponse,
  NotificationListResponse,
} from './notification.model';