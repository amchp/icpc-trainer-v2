import type { UpsolvingTabId } from "../../stores/uiStore";

export function UpsolvingTabs({
  activeTab,
  onChange,
}: {
  activeTab: UpsolvingTabId;
  onChange(tab: UpsolvingTabId): void;
}) {
  return (
    <div className="inline-flex gap-4">
      <button
        className={`border-b-2 px-1 pb-1.5 text-sm font-semibold transition ${
          activeTab === "gyms"
            ? "border-[var(--accent)] text-[var(--text)]"
            : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
        }`}
        data-testid="upsolving-tab-gyms"
        type="button"
        onClick={() => onChange("gyms")}
      >
        Gyms
      </button>
      <button
        className={`border-b-2 px-1 pb-1.5 text-sm font-semibold transition ${
          activeTab === "contests"
            ? "border-[var(--accent)] text-[var(--text)]"
            : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
        }`}
        data-testid="upsolving-tab-contests"
        type="button"
        onClick={() => onChange("contests")}
      >
        Contests
      </button>
    </div>
  );
}
