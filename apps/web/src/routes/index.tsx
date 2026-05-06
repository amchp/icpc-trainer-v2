import { createFileRoute } from "@tanstack/react-router";
import { GymFinderPage } from "../components/gym-finder/GymFinderPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "ICPC Trainer V2 | Gym Finder" }],
  }),
  component: GymFinderPage,
});
