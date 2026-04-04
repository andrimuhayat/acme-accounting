import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { TaskService, CreateTaskResponse, UpdateTaskResponse, DeleteTaskResponse } from './task.service';
import { Task, TaskStatus } from '../db/models/Task';

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
  };

  // Mock the Task model
  const mockTaskRepository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        {
          provide: getModelToken(Task),
          useValue: mockTaskRepository,
        },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('createTask', () => {
    describe('happy path', () => {
      it('should successfully create a task', async () => {
        // Arrange
        const title = 'New Task';
        const description = 'Task description';
        const userId = 1;

        mockTaskRepository.create.mockResolvedValue({
          id: 1,
          title,
          description,
          status: TaskStatus.pending,
          userId,
        });

        // Act
        const result: CreateTaskResponse = await service.createTask(title, description, userId);

        // Assert
        expect(result.success).toBe(true);
        expect(result.task).toBeDefined();
        expect(result.task.title).toBe(title);
        expect(result.task.description).toBe(description);
        expect(result.task.status).toBe(TaskStatus.pending);
        expect(result.task.userId).toBe(userId);
      });

      it('should create task with default pending status', async () => {
        // Arrange
        const title = 'Task without description';
        const userId = 1;

        mockTaskRepository.create.mockResolvedValue({
          id: 2,
          title,
          description: '',
          status: TaskStatus.pending,
          userId,
        });

        // Act
        const result: CreateTaskResponse = await service.createTask(title, undefined, userId);

        // Assert
        expect(result.success).toBe(true);
        expect(result.task.status).toBe(TaskStatus.pending);
      });

      it('should return task with id', async () => {
        // Arrange
        const title = 'Task with ID';
        const userId = 1;

        mockTaskRepository.create.mockResolvedValue({
          id: 5,
          title,
          status: TaskStatus.pending,
          userId,
        });

        // Act
        const result: CreateTaskResponse = await service.createTask(title, '', userId);

        // Assert
        expect(result.task.id).toBeDefined();
        expect(typeof result.task.id).toBe('number');
      });
    });

    describe('error cases', () => {
      it('should reject task with empty title', async () => {
        // Arrange
        const title = '';
        const userId = 1;

        // Act
        const result: CreateTaskResponse = await service.createTask(title, 'desc', userId);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Title is required');
      });

      it('should reject task with null title', async () => {
        // Act
        const result: CreateTaskResponse = await service.createTask(null as any, 'desc', 1);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Title is required');
      });

      it('should reject task with whitespace-only title', async () => {
        // Arrange
        const title = '   ';
        const userId = 1;

        // Act
        const result: CreateTaskResponse = await service.createTask(title, 'desc', userId);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Title is required');
      });

      it('should reject task creation when userId is invalid', async () => {
        // Act
        const result: CreateTaskResponse = await service.createTask('Title', 'desc', null as any);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('User ID is required');
      });
    });
  });

  describe('getTasksByUser', () => {
    describe('happy path', () => {
      it('should return all tasks for a user', async () => {
        // Arrange
        const userId = 1;
        const tasks = [
          { id: 1, title: 'Task 1', userId },
          { id: 2, title: 'Task 2', userId },
        ];
        mockTaskRepository.findAll.mockResolvedValue(tasks);

        // Act
        const result = await service.getTasksByUser(userId);

        // Assert
        expect(result).toEqual(tasks);
        expect(mockTaskRepository.findAll).toHaveBeenCalledWith({
          where: { userId },
        });
      });

      it('should return empty array when user has no tasks', async () => {
        // Arrange
        const userId = 999;
        mockTaskRepository.findAll.mockResolvedValue([]);

        // Act
        const result = await service.getTasksByUser(userId);

        // Assert
        expect(result).toEqual([]);
      });
    });

    describe('error cases', () => {
      it('should reject when userId is invalid', async () => {
        // Act
        const result = await service.getTasksByUser(null as any);

        // Assert
        expect(result).toEqual({ success: false, message: 'User ID is required' });
      });

      it('should reject when userId is zero', async () => {
        // Act
        const result = await service.getTasksByUser(0);

        // Assert
        expect(result).toEqual({ success: false, message: 'User ID is required' });
      });
    });
  });

  describe('getTaskById', () => {
    describe('happy path', () => {
      it('should return task when found and user owns it', async () => {
        // Arrange
        const taskId = 1;
        const userId = 1;
        const task = { ...mockTask, userId };
        mockTaskRepository.findByPk.mockResolvedValue(task);

        // Act
        const result = await service.getTaskById(taskId, userId);

        // Assert
        expect(result).toEqual(task);
      });

      it('should return task with correct structure', async () => {
        // Arrange
        const taskId = 1;
        const userId = 1;
        mockTaskRepository.findByPk.mockResolvedValue(mockTask);

        // Act
        const result = await service.getTaskById(taskId, userId);

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
      it('should return error when task not found', async () => {
        // Arrange
        const taskId = 999;
        const userId = 1;
        mockTaskRepository.findByPk.mockResolvedValue(null);

        // Act
        const result = await service.getTaskById(taskId, userId);

        // Assert
        expect(result).toEqual({ success: false, message: 'Task not found' });
      });

      it('should return error when task belongs to different user', async () => {
        // Arrange
        const taskId = 1;
        const taskOwnerId = 2;
        const requestingUserId = 1;
        mockTaskRepository.findByPk.mockResolvedValue({ ...mockTask, userId: taskOwnerId });

        // Act
        const result = await service.getTaskById(taskId, requestingUserId);

        // Assert
        expect(result).toEqual({ success: false, message: 'Task not found' });
      });

      it('should return error when taskId is invalid', async () => {
        // Act
        const result = await service.getTaskById(null as any, 1);

        // Assert
        expect(result).toEqual({ success: false, message: 'Task ID is required' });
      });

      it('should return error when userId is invalid', async () => {
        // Act
        const result = await service.getTaskById(1, null as any);

        // Assert
        expect(result).toEqual({ success: false, message: 'User ID is required' });
      });
    });
  });

  describe('updateTask', () => {
    describe('happy path', () => {
      it('should successfully update task title', async () => {
        // Arrange
        const taskId = 1;
        const userId = 1;
        const newTitle = 'Updated Title';
        mockTaskRepository.findByPk.mockResolvedValue({ ...mockTask, userId });
        mockTaskRepository.update.mockResolvedValue([1]);

        // Act
        const result: UpdateTaskResponse = await service.updateTask(taskId, userId, newTitle, undefined, undefined);

        // Assert
        expect(result.success).toBe(true);
        expect(result.task).toBeDefined();
        expect(mockTaskRepository.update).toHaveBeenCalled();
      });

      it('should successfully update task description', async () => {
        // Arrange
        const taskId = 1;
        const userId = 1;
        const newDescription = 'Updated Description';
        mockTaskRepository.findByPk.mockResolvedValue({ ...mockTask, userId });
        mockTaskRepository.update.mockResolvedValue([1]);

        // Act
        const result: UpdateTaskResponse = await service.updateTask(taskId, userId, undefined, newDescription, undefined);

        // Assert
        expect(result.success).toBe(true);
      });

      it('should successfully update task status', async () => {
        // Arrange
        const taskId = 1;
        const userId = 1;
        const newStatus = TaskStatus.completed;
        mockTaskRepository.findByPk.mockResolvedValue({ ...mockTask, userId });
        mockTaskRepository.update.mockResolvedValue([1]);

        // Act
        const result: UpdateTaskResponse = await service.updateTask(taskId, userId, undefined, undefined, newStatus);

        // Assert
        expect(result.success).toBe(true);
      });

      it('should update multiple fields at once', async () => {
        // Arrange
        const taskId = 1;
        const userId = 1;
        mockTaskRepository.findByPk.mockResolvedValue({ ...mockTask, userId });
        mockTaskRepository.update.mockResolvedValue([1]);

        // Act
        const result: UpdateTaskResponse = await service.updateTask(
          taskId,
          userId,
          'New Title',
          'New Description',
          TaskStatus.in_progress,
        );

        // Assert
        expect(result.success).toBe(true);
      });
    });

    describe('error cases', () => {
      it('should return error when task not found', async () => {
        // Arrange
        const taskId = 999;
        const userId = 1;
        mockTaskRepository.findByPk.mockResolvedValue(null);

        // Act
        const result: UpdateTaskResponse = await service.updateTask(taskId, userId, 'Title', undefined, undefined);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Task not found');
      });

      it('should return error when task belongs to different user', async () => {
        // Arrange
        const taskId = 1;
        const taskOwnerId = 2;
        const requestingUserId = 1;
        mockTaskRepository.findByPk.mockResolvedValue({ ...mockTask, userId: taskOwnerId });

        // Act
        const result: UpdateTaskResponse = await service.updateTask(taskId, requestingUserId, 'Title', undefined, undefined);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Task not found');
      });

      it('should return error when taskId is invalid', async () => {
        // Act
        const result: UpdateTaskResponse = await service.updateTask(null as any, 1, 'Title', undefined, undefined);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Task ID is required');
      });

      it('should return error when userId is invalid', async () => {
        // Act
        const result: UpdateTaskResponse = await service.updateTask(1, null as any, 'Title', undefined, undefined);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('User ID is required');
      });

      it('should return error when no update fields provided', async () => {
        // Arrange
        const taskId = 1;
        const userId = 1;
        mockTaskRepository.findByPk.mockResolvedValue({ ...mockTask, userId });

        // Act
        const result: UpdateTaskResponse = await service.updateTask(taskId, userId, undefined, undefined, undefined);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('No update fields provided');
      });
    });
  });

  describe('deleteTask', () => {
    describe('happy path', () => {
      it('should successfully delete a task', async () => {
        // Arrange
        const taskId = 1;
        const userId = 1;
        mockTaskRepository.findByPk.mockResolvedValue({ ...mockTask, userId });
        mockTaskRepository.destroy.mockResolvedValue(1);

        // Act
        const result: DeleteTaskResponse = await service.deleteTask(taskId, userId);

        // Assert
        expect(result.success).toBe(true);
        expect(result.message).toBe('Task deleted successfully');
      });
    });

    describe('error cases', () => {
      it('should return error when task not found', async () => {
        // Arrange
        const taskId = 999;
        const userId = 1;
        mockTaskRepository.findByPk.mockResolvedValue(null);

        // Act
        const result: DeleteTaskResponse = await service.deleteTask(taskId, userId);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Task not found');
      });

      it('should return error when task belongs to different user', async () => {
        // Arrange
        const taskId = 1;
        const taskOwnerId = 2;
        const requestingUserId = 1;
        mockTaskRepository.findByPk.mockResolvedValue({ ...mockTask, userId: taskOwnerId });

        // Act
        const result: DeleteTaskResponse = await service.deleteTask(taskId, requestingUserId);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Task not found');
      });

      it('should return error when taskId is invalid', async () => {
        // Act
        const result: DeleteTaskResponse = await service.deleteTask(null as any, 1);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Task ID is required');
      });

      it('should return error when userId is invalid', async () => {
        // Act
        const result: DeleteTaskResponse = await service.deleteTask(1, null as any);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('User ID is required');
      });
    });
  });
});