// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

let searchParams = new URLSearchParams('');
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => searchParams,
}));
vi.mock('@/components/import/ImportMonitor', () => ({
  ImportMonitor: ({ videoId }: { videoId: string }) => (
    <div>monitor:{videoId}</div>
  ),
}));

import ImportPage from './page';

const YT = 'https://www.youtube.com/watch?v=abc123';
const TR = 'https://freakonomics.com/podcast/x';

beforeEach(() => {
  searchParams = new URLSearchParams('');
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('ImportPage', () => {
  it('should render the form when no videoId', () => {
    render(<ImportPage />);
    expect(screen.getByLabelText(/youtube/i)).toBeInTheDocument();
  });

  it('should render the monitor when ?videoId present', () => {
    searchParams = new URLSearchParams('videoId=abc123');
    render(<ImportPage />);
    expect(screen.getByText('monitor:abc123')).toBeInTheDocument();
  });

  it("should router.replace('/import?videoId=abc123') on 202", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ videoId: 'abc123', status: 'downloading' }),
            { status: 202, headers: { 'content-type': 'application/json' } },
          ),
      ),
    );
    render(<ImportPage />);
    await userEvent.type(screen.getByLabelText(/youtube/i), YT);
    await userEvent.type(screen.getByLabelText(/대본|transcript/i), TR);
    await userEvent.click(
      screen.getByRole('button', { name: /임포트|제출|시작/ }),
    );
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/import?videoId=abc123'),
    );
  });
});
