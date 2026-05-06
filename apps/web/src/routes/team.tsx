import { createFileRoute } from "@tanstack/react-router";
import { TeamPage } from "../components/team/TeamPage";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [{ title: "ICPC Trainer V2 | Team" }],
  }),
  component: TeamPage,
});
