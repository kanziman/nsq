import type { Metadata } from 'next';
import {
  Cormorant_Garamond,
  JetBrains_Mono,
  Noto_Serif_KR,
} from 'next/font/google';
import './globals.css';

const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-cormorant',
});

// 세리프 자리(헤드라인)는 전부 한글이고 Cormorant엔 한글이 없다 — 실제로 그 글자들을
// 그리는 건 Noto Serif KR이다. 이 폰트는 한글·가나·한자를 모두 덮으므로 별도의 JP
// 세리프는 스택에서 도달조차 못 한다. Noto Serif JP를 두면 아무것도 렌더하지 않으면서
// preload만 잡아먹으므로 싣지 않는다(#148).
const notoSerifKR = Noto_Serif_KR({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-serif-kr',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
});

export const metadata: Metadata = {
  title: 'NSQ Shadowing Web App',
  description:
    'A warm-canvas editorial interface for English shadowing practice based on No Stupid Questions podcast.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="scroll-smooth">
      <body
        className={`${cormorantGaramond.variable} ${notoSerifKR.variable} ${jetbrainsMono.variable} font-sans bg-canvas text-ink antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
