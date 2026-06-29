import Link from 'next/link';
import EpisodeDashboard from '@/components/episode/EpisodeDashboard';

export default function HomePage() {
  return (
    <main className="min-h-screen p-8 md:p-24 max-w-5xl mx-auto space-y-12">
      {/* Header section (Editorial Display style) */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-hairline pb-8">
        <div className="space-y-3">
          <div className="text-primary font-semibold tracking-wider text-xs uppercase">
            Shadowing Playlist
          </div>
          <h1 className="font-serif text-4xl md:text-5xl text-ink font-normal tracking-tight">
            내 에피소드 보드
          </h1>
          <p className="font-sans text-muted-soft text-sm max-w-md">
            임포트된 유튜브 에피소드를 선택해 쉐도잉 훈련을 진행하거나 새로운
            학습 콘텐츠를 등록하세요.
          </p>
        </div>
        <Link
          href="/import"
          className="inline-flex h-10 items-center justify-center rounded bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-active"
        >
          에피소드 임포트
        </Link>
      </header>

      {/* Dashboard list Section */}
      <section className="space-y-6">
        <EpisodeDashboard />
      </section>

      {/* Bottom Footer block */}
      <footer className="pt-8 border-t border-hairline text-xs text-muted-soft">
        &copy; {new Date().getFullYear()} Antigravity. Warm-canvas Design System
        enabled.
      </footer>
    </main>
  );
}
