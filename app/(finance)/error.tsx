"use client";

import { Button } from "@/components/ui/button";

export default function FinancePortalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-lg border border-border-subtle bg-surface p-8">
      <h2>Algo no salió bien.</h2>
      <p className="max-w-[65ch] text-body-s text-graphite">
        Intenta de nuevo. Si el problema persiste, contacta a soporte.
      </p>
      <Button onClick={reset} className="font-display font-semibold">
        Reintentar
      </Button>
    </div>
  );
}
