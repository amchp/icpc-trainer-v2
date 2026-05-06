import { useTeamRoster } from "../../hooks/useTeamRoster";
import { TeammatesPanel } from "./TeammatesPanel";

export function TeamPage() {
  const team = useTeamRoster();

  return (
    <main data-testid="team-page">
      <section className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Team</h1>
      </section>

      <TeammatesPanel
        handles={team.handles}
        updatedAt={team.updatedAt}
        isLoading={team.isLoading}
        isSaving={team.isSaving}
        error={team.error}
        onReplace={team.replace}
      />
    </main>
  );
}
