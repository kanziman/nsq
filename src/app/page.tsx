export default function HomePage() {
  return (
    <main className="min-h-screen p-8 md:p-24 max-w-4xl mx-auto space-y-12">
      {/* Header section (Editorial Display style) */}
      <header className="space-y-4 border-b border-hairline pb-8">
        <div className="text-primary font-semibold tracking-wider text-xs uppercase">
          Project Setup Success
        </div>
        <h1 className="font-serif text-5xl md:text-6xl text-ink font-normal tracking-tight">
          NSQ Shadowing Web App
        </h1>
        <p className="font-sans text-body text-lg leading-relaxed max-w-2xl">
          Next.js App Router, Tailwind CSS, and shadcn/ui development
          environment has been initialized based on the warm-canvas editorial
          design system.
        </p>
      </header>

      {/* Interactive elements test (Buttons and Spacings) */}
      <section className="space-y-6">
        <h2 className="font-serif text-3xl text-ink">
          Design Tokens Verification
        </h2>
        <div className="flex flex-wrap gap-4">
          {/* Primary Coral Button */}
          <button className="h-10 px-5 rounded-md bg-primary text-primary-foreground font-medium text-sm transition-colors hover:bg-primary-active active:bg-primary-active disabled:opacity-50">
            Primary Coral CTA
          </button>

          {/* Secondary Outline Button */}
          <button className="h-10 px-5 rounded-md bg-canvas text-ink border border-hairline font-medium text-sm transition-colors hover:bg-secondary active:bg-secondary">
            Secondary Outline
          </button>

          {/* Badge Pills */}
          <span className="inline-flex items-center rounded-full bg-surface-card px-3 py-1 text-xs font-medium text-ink">
            Badge Pill
          </span>
          <span className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-foreground">
            NEW
          </span>
        </div>
      </section>

      {/* Dark Navy Card (Product Mockup) and Code Block */}
      <section className="space-y-4">
        <h3 className="font-serif text-2xl text-ink">Dark Navy Surface</h3>
        <div className="bg-surface-dark text-on-dark rounded-lg p-6 space-y-4">
          <p className="font-sans text-sm text-on-dark-soft">
            This card represents a dark navy product surface like code windows
            and audio players.
          </p>
          <div className="bg-surface-dark-soft text-on-dark font-mono text-xs p-4 rounded-md overflow-x-auto border border-surface-dark-elevated">
            <code>
              {`// Environment standards check
const BOUNDARY_PARK_BACKOFF_SEC = 0.05;
const verifyMatchRate = (rate: number): boolean => {
  if (rate < 0.85) throw new Error("Sync quality below threshold.");
  return true;
};`}
            </code>
          </div>
        </div>
      </section>

      {/* Bottom Footer block */}
      <footer className="pt-8 border-t border-hairline text-xs text-muted-soft">
        &copy; {new Date().getFullYear()} Antigravity. Built with Google
        DeepMind.
      </footer>
    </main>
  );
}
