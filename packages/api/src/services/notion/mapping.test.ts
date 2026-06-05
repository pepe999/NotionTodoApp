import { describe, it, expect } from 'vitest';
import { mapPageToTask, taskInputToProperties, type NotionPage } from './mapping';

const samplePage: NotionPage = {
  id: 'page-1',
  url: 'https://notion.so/page-1',
  last_edited_time: '2026-06-01T10:00:00.000Z',
  properties: {
    Name: { type: 'title', title: [{ plain_text: 'Napsat ' }, { plain_text: 'report' }] },
    Status: { type: 'select', select: { name: 'In Progress' } },
    Tags: { type: 'multi_select', multi_select: [{ name: 'work' }, { name: 'urgent' }] },
    Due: { type: 'date', date: { start: '2026-06-10' } },
    Timeline: { type: 'date', date: { start: '2026-06-01', end: '2026-06-15' } },
    Owner: { type: 'people', people: [{ id: 'user-a' }] },
    Description: { type: 'rich_text', rich_text: [{ plain_text: 'detaily' }] },
    DependsOn: { type: 'relation', relation: [{ id: 'task-x' }] },
    'Parent item': { type: 'relation', relation: [{ id: 'parent-1' }] },
  },
};

describe('mapPageToTask', () => {
  it('namapuje všechna pole', () => {
    const task = mapPageToTask(samplePage);
    expect(task).toEqual({
      id: 'page-1',
      name: 'Napsat report',
      status: 'In Progress',
      tags: ['work', 'urgent'],
      dueDate: '2026-06-10',
      timeline: { start: '2026-06-01', end: '2026-06-15' },
      ownerIds: ['user-a'],
      description: 'detaily',
      dependsOnIds: ['task-x'],
      parentId: 'parent-1',
      lastEditedTime: '2026-06-01T10:00:00.000Z',
      url: 'https://notion.so/page-1',
    });
  });

  it('je tolerantní k prázdné/neúplné stránce', () => {
    const task = mapPageToTask({ id: 'p2' });
    expect(task.name).toBe('Bez názvu');
    expect(task.status).toBe('Todo');
    expect(task.tags).toEqual([]);
    expect(task.dueDate).toBeNull();
    expect(task.timeline).toBeNull();
    expect(task.parentId).toBeNull();
  });

  it('neznámý status spadne na Todo', () => {
    const task = mapPageToTask({
      id: 'p3',
      properties: { Status: { type: 'select', select: { name: 'Bogus' } } },
    });
    expect(task.status).toBe('Todo');
  });
});

describe('taskInputToProperties', () => {
  it('zahrne jen přítomná pole (částečný PATCH)', () => {
    const props = taskInputToProperties({ status: 'Done' });
    expect(Object.keys(props)).toEqual(['Status']);
    expect(props.Status).toEqual({ select: { name: 'Done' } });
  });

  it('null v dueDate vyčistí pole', () => {
    expect(taskInputToProperties({ dueDate: null }).Due).toEqual({ date: null });
    expect(taskInputToProperties({ dueDate: '2026-01-01' }).Due).toEqual({
      date: { start: '2026-01-01' },
    });
  });

  it('parentId nastaví relaci Parent item', () => {
    expect(taskInputToProperties({ parentId: 'abc' })['Parent item']).toEqual({
      relation: [{ id: 'abc' }],
    });
    expect(taskInputToProperties({ parentId: null })['Parent item']).toEqual({ relation: [] });
  });
});
