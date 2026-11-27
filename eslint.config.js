import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

// Correctness checks only. Formatting and compiler-adoption rules are separate.
// ESLint 10 resolves JSX identifiers without an extra React syntax plugin.
export default [{ ignores: ['src/**/*.test.js'] }, {
  files: ['src/**/*.{js,jsx}'],
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    globals: { ...globals.browser,
      // Injected by productionBuild.js and vite.config.js respectively.
      __DEVELOPMENT_DIAGNOSTICS__: 'readonly',
      __INSCAPE_RELEASE_COMMIT__: 'readonly',
    },
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  linterOptions: { noInlineConfig: true },
  plugins: { 'react-hooks': reactHooks },
  rules: {
    'no-undef': 'error',
    'no-unreachable': 'error',
    'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }],
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'error',
  },
}];
