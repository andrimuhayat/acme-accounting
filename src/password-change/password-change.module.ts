import { Module } from '@nestjs/common';
import { PasswordChangeService } from './password-change.service';

@Module({
  providers: [PasswordChangeService],
  exports: [PasswordChangeService],
})
export class PasswordChangeModule {}