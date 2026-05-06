import { X } from "lucide-react";

export function TeammateChipList({
  handles,
  disabled,
  onRemove,
}: {
  handles: readonly string[];
  disabled: boolean;
  onRemove(handle: string): void;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {handles.map((handle) => (
        <button
          key={handle}
          className="group inline-flex items-center gap-1.5 text-sm text-[var(--text)] transition hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
          data-testid={`team-handle-chip-${handle.toLowerCase()}`}
          type="button"
          onClick={() => onRemove(handle)}
          disabled={disabled}
        >
          <span className="font-mono text-xs">{handle}</span>
          <X className="h-3 w-3 text-[var(--text-soft)] transition group-hover:text-red-400" />
        </button>
      ))}
    </div>
  );
}
