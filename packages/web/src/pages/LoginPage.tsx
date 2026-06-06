import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { startGoogleLogin } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CheckSquare } from 'lucide-react';

export function LoginPage() {
  const { user, isLoading } = useAuth();
  if (!isLoading && user) return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <CheckSquare className="h-6 w-6" />
          </div>
          <CardTitle>NotionTodoApp</CardTitle>
          <CardDescription>
            Úkoly nad tvou Notion databází – Kanban, časová osa, kalendář.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={startGoogleLogin}>
            Přihlásit přes Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
