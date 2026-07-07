'use client';

import * as React from 'react';
import type { LanguageCode } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isSubmittable } from '@/lib/utils/import-form';

export interface ImportFormProps {
  onAccepted?: (videoId: string) => void;
}

// 언어 세그먼티드 버튼 항목 (#124). ja는 대본 정합 미지원 → 자막 전용 모드.
const LANGUAGES: { code: LanguageCode; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'ja', label: 'JA' },
];

export function ImportForm({ onAccepted }: ImportFormProps): React.JSX.Element {
  const [youtubeUrl, setYoutubeUrl] = React.useState('');
  const [transcriptUrl, setTranscriptUrl] = React.useState('');
  const [language, setLanguage] = React.useState<LanguageCode>('en');
  const [error, setError] = React.useState<string | null>(null);
  const [acceptedId, setAcceptedId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const canSubmit =
    isSubmittable(youtubeUrl, transcriptUrl, language) && !submitting;

  function handleLanguageSelect(code: LanguageCode): void {
    setLanguage(code);
    // ja는 대본 입력을 숨기므로 값도 초기화해 규칙(ja+대본 불허)을 지킨다.
    if (code === 'ja') setTranscriptUrl('');
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setAcceptedId(null);
    setSubmitting(true);
    try {
      // 공백 대본은 부재(자막 전용 모드)로 취급해 바디에서 제외한다.
      const body: Record<string, string> = { youtubeUrl, language };
      if (transcriptUrl.trim() !== '') body.transcriptUrl = transcriptUrl;
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 202) {
        setAcceptedId(data.videoId);
        onAccepted?.(data.videoId);
        return;
      }
      if (res.status === 409) {
        setError(`이미 ${data.status} 상태입니다`);
      } else {
        setError(data.error ?? '임포트 접수에 실패했습니다');
      }
    } catch {
      setError('네트워크 오류로 임포트에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <span className="text-sm font-medium text-ink">언어 (Language)</span>
        <div className="flex gap-2">
          {LANGUAGES.map(({ code, label }) => (
            <Button
              key={code}
              type="button"
              variant={language === code ? 'primary' : 'secondary'}
              aria-pressed={language === code}
              onClick={() => handleLanguageSelect(code)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="youtubeUrl" className="text-sm font-medium text-ink">
          YouTube URL
        </label>
        <Input
          id="youtubeUrl"
          name="youtubeUrl"
          value={youtubeUrl}
          onChange={(e) => setYoutubeUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
        />
      </div>
      {language === 'en' && (
        <div className="space-y-2">
          <label
            htmlFor="transcriptUrl"
            className="text-sm font-medium text-ink"
          >
            대본 URL (Transcript, 선택)
          </label>
          <Input
            id="transcriptUrl"
            name="transcriptUrl"
            value={transcriptUrl}
            onChange={(e) => setTranscriptUrl(e.target.value)}
            placeholder="https://freakonomics.com/..."
          />
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-primary">
          {error}
        </p>
      )}
      {acceptedId && (
        <p role="status" className="text-sm text-ink">
          임포트가 접수되었습니다 ({acceptedId})
        </p>
      )}
      <Button type="submit" variant="primary" disabled={!canSubmit}>
        임포트 시작
      </Button>
    </form>
  );
}
