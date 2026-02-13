import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    server: {
      deps: {
        inline: [/@hono\/zod-openapi/, /@asteasolutions\/zod-to-openapi/],
      },
    },
  },
  resolve: {
    alias: {
      // Ensure all modules use the same Zod instance (prevents .openapi() registry mismatch)
      zod: path.resolve(__dirname, 'node_modules/zod'),
    },
  },
});
