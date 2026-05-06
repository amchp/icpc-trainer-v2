import { useState, type FormEvent } from "react";
import { Loader2, LogIn } from "lucide-react";
import { sessionStore } from "../stores/sessionStore";
import { resolveApiBaseUrl } from "../lib/runtime";
import { Button } from "./ui/button";

export function BlockingLoginScreen() {
  const loginError = sessionStore.useStore((state) => state.loginError);
  const [handle, setHandle] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startupStatus, setStartupStatus] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStartupStatus("Validating Codeforces credentials");

    const events =
      typeof EventSource === "undefined"
        ? null
        : new EventSource(`${resolveApiBaseUrl()}/api/upsolving/events`);
    if (events) {
      events.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data) as {
            readonly type?: string;
            readonly message?: string;
          };
          if (
            (event.type === "startup.progress" || event.type === "startup.completed") &&
            event.message
          ) {
            setStartupStatus(event.message);
          }
        } catch {
          // Ignore malformed events from a stale connection.
        }
      };
    }

    const result = await sessionStore.login({
      handle: handle.trim(),
      apiKey: apiKey.trim(),
      apiSecret: apiSecret.trim(),
    });
    events?.close();

    if (result.ok) {
      setHandle("");
      setApiKey("");
      setApiSecret("");
      setStartupStatus(null);
    }

    setIsSubmitting(false);
    if (!result.ok) {
      setStartupStatus(null);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8 sm:py-10">
      <section className="w-full max-w-lg p-0 sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Login</h1>

        <form
          className="mt-6"
          data-testid="login-form"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--text-soft)]">
                Handle
              </span>
              <input
                className="w-full rounded-lg bg-[var(--bg-hover)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--text-soft)] focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50"
                data-testid="login-handle-input"
                value={handle}
                onChange={(event) => setHandle(event.target.value)}
                placeholder="tourist"
                autoComplete="username"
                disabled={isSubmitting}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--text-soft)]">
                API key
              </span>
              <input
                className="w-full rounded-lg bg-[var(--bg-hover)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--text-soft)] focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50"
                data-testid="login-api-key-input"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="Codeforces API key"
                autoComplete="off"
                disabled={isSubmitting}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--text-soft)]">
                API secret
              </span>
              <input
                className="w-full rounded-lg bg-[var(--bg-hover)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--text-soft)] focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50"
                data-testid="login-api-secret-input"
                value={apiSecret}
                onChange={(event) => setApiSecret(event.target.value)}
                placeholder="Codeforces API secret"
                type="password"
                autoComplete="current-password"
                disabled={isSubmitting}
              />
            </label>
          </div>

          <Button
            className="mt-5 w-full py-3"
            data-testid="login-submit"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                Enter shell
              </>
            )}
          </Button>

          <p
            className={`mt-4 text-sm leading-relaxed ${loginError ? "text-red-400" : "text-[var(--text-soft)]"}`}
          >
            {loginError ??
              startupStatus ??
              "The backend validates the signed credentials before the product shell opens."}
          </p>
        </form>
      </section>
    </main>
  );
}
