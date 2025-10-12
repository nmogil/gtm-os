import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './'),
    }
  },
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        lib: ['ES2020'],
        moduleResolution: 'bundler',
        esModuleInterop: true,
        skipLibCheck: true,
        strict: true,
        resolveJsonModule: true,
        isolatedModules: true,
        types: ['vitest/globals', 'node']
      }
    }
  },
  test: {
    globals: true,
    environment: 'node',
    globalSetup: './tests/helpers/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'convex/_generated/',
        'testing/',
        'tests/helpers/'
      ]
    },
    testTimeout: 30000,
    hookTimeout: 30000
  }
});
