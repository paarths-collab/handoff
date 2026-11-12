export default {
  mutate: ["packages/core/src/{parse*,plan,export/**/*}.ts"],
  testRunner: "vitest",
  coverageAnalysis: "perTest",
  reporters: ["clear-text", "html"],
  thresholds: { high: 90, low: 80, break: 80 },
  concurrency: 2
};
