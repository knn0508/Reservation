import { API_BASE } from "./api"

/**
 * Where the menu photos live.
 *
 * The images are `frontend/public/menu/...` — static files the web app served through Vite.
 * RN has no proxy and no `public/` folder, so they are fetched from whatever server is
 * hosting that folder: in development the Vite dev server on :5173, on the same machine the
 * API is on. Set EXPO_PUBLIC_MEDIA_URL to point somewhere else.
 */
const MEDIA_BASE =
  process.env.EXPO_PUBLIC_MEDIA_URL?.replace(/\/$/, "") ?? API_BASE.replace(/:\d+$/, ":5173")

/** Turns a `public/`-relative path from the web app into a URL this app can load. */
export function mediaUrl(path?: string): string | undefined {
  if (!path) return undefined
  if (/^https?:\/\//.test(path)) return path
  return `${MEDIA_BASE}${path.startsWith("/") ? "" : "/"}${path}`
}
