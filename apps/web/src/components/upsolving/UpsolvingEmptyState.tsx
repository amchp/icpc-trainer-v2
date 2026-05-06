export function UpsolvingEmptyState({ tab }: { tab: "gyms" | "contests" }) {
  return (
    <div className="py-16 text-center">
      <p className="font-semibold">
        {tab === "contests" ? "Contest" : "Gym"} snapshots are still syncing.
      </p>
    </div>
  );
}
