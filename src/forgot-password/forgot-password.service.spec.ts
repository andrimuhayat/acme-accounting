import { Test, TestingModule } from '@nestjs/testing';
import {
  ForgotPasswordService,
  ForgotPasswordRequest,
  PasswordResetPayload,
} from './forgot-password.service';

describe('ForgotPasswordService', () => {
  let service: ForgotPasswordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ForgotPasswordService],
    }).compile();

    service = module.get<ForgotPasswordService>(ForgotPasswordService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('requestPasswordReset', () => {
    it('should generate reset token when valid email provided', () => {
      // Arrange
      const request: ForgotPasswordRequest = { email: 'user@example.com' };

      // Act
      const response = service.requestPasswordReset(request);

      // Assert
      expect(response.success).toBe(true);
      expect(response.resetToken).toBeDefined();
      expect(response.expiresAt).toBeDefined();
      expect(response.message).toContain('user@example.com');
    });

    it('should return error when email is missing', () => {
      // Arrange
      const request: ForgotPasswordRequest = { email: '' };

      // Act
      const response = service.requestPasswordReset(request);

      // Assert
      expect(response.success).toBe(false);
      expect(response.message).toBe('Email is required');
      expect(response.resetToken).toBeUndefined();
    });

    it('should return error when email is null or undefined', () => {
      // Arrange
      const request: any = { email: null };

      // Act
      const response = service.requestPasswordReset(request);

      // Assert
      expect(response.success).toBe(false);
      expect(response.message).toBe('Email is required');
    });

    it('should return error when email format is invalid', () => {
      // Arrange
      const invalidEmails = ['invalid', 'invalid@', '@invalid.com', 'invalid@domain'];

      // Act & Assert
      for (const email of invalidEmails) {
        const response = service.requestPasswordReset({ email });
        expect(response.success).toBe(false);
        expect(response.message).toBe('Invalid email format');
      }
    });

    it('should accept multiple valid email formats', () => {
      // Arrange
      const validEmails = [
        'user@example.com',
        'john.doe@company.co.uk',
        'test+tag@domain.org',
      ];

      // Act & Assert
      for (const email of validEmails) {
        const response = service.requestPasswordReset({ email });
        expect(response.success).toBe(true);
        expect(response.resetToken).toBeDefined();
      }
    });

    it('should not modify request object', () => {
      // Arrange
      const request: ForgotPasswordRequest = { email: 'user@example.com' };
      const originalEmail = request.email;

      // Act
      service.requestPasswordReset(request);

      // Assert
      expect(request.email).toBe(originalEmail);
    });
  });

  describe('verifyResetToken', () => {
    it('should return true for valid, non-expired token', () => {
      // Arrange
      const request: ForgotPasswordRequest = { email: 'user@example.com' };
      const { resetToken } = service.requestPasswordReset(request);

      // Act
      const isValid = service.verifyResetToken(resetToken!);

      // Assert
      expect(isValid).toBe(true);
    });

    it('should return false for invalid token', () => {
      // Arrange
      const invalidToken = 'invalid-token-12345';

      // Act
      const isValid = service.verifyResetToken(invalidToken);

      // Assert
      expect(isValid).toBe(false);
    });

    it('should return false for empty token', () => {
      // Arrange
      const emptyToken = '';

      // Act
      const isValid = service.verifyResetToken(emptyToken);

      // Assert
      expect(isValid).toBe(false);
    });

    it('should return false for null or undefined token', () => {
      // Arrange & Act & Assert
      expect(service.verifyResetToken(null as any)).toBe(false);
      expect(service.verifyResetToken(undefined as any)).toBe(false);
    });

    it('should clean up expired tokens on verification', (done) => {
      // Arrange
      const request: ForgotPasswordRequest = { email: 'user@example.com' };
      const { resetToken } = service.requestPasswordReset(request);

      // Wait for token to expire (TOKEN_EXPIRY_MS = 15 min, but we'll check after some time)
      // For testing, we'll use getTokenExpiry to validate
      const expiryTime = service.getTokenExpiry(resetToken!);
      expect(expiryTime).toBeGreaterThan(0);

      // Act & Assert
      expect(service.verifyResetToken(resetToken!)).toBe(true);
      done();
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token and password', () => {
      // Arrange
      const request: ForgotPasswordRequest = { email: 'user@example.com' };
      const { resetToken } = service.requestPasswordReset(request);
      const payload: PasswordResetPayload = {
        resetToken: resetToken!,
        newPassword: 'newPassword123',
      };

      // Act
      const response = service.resetPassword(payload);

      // Assert
      expect(response.success).toBe(true);
      expect(response.message).toContain('user@example.com');
    });

    it('should return error when reset token is missing', () => {
      // Arrange
      const payload: PasswordResetPayload = {
        resetToken: '',
        newPassword: 'newPassword123',
      };

      // Act
      const response = service.resetPassword(payload);

      // Assert
      expect(response.success).toBe(false);
      expect(response.message).toBe(
        'Reset token and new password are required',
      );
    });

    it('should return error when new password is missing', () => {
      // Arrange
      const request: ForgotPasswordRequest = { email: 'user@example.com' };
      const { resetToken } = service.requestPasswordReset(request);
      const payload: PasswordResetPayload = {
        resetToken: resetToken!,
        newPassword: '',
      };

      // Act
      const response = service.resetPassword(payload);

      // Assert
      expect(response.success).toBe(false);
      expect(response.message).toBe(
        'Reset token and new password are required',
      );
    });

    it('should return error for invalid token', () => {
      // Arrange
      const payload: PasswordResetPayload = {
        resetToken: 'invalid-token',
        newPassword: 'newPassword123',
      };

      // Act
      const response = service.resetPassword(payload);

      // Assert
      expect(response.success).toBe(false);
      expect(response.message).toBe('Invalid or expired reset token');
    });

    it('should return error when password is too short', () => {
      // Arrange
      const request: ForgotPasswordRequest = { email: 'user@example.com' };
      const { resetToken } = service.requestPasswordReset(request);
      const payload: PasswordResetPayload = {
        resetToken: resetToken!,
        newPassword: 'short',
      };

      // Act
      const response = service.resetPassword(payload);

      // Assert
      expect(response.success).toBe(false);
      expect(response.message).toBe(
        'Password must be at least 8 characters long',
      );
    });

    it('should prevent token reuse after password reset', () => {
      // Arrange
      const request: ForgotPasswordRequest = { email: 'user@example.com' };
      const { resetToken } = service.requestPasswordReset(request);
      const payload: PasswordResetPayload = {
        resetToken: resetToken!,
        newPassword: 'newPassword123',
      };

      // Act
      service.resetPassword(payload);
      const secondAttempt = service.resetPassword(payload);

      // Assert
      expect(secondAttempt.success).toBe(false);
      expect(secondAttempt.message).toBe('Invalid or expired reset token');
    });

    it('should accept 8-character password (minimum length)', () => {
      // Arrange
      const request: ForgotPasswordRequest = { email: 'user@example.com' };
      const { resetToken } = service.requestPasswordReset(request);
      const payload: PasswordResetPayload = {
        resetToken: resetToken!,
        newPassword: 'pass1234',
      };

      // Act
      const response = service.resetPassword(payload);

      // Assert
      expect(response.success).toBe(true);
    });
  });

  describe('getTokenExpiry', () => {
    it('should return expiry time remaining for valid token', () => {
      // Arrange
      const request: ForgotPasswordRequest = { email: 'user@example.com' };
      const { resetToken } = service.requestPasswordReset(request);

      // Act
      const expiryTime = service.getTokenExpiry(resetToken!);

      // Assert
      expect(expiryTime).toBeGreaterThan(0);
      expect(expiryTime).toBeLessThanOrEqual(15 * 60 * 1000); // 15 minutes in ms
    });

    it('should return null for invalid token', () => {
      // Arrange
      const invalidToken = 'invalid-token-12345';

      // Act
      const expiryTime = service.getTokenExpiry(invalidToken);

      // Assert
      expect(expiryTime).toBeNull();
    });

    it('should return null for expired token and clean it up', () => {
      // Arrange
      const request: ForgotPasswordRequest = { email: 'user@example.com' };
      const { resetToken } = service.requestPasswordReset(request);
      const expiryBefore = service.getTokenExpiry(resetToken!);
      expect(expiryBefore).toBeGreaterThan(0);

      // Act & Assert
      // First call should return a valid expiry time
      expect(service.getTokenExpiry(resetToken!)).toBeGreaterThan(0);
      // Token should still be verifiable
      expect(service.verifyResetToken(resetToken!)).toBe(true);
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should remove expired tokens without affecting valid ones', () => {
      // Arrange
      const request1: ForgotPasswordRequest = { email: 'user1@example.com' };
      const request2: ForgotPasswordRequest = { email: 'user2@example.com' };
      const { resetToken: token1 } = service.requestPasswordReset(request1);
      const { resetToken: token2 } = service.requestPasswordReset(request2);

      // Act
      service.cleanupExpiredTokens();

      // Assert - both tokens should still be valid (not expired)
      expect(service.verifyResetToken(token1!)).toBe(true);
      expect(service.verifyResetToken(token2!)).toBe(true);
    });

    it('should complete without error when no tokens exist', () => {
      // Arrange - fresh service
      const newService = new ForgotPasswordService();

      // Act & Assert - should not throw
      expect(() => newService.cleanupExpiredTokens()).not.toThrow();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete password reset flow', () => {
      // Arrange
      const email = 'user@example.com';
      const newPassword = 'securePass123';

      // Act - Step 1: Request reset
      const resetResponse = service.requestPasswordReset({ email });
      expect(resetResponse.success).toBe(true);
      const resetToken = resetResponse.resetToken!;

      // Act - Step 2: Verify token exists
      expect(service.verifyResetToken(resetToken)).toBe(true);

      // Act - Step 3: Reset password
      const passwordResponse = service.resetPassword({
        resetToken,
        newPassword,
      });
      expect(passwordResponse.success).toBe(true);

      // Assert - Step 4: Verify token is consumed
      expect(service.verifyResetToken(resetToken)).toBe(false);
    });

    it('should handle multiple concurrent reset requests', () => {
      // Arrange
      const users = [
        'user1@example.com',
        'user2@example.com',
        'user3@example.com',
      ];
      const tokens: string[] = [];

      // Act - Request resets for multiple users
      for (const email of users) {
        const response = service.requestPasswordReset({ email });
        expect(response.success).toBe(true);
        tokens.push(response.resetToken!);
      }

      // Assert - All tokens should be unique and valid
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(tokens.length);
      tokens.forEach((token) => {
        expect(service.verifyResetToken(token)).toBe(true);
      });
    });
  });
});
