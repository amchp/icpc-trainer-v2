import { Link } from "@tanstack/react-router";

const baseClass =
  "whitespace-nowrap px-1 pb-1 text-sm font-medium transition no-underline border-b-2";

export function AppNav() {
  return (
    <nav className="order-3 flex w-full items-center gap-5 overflow-x-auto lg:order-none lg:w-auto lg:overflow-visible">
      <Link
        to="/"
        className={baseClass}
        activeProps={{ className: "border-[var(--accent)] text-[var(--text)] font-semibold" }}
        inactiveProps={{ className: "border-transparent text-[var(--text-soft)] hover:text-[var(--text)]" }}
        data-testid="nav-gym-finder"
      >
        Gym Finder
      </Link>
      <Link
        to="/upsolving"
        className={baseClass}
        activeProps={{ className: "border-[var(--accent)] text-[var(--text)] font-semibold" }}
        inactiveProps={{ className: "border-transparent text-[var(--text-soft)] hover:text-[var(--text)]" }}
        data-testid="nav-upsolving"
      >
        Upsolving
      </Link>
      <Link
        to="/team"
        className={baseClass}
        activeProps={{ className: "border-[var(--accent)] text-[var(--text)] font-semibold" }}
        inactiveProps={{ className: "border-transparent text-[var(--text-soft)] hover:text-[var(--text)]" }}
        data-testid="nav-team"
      >
        Team
      </Link>
    </nav>
  );
}
