import { getToken } from "./auth-storage"
import type {
  FloorElementKind,
  FloorPlanDetail,
  FloorPlanMeta,
  TableShape,
} from "./floorplan"

export type { FloorElement, FloorPlanDetail, FloorPlanMeta, FloorTable } from "./floorplan"

export type TableCategory = "2_seater" | "4_seater"

export type ReservationStatus = "booked" | "seated" | "completed" | "cancelled" | "no_show"

export type UserRole = "customer" | "admin"

export interface Restaurant {
  id: number
  slug: string
  name: string
}

export interface User {
  id: number
  email: string
  full_name: string
  phone: string
  role: UserRole
  restaurant_id: number | null
}

export interface AvailabilitySlot {
  time: string
  available_count: number
}

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
  table_category: TableCategory
  start_time: string
  end_time: string
  status: ReservationStatus
  assigned_table_id: number
  merged_table_ids: number[] | null
  preorder_items: PreorderItem[] | null
  preorder_requested_at: string | null
}

export interface DiningTable {
  id: number
  restaurant_id: number
  table_number: string
  category: TableCategory
  is_active: boolean
  zone: string
}

const BASE = ""

class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
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
    // FastAPI validation errors (422) send `detail` as an array of {msg, loc, ...} objects, not a string.
    const message = Array.isArray(detail)
      ? detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join("; ")
      : typeof detail === "string"
        ? detail
        : JSON.stringify(detail)
    throw new ApiError(res.status, message)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export { ApiError }

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

// --- restaurants ---

export function getRestaurants(): Promise<Restaurant[]> {
  return request("/api/restaurants")
}

// --- availability ---

export function getAvailability(restaurantId: number, day: string, partySize: number): Promise<AvailabilitySlot[]> {
  return request(`/api/availability?restaurant_id=${restaurantId}&day=${day}&party_size=${partySize}`)
}

// --- reservations ---

export interface CreateReservationInput {
  restaurant_id: number
  guest_name: string
  guest_email: string
  guest_phone: string
  party_size: number
  start_time: string
  idempotency_key: string
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

export function markNoShow(id: string): Promise<Reservation> {
  return request(`/api/reservations/${id}/no-show`, { method: "POST" })
}

export function seatReservation(id: string): Promise<Reservation> {
  return request(`/api/reservations/${id}/seat`, { method: "POST" })
}

export function completeReservation(id: string): Promise<Reservation> {
  return request(`/api/reservations/${id}/complete`, { method: "POST" })
}

export function revertReservationStatus(id: string): Promise<Reservation> {
  return request(`/api/reservations/${id}/revert`, { method: "POST" })
}

// --- admin ---

export function getAdminReservations(day: string): Promise<Reservation[]> {
  return request(`/api/admin/reservations?day=${day}`)
}

export function getAdminTables(): Promise<DiningTable[]> {
  return request(`/api/admin/tables`)
}

// --- admin floor plans ---

/** A table as the editor sends it back; `id` is null for one that was added on the canvas. */
export interface FloorTableInput {
  id: number | null
  table_number: string
  category: TableCategory
  shape: TableShape
  seats: number
  x_cm: number
  y_cm: number
  width_cm: number
  height_cm: number
  rotation: number
}

export interface FloorElementInput {
  kind: FloorElementKind
  x_cm: number
  y_cm: number
  width_cm: number
  height_cm: number
  rotation: number
  label: string | null
  color: string | null
  z_index: number
}

export function getFloorPlans(): Promise<FloorPlanMeta[]> {
  return request(`/api/admin/floor-plans`)
}

export function getFloorPlan(planId: number): Promise<FloorPlanDetail> {
  return request(`/api/admin/floor-plans/${planId}`)
}

export function createFloorPlan(input: {
  name: string
  width_cm?: number
  height_cm?: number
}): Promise<FloorPlanMeta> {
  return request(`/api/admin/floor-plans`, { method: "POST", body: JSON.stringify(input) })
}

export function updateFloorPlan(
  planId: number,
  input: { name?: string; width_cm?: number; height_cm?: number },
): Promise<FloorPlanMeta> {
  return request(`/api/admin/floor-plans/${planId}`, { method: "PATCH", body: JSON.stringify(input) })
}

export function deleteFloorPlan(planId: number): Promise<void> {
  return request(`/api/admin/floor-plans/${planId}`, { method: "DELETE" })
}

/** The editor saves the whole canvas at once - see the backend's save_layout for why. */
export function saveFloorPlanLayout(
  planId: number,
  layout: { tables: FloorTableInput[]; elements: FloorElementInput[] },
): Promise<FloorPlanDetail> {
  return request(`/api/admin/floor-plans/${planId}/layout`, {
    method: "PUT",
    body: JSON.stringify(layout),
  })
}

// --- admin dashboard ---

export type DashboardRange = "this_month" | "last_2_months" | "this_year"

export interface SalesPoint {
  period: string
  online: number
  restaurant: number
  total: number
}

export interface SalesSeries {
  granularity: "day" | "month"
  points: SalesPoint[]
  totals: { online: number; restaurant: number; total: number }
}

export interface ClientsPoint {
  period: string
  from_app: number
  total: number
}

export interface ClientsSeries {
  granularity: "day" | "month"
  points: ClientsPoint[]
  totals: { from_app: number; total: number }
}

export interface CategoryShare {
  category_id: number
  name: string
  revenue: number
  percent: number
}

export interface ProductShare {
  product_id: number
  name: string
  revenue: number
  percent: number
}

export interface CategoryProducts {
  category_id: number
  name: string
  revenue: number
  products: ProductShare[]
}

export function getDashboardSales(range: DashboardRange): Promise<SalesSeries> {
  return request(`/api/admin/dashboard/sales?range=${range}`)
}

export function getDashboardClients(range: DashboardRange): Promise<ClientsSeries> {
  return request(`/api/admin/dashboard/clients?range=${range}`)
}

export function getDashboardCategories(range: DashboardRange): Promise<CategoryShare[]> {
  return request(`/api/admin/dashboard/categories?range=${range}`)
}

export function getDashboardCategoryProducts(
  range: DashboardRange,
  categoryId: number,
): Promise<CategoryProducts> {
  return request(`/api/admin/dashboard/categories/${categoryId}/products?range=${range}`)
}

// --- owner dashboard: delivery fleet ---

export type DeliveryStatus = "placed" | "accepted" | "picked_up" | "delivered" | "cancelled"

export interface FleetCourier {
  id: number
  full_name: string
  vehicle_type: string
  plate_number: string | null
  is_on_shift: boolean
  /** Orders currently in this courier's hands. */
  active_load: number
  /** Null when the position key has expired - no signal, rather than a stale dot. */
  lat: number | null
  lng: number | null
  heading: number | null
  speed_mps: number | null
  age_s: number | null
}

export interface BoardOrder {
  id: string
  public_code: string
  status: DeliveryStatus
  recipient_name: string
  recipient_phone: string
  address_text: string
  lat: number
  lng: number
  total: number
  courier_id: number | null
  courier_name: string | null
  placed_at: string
  accepted_at: string | null
  picked_up_at: string | null
  delivered_at: string | null
}

export interface OriginCell {
  lat: number
  lng: number
  orders: number
  revenue: number
}

export interface CourierKpi {
  courier_id: number
  full_name: string
  deliveries: number
  revenue: number
  avg_total_minutes: number | null
  avg_road_minutes: number | null
  avg_pickup_minutes: number | null
}

export interface FleetSummary {
  couriers_on_shift: number
  couriers_live: number
  active_orders: number
  unassigned_orders: number
  delivered_today: number
  revenue_today: number
}

export function getFleetSummary(): Promise<FleetSummary> {
  return request("/api/admin/fleet/summary")
}

export function getFleetCouriers(): Promise<FleetCourier[]> {
  return request("/api/admin/fleet/couriers")
}

export function getFleetOrders(includeFinished = false): Promise<BoardOrder[]> {
  return request(`/api/admin/fleet/orders?include_finished=${includeFinished}`)
}

/** Dispatcher override: hand an order to a specific courier. */
export function assignFleetOrder(orderId: string, courierId: number): Promise<BoardOrder> {
  return request(`/api/admin/fleet/orders/${orderId}/assign`, {
    method: "POST",
    body: JSON.stringify({ courier_id: courierId }),
  })
}

export function getOriginCells(days: number): Promise<OriginCell[]> {
  return request(`/api/admin/fleet/analytics/origins?days=${days}`)
}

export function getCourierKpis(days: number): Promise<CourierKpi[]> {
  return request(`/api/admin/fleet/analytics/couriers?days=${days}`)
}
