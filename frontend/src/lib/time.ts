export const RESTAURANT_TZ = "Asia/Baku"

export function toDayKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: RESTAURANT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value
  return `${get("year")}-${get("month")}-${get("day")}`
}

export function formatSlotTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: RESTAURANT_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso))
}

export function formatFullDate(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1, d, 12))
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: RESTAURANT_TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date)
}

export function formatShortDate(dayKey: string): { weekday: string; day: string } {
  const [y, m, d] = dayKey.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1, d, 12))
  const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: RESTAURANT_TZ, weekday: "short" }).format(date)
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: RESTAURANT_TZ, day: "numeric" }).format(date)
  return { weekday, day }
}

/** Local hour (0-23) in the restaurant's timezone, right now. */
function currentHourInRestaurantTz(): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: RESTAURANT_TZ, hour: "2-digit", hour12: false }).format(new Date()),
  )
}

/** Today's day-key, unless it's past 21:00 restaurant time - then tomorrow's. */
export function defaultBookableDay(): string {
  const now = new Date()
  if (currentHourInRestaurantTz() >= 21) {
    now.setDate(now.getDate() + 1)
  }
  return toDayKey(now)
}

export function nextNDays(n: number): string[] {
  const out: string[] = []
  const now = new Date()
  // Past 21:00 there's too little of today's service left to bother offering it - start the
  // strip from tomorrow instead.
  const startOffset = currentHourInRestaurantTz() >= 21 ? 1 : 0
  for (let i = startOffset; i < startOffset + n; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() + i)
    out.push(toDayKey(d))
  }
  return out
}

/** Builds an ISO instant for a given day-key + "HH:mm" slot, interpreted in the restaurant's timezone. */
export function slotToIso(dayKey: string, hhmm: string): string {
  const [y, m, d] = dayKey.split("-").map(Number)
  const [hh, mm] = hhmm.split(":").map(Number)

  const utcGuess = Date.UTC(y, m - 1, d, hh, mm)
  const tzOffsetMs = getTzOffsetMs(new Date(utcGuess))
  return new Date(utcGuess - tzOffsetMs).toISOString()
}

function getTzOffsetMs(date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: RESTAURANT_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
  const parts = dtf.formatToParts(date)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"))
  return asUTC - date.getTime()
}
