import Constants from "expo-constants"
import { getToken } from "./auth-storage"

/**
 * Where the API lives.
 *
 * A phone cannot resolve `localhost` - that would be the phone itself - so the base URL is
 * derived from the machine running the Expo dev server (`hostUri` is "192.168.x.x:8081"),
 * with the API's own port swapped in. Set EXPO_PUBLIC_API_URL to override for a staging or
 * production build.
 */
function resolveBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL
  if (explicit) return explicit.replace(/\/$/, "")
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost
  const host = hostUri?.split(":")[0]
  if (host) return `http://${host}:8000`
  return "http://localhost:8000"
}

export const API_BASE = resolveBaseUrl()

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    const detail = body.detail ?? res.statusText
    // FastAPI sends 422 `detail` as an array of {msg, loc}, not a string.
    const message = Array.isArray(detail)
      ? detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join("; ")
      : typeof detail === "string"
        ? detail
        : JSON.stringify(detail)
    throw new ApiError(res.status, message)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

// --- shared types ---

export type UserRole = "customer" | "admin" | "courier"

export interface User {
  id: number
  email: string
  full_name: string
  phone: string
  role: UserRole
  restaurant_id: number | null
}

export interface Restaurant {
  id: number
  slug: string
  name: string
}

// --- auth ---

export interface RegisterInput {
  email: string
  password: string
  full_name: string
  phone: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

export function register(input: RegisterInput): Promise<User> {
  return request("/api/auth/register", { method: "POST", body: JSON.stringify(input) })
}

export function login(input: LoginInput): Promise<AuthResponse> {
  return request("/api/auth/login", { method: "POST", body: JSON.stringify(input) })
}

export function getMe(): Promise<User> {
  return request("/api/auth/me")
}

export function getRestaurants(): Promise<Restaurant[]> {
  return request("/api/restaurants")
}

// --- reservations (dine-in) ---
//
// The other half of the split: a reservation pre-order goes to the restaurant's own floor
// view, is cooked for the booking time, and never reaches a courier. Delivery orders below
// are the ones couriers see. Same menu, same basket, two destinations.

export type ReservationStatus = "booked" | "seated" | "completed" | "cancelled" | "no_show"

export interface PreorderItem {
  name: string
  quantity: number
  price: number
}

export interface Reservation {
  id: string
  restaurant_id: number
  guest_name: string
  guest_email: string
  guest_phone: string
  party_size: number
  table_category: string
  start_time: string
  end_time: string
  status: ReservationStatus
  assigned_table_id: number
  merged_table_ids: number[] | null
  preorder_items: PreorderItem[] | null
  preorder_requested_at: string | null
}

export interface AvailabilitySlot {
  time: string
  available_count: number
}

export interface CreateReservationInput {
  restaurant_id: number
  guest_name: string
  guest_email: string
  guest_phone: string
  party_size: number
  start_time: string
  idempotency_key: string
}

/** `day` is a YYYY-MM-DD local date, not a timestamp - the server resolves it in the
 * restaurant's own timezone. */
export function getAvailability(
  restaurantId: number,
  day: string,
  partySize: number,
): Promise<AvailabilitySlot[]> {
  return request(
    `/api/availability?restaurant_id=${restaurantId}&day=${day}&party_size=${partySize}`,
  )
}

export function createReservation(input: CreateReservationInput): Promise<Reservation> {
  return request("/api/reservations", { method: "POST", body: JSON.stringify(input) })
}

export function getMyReservations(): Promise<Reservation[]> {
  return request("/api/reservations/me")
}

export function cancelReservation(id: string): Promise<Reservation> {
  return request(`/api/reservations/${id}/cancel`, { method: "POST" })
}

/** Attaches the basket to a booking: the kitchen has it ready at the reservation time. */
export function createPreorder(
  reservationId: string,
  restaurantId: number,
  items: PreorderItem[],
): Promise<Reservation> {
  return request(`/api/reservations/${reservationId}/preorder`, {
    method: "POST",
    body: JSON.stringify({ restaurant_id: restaurantId, items }),
  })
}

// --- delivery (online çatdırılma) ---

export type DeliveryStatus = "placed" | "accepted" | "picked_up" | "delivered" | "cancelled"

export interface DeliveryItem {
  name_snapshot: string
  unit_price: number
  quantity: number
}

/** What the customer may see about their courier - no phone number, by design. */
export interface CourierSummary {
  id: number
  full_name: string
  vehicle_type: string
  plate_number: string | null
}

export interface DeliveryOrder {
  id: string
  public_code: string
  restaurant_id: number
  status: DeliveryStatus
  recipient_name: string
  recipient_phone: string
  lat: number
  lng: number
  address_text: string
  building: string | null
  entrance: string | null
  floor: string | null
  apartment: string | null
  courier_note: string | null
  subtotal: number
  delivery_fee: number
  total: number
  payment_method: string
  placed_at: string
  accepted_at: string | null
  picked_up_at: string | null
  delivered_at: string | null
  cancelled_at: string | null
  items: DeliveryItem[]
  courier: CourierSummary | null
}

export interface CreateDeliveryOrderInput {
  restaurant_id: number
  recipient_name: string
  recipient_phone: string
  lat: number
  lng: number
  address_text: string
  building?: string | null
  entrance?: string | null
  floor?: string | null
  apartment?: string | null
  courier_note?: string | null
  payment_method: "cash" | "card_on_delivery"
  items: { name: string; unit_price: number; quantity: number }[]
}

export interface DeliveryQuote {
  delivery_fee: number
  free_over: number
  currency: string
}

export function getDeliveryQuote(subtotal: number): Promise<DeliveryQuote> {
  return request(`/api/delivery/quote?subtotal=${subtotal}`)
}

export function createDeliveryOrder(input: CreateDeliveryOrderInput): Promise<DeliveryOrder> {
  return request("/api/delivery/orders", { method: "POST", body: JSON.stringify(input) })
}

export function getMyDeliveryOrders(): Promise<DeliveryOrder[]> {
  return request("/api/delivery/orders/me")
}

export function cancelDeliveryOrder(id: string): Promise<DeliveryOrder> {
  return request(`/api/delivery/orders/${id}/cancel`, { method: "POST" })
}

// --- courier ---

export interface CourierProfile {
  user_id: number
  restaurant_id: number
  full_name: string
  vehicle_type: string
  plate_number: string | null
  is_on_shift: boolean
}

export function getCourierProfile(): Promise<CourierProfile> {
  return request("/api/courier/me")
}

export function setCourierShift(isOnShift: boolean): Promise<CourierProfile> {
  return request("/api/courier/me/shift", {
    method: "POST",
    body: JSON.stringify({ is_on_shift: isOnShift }),
  })
}

export function getAvailableDeliveries(): Promise<DeliveryOrder[]> {
  return request("/api/courier/orders/available")
}

export function getMyDeliveries(): Promise<DeliveryOrder[]> {
  return request("/api/courier/orders/mine")
}

export function acceptDelivery(id: string): Promise<DeliveryOrder> {
  return request(`/api/courier/orders/${id}/accept`, { method: "POST" })
}

export function pickUpDelivery(id: string): Promise<DeliveryOrder> {
  return request(`/api/courier/orders/${id}/pickup`, { method: "POST" })
}

export function completeDelivery(id: string): Promise<DeliveryOrder> {
  return request(`/api/courier/orders/${id}/deliver`, { method: "POST" })
}

// --- live tracking ---

/** One position report from the courier device. */
export interface CourierPingInput {
  lat: number
  lng: number
  heading?: number | null
  speed_mps?: number | null
  accuracy_m?: number | null
  order_id?: string | null
}

/** Where the courier is, and how long the customer should expect to wait. */
export interface DeliveryTracking {
  lat: number
  lng: number
  heading: number | null
  speed_mps: number | null
  distance_m: number
  eta_low_s: number
  eta_high_s: number
  /** Seconds since the fix was taken. Past ~120s the courier's position key has expired. */
  age_s: number | null
}

export function sendCourierLocation(ping: CourierPingInput): Promise<{ ok: boolean }> {
  return request("/api/courier/me/location", { method: "POST", body: JSON.stringify(ping) })
}

/** Bootstrap for the tracking screen; null while the courier has no signal. */
export function getDeliveryTracking(orderId: string): Promise<DeliveryTracking | null> {
  return request(`/api/delivery/orders/${orderId}/tracking`)
}

/**
 * WebSocket URL for one order's live position feed.
 *
 * The token rides in the query string because the WebSocket API cannot set an Authorization
 * header. The server still authorises it properly - it checks the JWT subject owns this
 * order before accepting the socket.
 */
export async function deliveryTrackingUrl(orderId: string): Promise<string> {
  const token = await getToken()
  const base = API_BASE.replace(/^http/, "ws")
  return `${base}/ws/delivery/${orderId}?token=${encodeURIComponent(token ?? "")}`
}
