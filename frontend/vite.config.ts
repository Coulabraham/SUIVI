import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const proxy = { '/api': { target: process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3000' } };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { strictPort: true, proxy },
  preview: { strictPort: true, proxy },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    clearMocks: true,
  },
});
