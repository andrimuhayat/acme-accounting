import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { PasswordResetService } from './password-reset.service';

/**
 * DTO for forgot password request
 * Time Complexity: O(1)
 */
interface ForgotPasswordDto {
  email: string;
}

/**
 * DTO for reset password request
 * Time Complexity: O(1)
 */
interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

/**
 * Response DTO for forgot password
 * Time Complexity: O(1)
 */
interface ForgotPasswordResponseDto {
  success: boolean;
  message: string;
  /** Simulated email sent indicator (in production, actual email would be sent) */
  emailSent?: boolean;
}

/**
 * Response DTO for reset password
 * Time Complexity: O(1)
 */
interface ResetPasswordResponseDto {
  success: boolean;
  message: string;
}

/**
 * Password Reset Controller
 * Handles HTTP endpoints for forgot password and reset password flows
 * 
 * Flow:
 * 1. User requests password reset via POST /api/v1/auth/forgot-password
 * 2. System generates token (simulates email sending)
 * 3. User submits new password via POST /api/v1/auth/reset-password with token
 * 4. System validates token and resets password
 * 
 * Performance: All operations are O(1) for token validation and storage
 */
@Controller('api/v1/auth')
export class PasswordResetController {
  constructor(private readonly passwordResetService: PasswordResetService) {}

  /**
   * Handle forgot password request
   * Generates a password reset token for the user
   * 
   * Time Complexity: O(1) for token generation
   * @param forgotPasswordDto - Contains user email
   * @returns ForgotPasswordResponse with success status and simulated email indicator
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
  ): Promise<ForgotPasswordResponseDto> {
    // Validate email presence
    if (!forgotPasswordDto.email || forgotPasswordDto.email.trim().length === 0) {
      throw new BadRequestException('Email is required');
    }

    // Validate email format
    if (!this.isValidEmail(forgotPasswordDto.email)) {
      throw new BadRequestException('Invalid email format');
    }

    // NOTE: In production, we would:
    // 1. Look up user by email to get userId
    // 2. Generate reset token
    // 3. Send email with reset link
    // For now, we simulate by accepting any email and generating a token
    
    // Simulated userId lookup (in production, this would query the User table)
    const userId = this.simulateUserLookupByEmail(forgotPasswordDto.email);
    
    if (!userId) {
      // Return success anyway to prevent email enumeration attacks
      return {
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent',
        emailSent: false,
      };
    }

    const result = await this.passwordResetService.generateResetToken(
      userId,
      forgotPasswordDto.email,
    );

    if (!result.success) {
      // Handle case where token already exists
      if (result.message.includes('already exists')) {
        return {
          success: false,
          message: result.message,
          emailSent: false,
        };
      }
      throw new BadRequestException(result.message);
    }

    // In production: Send actual email with reset link
    // For demo: Return token info (NEVER do this in production!)
    return {
      success: true,
      message: result.message + ' (Token: ' + result.tokenId + ' - Demo only)',
      emailSent: true,
    };
  }

  /**
   * Handle reset password request
   * Validates token and resets the user's password
   * 
   * Time Complexity: O(1) for token validation
   * @param resetPasswordDto - Contains reset token and new password
   * @returns ResetPasswordResponse with success status
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
  ): Promise<ResetPasswordResponseDto> {
    // Validate token presence
    if (!resetPasswordDto.token || resetPasswordDto.token.trim().length === 0) {
      throw new BadRequestException('Reset token is required');
    }

    // Validate newPassword presence
    if (!resetPasswordDto.newPassword || resetPasswordDto.newPassword.trim().length === 0) {
      throw new BadRequestException('New password is required');
    }

    // Validate password minimum length (security best practice)
    if (resetPasswordDto.newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }

    // Validate the token first
    const isValidToken = await this.passwordResetService.validateResetToken(
      resetPasswordDto.token,
    );

    if (!isValidToken) {
      throw new BadRequestException('Reset token is invalid or expired');
    }

    // NOTE: In production, we would hash the new password before storing
    // For this demo, we pass it through (the service would handle hashing)
    const result = await this.passwordResetService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );

    if (!result.success) {
      throw new BadRequestException(result.message);
    }

    return {
      success: true,
      message: result.message,
    };
  }

  /**
   * Validate email format
   * Time Complexity: O(1)
   * @param email - Email string to validate
   * @returns true if valid email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Simulate user lookup by email
   * Time Complexity: O(1) - In production, this would be a DB query
   * 
   * NOTE: This is a simulation. In production:
   * - Query User table by email
   * - Return actual userId or null if not found
   * 
   * @param email - User email
   * @returns Simulated userId (for demo purposes)
   */
  private simulateUserLookupByEmail(email: string): number | null {
    // Simulate: accept certain demo emails
    const demoEmails: Record<string, number> = {
      'demo@acme.com': 1,
      'test@acme.com': 2,
      'admin@acme.com': 3,
    };
    return demoEmails[email.toLowerCase()] || null;
  }
}
