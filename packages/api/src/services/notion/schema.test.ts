import { describe, it, expect } from 'vitest';
import { checkDatabaseSchema, type RetrievedDatabase } from './schema';

const validDatabase: RetrievedDatabase = {
  properties: {
    Name: { type: 'title' },
    Status: {
      type: 'select',
      select: {
        options: [{ name: 'Todo' }, { name: 'In Progress' }, { name: 'Review' }, { name: 'Done' }],
      },
    },
    Tags: { type: 'multi_select' },
    Due: { type: 'date' },
    Timeline: { type: 'date' },
    Owner: { type: 'people' },
    Description: { type: 'rich_text' },
    DependsOn: { type: 'relation' },
  },
};

describe('checkDatabaseSchema', () => {
  it('platná databáze → valid', () => {
    const result = checkDatabaseSchema(validDatabase);
    expect(result.valid).toBe(true);
    expect(result.columns).toHaveLength(8);
    expect(result.columns.every((c) => c.ok)).toBe(true);
  });

  it('chybějící sloupec → invalid s popisem', () => {
    const db: RetrievedDatabase = { properties: { ...validDatabase.properties } };
    delete db.properties!.Tags;
    const result = checkDatabaseSchema(db);
    expect(result.valid).toBe(false);
    const tags = result.columns.find((c) => c.column === 'Tags');
    expect(tags?.ok).toBe(false);
    expect(tags?.message).toContain('chybí');
  });

  it('špatný typ → invalid', () => {
    const db: RetrievedDatabase = {
      properties: { ...validDatabase.properties, Due: { type: 'rich_text' } },
    };
    const result = checkDatabaseSchema(db);
    const due = result.columns.find((c) => c.column === 'Due');
    expect(due?.ok).toBe(false);
    expect(due?.actualType).toBe('rich_text');
  });

  it('chybějící select volby → invalid', () => {
    const db: RetrievedDatabase = {
      properties: {
        ...validDatabase.properties,
        Status: { type: 'select', select: { options: [{ name: 'Todo' }] } },
      },
    };
    const result = checkDatabaseSchema(db);
    const status = result.columns.find((c) => c.column === 'Status');
    expect(status?.ok).toBe(false);
    expect(status?.message).toContain('In Progress');
  });
});
