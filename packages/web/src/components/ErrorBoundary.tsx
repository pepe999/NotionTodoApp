import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** Zachytí runtime chyby v render stromu (PLAN.md 3.1). */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Runtime chyba:', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="text-xl font-semibold">Něco se pokazilo</h1>
          <p className="max-w-md text-sm text-zinc-500">{this.state.error.message}</p>
          <Button onClick={() => window.location.reload()}>Načíst znovu</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
