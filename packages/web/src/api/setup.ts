import type { ValidateResult } from '@notiontodoapp/shared';
import { apiFetch } from '@/lib/api';

export const validateNotion = (token: string, databaseId: string): Promise<ValidateResult> =>
  apiFetch<ValidateResult>('/api/setup/validate', { method: 'POST', body: { token, databaseId } });

export interface SaveResult {
  ok: boolean;
  databaseId: string;
  validatedAt: number;
}

export const saveNotion = (token: string, databaseId: string): Promise<SaveResult> =>
  apiFetch<SaveResult>('/api/setup/save', { method: 'POST', body: { token, databaseId } });
