import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**', '**/.expo/**', '**/coverage/**', '**/metro.config.js', '**/*.config.js'],
  },
  {
    files: ['**/*.cjs', '**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        Buffer: 'readonly',
        URL: 'readonly',
        __dirname: 'readonly',
        console: 'readonly',
        module: 'readonly',
        process: 'readonly',
        require: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
