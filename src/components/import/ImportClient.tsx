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

// 임포트 폼/모니터의 클라이언트 UI. 서버 컴포넌트 import/page.tsx가
// 로컬 환경에서만 이 컴포넌트를 렌더한다(#162).
export function ImportClient(): React.ReactElement {
  return (
    <Suspense fallback={<p className="text-sm text-muted">불러오는 중…</p>}>
      <ImportContent />
    </Suspense>
  );
}
