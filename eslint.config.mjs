import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const eslintConfig = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'out/**',
      '.shadowing/**',
      'scripts/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // base 규칙은 타입을 이해 못 해 중복·오탐이 나므로 TS 파일에선 끄고
      // 타입 인식되는 @typescript-eslint 버전만 사용한다.
      'no-unused-vars': 'off',
      'no-console': 'off',
      // '_' 프리픽스는 "의도적으로 안 쓰는 인자/변수"라는 표시로 무시한다
      // (예: 타입 시그니처의 문서용 파라미터명 (_id: string) => ...).
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];

export default eslintConfig;
