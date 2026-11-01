import { defineConfig, devices } from '@playwright/test';

/*
 * End-to-end tests against two production builds served by `vite preview`: one in local mode
 * (Supabase values blanked out) for the task flows, and one in cloud mode for the sign-in screen.
 * Nothing signs in to the real Supabase project. Locally the installed Chrome is used; CI installs
 * Playwright's Chromium.
 */
const LOCAL = 5180;
const CLOUD = 5181;
const serve = (dir: string, port: number) =>
  `npx vite build --outDir .e2e/${dir} --emptyOutDir && npx vite preview --outDir .e2e/${dir} --port ${port} --strictPort`;
const chrome = { ...devices['Desktop Chrome'], channel: process.env.CI ? undefined : 'chrome' };

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // each worker is a whole Chrome; more than a few at once starves the preview servers
  workers: 3,
  reporter: process.env.CI ? 'github' : 'list',
  use: { trace: 'retain-on-failure' },
  projects: [
    {
      name: 'local mode',
      testIgnore: /cloud\.spec/,
      use: { ...chrome, baseURL: `http://localhost:${LOCAL}/taskflow/` },
    },
    {
      name: 'cloud mode',
      testMatch: /cloud\.spec/,
      use: { ...chrome, baseURL: `http://localhost:${CLOUD}/taskflow/` },
    },
  ],
  webServer: [
    {
      command: serve('local', LOCAL),
      port: LOCAL,
      env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: serve('cloud', CLOUD),
      port: CLOUD,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
