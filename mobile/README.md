# ITB Reservation — React Native (Expo)

A full port of `frontend/` (Vite + React + Tailwind) to React Native. Every screen, the booking
wizard, the SVG dining-room plan, the menu and cart, and the admin floor view are here. The web
app in `frontend/` is untouched and still runs.

## Prerequisites

Neither is installed on this machine yet:

1. **Node.js 20+** — <https://nodejs.org> (needed to run Metro, the bundler).
2. **Android Studio** — <https://developer.android.com/studio>. During setup install an SDK
   platform and create a virtual device (Tools → Device Manager → Create Device; any Pixel with
   a recent API level).

## Run it

```bash
cd mobile
npm install
npx expo install --fix    # aligns package versions to the installed Expo SDK
npx expo start
```

Then press **`a`** to launch the Android emulator. The first run installs Expo Go into the
emulator and streams the JS bundle — no native build required.

If you'd rather build a real APK into the emulator instead of using Expo Go:

```bash
npx expo run:android      # needs JDK 17 and ANDROID_HOME set by Android Studio
```

## Point it at your backend

The web app proxied `/api` through Vite. React Native has no proxy, so hosts are absolute and
live in `src/lib/config.ts`. The defaults target the **Android emulator**, where `10.0.2.2` is
the host machine:

| What | Default | Env override |
| --- | --- | --- |
| FastAPI backend | `http://10.0.2.2:8000` | `EXPO_PUBLIC_API_BASE` |
| Menu / restaurant photos | `http://10.0.2.2:5173` | `EXPO_PUBLIC_MEDIA_BASE` |

Copy `.env.example` to `.env` to change them (on a physical device, use your machine's LAN IP).

Two servers need to be up before the app has anything to show:

- `backend/` on `:8000` — the API and the `/ws/availability` socket.
- The **Vite dev server** on `:5173` — it is what serves `frontend/public/menu/...`, so the
  hundreds of dish photos load. Without it the app works fine; menu cards just show the
  placeholder icon.

## Layout

```
mobile/
  app/                          expo-router routes (file = route, same URLs as the web app)
    _layout.tsx                 providers, fonts, the floating pill header
    index.tsx                   restaurant list
    login / signup
    my-reservations.tsx
    admin/index.tsx  admin/login.tsx
    restaurants/[slug]/
      index.tsx                 profile, with the parallax hero
      book.tsx                  booking wizard
      menu.tsx                  menu + cart
  src/
    lib/                        api, config, theme tokens, time, floor-plan + menu data
    hooks/                      auth, availability (WebSocket), reservations, cart, fonts
    components/                 booking/, menu/, restaurant/, layout/, auth/, ui/
```

## What changed in the port, and why

| Web | Native | Reason |
| --- | --- | --- |
| react-router-dom | expo-router | File-based routing with the same paths. |
| Tailwind classes | `src/lib/theme.ts` + `StyleSheet` | Same palette and type scale as the `@theme` block, as plain values. |
| framer-motion | RN `Animated` (`FadeIn`, `PressScale`) | Built in — no extra native module to configure. |
| @phosphor-icons/react | `@expo/vector-icons` (Ionicons) | Phosphor's React package is DOM-only. |
| `localStorage` | `AsyncStorage` | Async, so the token and cart hydrate on mount before first use. |
| `Intl` with `timeZone` | fixed +04:00 offset in `time.ts` | Hermes doesn't always ship ICU time-zone data. Azerbaijan has had no DST since 2016, so this is exact. |
| `crypto.randomUUID()` | `src/lib/uuid.ts` | Not in Hermes. |
| Inline SVG | `react-native-svg` | The floor plan ports nearly 1:1; `feDropShadow` became flat offset shapes, and rotated text uses `rotation`/`originX`. |
| Hover on the floor plan | tap to focus + select | Phones have no hover. |
| Sideways-scrolling plan | fit to width + pinch-to-zoom | The `min-w-[38rem]` scroller doesn't suit a phone. |
| Admin's 7-column table | one card per reservation | Same fields, stacked. |

## Not ported

`frontend/src/components/booking/TableMap.tsx` — it was already dead code on the web
(`FloorPlan` replaced it and nothing imports it).
