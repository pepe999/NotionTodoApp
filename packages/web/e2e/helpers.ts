import type { Page } from '@playwright/test';

export interface MockTask {
  id: string;
  name: string;
  status: string;
  tags: string[];
  dueDate: string | null;
  timeline: null;
  ownerIds: string[];
  description: string;
  dependsOnIds: string[];
  parentId: string | null;
  lastEditedTime: string;
  url: string;
}

export function task(id: string, name: string, status = 'Todo'): MockTask {
  return {
    id,
    name,
    status,
    tags: [],
    dueDate: null,
    timeline: null,
    ownerIds: [],
    description: '',
    dependsOnIds: [],
    parentId: null,
    lastEditedTime: '2026-06-01T00:00:00.000Z',
    url: '',
  };
}

/** Namockuje přihlášeného uživatele + seznam úkolů na úrovni prohlížeče. */
export async function mockAuthedApp(page: Page, tasks: MockTask[]): Promise<void> {
  await page.route('**/auth/me', (route) =>
    route.fulfill({ json: { id: 'u', email: 'a@b.cz', name: 'A', avatarUrl: null } }),
  );
  await page.route('**/api/tasks', (route) => route.fulfill({ json: tasks }));
}
