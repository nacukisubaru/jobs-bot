module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.eslint.json',
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  extends: [
    'airbnb-base',
    'airbnb-typescript/base',
  ],
  env: {
    node: true,
    es2022: true,
  },
  ignorePatterns: ['dist', 'node_modules', '*.js'],
  rules: {
    'import/extensions': 'off',
    'import/prefer-default-export': 'off',
    'import/no-extraneous-dependencies': ['error', { devDependencies: ['**/scripts/**', '**/*.spec.ts'] }],
    'max-classes-per-file': ['error', { max: 4 }],
    '@typescript-eslint/indent': ['error', 2],
    'max-len': ['error', { code: 120, ignoreUrls: true, ignoreStrings: true }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'new-cap': 'off',
    'no-plusplus': 'off',
    'no-restricted-syntax': 'off',
    'no-await-in-loop': 'off',
    'no-continue': 'off',
  },
  overrides: [
    {
      files: ['scripts/**/*.ts'],
      rules: {
        'no-console': 'off',
        'import/no-extraneous-dependencies': 'off',
      },
    },
  ],
};
