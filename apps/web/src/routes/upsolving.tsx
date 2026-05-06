import { createFileRoute } from "@tanstack/react-router";
import { UpsolvingPage } from "../components/upsolving/UpsolvingPage";

export const Route = createFileRoute("/upsolving")({
  head: () => ({
    meta: [{ title: "ICPC Trainer V2 | Upsolving" }],
  }),
  component: UpsolvingPage,
});
