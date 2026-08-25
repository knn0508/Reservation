// Date/time helpers for the restaurant's local calendar.
//
// The web build leaned on Intl.DateTimeFormat with `timeZone: "Asia/Baku"`. Hermes only ships
// full ICU time-zone data on some builds, so the arithmetic here is done against a fixed
// offset instead — Azerbaijan has been on UTC+4 with no DST since 2016, which makes this exact
// and removes the dependency entirely.

export const RESTAURANT_TZ = "Asia/Baku"

/** Azerbaijan abolished DST in 2016; the offset has been a flat +04:00 ever since. */
const TZ_OFFSET_MINUTES = 4 * 60
const TZ_OFFSET_MS = TZ_OFFSET_MINUTES * 60_000

const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const pad = (n: number) => String(n).padStart(2, "0")

/** The instant, shifted so its UTC fields read as restaurant-local wall-clock fields. */
function localParts(date: Date) {
  const shifted = new Date(date.getTime() + TZ_OFFSET_MS)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  }
}

export function toDayKey(date: Date): string {
  const p = localParts(date)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

export function formatSlotTime(iso: string): string {
  const p = localParts(new Date(iso))
  return `${pad(p.hour)}:${pad(p.minute)}`
}

/** A day-key rendered as "Monday, 24 August" — the header format used on cards. */
export function formatFullDate(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number)
  const at = new Date(Date.UTC(y, m - 1, d, 12))
  return `${WEEKDAYS_LONG[at.getUTCDay()]}, ${d} ${MONTHS_LONG[m - 1]}`
}

export function formatShortDate(dayKey: string): { weekday: string; day: string } {
  const [y, m, d] = dayKey.split("-").map(Number)
  const at = new Date(Date.UTC(y, m - 1, d, 12))
  return { weekday: WEEKDAYS_SHORT[at.getUTCDay()], day: String(d) }
}

export function nextNDays(n: number): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() + i)
    out.push(toDayKey(d))
  }
  return out
}

/** Builds an ISO instant for a given day-key + "HH:mm" slot, read in the restaurant's zone. */
export function slotToIso(dayKey: string, hhmm: string): string {
  const [y, m, d] = dayKey.split("-").map(Number)
  const [hh, mm] = hhmm.split(":").map(Number)
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - TZ_OFFSET_MS).toISOString()
}
