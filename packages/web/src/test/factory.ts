import type { Task } from '@notiontodoapp/shared';

let counter = 0;

/** Test data factory (PLAN.md 4.4) – Task s rozumnými výchozími hodnotami. */
export function makeTask(overrides: Partial<Task> = {}): Task {
  counter += 1;
  return {
    id: `task-${counter}`,
    name: `Úkol ${counter}`,
    status: 'Todo',
    tags: [],
    dueDate: null,
    timeline: null,
    ownerIds: [],
    description: '',
    dependsOnIds: [],
    parentId: null,
    lastEditedTime: '2026-06-01T00:00:00.000Z',
    url: '',
    ...overrides,
  };
}
