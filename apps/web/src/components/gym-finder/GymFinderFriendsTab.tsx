import { useState } from "react";
import { Loader2, Plus, RefreshCw, X } from "lucide-react";
import { toast } from "../ui/toaster";
import { formatTimestamp } from "../../lib/format";
import type { RosterResponse } from "../../types/roster";
import { Button } from "../ui/button";

interface GymFinderFriendsTabProps {
  handles: readonly string[];
  updatedAt: string | null;
  isLoading: boolean;
  isSaving: boolean;
  isSyncing: boolean;
  error: string | null;
  onReplace(handles: string[]): Promise<{ ok: boolean; roster?: RosterResponse }>;
  onSync(force?: boolean, handles?: readonly string[]): Promise<{ ok: boolean }>;
  onRosterChanged(): void;
}

export function GymFinderFriendsTab(props: GymFinderFriendsTabProps) {
  const [draftHandle, setDraftHandle] = useState("");

  async function addHandle() {
    const next = draftHandle.trim();
    if (!next) return;

    if (props.handles.some((h) => h.toLowerCase() === next.toLowerCase())) {
      setDraftHandle("");
      toast({
        title: "Friend already exists",
        description: `${next} is already in this friends roster.`,
      });
      return;
    }

    const result = await props.onReplace([...props.handles, next]);
    if (result.ok) {
      setDraftHandle("");
      const previousHandles = new Set(props.handles.map((handle) => handle.toLowerCase()));
      const addedHandle =
        result.roster?.handles.find((handle) => !previousHandles.has(handle.toLowerCase())) ??
        next;
      const syncResult = await props.onSync(false, [addedHandle]);
      if (syncResult.ok) {
        props.onRosterChanged();
      }
    }
  }

  async function removeHandle(handle: string) {
    const result = await props.onReplace(
      props.handles.filter((h) => h.toLowerCase() !== handle.toLowerCase()),
    );
    if (result.ok) {
      props.onRosterChanged();
    }
  }

  async function syncRoster() {
    const result = await props.onSync(false);
    if (result.ok) {
      props.onRosterChanged();
    }
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <label className="text-sm font-medium text-[var(--text-muted)]">
          Friends
          <span className="ml-2 text-[var(--text-soft)]">({props.handles.length} validated)</span>
        </label>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void syncRoster()}
          disabled={props.isSyncing}
        >
          <RefreshCw size={13} className={props.isSyncing ? "animate-spin" : ""} />
          {props.isSyncing ? "Syncing..." : "Sync"}
        </Button>
      </div>

      <div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={draftHandle}
            onChange={(e) => setDraftHandle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void addHandle();
              }
            }}
            className="min-w-0 flex-1 rounded-lg bg-[var(--bg-hover)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--text-soft)] focus:ring-1 focus:ring-[var(--accent)]"
            placeholder="Enter a Codeforces handle"
            disabled={props.isSaving || props.isLoading || props.isSyncing}
          />
          <Button
            onClick={() => void addHandle()}
            disabled={props.isSaving || props.isSyncing}
            className="w-full py-3 sm:w-auto"
          >
            {props.isSaving || props.isSyncing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            {props.isSyncing ? "Syncing..." : "Add friend"}
          </Button>
        </div>
        {props.error ? (
          <p className="mt-3 mb-0 text-sm text-red-400">{props.error}</p>
        ) : (
          <p className="mt-3 mb-0 text-xs text-[var(--text-soft)]">
            Handles are stored for gym overlap analysis. Duplicates are blocked.
          </p>
        )}
      </div>

      <div className="mt-5 min-h-32">
        {props.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-[var(--text-soft)]">
            <Loader2 size={14} className="animate-spin" />
            Loading current friends...
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
                >
                  <X size={11} />
                  Remove
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-[var(--text-soft)]">
            No friends added yet. Add your first handle above.
          </p>
        )}
      </div>

      <div className="mt-4 text-xs text-[var(--text-soft)]">
        <p className="m-0">Last updated {formatTimestamp(props.updatedAt)}.</p>
      </div>
    </section>
  );
}
