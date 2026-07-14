import type { Metadata } from 'next';
import {
  Cormorant_Garamond,
  JetBrains_Mono,
  Noto_Serif_KR,
  Noto_Serif_JP,
} from 'next/font/google';
import './globals.css';

const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-cormorant',
});

const notoSerifKR = Noto_Serif_KR({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-serif-kr',
});

const notoSerifJP = Noto_Serif_JP({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-serif-jp',
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
        className={`${cormorantGaramond.variable} ${notoSerifKR.variable} ${notoSerifJP.variable} ${jetbrainsMono.variable} font-sans bg-canvas text-ink antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
