import { ArrowRight, Loader2 } from "lucide-react";
import { formatTimestamp } from "../../lib/format";
import { Button } from "../ui/button";

interface GymFinderContestTabProps {
  handles: readonly string[];
  updatedAt: string | null;
  isLoading: boolean;
  isSyncing: boolean;
  gymFinderViewState: string;
  isSearching: boolean;
  onSearch(): void;
}

export function GymFinderContestTab(props: GymFinderContestTabProps) {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold">Contest Search</h2>
        </div>

        <div className="text-left sm:text-right">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-soft)]">
            Ready friends
          </p>
          <p className="mt-1 text-2xl font-semibold">{props.handles.length}</p>
        </div>
      </div>

      <div className="mt-5">
        {props.isLoading ? (
          <p className="text-sm text-[var(--text-soft)]">Loading current friends...</p>
        ) : props.handles.length > 0 ? (
          <>
            <p className="text-xs text-[var(--text-soft)]">
              Using {props.handles.length} validated friend
              {props.handles.length === 1 ? "" : "s"} for contest search.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {props.handles.map((handle) => (
                <span key={handle} className="font-mono text-xs text-[var(--text-muted)]">
                  {handle}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs text-[var(--text-soft)]">
            No validated friends yet. Add them from the Friends tab before searching.
          </p>
        )}
      </div>

      <div className="mt-5 flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 text-xs text-[var(--text-soft)]">
          {props.handles.length > 0
            ? `Last updated ${formatTimestamp(props.updatedAt)}.`
            : "No saved handles to sync."}
        </div>
        <Button
          disabled={props.isSearching || props.handles.length === 0}
          onClick={props.onSearch}
          className="w-full md:w-auto"
        >
          {props.isSearching ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Searching...
            </>
          ) : (
            <>
              Find gyms
              <ArrowRight size={14} />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
