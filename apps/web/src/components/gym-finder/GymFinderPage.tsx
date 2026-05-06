import { useState } from "react";
import { toast } from "../ui/toaster";
import { useFriendsRoster } from "../../hooks/useFriendsRoster";
import { useGymFinder } from "../../hooks/useGymFinder";
import { GymFinderContestTab } from "./GymFinderContestTab";
import { GymFinderFriendsTab } from "./GymFinderFriendsTab";
import { GymFinderResults } from "./GymFinderResults";

type TabId = "contest" | "friends";

export function GymFinderPage() {
  const friends = useFriendsRoster();
  const gymFinder = useGymFinder(friends.handles.length);
  const [activeTab, setActiveTab] = useState<TabId>("contest");

  async function searchGyms() {
    const syncResult = await friends.sync(false);
    if (!syncResult.ok) {
      return;
    }

    const result = await gymFinder.reload();
    if (result.ok && result.data.rankings.length === 0) {
      toast({
        title: "No gyms found",
        description:
          "The request succeeded, but no unsolved gyms matched this friends roster. Try syncing friends or adding handles with gym submissions.",
      });
    }
  }

  return (
    <main data-testid="gym-finder-page">
      <section className="fade-in mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Gym Finder</h1>
      </section>

      <section className="fade-in mb-8">
        <div className="mb-6 flex gap-4">
          <button
            type="button"
            onClick={() => setActiveTab("contest")}
            className={`border-b-2 px-1 pb-1.5 text-sm font-semibold transition ${
              activeTab === "contest"
                ? "border-[var(--accent)] text-[var(--text)]"
                : "border-transparent text-[var(--text-soft)] hover:text-[var(--text)]"
            }`}
          >
            Contest
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("friends")}
            className={`border-b-2 px-1 pb-1.5 text-sm font-semibold transition ${
              activeTab === "friends"
                ? "border-[var(--accent)] text-[var(--text)]"
                : "border-transparent text-[var(--text-soft)] hover:text-[var(--text)]"
            }`}
          >
            Friends
          </button>
        </div>

        {activeTab === "contest" ? (
          <GymFinderContestTab
            handles={friends.handles}
            updatedAt={friends.updatedAt}
            isLoading={friends.isLoading}
            isSyncing={friends.isSyncing}
            gymFinderViewState={gymFinder.viewState}
            isSearching={friends.isSyncing || gymFinder.isRefreshing || gymFinder.isLoading}
            onSearch={() => void searchGyms()}
          />
        ) : (
          <GymFinderFriendsTab
            handles={friends.handles}
            updatedAt={friends.updatedAt}
            isLoading={friends.isLoading}
            isSaving={friends.isSaving}
            isSyncing={friends.isSyncing}
            error={friends.error}
            onReplace={friends.replace}
            onSync={friends.sync}
            onRosterChanged={() => void gymFinder.reload()}
          />
        )}
      </section>

      {gymFinder.error && (gymFinder.viewState === "error" || gymFinder.viewState === "stale") && (
        <section className="fade-in mb-6">
          <p className="text-sm text-red-400">{gymFinder.error}</p>
        </section>
      )}

      <GymFinderResults
        rankings={gymFinder.rankings}
        topRanking={gymFinder.topRanking}
        isRefreshing={gymFinder.isRefreshing}
        viewState={gymFinder.viewState}
      />
    </main>
  );
}
