import type { Task, CreateTaskInput, UpdateTaskInput } from '@notiontodoapp/shared';
import { apiFetch } from '@/lib/api';

export const fetchTasks = (signal?: AbortSignal): Promise<Task[]> =>
  apiFetch<Task[]>('/api/tasks', signal ? { signal } : {});

export const createTask = (input: CreateTaskInput): Promise<Task> =>
  apiFetch<Task>('/api/tasks', { method: 'POST', body: input });

export const updateTask = (id: string, input: UpdateTaskInput): Promise<Task> =>
  apiFetch<Task>(`/api/tasks/${id}`, { method: 'PATCH', body: input });

export const deleteTask = (id: string): Promise<void> =>
  apiFetch<void>(`/api/tasks/${id}`, { method: 'DELETE' });

export const createSubtask = (parentId: string, input: CreateTaskInput): Promise<Task> =>
  apiFetch<Task>(`/api/tasks/${parentId}/subtasks`, { method: 'POST', body: input });
