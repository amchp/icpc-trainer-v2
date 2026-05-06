import { X } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

type ToastVariant = "default" | "destructive";

interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastItem extends ToastInput {
  id: number;
  createdAt: number;
}

const TOAST_TIMEOUT_MS = 8000;
let nextId = 1;
let toasts: ToastItem[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return toasts;
}

export function toast(input: ToastInput) {
  const id = nextId++;
  toasts = [
    ...toasts,
    {
      ...input,
      id,
      createdAt: Date.now(),
    },
  ].slice(-4);
  emit();
  window.setTimeout(() => dismissToast(id), TOAST_TIMEOUT_MS);
  return id;
}

export function dismissToast(id: number) {
  toasts = toasts.filter((toastItem) => toastItem.id !== id);
  emit();
}

export function Toaster() {
  const currentToasts = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();
      const nextToasts = toasts.filter(
        (toastItem) => now - toastItem.createdAt < TOAST_TIMEOUT_MS,
      );
      if (nextToasts.length !== toasts.length) {
        toasts = nextToasts;
        emit();
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div
      className="pointer-events-none fixed right-4 top-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2"
      aria-live="polite"
      aria-atomic="true"
    >
      {currentToasts.map((toastItem) => (
        <div
          key={toastItem.id}
          className={`pointer-events-auto rounded-lg border bg-[var(--bg-elevated)] p-4 text-sm shadow-2xl shadow-black/30 ${
            toastItem.variant === "destructive"
              ? "border-red-500/40 text-red-100"
              : "border-[var(--border-strong)] text-[var(--text)]"
          }`}
          role={toastItem.variant === "destructive" ? "alert" : "status"}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{toastItem.title}</p>
              {toastItem.description ? (
                <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                  {toastItem.description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toastItem.id)}
              className="rounded-md p-1 text-[var(--text-soft)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
