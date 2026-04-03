import { Test, TestingModule } from '@nestjs/testing';
import { PasswordChangeService, ChangePasswordResponse } from './password-change.service';

describe('PasswordChangeService', () => {
  let service: PasswordChangeService;

  // Mock user database for testing
  const mockUsers = new Map<number, { password: string }>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PasswordChangeService],
    }).compile();

    service = module.get<PasswordChangeService>(PasswordChangeService);

    // CRITICAL FIX: Reset and initialize service's internal userPasswords map
    // The service stores hashed passwords internally, so we must use setUserPassword
    // to properly sync test users to the service state
    await service.setUserPassword(1, 'oldPassword123');
    await service.setUserPassword(2, 'user2OldPass');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('changePassword', () => {
    describe('happy path', () => {
      it('should successfully change password with valid credentials', async () => {
        // Arrange
        const userId = 1;
        const oldPassword = 'oldPassword123';
        const newPassword = 'newSecurePassword456';

        // Act
        const result = await service.changePassword(userId, oldPassword, newPassword);

        // Assert
        expect(result.success).toBe(true);
        expect(result.message).toBe('Password changed successfully');
      });

      it('should allow password change for different user', async () => {
        // Arrange
        const userId = 2;
        const oldPassword = 'user2OldPass';
        const newPassword = 'user2NewPass789';

        // Act
        const result = await service.changePassword(userId, oldPassword, newPassword);

        // Assert
        expect(result.success).toBe(true);
        expect(result.message).toBe('Password changed successfully');
      });

      it('should return different success responses for different users', async () => {
        // Arrange
        const user1 = { userId: 1, oldPassword: 'oldPassword123', newPassword: 'newPass1' };
        const user2 = { userId: 2, oldPassword: 'user2OldPass', newPassword: 'newPass2' };

        // Act
        const result1 = await service.changePassword(user1.userId, user1.oldPassword, user1.newPassword);
        const result2 = await service.changePassword(user2.userId, user2.oldPassword, user2.newPassword);

        // Assert
        expect(result1.success).toBe(true);
        expect(result2.success).toBe(true);
      });
    });

    describe('error cases', () => {
      it('should reject invalid user ID (zero)', async () => {
        // Arrange
        const userId = 0;
        const oldPassword = 'oldPassword123';
        const newPassword = 'newPassword456';

        // Act
        const result = await service.changePassword(userId, oldPassword, newPassword);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Invalid user ID provided');
      });

      it('should reject negative user ID', async () => {
        // Arrange
        const userId = -1;
        const oldPassword = 'oldPassword123';
        const newPassword = 'newPassword456';

        // Act
        const result = await service.changePassword(userId, oldPassword, newPassword);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Invalid user ID provided');
      });

      it('should reject non-existent user', async () => {
        // Arrange
        const userId = 999;
        const oldPassword = 'somePassword';
        const newPassword = 'newPassword456';

        // Act
        const result = await service.changePassword(userId, oldPassword, newPassword);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('User not found');
      });

      it('should reject wrong old password', async () => {
        // Arrange
        const userId = 1;
        const wrongOldPassword = 'wrongPassword';
        const newPassword = 'newPassword456';

        // Act
        const result = await service.changePassword(userId, wrongOldPassword, newPassword);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Current password is incorrect');
      });

      it('should reject empty old password', async () => {
        // Arrange
        const userId = 1;
        const oldPassword = '';
        const newPassword = 'newPassword456';

        // Act
        const result = await service.changePassword(userId, oldPassword, newPassword);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Old password cannot be empty');
      });

      it('should reject empty new password', async () => {
        // Arrange
        const userId = 1;
        const oldPassword = 'oldPassword123';
        const newPassword = '';

        // Act
        const result = await service.changePassword(userId, oldPassword, newPassword);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('New password cannot be empty');
      });

      it('should reject null user ID', async () => {
        // Arrange
        const userId = null;
        const oldPassword = 'oldPassword123';
        const newPassword = 'newPassword456';

        // Act
        const result = await service.changePassword(userId as any, oldPassword, newPassword);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Invalid user ID provided');
      });

      it('should reject null old password', async () => {
        // Arrange
        const userId = 1;
        const oldPassword = null;
        const newPassword = 'newPassword456';

        // Act
        const result = await service.changePassword(userId, oldPassword as any, newPassword);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Old password cannot be empty');
      });

      it('should reject null new password', async () => {
        // Arrange
        const userId = 1;
        const oldPassword = 'oldPassword123';
        const newPassword = null;

        // Act
        const result = await service.changePassword(userId, oldPassword, newPassword as any);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('New password cannot be empty');
      });
    });

    describe('edge cases', () => {
      it('should reject same old and new password', async () => {
        // Arrange
        const userId = 1;
        const oldPassword = 'samePassword123';
        const newPassword = 'samePassword123';

        // Act
        const result = await service.changePassword(userId, oldPassword, newPassword);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('New password must be different from current password');
      });

      it('should reject whitespace-only old password', async () => {
        // Arrange
        const userId = 1;
        const oldPassword = '   ';
        const newPassword = 'newPassword456';

        // Act
        const result = await service.changePassword(userId, oldPassword, newPassword);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Old password cannot be empty');
      });

      it('should reject whitespace-only new password', async () => {
        // Arrange
        const userId = 1;
        const oldPassword = 'oldPassword123';
        const newPassword = '   ';

        // Act
        const result = await service.changePassword(userId, oldPassword, newPassword);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('New password cannot be empty');
      });

      it('should reject whitespace old password that looks valid', async () => {
        // Arrange
        const userId = 1;
        const oldPassword = '  oldPassword123  ';
        const newPassword = 'newPassword456';

        // Act
        const result = await service.changePassword(userId, oldPassword, newPassword);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Current password is incorrect');
      });

      it('should reject new password that is too similar to old password', async () => {
        // Arrange
        const userId = 1;
        const oldPassword = 'oldPassword123';
        const newPassword = 'oldPassword124'; // Only last char different

        // Act
        const result = await service.changePassword(userId, oldPassword, newPassword);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('New password must be different from current password');
      });

      it('should handle very long passwords', async () => {
        // Arrange
        const userId = 1;
        const oldPassword = 'oldPassword123';
        const newPassword = 'a'.repeat(128);

        // Act
        const result = await service.changePassword(userId, oldPassword, newPassword);

        // Assert
        expect(result.success).toBe(true);
        expect(result.message).toBe('Password changed successfully');
      });

      it('should handle password with special characters', async () => {
        // Arrange
        const userId = 1;
        const oldPassword = 'oldPassword123';
        const newPassword = 'N3w!Pass@word#2024$';

        // Act
        const result = await service.changePassword(userId, oldPassword, newPassword);

        // Assert
        expect(result.success).toBe(true);
        expect(result.message).toBe('Password changed successfully');
      });
    });

    describe('integration tests', () => {
      it('should complete full password change flow', async () => {
        // Arrange
        const userId = 1;
        const oldPassword = 'oldPassword123';
        const newPassword = 'newSecurePassword456';

        // Act - Step 1: Change password
        const changeResult = await service.changePassword(userId, oldPassword, newPassword);
        expect(changeResult.success).toBe(true);

        // Step 2: Verify old password no longer works
        const oldResult = await service.changePassword(userId, oldPassword, 'anotherNewPass');
        expect(oldResult.success).toBe(false);
        expect(oldResult.message).toBe('Current password is incorrect');

        // Step 3: Verify new password works
        const newResult = await service.changePassword(userId, newPassword, 'anotherNewPass');
        expect(newResult.success).toBe(true);
      });

      it('should handle multiple users independently', async () => {
        // Arrange
        const user1 = { userId: 1, oldPassword: 'oldPassword123', newPassword: 'user1NewPass' };
        const user2 = { userId: 2, oldPassword: 'user2OldPass', newPassword: 'user2NewPass' };

        // Act
        const result1 = await service.changePassword(user1.userId, user1.oldPassword, user1.newPassword);
        const result2 = await service.changePassword(user2.userId, user2.oldPassword, user2.newPassword);

        // Assert
        expect(result1.success).toBe(true);
        expect(result2.success).toBe(true);

        // Verify user1 cannot use user2's old password
        const crossResult = await service.changePassword(user1.userId, user2.oldPassword, 'anyNewPass');
        expect(crossResult.success).toBe(false);
      });

      it('should track password change history per user', async () => {
        // Arrange
        const userId = 1;
        const password1 = 'oldPassword123';
        const password2 = 'middlePassword456';
        const password3 = 'finalPassword789';

        // Act - Change password multiple times
        const result1 = await service.changePassword(userId, password1, password2);
        expect(result1.success).toBe(true);

        const result2 = await service.changePassword(userId, password2, password3);
        expect(result2.success).toBe(true);

        // Assert - Old passwords should not work
        const oldResult1 = await service.changePassword(userId, password1, 'anyPass');
        expect(oldResult1.success).toBe(false);

        const oldResult2 = await service.changePassword(userId, password2, 'anyPass');
        expect(oldResult2.success).toBe(false);
      });
    });
  });
});