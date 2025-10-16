module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.js'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh', '@typescript-eslint', 'import'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    'import/no-cycle': 'error',
    'import/no-internal-modules': [
      'error',
      {
        allow: [
          // Allow imports from shared modules
          'shared/**',
          // Allow imports from feature modules within the same feature
          'features/*/components/**',
          'features/*/hooks/**',
          'features/*/api/**',
          'features/*/schemas/**',
          'features/*/state/**',
          'features/*/routes/**',
          // Allow imports from app modules
          'app/**',
          // Allow imports from pages and widgets
          'pages/**',
          'widgets/**',
        ],
      },
    ],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
  },
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json',
      },
    },
  },
};
