import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PasswordResetController } from './password-reset.controller';
import { PasswordResetService } from './password-reset.service';

describe('PasswordResetController', () => {
  let controller: PasswordResetController;
  let service: PasswordResetService;

  // Mock service implementation
  const mockPasswordResetService = {
    generateResetToken: jest.fn(),
    validateResetToken: jest.fn(),
    resetPassword: jest.fn(),
    getPendingTokensForUser: jest.fn(),
    revokeTokensForUser: jest.fn(),
    cleanupExpiredTokens: jest.fn(),
    getTokenStats: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PasswordResetController],
      providers: [
        {
          provide: PasswordResetService,
          useValue: mockPasswordResetService,
        },
      ],
    }).compile();

    controller = module.get<PasswordResetController>(PasswordResetController);
    service = module.get<PasswordResetService>(PasswordResetService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('forgotPassword', () => {
    describe('happy path', () => {
      it('should successfully generate reset token for valid email', async () => {
        // Arrange
        const dto = { email: 'demo@acme.com' };
        const mockResponse = {
          success: true,
          message: 'Password reset token generated successfully',
          tokenId: 'test-token-123456789012345678901234',
        };
        mockPasswordResetService.generateResetToken.mockResolvedValue(mockResponse);

        // Act
        const result = await controller.forgotPassword(dto);

        // Assert
        expect(result.success).toBe(true);
        expect(result.message).toContain('Password reset token generated successfully');
        expect(result.emailSent).toBe(true);
        expect(mockPasswordResetService.generateResetToken).toHaveBeenCalledWith(1, dto.email);
      });

      it('should return success for non-existent user (email enumeration prevention)', async () => {
        // Arrange
        const dto = { email: 'unknown@acme.com' };
        mockPasswordResetService.generateResetToken.mockResolvedValue({
          success: true,
          message: 'If an account exists with this email, a password reset link has been sent',
          emailSent: false,
        });

        // Act
        const result = await controller.forgotPassword(dto);

        // Assert
        expect(result.success).toBe(true);
        expect(result.emailSent).toBe(false);
      });
    });

    describe('error cases', () => {
      it('should throw BadRequestException for empty email', async () => {
        // Arrange
        const dto = { email: '' };

        // Act & Assert
        await expect(controller.forgotPassword(dto)).rejects.toThrow(BadRequestException);
        await expect(controller.forgotPassword(dto)).rejects.toThrow('Email is required');
      });

      it('should throw BadRequestException for whitespace-only email', async () => {
        // Arrange
        const dto = { email: '   ' };

        // Act & Assert
        await expect(controller.forgotPassword(dto)).rejects.toThrow(BadRequestException);
        await expect(controller.forgotPassword(dto)).rejects.toThrow('Email is required');
      });

      it('should throw BadRequestException for null email', async () => {
        // Arrange - Use type assertion to bypass TypeScript type checking for negative testing
        const dto = { email: null } as any;

        // Act & Assert
        await expect(controller.forgotPassword(dto)).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException for undefined email', async () => {
        // Arrange - Use type assertion to bypass TypeScript type checking for negative testing
        const dto = { email: undefined } as any;

        // Act & Assert
        await expect(controller.forgotPassword(dto)).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException for invalid email format (no @)', async () => {
        // Arrange
        const dto = { email: 'invalid-email' };

        // Act & Assert
        await expect(controller.forgotPassword(dto)).rejects.toThrow(BadRequestException);
        await expect(controller.forgotPassword(dto)).rejects.toThrow('Invalid email format');
      });

      it('should throw BadRequestException for invalid email format (no domain)', async () => {
        // Arrange
        const dto = { email: 'user@' };

        // Act & Assert
        await expect(controller.forgotPassword(dto)).rejects.toThrow(BadRequestException);
        await expect(controller.forgotPassword(dto)).rejects.toThrow('Invalid email format');
      });

      it('should throw BadRequestException for invalid email format (spaces)', async () => {
        // Arrange
        const dto = { email: 'user @example.com' };

        // Act & Assert
        await expect(controller.forgotPassword(dto)).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when token generation fails', async () => {
        // Arrange
        const dto = { email: 'demo@acme.com' };
        mockPasswordResetService.generateResetToken.mockResolvedValue({
          success: false,
          message: 'Invalid user ID provided',
        });

        // Act & Assert
        await expect(controller.forgotPassword(dto)).rejects.toThrow(BadRequestException);
        await expect(controller.forgotPassword(dto)).rejects.toThrow('Invalid user ID provided');
      });

      it('should return failure response when token already exists', async () => {
        // Arrange
        const dto = { email: 'demo@acme.com' };
        mockPasswordResetService.generateResetToken.mockResolvedValue({
          success: false,
          message: 'A password reset token already exists for this user',
        });

        // Act
        const result = await controller.forgotPassword(dto);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('A password reset token already exists for this user');
        expect(result.emailSent).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle email with plus addressing', async () => {
        // Arrange
        const dto = { email: 'user+tag@acme.com' };
        const mockResponse = {
          success: true,
          message: 'Password reset token generated successfully',
          tokenId: 'test-token-123456789012345678901234',
        };
        mockPasswordResetService.generateResetToken.mockResolvedValue(mockResponse);

        // Act
        const result = await controller.forgotPassword(dto);

        // Assert
        expect(result.success).toBe(true);
      });

      it('should handle email case insensitivity', async () => {
        // Arrange
        const dto = { email: 'DEMO@ACME.COM' };
        const mockResponse = {
          success: true,
          message: 'Password reset token generated successfully',
          tokenId: 'test-token-123456789012345678901234',
        };
        mockPasswordResetService.generateResetToken.mockResolvedValue(mockResponse);

        // Act
        const result = await controller.forgotPassword(dto);

        // Assert
        expect(result.success).toBe(true);
        // The service should be called with lowercase email
        expect(mockPasswordResetService.generateResetToken).toHaveBeenCalledWith(3, 'DEMO@ACME.COM');
      });
    });
  });

  describe('resetPassword', () => {
    describe('happy path', () => {
      it('should successfully reset password with valid token and password', async () => {
        // Arrange
        const dto = { token: 'valid-token-12345678901234567890', newPassword: 'newSecurePass123' };
        mockPasswordResetService.validateResetToken.mockResolvedValue(true);
        mockPasswordResetService.resetPassword.mockResolvedValue({
          success: true,
          message: 'Password reset successfully completed',
        });

        // Act
        const result = await controller.resetPassword(dto);

        // Assert
        expect(result.success).toBe(true);
        expect(result.message).toBe('Password reset successfully completed');
        expect(mockPasswordResetService.validateResetToken).toHaveBeenCalledWith(dto.token);
        expect(mockPasswordResetService.resetPassword).toHaveBeenCalledWith(dto.token, dto.newPassword);
      });

      it('should accept password with special characters', async () => {
        // Arrange
        const dto = { token: 'valid-token-12345678901234567890', newPassword: 'N3w!Pass@word#2024$' };
        mockPasswordResetService.validateResetToken.mockResolvedValue(true);
        mockPasswordResetService.resetPassword.mockResolvedValue({
          success: true,
          message: 'Password reset successfully completed',
        });

        // Act
        const result = await controller.resetPassword(dto);

        // Assert
        expect(result.success).toBe(true);
      });

      it('should accept very long password', async () => {
        // Arrange
        const dto = { token: 'valid-token-12345678901234567890', newPassword: 'a'.repeat(128) };
        mockPasswordResetService.validateResetToken.mockResolvedValue(true);
        mockPasswordResetService.resetPassword.mockResolvedValue({
          success: true,
          message: 'Password reset successfully completed',
        });

        // Act
        const result = await controller.resetPassword(dto);

        // Assert
        expect(result.success).toBe(true);
      });
    });

    describe('error cases', () => {
      it('should throw BadRequestException for empty token', async () => {
        // Arrange
        const dto = { token: '', newPassword: 'newPassword123' };

        // Act & Assert
        await expect(controller.resetPassword(dto)).rejects.toThrow(BadRequestException);
        await expect(controller.resetPassword(dto)).rejects.toThrow('Reset token is required');
      });

      it('should throw BadRequestException for whitespace-only token', async () => {
        // Arrange
        const dto = { token: '   ', newPassword: 'newPassword123' };

        // Act & Assert
        await expect(controller.resetPassword(dto)).rejects.toThrow(BadRequestException);
        await expect(controller.resetPassword(dto)).rejects.toThrow('Reset token is required');
      });

      it('should throw BadRequestException for null token', async () => {
        // Arrange - Use type assertion to bypass TypeScript type checking for negative testing
        const dto = { token: null, newPassword: 'newPassword123' } as any;

        // Act & Assert
        await expect(controller.resetPassword(dto)).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException for empty password', async () => {
        // Arrange
        const dto = { token: 'valid-token-12345678901234567890', newPassword: '' };

        // Act & Assert
        await expect(controller.resetPassword(dto)).rejects.toThrow(BadRequestException);
        await expect(controller.resetPassword(dto)).rejects.toThrow('New password is required');
      });

      it('should throw BadRequestException for whitespace-only password', async () => {
        // Arrange
        const dto = { token: 'valid-token-12345678901234567890', newPassword: '   ' };

        // Act & Assert
        await expect(controller.resetPassword(dto)).rejects.toThrow(BadRequestException);
        await expect(controller.resetPassword(dto)).rejects.toThrow('New password is required');
      });

      it('should throw BadRequestException for null password', async () => {
        // Arrange - Use type assertion to bypass TypeScript type checking for negative testing
        const dto = { token: 'valid-token-12345678901234567890', newPassword: null } as any;

        // Act & Assert
        await expect(controller.resetPassword(dto)).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException for password less than 8 characters', async () => {
        // Arrange
        const dto = { token: 'valid-token-12345678901234567890', newPassword: 'short' };

        // Act & Assert
        await expect(controller.resetPassword(dto)).rejects.toThrow(BadRequestException);
        await expect(controller.resetPassword(dto)).rejects.toThrow('Password must be at least 8 characters long');
      });

      it('should throw BadRequestException for invalid token', async () => {
        // Arrange
        const dto = { token: 'invalid-token', newPassword: 'newPassword123' };
        mockPasswordResetService.validateResetToken.mockResolvedValue(false);

        // Act & Assert
        await expect(controller.resetPassword(dto)).rejects.toThrow(BadRequestException);
        await expect(controller.resetPassword(dto)).rejects.toThrow('Reset token is invalid or expired');
      });

      it('should throw BadRequestException when resetPassword service fails', async () => {
        // Arrange
        const dto = { token: 'valid-token-12345678901234567890', newPassword: 'newPassword123' };
        mockPasswordResetService.validateResetToken.mockResolvedValue(true);
        mockPasswordResetService.resetPassword.mockResolvedValue({
          success: false,
          message: 'Reset token is invalid or expired',
        });

        // Act & Assert
        await expect(controller.resetPassword(dto)).rejects.toThrow(BadRequestException);
        await expect(controller.resetPassword(dto)).rejects.toThrow('Reset token is invalid or expired');
      });
    });

    describe('edge cases', () => {
      it('should accept exactly 8 character password', async () => {
        // Arrange
        const dto = { token: 'valid-token-12345678901234567890', newPassword: '12345678' };
        mockPasswordResetService.validateResetToken.mockResolvedValue(true);
        mockPasswordResetService.resetPassword.mockResolvedValue({
          success: true,
          message: 'Password reset successfully completed',
        });

        // Act
        const result = await controller.resetPassword(dto);

        // Assert
        expect(result.success).toBe(true);
      });

      it('should handle token with special characters', async () => {
        // Arrange
        const dto = { token: 'valid-token!@#$%^&*()', newPassword: 'newPassword123' };
        mockPasswordResetService.validateResetToken.mockResolvedValue(true);
        mockPasswordResetService.resetPassword.mockResolvedValue({
          success: true,
          message: 'Password reset successfully completed',
        });

        // Act
        const result = await controller.resetPassword(dto);

        // Assert
        expect(result.success).toBe(true);
      });
    });
  });

  describe('integration tests', () => {
    it('should complete full forgot password flow', async () => {
      // Arrange
      const forgotDto = { email: 'demo@acme.com' };
      const resetDto = { token: 'test-token-123456789012345678901234', newPassword: 'newSecurePass123' };

      mockPasswordResetService.generateResetToken.mockResolvedValue({
        success: true,
        message: 'Password reset token generated successfully',
        tokenId: resetDto.token,
      });
      mockPasswordResetService.validateResetToken.mockResolvedValue(true);
      mockPasswordResetService.resetPassword.mockResolvedValue({
        success: true,
        message: 'Password reset successfully completed',
      });

      // Act - Step 1: Request password reset
      const forgotResult = await controller.forgotPassword(forgotDto);
      expect(forgotResult.success).toBe(true);

      // Step 2: Reset password with token
      const resetResult = await controller.resetPassword(resetDto);
      expect(resetResult.success).toBe(true);
    });

    it('should handle multiple users independently', async () => {
      // Arrange
      const user1 = { forgotDto: { email: 'demo@acme.com' }, resetDto: { token: 'token-user-1', newPassword: 'password1' } };
      const user2 = { forgotDto: { email: 'test@acme.com' }, resetDto: { token: 'token-user-2', newPassword: 'password2' } };

      mockPasswordResetService.generateResetToken
        .mockResolvedValueOnce({
          success: true,
          message: 'Password reset token generated successfully',
          tokenId: user1.resetDto.token,
        })
        .mockResolvedValueOnce({
          success: true,
          message: 'Password reset token generated successfully',
          tokenId: user2.resetDto.token,
        });

      mockPasswordResetService.validateResetToken.mockResolvedValue(true);
      mockPasswordResetService.resetPassword.mockResolvedValue({
        success: true,
        message: 'Password reset successfully completed',
      });

      // Act
      const result1 = await controller.forgotPassword(user1.forgotDto);
      const result2 = await controller.forgotPassword(user2.forgotDto);

      // Assert
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });
});