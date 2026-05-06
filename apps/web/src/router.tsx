import {
  createMemoryHistory,
  createRouter as createTanStackRouter,
  type RouterHistory,
} from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter(options?: { history?: RouterHistory }) {
  return createTanStackRouter({
    routeTree,
    history: options?.history,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });
}

export function getTestRouter(initialPath = "/") {
  return getRouter({
    history: createMemoryHistory({
      initialEntries: [initialPath],
    }),
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
