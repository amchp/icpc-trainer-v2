import type { ErrorComponentProps } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";

function getMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return "An unexpected router error occurred.";
}

function getDetails(error: unknown) {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return "No error details available.";
  }
}

export function RouteErrorView({ error, reset }: ErrorComponentProps) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-2xl p-8">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-red-400">
            Route Error
          </p>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Shell interrupted.</h1>
        <p className="mt-3 leading-relaxed text-[var(--text-muted)]">{getMessage(error)}</p>

        <div className="mt-6 flex gap-3">
          <Button onClick={() => reset()}>
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>

        <pre className="mt-6 overflow-auto border-t border-[var(--border)] pt-4 font-mono text-xs leading-relaxed text-[var(--text-muted)]">
          {getDetails(error)}
        </pre>
      </section>
    </main>
  );
}
