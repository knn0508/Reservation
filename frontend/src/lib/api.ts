export type TableCategory = "2_seater" | "4_seater"

export type ReservationStatus = "booked" | "seated" | "completed" | "cancelled" | "no_show"

export interface AvailabilitySlot {
  time: string
  tables_2_free: number
  tables_4_free: number
}

export interface Reservation {
  id: string
  guest_name: string
  guest_email: string
  guest_phone: string
  party_size: number
  table_category: TableCategory
  start_time: string
  end_time: string
  status: ReservationStatus
  assigned_table_id: number | null
}

export interface DiningTable {
  id: number
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
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new ApiError(res.status, body.detail ?? res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export { ApiError }

export function getAvailability(day: string): Promise<AvailabilitySlot[]> {
  return request(`/api/availability?day=${day}`)
}

export interface CreateReservationInput {
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

export function getReservation(id: string): Promise<Reservation> {
  return request(`/api/reservations/${id}`)
}

export function cancelReservation(id: string): Promise<Reservation> {
  return request(`/api/reservations/${id}/cancel`, { method: "POST" })
}

export function markNoShow(id: string): Promise<Reservation> {
  return request(`/api/reservations/${id}/no-show`, { method: "POST" })
}

export function seatReservation(id: string, tableId: number): Promise<Reservation> {
  return request(`/api/reservations/${id}/seat?table_id=${tableId}`, { method: "POST" })
}

export function completeReservation(id: string): Promise<Reservation> {
  return request(`/api/reservations/${id}/complete`, { method: "POST" })
}

export function getAdminReservations(day: string): Promise<Reservation[]> {
  return request(`/api/admin/reservations?day=${day}`)
}

export function getAdminTables(): Promise<DiningTable[]> {
  return request(`/api/admin/tables`)
}
