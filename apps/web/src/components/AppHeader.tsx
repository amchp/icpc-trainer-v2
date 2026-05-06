import { RefreshCw, LogOut, User } from "lucide-react";
import { useState } from "react";
import { getErrorDetails, getErrorMessage } from "../lib/api/errors";
import { syncTeam } from "../lib/api/team";
import { reloadPage } from "../lib/browser";
import { sessionStore } from "../stores/sessionStore";
import { AppNav } from "./AppNav";
import { Button } from "./ui/button";
import { toast } from "./ui/toaster";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export function AppHeader() {
  const currentHandle = sessionStore.useStore((state) => state.currentHandle);
  const [isSyncingTeam, setIsSyncingTeam] = useState(false);

  function handleSyncTeamSubmissions() {
    if (isSyncingTeam) {
      return;
    }

    setIsSyncingTeam(true);
    void syncTeam({ force: true })
      .then(() => {
        reloadPage();
      })
      .catch((error: unknown) => {
        setIsSyncingTeam(false);
        const message = getErrorMessage(error, "Unable to sync team submissions.");
        const details = getErrorDetails(error);
        toast({
          title: "Team sync failed",
          description: details ? `${message} ${details}` : message,
          variant: "destructive",
        });
      });
  }

  return (
    <header className="shrink-0 border-b border-[var(--border)] bg-[var(--bg)]/80 px-3 backdrop-blur-lg sm:px-4">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-3 gap-y-3 py-3 sm:gap-x-4">
        <div className="mr-auto flex min-w-0 items-center gap-2.5">
          <img src="/icpc_trainer.png" alt="ICPC Trainer" className="h-7 w-7 object-contain" />
          <span className="truncate font-mono text-sm font-bold text-[var(--text)]">ICPC Trainer</span>
        </div>

        <AppNav />

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleSyncTeamSubmissions}
          disabled={isSyncingTeam}
          className="rounded-full px-3 sm:px-3.5"
          data-testid="sync-team-submissions"
        >
          <RefreshCw size={14} className={isSyncingTeam ? "animate-spin" : undefined} />
          <span>Sync</span>
          <span className="hidden min-[420px]:inline">submissions</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" className="max-w-[34vw] rounded-full gap-2 px-3 sm:max-w-40 sm:px-3.5 xl:max-w-56">
              <User size={14} className="text-[var(--text-muted)]" />
              <span className="truncate">{currentHandle}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Account</DropdownMenuLabel>
            <div className="px-3 pb-2">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg)]">
                  <User size={14} className="text-[var(--text-muted)]" />
                </div>
                <div>
                  <p className="text-[11px] text-[var(--text-soft)]">Logged in as</p>
                  <p className="font-mono text-sm font-semibold">{currentHandle}</p>
                </div>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => void sessionStore.logout()}
              className="text-[var(--text-muted)]"
            >
              <LogOut size={14} />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
