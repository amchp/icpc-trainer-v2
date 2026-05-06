export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="shrink-0 border-t border-[var(--border)] px-3 py-3 sm:px-4">
      <div className="mx-auto w-full max-w-[1180px] text-center">
        <p className="m-0 text-xs text-[var(--text-soft)]">&copy; {year} ICPC Trainer</p>
      </div>
    </footer>
  );
}
