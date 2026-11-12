import { defineConfig } from 'vitest/config'

// Wall-clock budgets run first against the shipping code in the mutation command.
// Instrumented mutants have different timing and exercise behavioral tests only.
export default defineConfig({
  test: {
    include: ['packages/core/test/**/*.test.ts'],
    testNamePattern: /^(?!.*parses 5,000 tabs and builds their plan within budget)/,
  },
})
