import { Fragment } from 'react';
import type { RubyPiece } from '@/lib/utils/tokenize';

/**
 * 검증·병합이 끝난 루비 조각 시퀀스를 <ruby><rt>로 렌더한다(#128).
 * rt 없는 조각은 평문 그대로 — base 텍스트 합은 항상 원문과 일치한다.
 */
export function RubyText({
  pieces,
}: {
  pieces: RubyPiece[];
}): React.ReactElement {
  return (
    <>
      {pieces.map((piece, i) =>
        piece.rt ? (
          <ruby key={i}>
            {piece.text}
            <rt className="text-[0.6em] text-muted-soft select-none">
              {piece.rt}
            </rt>
          </ruby>
        ) : (
          <Fragment key={i}>{piece.text}</Fragment>
        ),
      )}
    </>
  );
}
