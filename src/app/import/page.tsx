import { ImportClient } from '@/components/import/ImportClient';
import { isProductionDeploy } from '@/lib/utils/env';

export default function ImportPage() {
  // 임포트는 로컬 개발 환경 전용 — 배포(Vercel)에서는 안내 화면만 노출한다(#162).
  const production = isProductionDeploy();

  return (
    <main className="min-h-screen p-8 md:p-24 max-w-2xl mx-auto space-y-8">
      <header className="space-y-2 border-b border-hairline pb-6">
        <div className="text-primary font-semibold tracking-wider text-xs uppercase">
          Import
        </div>
        <h1 className="font-serif text-4xl md:text-5xl text-ink font-normal tracking-tight">
          에피소드 임포트
        </h1>
        <p className="font-sans text-body leading-relaxed">
          YouTube 영상과 Freakonomics 대본 URL을 입력해 쉐도잉 콘텐츠를
          임포트합니다.
        </p>
      </header>

      {production ? (
        <p className="font-sans text-muted-soft text-sm leading-relaxed">
          임포트는 로컬 개발 환경에서만 동작합니다. 배포본에서는 이미 등록된
          에피소드의 학습만 제공됩니다.
        </p>
      ) : (
        <ImportClient />
      )}
    </main>
  );
}
