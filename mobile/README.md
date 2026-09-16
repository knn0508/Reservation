# ITB Restaurant System — mobile

The phone half of the platform: **customers** ordering delivery, and **couriers** carrying it.
Restaurant owners stay on the web app (`../frontend`) — floor plan, reservations, menu and
sales dashboard are all web surfaces.

Expo SDK 54 · expo-router · React Native 0.81 · TanStack Query.

## Running it

```bash
npm install
npm start          # then press a (Android) / i (iOS), or scan the QR in Expo Go
```

The backend must be up (`docker compose up` from the repo root).

### Pointing the app at the API

A phone can't resolve `localhost` — that would be the phone itself. `src/lib/api.ts` derives
the API host from the machine running the Expo dev server and uses port 8000, which works out
of the box on a normal LAN. Override it when that guess is wrong:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.50:8000 npm start
```

The Account tab shows the resolved URL — check there first when nothing loads.

## Test accounts

Seeded by `backend/scripts/seed.py`:

| Role | Email | Password |
|---|---|---|
| Courier (Mamajan) | `courier@mamajan-georgian-cuisine-demo.com` | `courier12345` |
| Courier (Nar Bağı) | `courier@narbagi-demo.com` | `courier12345` |

Customers register in the app. Owner accounts land on a notice screen telling them to use
the web dashboard.

## Two order paths, one menu and one basket

The same Mamajan menu and the same basket feed **two destinations that never mix**:

| | Delivery order | Reservation pre-order |
|---|---|---|
| Started from | Menu → "Order delivery" | A booking → "Pre-order for this booking" |
| Goes to | **The courier app** | **The restaurant's floor view** (web) |
| Backend | `POST /api/delivery/orders` → `delivery_order` | `POST /api/reservations/{id}/preorder` → `reservation.preorder_items` |
| Asks for | GPS pin, address, courier note, delivery fee | Which booking. No address, no fee |
| Customer follows it in | Delivery tab | Bookings tab |

`useCart` carries a `fulfilment` field (`"delivery" | "reservation"`) plus the booking id, so
a basket always knows where it is headed. Entering the menu from a booking
(`/menu/[slug]?reservationId=…`) pins it to the reservation path and shows a banner saying so
— that customer is never asked for a delivery address. The basket screen is where the fork is
made explicit, because the two paths ask for completely different things.

Switching restaurants mid-basket starts a fresh basket and drops the booking link, since that
booking is at the other restaurant.

## Screens

```
app/
  index.tsx              routes each account to its own app by role
  login.tsx  signup.tsx  one login for both phone roles; signup creates customers only
  admin-notice.tsx       owners are sent to the web dashboard
  (customer)/
    restaurants.tsx      two doors per venue: order delivery, or book a table
    reservations.tsx     bookings + their pre-orders; entry to the reservation path
    orders.tsx           delivery tracking + cancel
    account.tsx          profile, basket, logout, resolved API URL
  book/[slug].tsx        party size → day → slot: the reservation process
  menu/[slug].tsx        Mamajan menu; ?reservationId pins the basket to a booking
  basket.tsx             lines, quantities, and the delivery/reservation fork
  checkout.tsx           delivery path: recipient, GPS pin, address, courier note, payment
  preorder.tsx           reservation path: pick the booking, send it to the kitchen
  courier.tsx            claim → picked up → delivered, with Google Maps navigation
```

## Google Maps

No map SDK and no API key. The app hands off to the installed Google Maps app through
documented URL schemes (`src/lib/maps.ts`): the courier gets real turn-by-turn navigation to
the drop pin, and the customer can check where their pin landed. An in-app draggable map
would need `react-native-maps`, a per-platform API key and a native rebuild — worth doing
only if in-app routing becomes a requirement.

The customer's pin comes from the device GPS (`expo-location`) first, with a pasted Google
Maps link as the fallback for ordering to someone else's address.

## Not built yet

From `../kuryer-izleme-sistemi-build-guide.md`, the live-tracking layer: the Socket.IO
gateway, Redis position state, adaptive location sampling on the courier device, marker
interpolation, dispatch scoring and OSRM ETAs. Order status is polled every 10 s today,
which is honest for status changes but is not a substitute for live courier position.

`src/lib/menu.ts` is copied from `frontend/src/lib/mamajanMenu.ts`; that file stays the
source of truth until the menu moves behind an API.
