import { Injectable } from '@nestjs/common';
import { performance } from 'perf_hooks';

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetTokenResponse {
  success: boolean;
  message: string;
  resetToken?: string;
  expiresAt?: number;
}

export interface PasswordResetPayload {
  resetToken: string;
  newPassword: string;
}

export interface PasswordResetResponse {
  success: boolean;
  message: string;
}

interface ResetTokenData {
  token: string;
  email: string;
  createdAt: number;
  expiresAt: number;
}

@Injectable()
export class ForgotPasswordService {
  // In-memory token store: Map<token, ResetTokenData> - O(1) lookup
  private tokenStore: Map<string, ResetTokenData> = new Map();
  private readonly TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

  /**
   * Request a password reset for the given email
   * O(1) time complexity: generates token and stores in Map
   *
   * @param request - Contains user's email address
   * @returns ResetTokenResponse with generated token and expiry
   */
  requestPasswordReset(request: ForgotPasswordRequest): ResetTokenResponse {
    if (!request || !request.email) {
      return {
        success: false,
        message: 'Email is required',
      };
    }

    if (!this.isValidEmail(request.email)) {
      return {
        success: false,
        message: 'Invalid email format',
      };
    }

    // Generate unique token
    const resetToken = this.generateResetToken();
    const now = performance.now();
    const expiresAt = now + this.TOKEN_EXPIRY_MS;

    // Store in Map for O(1) lookup during verification
    const tokenData: ResetTokenData = {
      token: resetToken,
      email: request.email,
      createdAt: now,
      expiresAt,
    };

    this.tokenStore.set(resetToken, tokenData);

    // In production: send email with reset link containing token
    // For now, return token for testing purposes
    return {
      success: true,
      message: `Password reset link has been sent to ${request.email}`,
      resetToken,
      expiresAt: Math.round(expiresAt),
    };
  }

  /**
   * Verify reset token validity
   * O(1) time complexity: direct Map lookup
   *
   * @param resetToken - Token to verify
   * @returns true if token is valid and not expired
   */
  verifyResetToken(resetToken: string): boolean {
    if (!resetToken) {
      return false;
    }

    const tokenData = this.tokenStore.get(resetToken);
    if (!tokenData) {
      return false;
    }

    // Check expiration
    const now = performance.now();
    if (now > tokenData.expiresAt) {
      this.tokenStore.delete(resetToken);
      return false;
    }

    return true;
  }

  /**
   * Reset password using valid reset token
   * O(1) time complexity: Map lookup + delete
   *
   * @param payload - Contains reset token and new password
   * @returns PasswordResetResponse indicating success or failure
   */
  resetPassword(payload: PasswordResetPayload): PasswordResetResponse {
    if (!payload || !payload.resetToken || !payload.newPassword) {
      return {
        success: false,
        message: 'Reset token and new password are required',
      };
    }

    if (!this.verifyResetToken(payload.resetToken)) {
      return {
        success: false,
        message: 'Invalid or expired reset token',
      };
    }

    if (payload.newPassword.length < 8) {
      return {
        success: false,
        message: 'Password must be at least 8 characters long',
      };
    }

    const tokenData = this.tokenStore.get(payload.resetToken);
    if (!tokenData) {
      return {
        success: false,
        message: 'Invalid reset token',
      };
    }

    // In production: hash password and update in database
    // For now, just remove used token
    this.tokenStore.delete(payload.resetToken);

    return {
      success: true,
      message: `Password has been reset successfully for ${tokenData.email}`,
    };
  }

  /**
   * Get token expiry time for a given token
   * O(1) time complexity: Map lookup
   *
   * @param resetToken - Token to check
   * @returns Expiry time in ms or null if invalid/expired
   */
  getTokenExpiry(resetToken: string): number | null {
    const tokenData = this.tokenStore.get(resetToken);
    if (!tokenData) {
      return null;
    }

    const now = performance.now();
    if (now > tokenData.expiresAt) {
      this.tokenStore.delete(resetToken);
      return null;
    }

    return Math.round(tokenData.expiresAt - now);
  }

  /**
   * Clean up expired tokens
   * O(n) time complexity where n = number of tokens in store
   */
  cleanupExpiredTokens(): void {
    const now = performance.now();
    const expiredTokens: string[] = [];

    for (const [token, data] of this.tokenStore.entries()) {
      if (now > data.expiresAt) {
        expiredTokens.push(token);
      }
    }

    for (const token of expiredTokens) {
      this.tokenStore.delete(token);
    }
  }

  /**
   * Validate email format
   * O(1) time complexity: simple regex check
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Generate random reset token
   * O(1) time complexity: string generation
   */
  private generateResetToken(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
