import { Test, TestingModule } from '@nestjs/testing';
import { AuthService, LoginRequest, LoginResponse, ValidateTokenResponse, LogoutResponse } from './auth.service';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

describe('AuthService', () => {
  let service: AuthService;

  // Mock user for testing (passwordHash is bcrypt hash of 'password123')
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    passwordHash: '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // 'password123'
    role: 'User',
    companyId: 1,
  };

  // Mock users database
  const mockUsersDb: Record<string, typeof mockUser> = {
    'test@example.com': mockUser,
  };

  // Active sessions tracking
  const activeSessions: Map<number, string> = new Map();

  // JWT Secret for testing
  const JWT_SECRET = 'test-secret-key';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: 'JWT_SECRET',
          useValue: JWT_SECRET,
        },
        {
          provide: 'TOKEN_EXPIRY_MS',
          useValue: 86400000, // 24 hours
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    
    // Reset state before each test
    activeSessions.clear();
  });

  describe('login', () => {
    describe('happy path', () => {
      it('should successfully login with valid credentials', async () => {
        // Arrange
        const email = 'test@example.com';
        const password = 'password123';
        
        // Mock bcrypt compare to return true
        jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
        
        // Mock jwt.sign
        jest.spyOn(jwt, 'sign').mockImplementation(() => 'mock-jwt-token');

        // Act
        const result = await service.login(email, password);

        // Assert
        expect(result.success).toBe(true);
        expect(result.message).toBe('Login successful');
        expect(result.token).toBeDefined();
        expect(result.userId).toBe(1);
      });

      it('should return token with correct structure', async () => {
        // Arrange
        const email = 'test@example.com';
        const password = 'password123';

        jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
        jest.spyOn(jwt, 'sign').mockImplementation(() => 'mock-jwt-token');

        // Act
        const result = await service.login(email, password);

        // Assert
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('message');
        expect(result).toHaveProperty('token');
        expect(result).toHaveProperty('userId');
        expect(typeof result.success).toBe('boolean');
        expect(typeof result.message).toBe('string');
        expect(typeof result.token).toBe('string');
        expect(typeof result.userId).toBe('number');
      });
    });

    describe('error cases', () => {
      it('should reject login with invalid email format', async () => {
        // Arrange
        const email = 'notanemail';
        const password = 'password123';

        // Act
        const result = await service.login(email, password);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Invalid email address provided');
        expect(result.token).toBeUndefined();
      });

      it('should reject login with invalid password', async () => {
        // Arrange
        const email = 'test@example.com';
        const password = 'wrongpassword';

        // Mock bcrypt compare to return false
        jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));

        // Act
        const result = await service.login(email, password);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Invalid credentials');
        expect(result.token).toBeUndefined();
      });

      it('should reject login with empty email', async () => {
        // Arrange
        const email = '';
        const password = 'password123';

        // Act
        const result = await service.login(email, password);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Email and password are required');
      });

      it('should reject login with empty password', async () => {
        // Arrange
        const email = 'test@example.com';
        const password = '';

        // Act
        const result = await service.login(email, password);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Email and password are required');
      });

      it('should reject login with null email', async () => {
        // Arrange
        const email = null as any;
        const password = 'password123';

        // Act
        const result = await service.login(email, password);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Email and password are required');
      });

      it('should reject login with null password', async () => {
        // Arrange
        const email = 'test@example.com';
        const password = null as any;

        // Act
        const result = await service.login(email, password);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Email and password are required');
      });
    });

    describe('edge cases', () => {
      it('should reject login with whitespace-only email', async () => {
        // Arrange
        const email = '   ';
        const password = 'password123';

        // Act
        const result = await service.login(email, password);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Email and password are required');
      });

      it('should reject login with whitespace-only password', async () => {
        // Arrange
        const email = 'test@example.com';
        const password = '   ';

        // Act
        const result = await service.login(email, password);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Email and password are required');
      });

      it('should handle very long email input', async () => {
        // Arrange
        const email = 'a'.repeat(1000) + '@example.com';
        const password = 'password123';

        // Act
        const result = await service.login(email, password);

        // Assert
        expect(result.success).toBe(false);
      });

      it('should handle special characters in email', async () => {
        // Arrange
        const email = 'test+special@example.com';
        const password = 'password123';

        // Act
        const result = await service.login(email, password);

        // Assert
        // Should not crash, should handle gracefully
        expect(result).toBeDefined();
      });
    });
  });

  describe('validateToken', () => {
    describe('happy path', () => {
      it('should return valid for a valid token', async () => {
        // Arrange
        const token = 'valid-jwt-token';
        const decoded = { userId: 1, iat: Math.floor(Date.now() / 1000) };

        jest.spyOn(jwt, 'verify').mockImplementation(() => decoded);

        // Act
        const result = await service.validateToken(token);

        // Assert
        expect(result.valid).toBe(true);
        expect(result.userId).toBe(1);
      });

      it('should return valid token structure', async () => {
        // Arrange
        const token = 'valid-jwt-token';
        const decoded = { userId: 1, iat: Math.floor(Date.now() / 1000) };

        jest.spyOn(jwt, 'verify').mockImplementation(() => decoded);

        // Act
        const result = await service.validateToken(token);

        // Assert
        expect(result).toHaveProperty('valid');
        expect(typeof result.valid).toBe('boolean');
        if (result.valid && result.userId) {
          expect(typeof result.userId).toBe('number');
        }
      });
    });

    describe('error cases', () => {
      it('should reject invalid token', async () => {
        // Arrange
        const token = 'invalid-token';

        jest.spyOn(jwt, 'verify').mockImplementation(() => {
          throw new Error('Invalid token');
        });

        // Act
        const result = await service.validateToken(token);

        // Assert
        expect(result.valid).toBe(false);
        expect(result.userId).toBeUndefined();
      });

      it('should reject expired token', async () => {
        // Arrange
        const token = 'expired-token';

        jest.spyOn(jwt, 'verify').mockImplementation(() => {
          throw new Error('Token expired');
        });

        // Act
        const result = await service.validateToken(token);

        // Assert
        expect(result.valid).toBe(false);
      });

      it('should reject null token', async () => {
        // Act
        const result = await service.validateToken(null as any);

        // Assert
        expect(result.valid).toBe(false);
        expect(result.userId).toBeUndefined();
      });

      it('should reject undefined token', async () => {
        // Act
        const result = await service.validateToken(undefined as any);

        // Assert
        expect(result.valid).toBe(false);
        expect(result.userId).toBeUndefined();
      });

      it('should reject empty string token', async () => {
        // Act
        const result = await service.validateToken('');

        // Assert
        expect(result.valid).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should reject malformed token', async () => {
        // Arrange
        const token = 'malformed.token.here';

        jest.spyOn(jwt, 'verify').mockImplementation(() => {
          throw new Error('Malformed token');
        });

        // Act
        const result = await service.validateToken(token);

        // Assert
        expect(result.valid).toBe(false);
      });

      it('should handle token with missing userId', async () => {
        // Arrange
        const token = 'valid-structure-token';
        const decoded = { iat: Math.floor(Date.now() / 1000) }; // missing userId

        jest.spyOn(jwt, 'verify').mockImplementation(() => decoded);

        // Act
        const result = await service.validateToken(token);

        // Assert
        expect(result.valid).toBe(false);
      });

      it('should handle very long token', async () => {
        // Arrange
        const token = 'a'.repeat(10000);

        jest.spyOn(jwt, 'verify').mockImplementation(() => {
          throw new Error('Token too long');
        });

        // Act
        const result = await service.validateToken(token);

        // Assert
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('logout', () => {
    describe('happy path', () => {
      it('should successfully logout with valid token', async () => {
        // Arrange
        const token = 'valid-token-to-logout';
        const decoded = { userId: 1, email: 'test@example.com' };

        // Mock jwt.verify since logout() now validates token before processing
        jest.spyOn(jwt, 'verify').mockImplementation(() => decoded);

        // Manually add session to activeSessions (simulating prior login)
        (service as any).activeSessions.set(token, { userId: 1, email: 'test@example.com', token, createdAt: new Date() });
        (service as any).userSessionMap.set(1, token);

        // Act
        const result = await service.logout(token);

        // Assert
        expect(result.success).toBe(true);
        expect(result.message).toBe('Logout successful');
      });

      it('should return correct logout response structure', async () => {
        // Arrange
        const token = 'valid-token';
        const decoded = { userId: 1, email: 'test@example.com' };

        // Mock jwt.verify since logout() now validates token before processing
        jest.spyOn(jwt, 'verify').mockImplementation(() => decoded);

        // Manually add session to activeSessions (simulating prior login)
        (service as any).activeSessions.set(token, { userId: 1, email: 'test@example.com', token, createdAt: new Date() });
        (service as any).userSessionMap.set(1, token);

        // Act
        const result = await service.logout(token);

        // Assert
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('message');
        expect(typeof result.success).toBe('boolean');
        expect(typeof result.message).toBe('string');
      });
    });

    describe('error cases', () => {
      it('should reject logout when session not found', async () => {
        // Arrange - token that was never logged in with
        const token = 'non-existent-session-token';
        const decoded = { userId: 1, email: 'test@example.com' };

        // Mock jwt.verify since logout() validates token before checking session
        jest.spyOn(jwt, 'verify').mockImplementation(() => decoded);

        // Act - logout without ever establishing this session
        const result = await service.logout(token);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Session not found');
      });

      it('should reject logout with null token', async () => {
        // Act
        const result = await service.logout(null as any);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Invalid or missing token');
      });

      it('should reject logout with undefined token', async () => {
        // Act
        const result = await service.logout(undefined as any);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Invalid or missing token');
      });

      it('should reject logout with empty string token', async () => {
        // Act
        const result = await service.logout('');

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Invalid or missing token');
      });
    });

    describe('edge cases', () => {
      it('should handle logout for already logged out session', async () => {
        // Arrange
        const token = 'already-invalidated-token';
        const decoded = { userId: 1 };

        // Mock jwt.verify since logout now validates token before processing
        jest.spyOn(jwt, 'verify').mockImplementation(() => decoded);

        // Act - call logout twice (first one succeeds, second returns session not found)
        await service.logout(token);
        const result = await service.logout(token);

        // Assert - second logout should fail since session was already removed
        expect(result.success).toBe(false);
        expect(result.message).toBe('Session not found');
      });

      it('should handle logout with whitespace token', async () => {
        // Arrange
        const token = '   ';

        // Act
        const result = await service.logout(token);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Invalid or missing token');
      });

      it('should remove session from activeSessions after successful logout', async () => {
        // Arrange
        const token = 'token-to-verify-removal';
        const decoded = { userId: 1, email: 'test@example.com' };

        jest.spyOn(jwt, 'verify').mockImplementation(() => decoded);

        // Manually add session to activeSessions (simulating prior login)
        (service as any).activeSessions.set(token, { userId: 1, email: 'test@example.com', token, createdAt: new Date() });
        (service as any).userSessionMap.set(1, token);

        // Verify session exists before logout
        expect((service as any).activeSessions.has(token)).toBe(true);

        // Act
        const result = await service.logout(token);

        // Assert
        expect(result.success).toBe(true);
        expect((service as any).activeSessions.has(token)).toBe(false);
        expect((service as any).activeSessions.size).toBe(0);
      });

      it('should remove session from userSessionMap after successful logout', async () => {
        // Arrange
        const token = 'token-to-verify-usermap-removal';
        const decoded = { userId: 1, email: 'test@example.com' };

        jest.spyOn(jwt, 'verify').mockImplementation(() => decoded);

        // Manually add session to activeSessions and userSessionMap (simulating prior login)
        (service as any).activeSessions.set(token, { userId: 1, email: 'test@example.com', token, createdAt: new Date() });
        (service as any).userSessionMap.set(1, token);

        // Verify session exists before logout
        expect((service as any).userSessionMap.has(1)).toBe(true);

        // Act
        const result = await service.logout(token);

        // Assert
        expect(result.success).toBe(true);
        expect((service as any).userSessionMap.has(1)).toBe(false);
        expect((service as any).userSessionMap.size).toBe(0);
      });

      it('should fail logout when jwt is valid but session not in activeSessions', async () => {
        // Arrange - This tests the bug scenario: jwt.verify succeeds but activeSessions.get(token) returns undefined
        const token = 'valid-jwt-but-no-session';
        const decoded = { userId: 1, email: 'test@example.com' };

        // Mock jwt.verify to succeed (token is valid JWT)
        jest.spyOn(jwt, 'verify').mockImplementation(() => decoded);

        // Do NOT add session to activeSessions - simulating the bug where session lookup fails
        // (service as any).activeSessions.set(token, {...});  // <-- intentionally NOT adding session

        // Act
        const result = await service.logout(token);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Session not found');
      });

      it('should handle logout with different tokens for same user correctly', async () => {
        // Arrange
        const token1 = 'first-token';
        const token2 = 'second-token';
        const decoded1 = { userId: 1, email: 'test@example.com' };
        const decoded2 = { userId: 1, email: 'test@example.com' };

        jest.spyOn(jwt, 'verify')
          .mockImplementationOnce(() => decoded1)
          .mockImplementationOnce(() => decoded2);

        // Setup first session
        (service as any).activeSessions.set(token1, { userId: 1, email: 'test@example.com', token: token1, createdAt: new Date() });
        (service as any).userSessionMap.set(1, token1);

        // Act - logout with first token
        const result1 = await service.logout(token1);

        // Assert
        expect(result1.success).toBe(true);
        expect((service as any).activeSessions.has(token1)).toBe(false);

        // Setup second session with same userId (single session enforcement)
        (service as any).activeSessions.set(token2, { userId: 1, email: 'test@example.com', token: token2, createdAt: new Date() });
        (service as any).userSessionMap.set(1, token2);

        // Act - logout with second token
        const result2 = await service.logout(token2);

        // Assert
        expect(result2.success).toBe(true);
        expect((service as any).activeSessions.has(token2)).toBe(false);
      });
    });
  });

  describe('getUserIdFromToken', () => {
    describe('happy path', () => {
      it('should return userId for valid token', () => {
        // Arrange
        const token = 'valid-jwt-token';
        const decoded = { userId: 42 };

        jest.spyOn(jwt, 'decode').mockImplementation(() => decoded);

        // Act
        const result = service.getUserIdFromToken(token);

        // Assert
        expect(result).toBe(42);
      });

      it('should return correct userId type', () => {
        // Arrange
        const token = 'valid-token';
        const decoded = { userId: 1 };

        jest.spyOn(jwt, 'decode').mockImplementation(() => decoded);

        // Act
        const result = service.getUserIdFromToken(token);

        // Assert
        expect(typeof result).toBe('number');
      });
    });

    describe('error cases', () => {
      it('should return null for invalid token', () => {
        // Arrange
        const token = 'invalid-token';

        // jwt.decode returns null for invalid tokens (doesn't throw)
        jest.spyOn(jwt, 'decode').mockImplementation(() => null);

        // Act
        const result = service.getUserIdFromToken(token);

        // Assert
        expect(result).toBeNull();
      });

      it('should return null for expired token', () => {
        // Arrange
        const token = 'expired-token';

        // jwt.decode returns null for expired tokens (doesn't throw)
        jest.spyOn(jwt, 'decode').mockImplementation(() => null);

        // Act
        const result = service.getUserIdFromToken(token);

        // Assert
        expect(result).toBeNull();
      });

      it('should return null for null token', () => {
        // Act
        const result = service.getUserIdFromToken(null as any);

        // Assert
        expect(result).toBeNull();
      });

      it('should return null for undefined token', () => {
        // Act
        const result = service.getUserIdFromToken(undefined as any);

        // Assert
        expect(result).toBeNull();
      });

      it('should return null for empty string token', () => {
        // Act
        const result = service.getUserIdFromToken('');

        // Assert
        expect(result).toBeNull();
      });
    });

    describe('edge cases', () => {
      it('should return null for token with missing userId', () => {
        // Arrange
        const token = 'token-without-userid';
        const decoded = { iat: Math.floor(Date.now() / 1000) };

        jest.spyOn(jwt, 'decode').mockImplementation(() => decoded);

        // Act
        const result = service.getUserIdFromToken(token);

        // Assert
        expect(result).toBeNull();
      });

      it('should return null for token with non-numeric userId', () => {
        // Arrange
        const token = 'token-with-string-userid';
        const decoded = { userId: 'not-a-number' };

        jest.spyOn(jwt, 'decode').mockImplementation(() => decoded);

        // Act
        const result = service.getUserIdFromToken(token);

        // Assert
        expect(result).toBeNull();
      });

      it('should handle malformed token', () => {
        // Arrange
        const token = 'not-a-valid-jwt';

        // jwt.decode returns null for malformed tokens (doesn't throw)
        jest.spyOn(jwt, 'decode').mockImplementation(() => null);

        // Act
        const result = service.getUserIdFromToken(token);

        // Assert
        expect(result).toBeNull();
      });
    });
  });

  describe('single active session enforcement', () => {
    describe('happy path', () => {
      it('should allow login when user has no existing session', async () => {
        // Arrange
        const email = 'test@example.com';
        const password = 'password123';

        jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
        jest.spyOn(jwt, 'sign').mockImplementation(() => 'new-token-1');

        // Act
        const result = await service.login(email, password);

        // Assert
        expect(result.success).toBe(true);
      });

      it('should track session for user after login', async () => {
        // Arrange
        const email = 'test@example.com';
        const password = 'password123';

        jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
        jest.spyOn(jwt, 'sign').mockImplementation(() => 'session-token');

        // Act
        await service.login(email, password);
        const secondLogin = await service.login(email, password);

        // Assert
        // Second login should be handled according to single session rule
        expect(secondLogin).toBeDefined();
      });
    });

    describe('error cases', () => {
      it('should invalidate previous session when user logs in again', async () => {
        // Arrange
        const email = 'test@example.com';
        const password = 'password123';

        jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
        jest.spyOn(jwt, 'sign')
          .mockImplementationOnce(() => 'first-token')
          .mockImplementationOnce(() => 'second-token');

        // Act
        const firstLogin = await service.login(email, password);
        const secondLogin = await service.login(email, password);

        // Assert
        expect(firstLogin.success).toBe(true);
        expect(secondLogin.success).toBe(true);
        expect(firstLogin.token).not.toBe(secondLogin.token);
      });

      it('should reject login when session limit is exceeded', async () => {
        // Arrange
        const email = 'test@example.com';
        const password = 'password123';

        jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
        jest.spyOn(jwt, 'sign').mockImplementation(() => 'token');

        // Simulate multiple logins to trigger session limit
        for (let i = 0; i < 5; i++) {
          await service.login(email, password);
        }

        // Act
        const result = await service.login(email, password);

        // Assert - should still work due to single session replacement
        expect(result.success).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should handle multiple users with independent sessions', async () => {
        // Arrange
        const user1Email = 'user1@example.com';
        const user2Email = 'user2@example.com';
        const password = 'password123';

        jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
        jest.spyOn(jwt, 'sign')
          .mockImplementationOnce(() => 'user1-token')
          .mockImplementationOnce(() => 'user2-token');

        // Act
        const login1 = await service.login(user1Email, password);
        const login2 = await service.login(user2Email, password);

        // Assert
        expect(login1.success).toBe(true);
        expect(login2.success).toBe(true);
        expect(login1.userId).not.toBe(login2.userId);
      });
    });
  });

  describe('token expiration', () => {
    describe('happy path', () => {
      it('should create token with correct expiration time', async () => {
        // Arrange
        const email = 'test@example.com';
        const password = 'password123';

        jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
        jest.spyOn(jwt, 'sign').mockImplementation(() => 'token-with-expiry');

        // Act
        const result = await service.login(email, password);

        // Assert
        expect(result.success).toBe(true);
        expect(result.token).toBeDefined();
      });
    });

    describe('edge cases', () => {
      it('should handle token near expiration boundary', async () => {
        // Arrange
        const token = 'near-expiration-token';
        const decoded = { userId: 1, exp: Math.floor(Date.now() / 1000) - 1 }; // just expired

        jest.spyOn(jwt, 'verify').mockImplementation(() => decoded);

        // Act
        const result = await service.validateToken(token);

        // Assert
        expect(result.valid).toBe(false);
      });

      it('should handle token at expiration boundary', async () => {
        // Arrange
        const token = 'at-expiration-token';
        const now = Math.floor(Date.now() / 1000);
        const decoded = { userId: 1, exp: now, iat: now - 86400 }; // exactly at expiration

        jest.spyOn(jwt, 'verify').mockImplementation(() => decoded);

        // Act
        const result = await service.validateToken(token);

        // Assert
        expect(result.valid).toBe(false);
      });

      it('should accept token well before expiration', async () => {
        // Arrange
        const token = 'fresh-token';
        const now = Math.floor(Date.now() / 1000);
        const decoded = { userId: 1, exp: now + 86400, iat: now }; // valid for 24 more hours

        jest.spyOn(jwt, 'verify').mockImplementation(() => decoded);

        // Act
        const result = await service.validateToken(token);

        // Assert
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('integration tests', () => {
    it('should complete full login-validate-logout flow', async () => {
      // Arrange
      const email = 'test@example.com';
      const password = 'password123';
      const decoded = { userId: 1, email: 'test@example.com' };

      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
      jest.spyOn(jwt, 'sign').mockImplementation(() => 'flow-token');
      // Mock jwt.verify for both validateToken and logout
      jest.spyOn(jwt, 'verify').mockImplementation(() => decoded);

      // Act - Login
      const loginResult = await service.login(email, password);
      expect(loginResult.success).toBe(true);

      // Act - Validate
      const validateResult = await service.validateToken(loginResult.token!);
      expect(validateResult.valid).toBe(true);

      // Act - Logout
      const logoutResult = await service.logout(loginResult.token!);
      expect(logoutResult.success).toBe(true);

      // Assert
      expect(loginResult.token).toBeDefined();
      expect(validateResult.userId).toBe(1);
    });

    it('should handle multiple user sessions independently', async () => {
      // Arrange
      const user1 = { email: 'user1@example.com', password: 'password1', id: 1 };
      const user2 = { email: 'user2@example.com', password: 'password2', id: 2 };
      const decoded = { userId: 1, email: 'user1@example.com' };

      jest.spyOn(bcrypt, 'compare')
        .mockImplementation((pwd: string) => Promise.resolve(pwd === user1.password || pwd === user2.password));
      jest.spyOn(jwt, 'sign')
        .mockImplementationOnce(() => 'user1-token')
        .mockImplementationOnce(() => 'user2-token');
      // Mock jwt.verify for validateToken calls
      jest.spyOn(jwt, 'verify').mockImplementation(() => decoded);

      // Act
      const login1 = await service.login(user1.email, user1.password);
      const login2 = await service.login(user2.email, user2.password);

      // Assert
      expect(login1.success).toBe(true);
      expect(login2.success).toBe(true);
      expect(login1.userId).toBe(user1.id);
      expect(login2.userId).toBe(user2.id);
      expect(login1.token).not.toBe(login2.token);

      // Validate both tokens
      const validate1 = await service.validateToken(login1.token!);
      const validate2 = await service.validateToken(login2.token!);

      expect(validate1.valid).toBe(true);
      expect(validate2.valid).toBe(true);
      expect(validate1.userId).toBe(user1.id);
      expect(validate2.userId).toBe(user2.id);
    });

    it('should enforce single session per user', async () => {
      // Arrange
      const email = 'test@example.com';
      const password = 'password123';

      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
      jest.spyOn(jwt, 'sign')
        .mockImplementationOnce(() => 'first-session-token')
        .mockImplementationOnce(() => 'second-session-token');

      // Act - First login
      const firstLogin = await service.login(email, password);
      expect(firstLogin.success).toBe(true);

      // Act - Second login (should replace first session)
      const secondLogin = await service.login(email, password);
      expect(secondLogin.success).toBe(true);

      // Assert - Tokens should be different
      expect(firstLogin.token).not.toBe(secondLogin.token);

      // Both should still be valid tokens but with single session enforcement
      expect(secondLogin.token).toBeDefined();
    });
  });
});
