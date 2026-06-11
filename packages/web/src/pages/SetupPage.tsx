import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { ValidateResult } from '@notiontodoapp/shared';
import { validateNotion, saveNotion } from '@/api/setup';
import { ApiError } from '@/lib/api';
import { TASKS_KEY } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, X, ExternalLink, Loader2 } from 'lucide-react';

type Step = 'intro' | 'credentials' | 'result';

export function SetupPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>('intro');
  const [token, setToken] = useState('');
  const [databaseId, setDatabaseId] = useState('');
  const [result, setResult] = useState<ValidateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onValidate = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const r = await validateNotion(token, databaseId);
      setResult(r);
      setStep('result');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Validace selhala.');
    } finally {
      setBusy(false);
    }
  };

  const onSave = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await saveNotion(token, databaseId);
      await qc.invalidateQueries({ queryKey: TASKS_KEY });
      navigate('/', { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Uložení selhalo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Připojení Notion</CardTitle>
          <CardDescription>
            {step === 'intro' && 'Propoj appku se svou Notion databází úkolů.'}
            {step === 'credentials' && 'Zadej integration token a databázi.'}
            {step === 'result' && 'Výsledek kontroly schématu databáze.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {step === 'intro' && (
            <>
              <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-600 dark:text-zinc-300">
                <li>
                  Vytvoř interní integraci na{' '}
                  <a
                    className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                    href="https://www.notion.so/my-integrations"
                    target="_blank"
                    rel="noreferrer"
                  >
                    notion.so/my-integrations <ExternalLink className="h-3 w-3" />
                  </a>
                  .
                </li>
                <li>Zkopíruj „Internal Integration Token" (začíná na ntn_, u starších integrací secret_…).</li>
                <li>Otevři svou databázi úkolů → ⋯ → „Connections" → přidej integraci.</li>
                <li>Zkopíruj URL databáze (obsahuje její ID).</li>
              </ol>
              <Button onClick={() => setStep('credentials')}>Pokračovat</Button>
            </>
          )}

          {step === 'credentials' && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="token">Integration token</Label>
                <Input
                  id="token"
                  type="password"
                  placeholder="ntn_… nebo secret_…"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="db">Database ID nebo URL</Label>
                <Input
                  id="db"
                  placeholder="https://notion.so/… nebo 32znakové ID"
                  value={databaseId}
                  onChange={(e) => setDatabaseId(e.target.value)}
                />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep('intro')}>
                  Zpět
                </Button>
                <Button onClick={onValidate} disabled={busy || !token || !databaseId}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />} Ověřit
                </Button>
              </div>
            </>
          )}

          {step === 'result' && result && (
            <>
              <ul className="flex flex-col gap-1.5 text-sm">
                {result.columns.map((c) => (
                  <li key={c.column} className="flex items-center gap-2">
                    {c.ok ? (
                      <Check className="h-4 w-4 shrink-0 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 shrink-0 text-red-600" />
                    )}
                    <span className="font-medium">{c.column}</span>
                    <span className="text-zinc-500">({c.expectedType})</span>
                    {!c.ok && c.message && <span className="text-red-600">— {c.message}</span>}
                  </li>
                ))}
              </ul>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {result.valid ? (
                <Alert variant="success">
                  <AlertDescription>Databáze je v pořádku. Můžeš uložit.</AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertDescription>
                    Databáze nesplňuje schéma. Oprav sloupce a ověř znovu.
                  </AlertDescription>
                </Alert>
              )}
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep('credentials')}>
                  Zpět
                </Button>
                <Button onClick={onSave} disabled={busy || !result.valid}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />} Uložit a pokračovat
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
