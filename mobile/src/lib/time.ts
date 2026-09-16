/** Date helpers for the booking flow. Kept tiny and dependency-free - the app only ever
 * needs "the next 7 days" and "what time is this slot". */

/** YYYY-MM-DD in the device's own timezone (never toISOString, which shifts to UTC and can
 * land you a day early for anyone east of Greenwich - Baku is UTC+4). */
export function toDayKey(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0")
  const day = `${d.getDate()}`.padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + n)
  return copy
}

export function formatSlotTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export function formatDayShort(d: Date): string {
  return d.toLocaleDateString([], { weekday: "short" })
}

export function formatDayNumber(d: Date): string {
  return `${d.getDate()}`
}

export function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { day: "numeric", month: "long" })
}

/** Good enough for an idempotency key: it only has to be unique per booking attempt. */
export function randomKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
