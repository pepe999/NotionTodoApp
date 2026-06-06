import { describe, it, expect } from 'vitest';
import databaseFixture from './__fixtures__/notionDatabase.json';
import pageFixture from './__fixtures__/notionPage.json';
import { checkDatabaseSchema, type RetrievedDatabase } from './schema';
import { mapPageToTask, type NotionPage } from './mapping';

/**
 * Kontraktní testy (PLAN.md 4.4): hlídají, že mapování/validace odpovídají
 * reálnému tvaru Notion odpovědí. Při změně tvaru fixtur (breaking change v
 * Notion API) tyto testy spadnou a upozorní na regresi mappingu.
 */
describe('Notion contract', () => {
  it('validace reálné databáze projde (8 sloupců)', () => {
    const result = checkDatabaseSchema(databaseFixture as RetrievedDatabase);
    expect(result.valid).toBe(true);
    expect(result.columns).toHaveLength(8);
  });

  it('mapování reálné stránky na Task', () => {
    const task = mapPageToTask(pageFixture as unknown as NotionPage);
    expect(task).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Napsat report',
      status: 'In Progress',
      tags: ['work', 'urgent'],
      dueDate: '2026-06-10',
      timeline: { start: '2026-06-01', end: '2026-06-15' },
      ownerIds: ['user-a'],
      description: 'detaily úkolu',
      dependsOnIds: ['22222222-2222-4222-8222-222222222222'],
    });
  });
});
