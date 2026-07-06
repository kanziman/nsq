/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { TutorChat } from './TutorChat';

afterEach(cleanup);

describe('TutorChat', () => {
  it('should render general tab and chat interface correctly on initial load', () => {
    render(<TutorChat />);
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/메시지를 입력하세요/i)).toBeInTheDocument();
  });

  it('should display user message and stream mock response when form is submitted', async () => {
    // Mock global fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => {
          let readOnce = false;
          return {
            read: async () => {
              if (!readOnce) {
                readOnce = true;
                return { value: new TextEncoder().encode('Mock response'), done: false };
              }
              return { done: true };
            }
          };
        }
      }
    } as any);

    render(<TutorChat />);
    const input = screen.getByPlaceholderText(/메시지를 입력하세요/i);
    fireEvent.change(input, { target: { value: '안녕' } });
    fireEvent.submit(input);
    
    expect(screen.getByText('안녕')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Mock response/i)).toBeInTheDocument();
    });
  });

  it('should handle and display very long messages correctly without breaking UI layout', () => {
    // just dummy fetch for this test
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: { getReader: () => ({ read: async () => ({ done: true }) }) }
    } as any);
    
    render(<TutorChat />);
    const longMsg = 'A'.repeat(1000);
    const input = screen.getByPlaceholderText(/메시지를 입력하세요/i);
    fireEvent.change(input, { target: { value: longMsg } });
    fireEvent.submit(input);
    expect(screen.getByText(longMsg)).toBeInTheDocument();
  });

  it('should display error state or fallback UI when API request fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400 } as any);
    render(<TutorChat />);
    const input = screen.getByPlaceholderText(/메시지를 입력하세요/i);
    fireEvent.change(input, { target: { value: '에러테스트' } });
    fireEvent.submit(input);
    
    await waitFor(() => {
      expect(screen.getByText(/Error occurred/i)).toBeInTheDocument();
    });
  });

  it('should pass context prop to API payload when form is submitted', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: { getReader: () => ({ read: async () => ({ done: true }) }) }
    } as any);
    global.fetch = fetchMock;

    const mockContext = { text: 'Hello world', translation: '안녕 세상' };
    render(<TutorChat context={mockContext} />);
    
    const input = screen.getByPlaceholderText(/메시지를 입력하세요/i);
    fireEvent.change(input, { target: { value: '테스트 메시지' } });
    fireEvent.submit(input);

    expect(fetchMock).toHaveBeenCalledWith('/api/tutor', expect.objectContaining({
      body: JSON.stringify({ speakerId: 'General', message: '테스트 메시지', context: mockContext })
    }));
  });

  it('should render suggested question chips when context is provided', () => {
    const mockContext = { text: 'Hello' };
    render(<TutorChat context={mockContext} />);
    expect(screen.getByText('이 문장의 뜻이 뭐야?')).toBeInTheDocument();
    expect(screen.getByText('주요 단어 설명해줘')).toBeInTheDocument();
  });

  it('should not render suggested chips if context is missing', () => {
    render(<TutorChat />);
    expect(screen.queryByText('이 문장의 뜻이 뭐야?')).not.toBeInTheDocument();
  });

  it('should immediately submit the question and stream response when a suggested chip is clicked', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: { getReader: () => ({ read: async () => ({ done: true }) }) }
    } as any);
    global.fetch = fetchMock;

    const mockContext = { text: 'Hello' };
    render(<TutorChat context={mockContext} />);
    
    const chip = screen.getByText('이 문장의 뜻이 뭐야?');
    fireEvent.click(chip);

    expect(fetchMock).toHaveBeenCalledWith('/api/tutor', expect.objectContaining({
      body: JSON.stringify({ speakerId: 'General', message: '이 문장의 뜻이 뭐야?', context: mockContext })
    }));
    
    // Message should be appended to chat
    expect(screen.getByText('이 문장의 뜻이 뭐야?')).toBeInTheDocument();
  });

  it('should hide suggested chips after the user sends the first message', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: { getReader: () => ({ read: async () => ({ done: true }) }) }
    } as any);
    global.fetch = fetchMock;

    const mockContext = { text: 'Hello' };
    render(<TutorChat context={mockContext} />);
    
    expect(screen.getByText('이 문장의 뜻이 뭐야?')).toBeInTheDocument();
    
    const input = screen.getByPlaceholderText(/메시지를 입력하세요/i);
    fireEvent.change(input, { target: { value: '안녕' } });
    fireEvent.submit(input);
    
    expect(screen.queryByText('이 문장의 뜻이 뭐야?')).not.toBeInTheDocument();
  });
});
