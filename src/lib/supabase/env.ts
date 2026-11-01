/**
 * Which mode the app runs in, decided once from the build's environment (.env).
 * Cloud mode: both values set, so sign-in, workspaces and live sync are on.
 * Local mode: either one empty, so there are no accounts and data stays in this browser.
 * Nothing else reads the environment: ask `cloudEnabled()`.
 */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const cloudEnabled = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
