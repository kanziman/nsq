'use client';

import { useRouter } from 'next/navigation';
import { ImportForm } from '@/components/import/ImportForm';

export default function ImportPage() {
  const router = useRouter();

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

      <ImportForm
        onAccepted={(videoId) => router.replace(`/import?videoId=${videoId}`)}
      />
    </main>
  );
}
