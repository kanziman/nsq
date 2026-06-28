'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ImportForm } from '@/components/import/ImportForm';
import { ImportMonitor } from '@/components/import/ImportMonitor';

function ImportContent() {
  const router = useRouter();
  const videoId = useSearchParams().get('videoId');

  if (videoId) {
    return (
      <ImportMonitor
        videoId={videoId}
        onNewImport={() => router.replace('/import')}
      />
    );
  }

  return (
    <ImportForm onAccepted={(id) => router.replace(`/import?videoId=${id}`)} />
  );
}

export default function ImportPage() {
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

      <Suspense fallback={<p className="text-sm text-muted">불러오는 중…</p>}>
        <ImportContent />
      </Suspense>
    </main>
  );
}
