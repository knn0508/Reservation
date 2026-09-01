// Where the app finds the backend and the static media that used to be served by Vite's
// `public/` folder.
//
// On the Android emulator, `localhost` is the emulator itself — the developer machine is
// reachable at 10.0.2.2. On a physical device over Wi-Fi, set your machine's LAN IP with
// EXPO_PUBLIC_API_BASE / EXPO_PUBLIC_MEDIA_BASE in mobile/.env (see .env.example).

const DEV_HOST = "10.0.2.2"

/** FastAPI backend. The web app proxied `/api` here through Vite; RN has no proxy, so paths
 *  are absolute. */
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? `http://${DEV_HOST}:8000`

/** Menu photos and restaurant images. They live in `frontend/public`, so any static server
 *  over that folder works — the running Vite dev server on :5173 is the easiest one. */
export const MEDIA_BASE = process.env.EXPO_PUBLIC_MEDIA_BASE ?? `http://${DEV_HOST}:5173`

export const WS_BASE = API_BASE.replace(/^http/, "ws")

/** Turns a `public/`-relative path from the web app into a URL this app can load. */
export function mediaUrl(path?: string): string | undefined {
  if (!path) return undefined
  if (/^https?:\/\//.test(path)) return path
  return `${MEDIA_BASE}${path.startsWith("/") ? "" : "/"}${path}`
}
