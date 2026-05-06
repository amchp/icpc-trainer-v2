import type { ReactNode } from "react";
import { useSessionBootstrap } from "../hooks/useSessionBootstrap";
import { AppHeader } from "./AppHeader";
import { BlockingLoginScreen } from "./BlockingLoginScreen";
import { Footer } from "./Footer";

export function AppShell({ children }: { children: ReactNode }) {
  const session = useSessionBootstrap();

  if (session.status === "booting") {
    return null;
  }

  if (session.status === "anonymous") {
    return <BlockingLoginScreen />;
  }

  return (
    <div className="flex h-screen max-w-full flex-col overflow-hidden" data-testid="app-shell">
      <AppHeader />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1180px] px-3 py-4 sm:px-4 sm:py-6">{children}</div>
      </main>
      <Footer />
    </div>
  );
}
