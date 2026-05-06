import type { ReactNode } from "react";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import { AppShell } from "../components/AppShell";
import { RouteErrorView } from "../components/RouteErrorView";
import { Toaster } from "../components/ui/toaster";
import "../styles.css";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        name: "color-scheme",
        content: "dark",
      },
      {
        title: "ICPC Trainer V2",
      },
    ],
    links: [
      {
        rel: "icon",
        type: "image/png",
        href: "/icpc_trainer.png",
      },
    ],
  }),
  component: RootRouteComponent,
  errorComponent: RouteErrorView,
  shellComponent: RootDocument,
});

function RootRouteComponent() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" data-theme="dark">
      <head>
        <HeadContent />
      </head>
      <body className="font-sans antialiased selection:bg-[rgba(0,170,255,0.2)]">
        {children}
        <Toaster />
        <Scripts />
      </body>
    </html>
  );
}
