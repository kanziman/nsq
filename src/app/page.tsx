import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ShadowingPlayer } from '@/components/player/shadowing-player';

export default function HomePage() {
  return (
    <main className="min-h-screen p-8 md:p-24 max-w-5xl mx-auto space-y-16">
      {/* Header section (Editorial Display style) */}
      <header className="space-y-4 border-b border-hairline pb-8">
        <div className="text-primary font-semibold tracking-wider text-xs uppercase">
          Design System Integration
        </div>
        <h1 className="font-serif text-5xl md:text-6xl text-ink font-normal tracking-tight">
          NSQ Shadowing Web App
        </h1>
        <p className="font-sans text-body text-lg leading-relaxed max-w-2xl">
          Core components and speaker styles have been integrated conforming to
          the warm-canvas editorial design system parameters.
        </p>
      </header>

      {/* Main 2-column showcase: Left components, Right Shadowing player preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Components Showcase (5 columns) */}
        <div className="lg:col-span-5 space-y-8">
          <section className="space-y-4">
            <h2 className="font-serif text-2xl text-ink font-normal">
              UI Components
            </h2>

            {/* Buttons card showcase */}
            <Card className="p-6 space-y-4">
              <h3 className="text-sm font-semibold text-muted">
                Button Variants
              </h3>
              <div className="flex flex-col gap-2">
                <Button variant="primary">Primary Coral Button</Button>
                <Button variant="secondary">Secondary Outline</Button>
                <Button variant="textLink" className="justify-start">
                  Text Link variant
                </Button>

                <div className="bg-surface-dark p-4 rounded-md flex gap-2 justify-center items-center">
                  <Button variant="secondaryOnDark" size="sm">
                    On-Dark Small
                  </Button>
                  <Button variant="iconCircular" size="icon">
                    ▶
                  </Button>
                </div>
              </div>
            </Card>

            {/* Inputs card showcase */}
            <Card className="p-6 space-y-4">
              <h3 className="text-sm font-semibold text-muted">Form Input</h3>
              <div className="space-y-2">
                <label className="text-xs text-muted-soft block">
                  Podcast Episode URL
                </label>
                <Input
                  type="text"
                  placeholder="https://youtube.com/watch?v=..."
                />
              </div>
            </Card>

            {/* Badges card showcase */}
            <Card className="p-6 space-y-4">
              <h3 className="text-sm font-semibold text-muted">Badges</h3>
              <div className="flex flex-wrap gap-2">
                <Badge variant="pill">Badge Pill</Badge>
                <Badge variant="coral">NEW</Badge>
              </div>
            </Card>
          </section>
        </div>

        {/* Right Side: Player Preview (7 columns) */}
        <div className="lg:col-span-7 space-y-4">
          <h2 className="font-serif text-2xl text-ink font-normal">
            Shadowing Player Layout
          </h2>
          <ShadowingPlayer />
        </div>
      </div>

      {/* Bottom Footer block */}
      <footer className="pt-8 border-t border-hairline text-xs text-muted-soft">
        &copy; {new Date().getFullYear()} Antigravity. Built with Google
        DeepMind.
      </footer>
    </main>
  );
}
