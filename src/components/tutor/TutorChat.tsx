import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Sparkles, Bot, User } from 'lucide-react';
import { resolveSpeaker } from '@/lib/constants/speakers';
import type { LanguageCode } from '@/lib/types';
import ReactMarkdown from 'react-markdown';

export interface TutorChatProps {
  className?: string;
  context?: { text: string; translation?: string };
  speakers?: string[];
  /** 에피소드 언어(#129). 튜터 요청 바디에 포함. 기본 'en'. */
  language?: LanguageCode;
}

export function TutorChat({
  className,
  context,
  speakers = [],
  language = 'en',
}: TutorChatProps) {
  const [activeTab, setActiveTab] = useState<string>('General');
  const [messages, setMessages] = useState<
    { role: 'user' | 'tutor'; content: string }[]
  >([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const submitMessage = async (text: string) => {
    if (!text || isLoading) return;

    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setError(false);
    setIsLoading(true);

    try {
      const res = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          speakerId: activeTab,
          message: text,
          context,
          language,
        }),
      });

      if (!res.ok) {
        setError(true);
        setIsLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setIsLoading(false);
        return;
      }

      const decoder = new TextDecoder();
      let done = false;
      let streamedText = '';

      setMessages((prev) => [...prev, { role: 'tutor', content: '' }]);
      setIsLoading(false);

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          streamedText += decoder.decode(value);
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1].content = streamedText;
            return next;
          });
        }
      }
    } catch (e) {
      setError(true);
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    submitMessage(input);
  };

  const showSuggestions = !!context && messages.length === 0;

  const filteredSpeakers = speakers.filter(
    (s) => s !== 'BOTH' && s !== 'NARRATOR',
  );
  const tabs = ['General', ...filteredSpeakers];

  return (
    <div className={`flex flex-col h-full relative ${className || ''}`}>
      {/* Header Tabs */}
      <div className="flex flex-wrap border-b border-hairline pb-4 mb-4 gap-2">
        {tabs.map((tab) => {
          const isGeneral = tab === 'General';
          const name = isGeneral ? 'General' : resolveSpeaker(tab).name;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors flex items-center gap-1.5 ${
                activeTab === tab
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-canvas text-muted-soft hover:text-ink border border-hairline hover:border-primary/30'
              }`}
            >
              {isGeneral ? (
                <Bot className="w-3.5 h-3.5" />
              ) : (
                <User className="w-3.5 h-3.5" />
              )}
              {name}
            </button>
          );
        })}

        <p className="w-full text-xs text-muted-soft mt-1.5 leading-[1.5]">
          {activeTab === 'General'
            ? '문법 구조 분석, 뉘앙스 차이, 유사 표현 등 깊이 있는 영어 학습을 돕습니다.'
            : `${resolveSpeaker(activeTab).name}의 관점에서 문맥과 의도, 배경지식을 설명합니다.`}
        </p>
      </div>

      {/* Chat History */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-6 scroll-smooth pr-2 pb-4"
      >
        {messages.length === 0 && !showSuggestions && (
          <div className="h-full flex flex-col items-center justify-center text-muted-soft space-y-3">
            <Sparkles className="w-8 h-8 opacity-20" />
            <p className="text-sm">궁금한 점을 자유롭게 물어보세요.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'tutor' && (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className="w-4 h-4 text-primary" />
              </div>
            )}

            <div
              className={`max-w-[95%] rounded-2xl px-4 py-3 text-sm leading-[1.6] ${
                msg.role === 'user'
                  ? 'bg-primary text-white rounded-tr-sm'
                  : 'bg-surface-card border border-hairline text-ink rounded-tl-sm'
              }`}
            >
              {msg.role === 'tutor' ? (
                <div className="markdown-body">
                  {msg.content ? (
                    <ReactMarkdown
                      components={{
                        h1: ({ node, ...props }) => (
                          <h1
                            className="text-lg font-bold mt-4 mb-2 first:mt-0"
                            {...props}
                          />
                        ),
                        h2: ({ node, ...props }) => (
                          <h2
                            className="text-base font-bold mt-3 mb-1 first:mt-0"
                            {...props}
                          />
                        ),
                        h3: ({ node, ...props }) => (
                          <h3
                            className="text-sm font-bold mt-2 mb-1 first:mt-0"
                            {...props}
                          />
                        ),
                        p: ({ node, ...props }) => (
                          <p className="mb-2 last:mb-0" {...props} />
                        ),
                        ul: ({ node, ...props }) => (
                          <ul className="list-disc pl-4 mb-2" {...props} />
                        ),
                        ol: ({ node, ...props }) => (
                          <ol className="list-decimal pl-4 mb-2" {...props} />
                        ),
                        li: ({ node, ...props }) => (
                          <li className="mb-0.5" {...props} />
                        ),
                        strong: ({ node, ...props }) => (
                          <strong
                            className="font-semibold text-ink"
                            {...props}
                          />
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    <span className="flex gap-1 items-center h-4">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-soft animate-bounce" />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-soft animate-bounce delay-150" />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-soft animate-bounce delay-300" />
                    </span>
                  )}
                </div>
              ) : (
                msg.content
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-canvas border border-hairline flex items-center justify-center flex-shrink-0 mt-1">
                <User className="w-4 h-4 text-muted" />
              </div>
            )}
          </div>
        ))}
        {error && (
          <div className="text-center text-xs text-red-500 bg-red-500/10 py-2 rounded-lg">
            Error occurred. 다시 시도해주세요.
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="pt-4 mt-auto border-t border-hairline relative">
        {/* Suggested Chips */}
        {showSuggestions && (
          <div className="absolute bottom-full left-0 w-full pb-4 pt-12 bg-gradient-to-t from-surface-card via-surface-card/80 to-transparent pointer-events-none flex flex-col gap-2 items-start justify-end">
            <div className="pointer-events-auto flex flex-wrap gap-2 w-full">
              <span className="w-full text-xs font-medium text-muted-soft mb-1 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                현재 문장에 대해 물어보기
              </span>
              {(activeTab === 'General'
                ? [
                    '이 문장의 뜻이 뭐야?',
                    '주요 단어 설명해줘',
                    '실생활에서 자주 쓰는 비슷한 표현 알려줘',
                  ]
                : [
                    '네 관점에서 이 주제를 더 설명해줘',
                    '이 문맥의 배경지식이나 숨은 의도가 뭐야?',
                    '이 주제로 짤막하게 토론하자',
                  ]
              ).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => submitMessage(q)}
                  disabled={isLoading}
                  className="px-3 py-1.5 text-xs bg-canvas hover:bg-primary/5 text-ink border border-hairline hover:border-primary/30 rounded-full transition-all duration-200 text-left disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 relative z-10"
        >
          <Input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="메시지를 입력하세요..."
            disabled={isLoading}
            className="flex-1 bg-canvas border-hairline focus-visible:ring-primary/20 rounded-full px-4"
          />
          <Button
            type="submit"
            disabled={!input.trim() || isLoading}
            size="icon"
            className="rounded-full w-10 h-10 shrink-0 bg-primary hover:bg-primary/90 transition-transform active:scale-95 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
