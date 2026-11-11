import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Migrations, bcrypt hashing, and multi-workspace parallel runs can exceed
    // Vitest's 10s defaults on slower machines/CI.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
