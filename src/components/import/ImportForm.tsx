'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isSubmittable } from '@/lib/utils/import-form';

export interface ImportFormProps {
  onAccepted?: (videoId: string) => void;
}

export function ImportForm({ onAccepted }: ImportFormProps): React.JSX.Element {
  const [youtubeUrl, setYoutubeUrl] = React.useState('');
  const [transcriptUrl, setTranscriptUrl] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [acceptedId, setAcceptedId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const canSubmit = isSubmittable(youtubeUrl, transcriptUrl) && !submitting;

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setAcceptedId(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ youtubeUrl, transcriptUrl }),
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
      <div className="space-y-2">
        <label htmlFor="transcriptUrl" className="text-sm font-medium text-ink">
          대본 URL (Transcript)
        </label>
        <Input
          id="transcriptUrl"
          name="transcriptUrl"
          value={transcriptUrl}
          onChange={(e) => setTranscriptUrl(e.target.value)}
          placeholder="https://freakonomics.com/..."
        />
      </div>
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
