import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import securityPlugin from 'eslint-plugin-security';
import securityNodePlugin from 'eslint-plugin-security-node';

export default tseslint.config(
  // IGNORE PATTERNS
  {
    ignores: [
      'dist/**',
      'build/**', 
      'node_modules/**',
      '*.log',
      'coverage/**',
      '.firebase/**',
      'security-check.js'
    ]
  },
  
  // TYPESCRIPT & REACT CONFIG
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        React: 'readonly'
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'security': securityPlugin,
      'security-node': securityNodePlugin
    },
    rules: {
      // React rules
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      
      // Security rules - adjusted for React/TypeScript
      'security/detect-object-injection': 'off', // Too many false positives in React
      'security/detect-non-literal-require': 'off', // TypeScript uses import
      'security/detect-non-literal-fs-filename': 'off', // Frontend doesn't use fs
      'security-node/detect-crlf': 'off', // Console.log warnings - usually false positives
      
      // Keep important security rules
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'error',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-non-literal-regexp': 'error',
      'security/detect-possible-timing-attacks': 'error',
      'security/detect-pseudoRandomBytes': 'error',
      'security/detect-unsafe-regex': 'error',
      'security-node/detect-dangerous-redirects': 'error',
      'security-node/detect-insecure-randomness': 'error',
      'security-node/detect-buffer-unsafe-allocation': 'error',
      
      // TypeScript rules
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', {
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_'
      }]
    }
  }
);
