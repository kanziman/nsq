# Dynamic Overlay (Gradient)

## Overview
추천 질문 칩셋이나 하단 고정 액션바 등 플로팅 UI를 배치할 때 겹침 현상을 방지하는 동적 그라데이션 오버레이 패턴입니다.

## Usage

```tsx
<div className="relative">
  {/* Content */}
  
  {/* Floating Overlay */}
  <div className="absolute bottom-full left-0 w-full pb-4 pt-12 bg-gradient-to-t from-surface-card via-surface-card/80 to-transparent pointer-events-none flex flex-col gap-2 items-start justify-end">
    <div className="pointer-events-auto">
      {/* Floating Elements */}
    </div>
  </div>
</div>
```

## Rules
- 플로팅 요소 영역에 고정 높이(`h-32` 등)를 할당하지 않습니다.
- 상단 여백(`pt-12`)과 `bg-gradient-to-t`를 활용하여 안의 내용물이 늘어나도 자연스럽게 그라데이션이 확장되도록 구성합니다.
- 바탕색은 부모 컨테이너 색상(`from-surface-card`)과 일치시켜 이질감이 없도록 합니다.
