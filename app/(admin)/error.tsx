"use client";

import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <AlertCircle className="h-8 w-8 text-text-primary" />
      <h2 className="font-display text-h3 text-text-primary">Algo no salió bien.</h2>
      <p className="text-body-s text-text-secondary">
        Intenta de nuevo. Si el problema persiste, contacta a soporte.
      </p>
      <Button onClick={reset} className="font-display font-semibold">
        Reintentar
      </Button>
    </div>
  );
}
