import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

export interface ChangePasswordResponse {
  success: boolean;
  message: string;
}

export interface StoredUserPassword {
  passwordHash: string;
}

@Injectable()
export class PasswordChangeService {
  // In-memory store for demo (replace with actual DB in production)
  private userPasswords: Map<number, StoredUserPassword> = new Map();
  private readonly BCRYPT_ROUNDS = 10;

  /**
   * Change password for a logged-in user
   * Time Complexity: O(1) for validation, O(n) for bcrypt operations
   * @param userId - User ID requesting password change
   * @param oldPassword - Current password for verification
   * @param newPassword - New password to set
   * @returns ChangePasswordResponse with success status
   */
  async changePassword(
    userId: number,
    oldPassword: string,
    newPassword: string,
  ): Promise<ChangePasswordResponse> {
    try {
      // Validate userId
      if (!userId || userId <= 0) {
        return {
          success: false,
          message: 'Invalid user ID provided',
        };
      }

      // Validate oldPassword is not empty
      if (!oldPassword || typeof oldPassword !== 'string' || oldPassword.trim().length === 0) {
        return {
          success: false,
          message: 'Old password cannot be empty',
        };
      }

      // Validate newPassword is not empty
      if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length === 0) {
        return {
          success: false,
          message: 'New password cannot be empty',
        };
      }

      // Check if user exists in our store
      const storedUser = this.userPasswords.get(userId);
      if (!storedUser) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      // Verify old password matches stored hash using bcrypt.compare
      const isOldPasswordValid = await bcrypt.compare(oldPassword, storedUser.passwordHash);
      if (!isOldPasswordValid) {
        return {
          success: false,
          message: 'Current password is incorrect',
        };
      }

      // Verify new password is different from old password
      const isSameAsOld = await bcrypt.compare(newPassword, storedUser.passwordHash);
      if (isSameAsOld) {
        return {
          success: false,
          message: 'New password must be different from current password',
        };
      }

      // Hash new password with bcrypt
      const newPasswordHash = await bcrypt.hash(newPassword, this.BCRYPT_ROUNDS);

      // Store the new password hash (replace existing)
      this.userPasswords.set(userId, {
        passwordHash: newPasswordHash,
      });

      return {
        success: true,
        message: 'Password changed successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Error changing password: ${error.message}`,
      };
    }
  }

  /**
   * Helper method to set initial password for a user (for testing/setup purposes)
   * Time Complexity: O(1) + O(n) for bcrypt hash
   * @param userId - User ID
   * @param password - Plain text password to hash and store
   */
  async setUserPassword(userId: number, password: string): Promise<void> {
    const passwordHash = await bcrypt.hash(password, this.BCRYPT_ROUNDS);
    this.userPasswords.set(userId, { passwordHash });
  }

  /**
   * Helper method to check if a user exists
   * Time Complexity: O(1)
   * @param userId - User ID to check
   * @returns true if user exists
   */
  hasUser(userId: number): boolean {
    return this.userPasswords.has(userId);
  }
}
