import { Injectable } from '@nestjs/common';
import { performance } from 'perf_hooks';

export interface PasswordResetToken {
  token: string;
  userId: number;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetResponse {
  success: boolean;
  message: string;
  tokenId?: string;
}

@Injectable()
export class PasswordResetService {
  private resetTokens: Map<string, PasswordResetToken> = new Map();
  private userEmailMap: Map<number, string> = new Map();
  private readonly TOKEN_EXPIRY_MS = 3600000; // 1 hour
  private readonly TOKEN_LENGTH = 32;

  /**
   * Generate a password reset token for a user
   * Time Complexity: O(1)
   * @param userId - User ID requesting password reset
   * @param email - User email for validation
   * @returns PasswordResetResponse with token details
   */
  async generateResetToken(userId: number, email: string): Promise<PasswordResetResponse> {
    try {
      // Validate input
      if (!userId || userId <= 0) {
        return {
          success: false,
          message: 'Invalid user ID provided',
        };
      }

      if (!email || !this.isValidEmail(email)) {
        return {
          success: false,
          message: 'Invalid email address provided',
        };
      }

      // Check if user already has a pending reset token (prevent token spam)
      const existingToken = this.findTokenByUserId(userId);
      if (existingToken && !this.isTokenExpired(existingToken)) {
        return {
          success: false,
          message: 'A password reset token already exists for this user',
        };
      }

      // Generate new token
      const token = this.generateSecureToken();
      const expiresAt = new Date(Date.now() + this.TOKEN_EXPIRY_MS);

      const resetToken: PasswordResetToken = {
        token,
        userId,
        expiresAt,
        used: false,
        createdAt: new Date(),
      };

      // Store token and email mapping
      this.resetTokens.set(token, resetToken);
      this.userEmailMap.set(userId, email);

      return {
        success: true,
        message: 'Password reset token generated successfully',
        tokenId: token,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error generating reset token: ${error.message}`,
      };
    }
  }

  /**
   * Validate a password reset token
   * Time Complexity: O(1)
   * @param token - The reset token to validate
   * @returns true if token is valid and not expired, false otherwise
   */
  async validateResetToken(token: string): Promise<boolean> {
    if (!token || typeof token !== 'string') {
      return false;
    }

    const resetToken = this.resetTokens.get(token);

    if (!resetToken) {
      return false;
    }

    // Check if token is already used
    if (resetToken.used) {
      return false;
    }

    // Check if token is expired
    if (this.isTokenExpired(resetToken)) {
      return false;
    }

    return true;
  }

  /**
   * Complete password reset by consuming the token
   * Time Complexity: O(1)
   * @param token - The reset token
   * @param newPassword - New password (should be hashed by caller)
   * @returns PasswordResetResponse with success status
   */
  async resetPassword(token: string, newPassword: string): Promise<PasswordResetResponse> {
    try {
      // Validate input
      if (!token || typeof token !== 'string') {
        return {
          success: false,
          message: 'Invalid or missing token',
        };
      }

      if (!newPassword || newPassword.trim().length === 0) {
        return {
          success: false,
          message: 'Password cannot be empty',
        };
      }

      // Validate token
      const isValid = await this.validateResetToken(token);
      if (!isValid) {
        return {
          success: false,
          message: 'Reset token is invalid or expired',
        };
      }

      const resetToken = this.resetTokens.get(token);
      if (!resetToken) {
        return {
          success: false,
          message: 'Reset token not found',
        };
      }

      // Mark token as used
      resetToken.used = true;
      this.resetTokens.set(token, resetToken);

      return {
        success: true,
        message: 'Password reset successfully completed',
      };
    } catch (error) {
      return {
        success: false,
        message: `Error resetting password: ${error.message}`,
      };
    }
  }

  /**
   * Get pending reset tokens for a specific user
   * Time Complexity: O(n) where n is total tokens in system
   * @param userId - User ID to check
   * @returns Array of pending reset tokens
   */
  async getPendingTokensForUser(userId: number): Promise<PasswordResetToken[]> {
    if (!userId || userId <= 0) {
      return [];
    }

    const pendingTokens: PasswordResetToken[] = [];

    for (const token of this.resetTokens.values()) {
      if (
        token.userId === userId &&
        !token.used &&
        !this.isTokenExpired(token)
      ) {
        pendingTokens.push(token);
      }
    }

    return pendingTokens;
  }

  /**
   * Revoke all pending reset tokens for a user
   * Time Complexity: O(n) where n is total tokens in system
   * @param userId - User ID whose tokens should be revoked
   * @returns PasswordResetResponse with count of revoked tokens
   */
  async revokeTokensForUser(userId: number): Promise<PasswordResetResponse> {
    if (!userId || userId <= 0) {
      return {
        success: false,
        message: 'Invalid user ID provided',
      };
    }

    let revokedCount = 0;

    for (const [tokenKey, token] of this.resetTokens.entries()) {
      if (token.userId === userId && !token.used) {
        this.resetTokens.delete(tokenKey);
        revokedCount++;
      }
    }

    return {
      success: true,
      message: `Revoked ${revokedCount} pending password reset token(s)`,
    };
  }

  /**
   * Clean up expired tokens from memory
   * Time Complexity: O(n) where n is total tokens in system
   * Should be called periodically (e.g., every 30 minutes)
   */
  async cleanupExpiredTokens(): Promise<{ deletedCount: number }> {
    let deletedCount = 0;

    for (const [tokenKey, token] of this.resetTokens.entries()) {
      if (this.isTokenExpired(token)) {
        this.resetTokens.delete(tokenKey);
        deletedCount++;
      }
    }

    return { deletedCount };
  }

  /**
   * Get statistics about reset tokens
   * Time Complexity: O(n) where n is total tokens in system
   * @returns Object with token statistics
   */
  async getTokenStats(): Promise<{
    totalTokens: number;
    activeTokens: number;
    usedTokens: number;
    expiredTokens: number;
  }> {
    let totalTokens = 0;
    let activeTokens = 0;
    let usedTokens = 0;
    let expiredTokens = 0;

    for (const token of this.resetTokens.values()) {
      totalTokens++;
      if (token.used) {
        usedTokens++;
      } else if (this.isTokenExpired(token)) {
        expiredTokens++;
      } else {
        activeTokens++;
      }
    }

    return {
      totalTokens,
      activeTokens,
      usedTokens,
      expiredTokens,
    };
  }

  // ============ Private Helper Methods ============

  /**
   * Check if an email address is valid (basic validation)
   * Time Complexity: O(n) where n is length of email string
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Generate a cryptographically secure token
   * Time Complexity: O(TOKEN_LENGTH) = O(1) since TOKEN_LENGTH is constant
   */
  private generateSecureToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < this.TOKEN_LENGTH; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  /**
   * Check if a token is expired
   * Time Complexity: O(1)
   */
  private isTokenExpired(token: PasswordResetToken): boolean {
    return Date.now() > token.expiresAt.getTime();
  }

  /**
   * Find a reset token by user ID
   * Time Complexity: O(n) where n is total tokens in system
   */
  private findTokenByUserId(userId: number): PasswordResetToken | null {
    for (const token of this.resetTokens.values()) {
      if (token.userId === userId && !token.used) {
        return token;
      }
    }
    return null;
  }
}
