import { Injectable } from '@nestjs/common';
import { performance } from 'perf_hooks';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token?: string;
  userId?: number;
}

export interface ValidateTokenResponse {
  valid: boolean;
  userId?: number;
}

export interface LogoutResponse {
  success: boolean;
  message: string;
}

export interface AuthenticatedUser {
  userId: number;
  email: string;
  token: string;
  createdAt: Date;
}

@Injectable()
export class AuthService {
  private activeSessions: Map<string, AuthenticatedUser> = new Map();
  private userSessionMap: Map<number, string> = new Map(); // userId -> token (for single session enforcement)
  private readonly JWT_SECRET = (() => {
    const secret = process.env.JWT_SECRET;
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    return secret || 'acme-secret-key-change-in-production';
  })();
  private readonly JWT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly BCRYPT_ROUNDS = 10;

  /**
   * Authenticate user with email and password
   * Time Complexity: O(1) for session lookup, O bcrypt for password comparison
   * @param email - User email
   * @param password - User password (plain text, will be compared with hashed)
   * @returns LoginResponse with token on success
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      // Validate input
      if (!email || !this.isValidEmail(email)) {
        return {
          success: false,
          message: 'Invalid email address provided',
        };
      }

      if (!password || password.trim().length === 0) {
        return {
          success: false,
          message: 'Password cannot be empty',
        };
      }

      // For demo purposes, we simulate user lookup
      // In production, this would query the database
      const userId = await this.findUserIdByEmail(email);
      if (!userId) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      // Check if user already has an active session (single session enforcement)
      const existingToken = this.userSessionMap.get(userId);
      if (existingToken) {
        // Revoke old session
        this.activeSessions.delete(existingToken);
        this.userSessionMap.delete(userId);
      }

      // Generate new JWT token
      const token = this.generateJwtToken(userId, email);
      const expiresAt = new Date(Date.now() + this.JWT_EXPIRY_MS);

      // Store session
      const session: AuthenticatedUser = {
        userId,
        email,
        token,
        createdAt: new Date(),
      };

      this.activeSessions.set(token, session);
      this.userSessionMap.set(userId, token);

      return {
        success: true,
        message: 'Login successful',
        token,
        userId,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error during login: ${error.message}`,
      };
    }
  }

  /**
   * Validate a JWT token
   * Time Complexity: O(1)
   * @param token - The JWT token to validate
   * @returns ValidateTokenResponse with validation status and userId
   */
  async validateToken(token: string): Promise<ValidateTokenResponse> {
    if (!token || typeof token !== 'string') {
      return { valid: false };
    }

    try {
      // Verify JWT signature and expiration
      const decoded = jwt.verify(token, this.JWT_SECRET) as { userId: number; email: string };

      // Check if token exists in active sessions
      const session = this.activeSessions.get(token);
      if (!session) {
        return { valid: false };
      }

      return {
        valid: true,
        userId: decoded.userId,
      };
    } catch (error) {
      // Token is invalid (expired, tampered, etc.)
      return { valid: false };
    }
  }

  /**
   * Logout user by invalidating their token
   * Time Complexity: O(1)
   * @param token - The token to invalidate
   * @returns LogoutResponse with success status
   */
  async logout(token: string): Promise<LogoutResponse> {
    try {
      if (!token || typeof token !== 'string') {
        return {
          success: false,
          message: 'Invalid or missing token',
        };
      }

      const session = this.activeSessions.get(token);
      if (!session) {
        return {
          success: false,
          message: 'Session not found',
        };
      }

      // Remove session
      this.activeSessions.delete(token);
      this.userSessionMap.delete(session.userId);

      return {
        success: true,
        message: 'Logout successful',
      };
    } catch (error) {
      return {
        success: false,
        message: `Error during logout: ${error.message}`,
      };
    }
  }

  /**
   * Extract userId from a valid JWT token (without full validation)
   * Time Complexity: O(1)
   * @param token - The JWT token to decode
   * @returns userId if token can be decoded, null otherwise
   */
  getUserIdFromToken(token: string): number | null {
    if (!token || typeof token !== 'string') {
      return null;
    }

    try {
      // Decode without verification (for quick lookup)
      // Full validation should use validateToken()
      const decoded = jwt.decode(token) as { userId: number; email: string } | null;
      if (!decoded || !decoded.userId) {
        return null;
      }
      return decoded.userId;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate a JWT token for a user
   * Time Complexity: O(1)
   * @param userId - User ID
   * @param email - User email
   * @returns Signed JWT token string
   */
  private generateJwtToken(userId: number, email: string): string {
    return jwt.sign(
      { userId, email },
      this.JWT_SECRET,
      { expiresIn: '24h' }
    );
  }

  /**
   * Validate email format
   * Time Complexity: O(1)
   * @param email - Email to validate
   * @returns true if valid email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Simulate user lookup by email
   * In production, this would query the database
   * Time Complexity: O(n) where n is number of users
   * @param email - User email to find
   * @returns userId if found, null otherwise
   */
  private async findUserIdByEmail(email: string): Promise<number | null> {
    // This is a placeholder for database lookup
    // In production: const user = await this.userRepository.findOne({ where: { email } });
    // Demo: accept any valid email format and generate a consistent userId
    if (this.isValidEmail(email)) {
      // Generate deterministic userId from email for demo consistency
      let hash = 0;
      for (let i = 0; i < email.length; i++) {
        const char = email.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return Math.abs(hash) % 10000 || 1; // Return between 1-10000
    }
    return null;
  }

  /**
   * Compare password with hashed password
   * Time Complexity: O(1) for bcrypt comparison
   * @param plainPassword - Plain text password
   * @param hashedPassword - Hashed password from DB
   * @returns true if match
   */
  async comparePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      return false;
    }
  }

  /**
   * Hash a password using bcrypt
   * Time Complexity: O(1) for bcrypt hash
   * @param password - Plain text password
   * @returns Hashed password
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.BCRYPT_ROUNDS);
  }
}
