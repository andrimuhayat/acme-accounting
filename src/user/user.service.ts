import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { AuthUser } from '../../db/models/AuthUser';

export interface RegisterResponse {
  success: boolean;
  message: string;
  userId?: number;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token?: string;
  userId?: number;
}

@Injectable()
export class UserService {
  private readonly BCRYPT_ROUNDS = 10;
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'acme-fallback-dev-only-32chars!!';
  private readonly JWT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Register a new user with email and password
   * Time Complexity: O(1) for validation, O(bcrypt) for password hashing
   * @param email - User email
   * @param password - User password (plain text)
   * @returns RegisterResponse with success status and userId on success
   */
  async register(email: string, password: string): Promise<RegisterResponse> {
    // Validate email - check null/undefined FIRST
    if (email === null || email === undefined) {
      return {
        success: false,
        message: 'Email and password are required',
      };
    }

    if (!email || email.trim().length === 0) {
      return {
        success: false,
        message: 'Email and password are required',
      };
    }

    if (!this.isValidEmail(email)) {
      return {
        success: false,
        message: 'Invalid email address provided',
      };
    }

    // Validate password
    if (password === null || password === undefined) {
      return {
        success: false,
        message: 'Email and password are required',
      };
    }

    if (!password || password.trim().length === 0) {
      return {
        success: false,
        message: 'Email and password are required',
      };
    }

    // Check if user already exists
    const existingUser = await this.getUserByEmail(email);
    if (existingUser) {
      return {
        success: false,
        message: 'User with this email already exists',
      };
    }

    // Hash password and create user
    try {
      const passwordHash = await this.hashPassword(password);
      const user = await AuthUser.create({
        email: email.trim().toLowerCase(),
        passwordHash,
      });

      return {
        success: true,
        message: 'Registration successful',
        userId: user.id,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Registration failed. Please try again.',
      };
    }
  }

  /**
   * Login user with email and password
   * Time Complexity: O(1) for validation, O(1) for user lookup, O(bcrypt) for password comparison
   * @param email - User email
   * @param password - User password (plain text)
   * @returns LoginResponse with token on success
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    // Validate email - check null/undefined FIRST
    if (email === null || email === undefined) {
      return {
        success: false,
        message: 'Email and password are required',
      };
    }

    if (!email || email.trim().length === 0) {
      return {
        success: false,
        message: 'Email and password are required',
      };
    }

    if (!this.isValidEmail(email)) {
      return {
        success: false,
        message: 'Invalid email address provided',
      };
    }

    // Validate password
    if (password === null || password === undefined) {
      return {
        success: false,
        message: 'Email and password are required',
      };
    }

    if (!password || password.trim().length === 0) {
      return {
        success: false,
        message: 'Email and password are required',
      };
    }

    // Find user by email
    const user = await this.getUserByEmail(email);
    if (!user) {
      return {
        success: false,
        message: 'Invalid credentials',
      };
    }

    // Verify password
    const isPasswordValid = await this.comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return {
        success: false,
        message: 'Invalid credentials',
      };
    }

    // Generate JWT token
    const token = this.generateJwtToken(user.id, user.email);

    return {
      success: true,
      message: 'Login successful',
      token,
      userId: user.id,
    };
  }

  /**
   * Get user by email
   * Time Complexity: O(1) lookup via index
   * @param email - User email to find
   * @returns AuthUser if found, null otherwise
   */
  async getUserByEmail(email: string): Promise<AuthUser | null> {
    if (!email || !this.isValidEmail(email)) {
      return null;
    }

    return await AuthUser.findOne({
      where: { email: email.trim().toLowerCase() },
    });
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
   * Hash a password using bcrypt
   * Time Complexity: O(bcrypt) for hashing
   * @param password - Plain text password
   * @returns Hashed password
   */
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.BCRYPT_ROUNDS);
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
}