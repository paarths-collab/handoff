import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { include: ['packages/**/*.{test,spec}.ts', 'apps/**/*.{test,spec}.ts'], exclude: ['**/e2e/**', '**/node_modules/**', '**/dist/**'] } })
