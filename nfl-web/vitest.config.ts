import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Several suites are Monte Carlo property tests — the season simulation
    // alone runs 2,000 seasons — and they legitimately take seconds. Under the
    // default five, they failed on load rather than on an assertion, which
    // makes the whole suite untrustworthy as a gate before a release.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
