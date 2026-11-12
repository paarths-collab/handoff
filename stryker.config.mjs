export default {
  mutate: ["packages/core/src/{parse,read-pack,tree,plan,export/**/*}.ts"],
  ignorePatterns: [".pnpm-store", ".pnpm", ".cache", "reports", ".worktrees", "private", "release", "apps/*/src-tauri", "**/.wxt", "**/.output", "**/dist", "playwright-report", "test-results"],
  incremental: true,
  plugins: ["@stryker-mutator/vitest-runner"],
  testRunner: "vitest",
  coverageAnalysis: "perTest",
  reporters: ["clear-text", "html", "json"],
  thresholds: { high: 90, low: 80, break: 80 },
  concurrency: 2
};
