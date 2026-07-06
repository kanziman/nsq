# Tabs (Wrapping Pill)

## Overview
모바일 환경이나 좁은 컨테이너(사이드바)에서 가로 스크롤(`overflow-x-auto`)을 강제하는 고정 탭 대신, 줄바꿈이 자연스러운 알약(Pill) 형태의 탭 디자인을 표준으로 사용합니다.

## Usage

```tsx
<div className="flex flex-wrap gap-2">
  {tabs.map(tab => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors flex items-center gap-1.5 ${
        activeTab === tab 
          ? 'bg-primary text-white shadow-sm' 
          : 'bg-canvas text-muted-soft hover:text-ink border border-hairline hover:border-primary/30'
      }`}
    >
      {tab}
    </button>
  ))}
</div>
```

## Rules
- 탭 아이템이 많아질 경우 `flex-wrap`으로 자연스럽게 떨어지도록 구성합니다.
- Active 상태는 `bg-primary text-white`를 사용하여 시각적 우선순위를 높입니다.
- Inactive 상태는 `bg-canvas` 배경에 옅은 테두리(`border-hairline`)를 사용하여 바탕(주로 `bg-surface-card`)과 대비를 줍니다.
