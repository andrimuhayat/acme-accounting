import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import * as bcrypt from 'bcrypt';
import { UserService, RegisterResponse, LoginResponse } from './user.service';
import { AuthUser } from '../../db/models/AuthUser';

describe('UserService', () => {
  let service: UserService;

  // Mock model class
  const mockAuthUserModel = {
    id: 1,
    email: 'test@example.com',
    passwordHash: '$2b$10$hashedpassword',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock the AuthUser model
  const mockAuthUserRepository = {
    create: jest.fn(),
    findOne: jest.fn(),
    findByPk: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getModelToken(AuthUser),
          useValue: mockAuthUserRepository,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('register', () => {
    describe('happy path', () => {
      it('should successfully register a new user', async () => {
        // Arrange
        const email = 'newuser@example.com';
        const password = 'password123';

        mockAuthUserRepository.findOne.mockResolvedValue(null); // No existing user
        mockAuthUserRepository.create.mockResolvedValue({
          id: 2,
          email,
          passwordHash: await bcrypt.hash(password, 10),
        });

        // Act
        const result: RegisterResponse = await service.register(email, password);

        // Assert
        expect(result.success).toBe(true);
        expect(result.message).toBe('Registration successful');
        expect(result.userId).toBe(2);
        expect(mockAuthUserRepository.create).toHaveBeenCalled();
      });

      it('should return userId on successful registration', async () => {
        // Arrange
        const email = 'another@example.com';
        const password = 'securepassword';

        mockAuthUserRepository.findOne.mockResolvedValue(null);
        mockAuthUserRepository.create.mockResolvedValue({
          id: 5,
          email,
        });

        // Act
        const result: RegisterResponse = await service.register(email, password);

        // Assert
        expect(result.userId).toBeDefined();
        expect(typeof result.userId).toBe('number');
      });
    });

    describe('error cases', () => {
      it('should reject registration with duplicate email', async () => {
        // Arrange
        const email = 'existing@example.com';
        const password = 'password123';

        mockAuthUserRepository.findOne.mockResolvedValue({
          id: 1,
          email,
          passwordHash: '$2b$10$hashed',
        });

        // Act
        const result: RegisterResponse = await service.register(email, password);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('User with this email already exists');
        expect(result.userId).toBeUndefined();
      });

      it('should reject registration with invalid email format', async () => {
        // Arrange
        const invalidEmails = ['notanemail', 'missing@domain', '@nodomain.com', 'spaces in@email.com'];

        for (const email of invalidEmails) {
          // Act
          const result: RegisterResponse = await service.register(email, 'password123');

          // Assert
          expect(result.success).toBe(false);
          expect(result.message).toBe('Invalid email address provided');
        }
      });

      it('should reject registration with empty email', async () => {
        // Arrange
        const email = '';
        const password = 'password123';

        // Act
        const result: RegisterResponse = await service.register(email, password);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Email and password are required');
      });

      it('should reject registration with null email', async () => {
        // Act
        const result: RegisterResponse = await service.register(null as any, 'password123');

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Email and password are required');
      });

      it('should reject registration with weak password (too short)', async () => {
        // Arrange
        const email = 'user@example.com';
        const weakPasswords = ['short', '1234567', 'abc', ''];

        for (const password of weakPasswords) {
          // Act
          const result: RegisterResponse = await service.register(email, password);

          // Assert
          expect(result.success).toBe(false);
          expect(result.message).toBe('Password must be at least 8 characters long');
        }
      });

      it('should reject registration with null password', async () => {
        // Act
        const result: RegisterResponse = await service.register('user@example.com', null as any);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Email and password are required');
      });

      it('should reject registration with whitespace-only password', async () => {
        // Arrange
        const email = 'user@example.com';
        const password = '        ';

        // Act
        const result: RegisterResponse = await service.register(email, password);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Password must be at least 8 characters long');
      });
    });

    describe('edge cases', () => {
      it('should handle registration with whitespace in email', async () => {
        // Arrange
        const email = '  user@example.com  ';
        const password = 'password123';

        mockAuthUserRepository.findOne.mockResolvedValue(null);
        mockAuthUserRepository.create.mockResolvedValue({
          id: 3,
          email: email.trim(),
        });

        // Act
        const result: RegisterResponse = await service.register(email, password);

        // Assert
        expect(result.success).toBe(true);
      });

      it('should hash password before saving', async () => {
        // Arrange
        const email = 'hashtest@example.com';
        const password = 'password123';
        let savedPasswordHash: string;

        mockAuthUserRepository.findOne.mockResolvedValue(null);
        mockAuthUserRepository.create.mockImplementation(async (data: any) => {
          savedPasswordHash = data.passwordHash;
          return { id: 4, ...data };
        });

        // Act
        await service.register(email, password);

        // Assert
        expect(savedPasswordHash).toBeDefined();
        expect(savedPasswordHash).not.toBe(password); // Should not be plain text
        expect(savedPasswordHash.startsWith('$2b$')).toBe(true); // bcrypt format
      });
    });
  });

  describe('login', () => {
    describe('happy path', () => {
      it('should successfully login with valid credentials', async () => {
        // Arrange
        const email = 'test@example.com';
        const password = 'password123';
        const passwordHash = await bcrypt.hash(password, 10);

        mockAuthUserRepository.findOne.mockResolvedValue({
          id: 1,
          email,
          passwordHash,
        });

        // Mock jwt.sign
        jest.spyOn(require('jsonwebtoken'), 'sign').mockImplementation(() => 'mock-jwt-token');

        // Act
        const result: LoginResponse = await service.login(email, password);

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
        const passwordHash = await bcrypt.hash(password, 10);

        mockAuthUserRepository.findOne.mockResolvedValue({
          id: 1,
          email,
          passwordHash,
        });

        jest.spyOn(require('jsonwebtoken'), 'sign').mockImplementation(() => 'mock-jwt-token');

        // Act
        const result: LoginResponse = await service.login(email, password);

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
        const result: LoginResponse = await service.login(email, password);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Invalid email address provided');
        expect(result.token).toBeUndefined();
      });

      it('should reject login with non-existent user', async () => {
        // Arrange
        const email = 'nonexistent@example.com';
        const password = 'password123';

        mockAuthUserRepository.findOne.mockResolvedValue(null);

        // Act
        const result: LoginResponse = await service.login(email, password);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Invalid credentials');
        expect(result.token).toBeUndefined();
      });

      it('should reject login with wrong password', async () => {
        // Arrange
        const email = 'test@example.com';
        const correctPassword = 'correctpassword';
        const wrongPassword = 'wrongpassword';
        const passwordHash = await bcrypt.hash(correctPassword, 10);

        mockAuthUserRepository.findOne.mockResolvedValue({
          id: 1,
          email,
          passwordHash,
        });

        // Act
        const result: LoginResponse = await service.login(email, wrongPassword);

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
        const result: LoginResponse = await service.login(email, password);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Email and password are required');
      });

      it('should reject login with empty password', async () => {
        // Arrange
        const email = 'test@example.com';
        const password = '';

        // Act
        const result: LoginResponse = await service.login(email, password);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Email and password are required');
      });

      it('should reject login with null email', async () => {
        // Act
        const result: LoginResponse = await service.login(null as any, 'password123');

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Email and password are required');
      });

      it('should reject login with null password', async () => {
        // Act
        const result: LoginResponse = await service.login('test@example.com', null as any);

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
        const result: LoginResponse = await service.login(email, password);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Email and password are required');
      });

      it('should reject login with whitespace-only password', async () => {
        // Arrange
        const email = 'test@example.com';
        const password = '   ';

        // Act
        const result: LoginResponse = await service.login(email, password);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Email and password are required');
      });
    });
  });

  describe('getUserByEmail', () => {
    it('should find user by email', async () => {
      // Arrange
      const email = 'findme@example.com';
      const mockUser = { id: 10, email, passwordHash: 'hash' };
      mockAuthUserRepository.findOne.mockResolvedValue(mockUser);

      // Act
      const result = await service.getUserByEmail(email);

      // Assert
      expect(result).toEqual(mockUser);
      expect(mockAuthUserRepository.findOne).toHaveBeenCalledWith({
        where: { email },
      });
    });

    it('should return null when user not found', async () => {
      // Arrange
      mockAuthUserRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.getUserByEmail('notfound@example.com');

      // Assert
      expect(result).toBeNull();
    });
  });
});