import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import securityPlugin from 'eslint-plugin-security';
import securityNodePlugin from 'eslint-plugin-security-node';

export default [
  // IGNORE PATTERNS
  {
    ignores: [
      'dist/**',
      'build/**', 
      'node_modules/**',
      '*.log',
      'coverage/**',
      '.firebase/**',
      'functions/lib/**',
      'functions/node_modules/**',
      'security-check.js'
    ]
  },
  
  // TYPESCRIPT & REACT CONFIG
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        React: 'readonly'
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'security': securityPlugin,
      'security-node': securityNodePlugin
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      // React rules
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true, allowExportNames: ['useAuth'] },
      ],
      
      // Security rules - adjusted for React/TypeScript
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-require': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'security-node/detect-crlf': 'off',
      
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
  },

  // NODE SCRIPTS
  {
    files: ['scripts/**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        fetch: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { caughtErrors: 'none' }],
    },
  },

  // CLOUD FUNCTIONS RUN IN NODE
  {
    files: ['functions/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // VITEST CONFIG AND RULES TESTS RUN IN NODE
  {
    files: ['tests/**/*.ts', 'vitest.config.ts', 'vitest.rules.config.ts', 'vite.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
  }
];