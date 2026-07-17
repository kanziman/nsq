import Link from 'next/link';
import EpisodeDashboard from '@/components/episode/EpisodeDashboard';
import { isProductionDeploy } from '@/lib/utils/env';

export default function HomePage() {
  // 배포(조회 전용)에서는 임포트 진입점을 노출하지 않는다(#162).
  const isLocal = !isProductionDeploy();
  return (
    <main className="min-h-screen p-8 md:p-24 max-w-5xl mx-auto space-y-12">
      {/* Header section (Editorial Display style) */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-hairline pb-8">
        <div className="space-y-3">
          <div className="text-primary font-medium tracking-[1.5px] text-xs uppercase">
            Shadowing Playlist
          </div>
          <h1 className="font-serif text-4xl md:text-5xl text-ink font-normal tracking-[-0.5px] md:tracking-[-1px]">
            내 에피소드 보드
          </h1>
          <p className="font-sans text-muted-soft text-sm leading-[1.55] max-w-md">
            임포트된 유튜브 에피소드를 선택해 쉐도잉 훈련을 진행하거나 새로운
            학습 콘텐츠를 등록하세요.
          </p>
        </div>
        {isLocal && (
          <Link
            href="/import"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-active"
          >
            임포트하기
          </Link>
        )}
      </header>

      {/* Dashboard list Section */}
      <section className="space-y-6">
        <EpisodeDashboard isLocal={isLocal} />
      </section>

      {/* Bottom Footer block */}
      <footer className="pt-8 border-t border-hairline text-xs text-muted-soft">
        &copy; {new Date().getFullYear()} Antigravity. Warm-canvas Design System
        enabled.
      </footer>
    </main>
  );
}
