import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { formatTimestamp } from "../../lib/format";
import { Button } from "../ui/button";

interface TeammatesPanelProps {
  handles: readonly string[];
  updatedAt: string | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  onReplace(handles: string[]): Promise<{ ok: boolean }>;
}

export function TeammatesPanel(props: TeammatesPanelProps) {
  const [draftHandle, setDraftHandle] = useState("");

  async function addHandle() {
    const nextHandle = draftHandle.trim();
    if (!nextHandle) {
      return;
    }

    const duplicate = props.handles.some(
      (handle) => handle.toLowerCase() === nextHandle.toLowerCase(),
    );
    if (duplicate) {
      setDraftHandle("");
      return;
    }

    const result = await props.onReplace([...props.handles, nextHandle]);
    if (result.ok) {
      setDraftHandle("");
    }
  }

  async function removeHandle(handle: string) {
    await props.onReplace(props.handles.filter((entry) => entry.toLowerCase() !== handle.toLowerCase()));
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold">Teammates</h2>
        </div>
        <div className="text-left text-xs text-[var(--text-muted)] sm:text-right">
          <span>{props.handles.length} teammates</span>
          <span className="mx-2 text-[var(--text-soft)]">&middot;</span>
          <span>updated {formatTimestamp(props.updatedAt)}</span>
        </div>
      </div>


      <div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            className="min-w-0 flex-1 rounded-lg bg-[var(--bg-hover)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--text-soft)] focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50"
            data-testid="team-add-input"
            value={draftHandle}
            onChange={(event) => setDraftHandle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void addHandle();
              }
            }}
            placeholder="Enter a Codeforces handle"
            disabled={props.isLoading || props.isSaving}
          />
          <Button
            data-testid="team-add-submit"
            type="button"
            onClick={() => void addHandle()}
            disabled={props.isSaving}
            className="w-full py-3 sm:w-auto"
          >
            {props.isSaving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            Add teammate
          </Button>
        </div>
        {props.error ? (
          <p className="mt-3 mb-0 text-sm text-red-400">{props.error}</p>
        ) : (
          <p className="mt-3 mb-0 text-xs text-[var(--text-soft)]">
            Handles are stored as part of your primary training group.
          </p>
        )}
      </div>

      <div className="mt-5 min-h-32">
        {props.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-[var(--text-soft)]">
            <Loader2 size={14} className="animate-spin" />
            Loading teammate roster...
          </div>
        ) : props.handles.length > 0 ? (
          <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {props.handles.map((handle, index) => (
              <div key={handle} className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-baseline gap-3">
                  <span className="w-5 shrink-0 text-right font-mono text-xs text-[var(--text-soft)]">
                    {index + 1}
                  </span>
                  <span className="truncate font-mono text-sm">{handle}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void removeHandle(handle)}
                  disabled={props.isSaving}
                  className="shrink-0 text-[var(--text-muted)] hover:border-red-500/50 hover:bg-red-500/12 hover:text-red-300"
                  aria-label={`Remove ${handle}`}
                  data-testid={`team-handle-chip-${handle.toLowerCase()}`}
                >
                  <X size={11} />
                  Remove
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-[var(--text-soft)]">
            No teammates added yet. Add your first handle above.
          </p>
        )}
      </div>
    </section>
  );
}
