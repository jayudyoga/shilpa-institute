
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

/**
 * Global error boundary to catch runtime exceptions and prevent app-wide crashes.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error centrally for debugging purposes.
    // In production, this would go to an error monitoring service.
    console.error('Runtime error caught by boundary:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4 space-y-4">
      <div className="size-16 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
        <AlertCircle className="size-10" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold font-headline uppercase tracking-tight text-foreground">Something went wrong</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {error.message || "An unexpected error occurred during rendering. This might be due to missing database indexes or data mismatch."}
        </p>
      </div>
      <div className="flex gap-4 pt-4">
        <Button onClick={() => window.location.reload()} variant="outline" className="gap-2">
           Full Reload
        </Button>
        <Button onClick={() => reset()} className="gap-2">
          <RefreshCw className="size-4" /> Try Again
        </Button>
      </div>
    </div>
  );
}
