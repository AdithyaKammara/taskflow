import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages serves the site from /taskflow/; Vercel (which sets VERCEL=1 when it builds) from /
  base: process.env.VERCEL ? '/' : '/taskflow/',
  plugins: [react(), tailwindcss()],
  test: { include: ['tests/**/*.test.ts'] },
});
