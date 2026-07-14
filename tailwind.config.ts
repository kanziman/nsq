import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--canvas)',
        primary: {
          DEFAULT: 'var(--primary)',
          active: 'var(--primary-active)',
          disabled: 'var(--primary-disabled)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        ink: 'var(--ink)',
        neutral: 'var(--neutral)',
        body: {
          DEFAULT: 'var(--body)',
          strong: 'var(--body-strong)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          soft: 'var(--muted-soft)',
          foreground: 'var(--muted-foreground)',
        },
        hairline: {
          DEFAULT: 'var(--hairline)',
          soft: 'var(--hairline-soft)',
        },
        surface: {
          DEFAULT: 'var(--surface)',
          soft: 'var(--surface-soft)',
          card: 'var(--surface-card)',
          creamStrong: 'var(--surface-cream-strong)',
          dark: 'var(--surface-dark)',
          darkElevated: 'var(--surface-dark-elevated)',
          darkSoft: 'var(--surface-dark-soft)',
        },
        on: {
          primary: 'var(--on-primary)',
          dark: {
            DEFAULT: 'var(--on-dark)',
            soft: 'var(--on-dark-soft)',
          },
        },
        accent: {
          teal: 'var(--accent-teal)',
          amber: 'var(--accent-amber)',
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },

        // shadcn/ui 테마 변수 매핑
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
      },
      // 폴백 스택은 globals.css의 @theme이 단일 진실 공급원이다(#148).
      // 여기서 폴백을 중복 정의하면 드리프트가 생기므로 변수만 참조한다.
      fontFamily: {
        serif: ['var(--font-serif)'],
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        pill: 'var(--radius-pill)',
      },
      spacing: {
        xxs: 'var(--spacing-xxs)',
        xs: 'var(--spacing-xs)',
        sm: 'var(--spacing-sm)',
        md: 'var(--spacing-md)',
        lg: 'var(--spacing-lg)',
        xl: 'var(--spacing-xl)',
        xxl: 'var(--spacing-xxl)',
        section: 'var(--spacing-section)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
