import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: HomePage })

function HomePage() {
  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">ICPC Trainer</p>
        <h1>Frontend only.</h1>
        <p className="lede">
          The web app now stays focused on the client surface. Database access,
          Drizzle config, and server-only transport code belong in dedicated
          backend modules instead of `apps/web`.
        </p>
      </section>
    </main>
  )
}
