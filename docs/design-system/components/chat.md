# Chat Bubble

## Overview
학습용 단어장 봇, Q&A 게시판 등 대화형 인터페이스를 위한 채팅 말풍선 UI 패턴입니다.

## Usage

```tsx
<div className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
  {msg.role === 'tutor' && (
    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
      <Bot className="w-4 h-4 text-primary" />
    </div>
  )}
  
  <div className={`max-w-[95%] rounded-2xl px-4 py-3 text-sm leading-[1.6] ${
    msg.role === 'user' 
      ? 'bg-primary text-white rounded-tr-sm' 
      : 'bg-surface-card border border-hairline text-ink rounded-tl-sm'
  }`}>
    {msg.content}
  </div>
</div>
```

## Rules
- 말풍선 너비는 여유 있게 `max-w-[95%]` 정도로 주어 모바일 환경에서도 공간을 충분히 활용합니다.
- 사용자(User)는 `bg-primary text-white`와 오른쪽 정렬(`justify-end`), 시스템(Tutor)은 `bg-surface-card border-hairline text-ink`와 왼쪽 정렬(`justify-start`)을 사용합니다.
- 대화 꼬리표 곡률은 `rounded-tr-sm`(User), `rounded-tl-sm`(Tutor) 처럼 비대칭 라운딩을 주어 말풍선 방향성을 부여합니다.
