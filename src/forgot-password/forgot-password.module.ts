import { Module } from '@nestjs/common';
import { ForgotPasswordService } from './forgot-password.service';

@Module({
  providers: [ForgotPasswordService],
  exports: [ForgotPasswordService],
})
export class ForgotPasswordModule {}
