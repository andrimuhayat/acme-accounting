import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TaskService, CreateTaskDto, UpdateTaskDto, TaskResponse } from './task.service';
import { Task, TaskStatus } from '../../db/models/Task';

// Mock the Task model
jest.mock('../../db/models/Task');

describe('TaskService', () => {
  let service: TaskService;

  // Mock data
  const mockTask = {
    id: 1,
    title: 'Test Task',
    description: 'Test Description',
    status: TaskStatus.pending,
    userId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn(),
    destroy: jest.fn(),
  };

  beforeEach(async () => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [TaskService],
    }).compile();

    service = module.get<TaskService>(TaskService);
  });

  describe('createTask', () => {
    describe('happy path', () => {
      it('should successfully create a task', async () => {
        // Arrange
        const userId = 1;
        const dto: CreateTaskDto = { title: 'New Task', description: 'Task description' };

        (Task.create as jest.Mock).mockResolvedValue({
          id: 1,
          title: dto.title,
          description: dto.description,
          status: TaskStatus.pending,
          userId,
          createdAt: new Date(),
        });

        // Act
        const result: TaskResponse = await service.createTask(userId, dto);

        // Assert
        expect(result.id).toBe(1);
        expect(result.title).toBe(dto.title);
        expect(result.description).toBe(dto.description);
        expect(result.status).toBe(TaskStatus.pending);
        expect(result.userId).toBe(userId);
        expect(Task.create).toHaveBeenCalledWith({
          title: dto.title,
          description: dto.description || '',
          status: TaskStatus.pending,
          userId,
        });
      });

      it('should create task with empty description when not provided', async () => {
        // Arrange
        const userId = 1;
        const dto: CreateTaskDto = { title: 'Task without description' };

        (Task.create as jest.Mock).mockResolvedValue({
          id: 2,
          title: dto.title,
          description: '',
          status: TaskStatus.pending,
          userId,
          createdAt: new Date(),
        });

        // Act
        const result: TaskResponse = await service.createTask(userId, dto);

        // Assert
        expect(result.description).toBe('');
        expect(result.status).toBe(TaskStatus.pending);
      });

      it('should return task with correct structure', async () => {
        // Arrange
        const userId = 1;
        const dto: CreateTaskDto = { title: 'Task with ID' };

        (Task.create as jest.Mock).mockResolvedValue({
          id: 5,
          title: dto.title,
          description: '',
          status: TaskStatus.pending,
          userId,
          createdAt: new Date(),
        });

        // Act
        const result: TaskResponse = await service.createTask(userId, dto);

        // Assert
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('description');
        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('userId');
        expect(result).toHaveProperty('createdAt');
      });
    });

    describe('error cases', () => {
      it('should reject task with empty title', async () => {
        // Arrange
        const userId = 1;
        const dto: CreateTaskDto = { title: '' };

        // Act & Assert
        await expect(service.createTask(userId, dto)).rejects.toThrow(ForbiddenException);
      });

      it('should reject task with whitespace-only title', async () => {
        // Arrange
        const userId = 1;
        const dto: CreateTaskDto = { title: '   ' };

        // Act & Assert
        await expect(service.createTask(userId, dto)).rejects.toThrow(ForbiddenException);
      });

      it('should reject task when title is null', async () => {
        // Arrange
        const userId = 1;
        const dto = { title: null as any, description: 'desc' };

        // Act & Assert
        await expect(service.createTask(userId, dto)).rejects.toThrow();
      });
    });
  });

  describe('getTasksByUser', () => {
    describe('happy path', () => {
      it('should return all tasks for a user', async () => {
        // Arrange
        const userId = 1;
        const tasks = [
          { id: 1, title: 'Task 1', description: '', status: TaskStatus.pending, userId, createdAt: new Date() },
          { id: 2, title: 'Task 2', description: '', status: TaskStatus.in_progress, userId, createdAt: new Date() },
        ];
        (Task.findAll as jest.Mock).mockResolvedValue(tasks);

        // Act
        const result: TaskResponse[] = await service.getTasksByUser(userId);

        // Assert
        expect(result).toHaveLength(2);
        expect(Task.findAll).toHaveBeenCalledWith({
          where: { userId },
          order: [['createdAt', 'DESC']],
        });
      });

      it('should return empty array when user has no tasks', async () => {
        // Arrange
        const userId = 999;
        (Task.findAll as jest.Mock).mockResolvedValue([]);

        // Act
        const result: TaskResponse[] = await service.getTasksByUser(userId);

        // Assert
        expect(result).toEqual([]);
      });

      it('should return tasks with correct structure', async () => {
        // Arrange
        const userId = 1;
        (Task.findAll as jest.Mock).mockResolvedValue([mockTask]);

        // Act
        const result: TaskResponse[] = await service.getTasksByUser(userId);

        // Assert
        expect(result[0]).toHaveProperty('id');
        expect(result[0]).toHaveProperty('title');
        expect(result[0]).toHaveProperty('description');
        expect(result[0]).toHaveProperty('status');
        expect(result[0]).toHaveProperty('userId');
        expect(result[0]).toHaveProperty('createdAt');
      });
    });
  });

  describe('getTaskById', () => {
    describe('happy path', () => {
      it('should return task when found and user owns it', async () => {
        // Arrange
        const taskId = 1;
        const userId = 1;
        (Task.findByPk as jest.Mock).mockResolvedValue({ ...mockTask });

        // Act
        const result: TaskResponse = await service.getTaskById(taskId, userId);

        // Assert
        expect(result.id).toBe(taskId);
        expect(result.userId).toBe(userId);
      });

      it('should return task with correct structure', async () => {
        // Arrange
        const taskId = 1;
        const userId = 1;
        (Task.findByPk as jest.Mock).mockResolvedValue({ ...mockTask });

        // Act
        const result: TaskResponse = await service.getTaskById(taskId, userId);

        // Assert
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('description');
        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('userId');
        expect(result).toHaveProperty('createdAt');
      });
    });

    describe('error cases', () => {
      it('should throw NotFoundException when task not found', async () => {
        // Arrange
        const taskId = 999;
        const userId = 1;
        (Task.findByPk as jest.Mock).mockResolvedValue(null);

        // Act & Assert
        await expect(service.getTaskById(taskId, userId)).rejects.toThrow(NotFoundException);
      });

      it('should throw ForbiddenException when task belongs to different user', async () => {
        // Arrange
        const taskId = 1;
        const taskOwnerId = 2;
        const requestingUserId = 1;
        (Task.findByPk as jest.Mock).mockResolvedValue({ ...mockTask, userId: taskOwnerId });

        // Act & Assert
        await expect(service.getTaskById(taskId, requestingUserId)).rejects.toThrow(ForbiddenException);
      });
    });
  });

  describe('updateTask', () => {
    describe('happy path', () => {
      it('should successfully update task title', async () => {
        // Arrange
        const taskId = 1;
        const userId = 1;
        const dto: UpdateTaskDto = { title: 'Updated Title' };
        const mockTaskInstance = {
          ...mockTask,
          save: jest.fn().mockResolvedValue(true),
        };
        (Task.findByPk as jest.Mock).mockResolvedValue(mockTaskInstance);

        // Act
        const result: TaskResponse = await service.updateTask(taskId, userId, dto);

        // Assert
        expect(mockTaskInstance.save).toHaveBeenCalled();
      });

      it('should successfully update task description', async () => {
        // Arrange
        const taskId = 1;
        const userId = 1;
        const dto: UpdateTaskDto = { description: 'Updated Description' };
        const mockTaskInstance = {
          ...mockTask,
          save: jest.fn().mockResolvedValue(true),
        };
        (Task.findByPk as jest.Mock).mockResolvedValue(mockTaskInstance);

        // Act
        await service.updateTask(taskId, userId, dto);

        // Assert
        expect(mockTaskInstance.save).toHaveBeenCalled();
      });

      it('should successfully update task status', async () => {
        // Arrange
        const taskId = 1;
        const userId = 1;
        const dto: UpdateTaskDto = { status: TaskStatus.completed };
        const mockTaskInstance = {
          ...mockTask,
          save: jest.fn().mockResolvedValue(true),
        };
        (Task.findByPk as jest.Mock).mockResolvedValue(mockTaskInstance);

        // Act
        await service.updateTask(taskId, userId, dto);

        // Assert
        expect(mockTaskInstance.save).toHaveBeenCalled();
      });

      it('should update multiple fields at once', async () => {
        // Arrange
        const taskId = 1;
        const userId = 1;
        const dto: UpdateTaskDto = {
          title: 'New Title',
          description: 'New Description',
          status: TaskStatus.in_progress,
        };
        const mockTaskInstance = {
          ...mockTask,
          save: jest.fn().mockResolvedValue(true),
        };
        (Task.findByPk as jest.Mock).mockResolvedValue(mockTaskInstance);

        // Act
        await service.updateTask(taskId, userId, dto);

        // Assert
        expect(mockTaskInstance.save).toHaveBeenCalled();
      });
    });

    describe('error cases', () => {
      it('should throw NotFoundException when task not found', async () => {
        // Arrange
        const taskId = 999;
        const userId = 1;
        const dto: UpdateTaskDto = { title: 'Title' };
        (Task.findByPk as jest.Mock).mockResolvedValue(null);

        // Act & Assert
        await expect(service.updateTask(taskId, userId, dto)).rejects.toThrow(NotFoundException);
      });

      it('should throw ForbiddenException when task belongs to different user', async () => {
        // Arrange
        const taskId = 1;
        const taskOwnerId = 2;
        const requestingUserId = 1;
        const dto: UpdateTaskDto = { title: 'Title' };
        (Task.findByPk as jest.Mock).mockResolvedValue({ ...mockTask, userId: taskOwnerId });

        // Act & Assert
        await expect(service.updateTask(taskId, requestingUserId, dto)).rejects.toThrow(ForbiddenException);
      });

      it('should throw ForbiddenException for invalid status value', async () => {
        // Arrange
        const taskId = 1;
        const userId = 1;
        const dto: UpdateTaskDto = { status: 'invalid' as any };
        const mockTaskInstance = {
          ...mockTask,
          save: jest.fn().mockResolvedValue(true),
        };
        (Task.findByPk as jest.Mock).mockResolvedValue(mockTaskInstance);

        // Act & Assert
        await expect(service.updateTask(taskId, userId, dto)).rejects.toThrow(ForbiddenException);
      });
    });
  });

  describe('deleteTask', () => {
    describe('happy path', () => {
      it('should successfully delete a task', async () => {
        // Arrange
        const taskId = 1;
        const userId = 1;
        const mockTaskInstance = {
          ...mockTask,
          destroy: jest.fn().mockResolvedValue(true),
        };
        (Task.findByPk as jest.Mock).mockResolvedValue(mockTaskInstance);

        // Act
        const result = await service.deleteTask(taskId, userId);

        // Assert
        expect(result.success).toBe(true);
        expect(result.message).toBe('Task deleted successfully');
      });
    });

    describe('error cases', () => {
      it('should throw NotFoundException when task not found', async () => {
        // Arrange
        const taskId = 999;
        const userId = 1;
        (Task.findByPk as jest.Mock).mockResolvedValue(null);

        // Act & Assert
        await expect(service.deleteTask(taskId, userId)).rejects.toThrow(NotFoundException);
      });

      it('should throw ForbiddenException when task belongs to different user', async () => {
        // Arrange
        const taskId = 1;
        const taskOwnerId = 2;
        const requestingUserId = 1;
        (Task.findByPk as jest.Mock).mockResolvedValue({ ...mockTask, userId: taskOwnerId });

        // Act & Assert
        await expect(service.deleteTask(taskId, requestingUserId)).rejects.toThrow(ForbiddenException);
      });
    });
  });
});