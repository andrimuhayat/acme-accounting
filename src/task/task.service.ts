import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Task, TaskStatus } from '../../db/models/Task';

export interface CreateTaskDto {
  title: string;
  description?: string;
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  status?: TaskStatus;
}

export interface TaskResponse {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  userId: number;
  createdAt: Date;
}

export interface DeleteTaskResponse {
  success: boolean;
  message: string;
}

@Injectable()
export class TaskService {
  /**
   * Create a new task for a user
   * Time Complexity: O(1) for create operation
   * @param userId - The user ID from JWT token
   * @param dto - Task creation data
   * @returns Created task
   */
  async createTask(userId: number, dto: CreateTaskDto): Promise<TaskResponse> {
    // Validate input
    if (!dto.title || dto.title.trim().length === 0) {
      throw new ForbiddenException('Title is required');
    }

    const task = await Task.create({
      title: dto.title.trim(),
      description: dto.description?.trim() || '',
      status: TaskStatus.pending,
      userId,
    });

    return this.buildTaskResponse(task);
  }

  /**
   * Get all tasks for a specific user
   * Time Complexity: O(n) where n is number of tasks for user
   * @param userId - The user ID from JWT token
   * @returns Array of user's tasks
   */
  async getTasksByUser(userId: number): Promise<TaskResponse[]> {
    const tasks = await Task.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
    });

    return tasks.map(task => this.buildTaskResponse(task));
  }

  /**
   * Get a specific task by ID with user authorization check
   * Time Complexity: O(1) for lookup
   * @param taskId - The task ID
   * @param userId - The user ID from JWT token (for authorization)
   * @returns Task if found and authorized
   * @throws NotFoundException if task not found
   * @throws ForbiddenException if user doesn't own the task
   */
  async getTaskById(taskId: number, userId: number): Promise<TaskResponse> {
    const task = await Task.findByPk(taskId);

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.userId !== userId) {
      throw new ForbiddenException('Access denied to this task');
    }

    return this.buildTaskResponse(task);
  }

  /**
   * Update a task with user authorization check
   * Time Complexity: O(1) for lookup and update
   * @param taskId - The task ID
   * @param userId - The user ID from JWT token (for authorization)
   * @param dto - Update data
   * @returns Updated task
   * @throws NotFoundException if task not found
   * @throws ForbiddenException if user doesn't own the task
   */
  async updateTask(taskId: number, userId: number, dto: UpdateTaskDto): Promise<TaskResponse> {
    const task = await Task.findByPk(taskId);

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.userId !== userId) {
      throw new ForbiddenException('Access denied to this task');
    }

    // Update fields if provided
    if (dto.title !== undefined && dto.title.trim().length > 0) {
      task.title = dto.title.trim();
    }

    if (dto.description !== undefined) {
      task.description = dto.description.trim();
    }

    if (dto.status !== undefined) {
      // Validate status value
      if (!Object.values(TaskStatus).includes(dto.status)) {
        throw new ForbiddenException('Invalid status value');
      }
      task.status = dto.status;
    }

    await task.save();

    return this.buildTaskResponse(task);
  }

  /**
   * Delete a task with user authorization check
   * Time Complexity: O(1) for lookup and delete
   * @param taskId - The task ID
   * @param userId - The user ID from JWT token (for authorization)
   * @returns Delete confirmation
   * @throws NotFoundException if task not found
   * @throws ForbiddenException if user doesn't own the task
   */
  async deleteTask(taskId: number, userId: number): Promise<DeleteTaskResponse> {
    const task = await Task.findByPk(taskId);

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.userId !== userId) {
      throw new ForbiddenException('Access denied to this task');
    }

    await task.destroy();

    return {
      success: true,
      message: 'Task deleted successfully',
    };
  }

  /**
   * Build a TaskResponse from a Task model instance
   * @param task - Task model instance
   * @returns TaskResponse object
   */
  private buildTaskResponse(task: Task): TaskResponse {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      userId: task.userId,
      createdAt: task.createdAt,
    };
  }
}