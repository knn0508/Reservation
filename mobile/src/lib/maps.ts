import { Linking, Platform } from "react-native"

/**
 * Google Maps hand-off.
 *
 * On a phone these URLs open the real Google Maps app - live traffic, voice guidance,
 * rerouting - which is strictly better than anything we could draw in-app, and needs no
 * API key and no map SDK. That is why the courier screen hands off rather than embedding.
 */

/** Baku city centre - where the pin starts when the phone won't share a location. */
export const DEFAULT_PIN = { lat: 40.37767, lng: 49.89201 }

export interface LatLng {
  lat: number
  lng: number
}

/** 5 decimals is ~1 m: more precision than a delivery pin can honestly claim. */
export function formatCoord(n: number): string {
  return n.toFixed(5)
}

export function formatLatLng({ lat, lng }: LatLng): string {
  return `${formatCoord(lat)}, ${formatCoord(lng)}`
}

/** Turn-by-turn driving directions from wherever the courier is now to the drop point. */
export function directionsUrl({ lat, lng }: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
}

/** The pin alone, roadmap view - for eyeballing the neighbourhood. */
export function placeUrl({ lat, lng }: LatLng): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}

export async function openDirections(point: LatLng): Promise<void> {
  // iOS accepts the comgooglemaps:// scheme only when Google Maps is installed; the https
  // URL is handled by the installed app anyway and falls back to the browser, so it is the
  // safer single path. Apple Maps stays available through the OS share sheet.
  const url =
    Platform.OS === "ios"
      ? `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}&travelmode=driving`
      : directionsUrl(point)
  await Linking.openURL(url)
}

export async function openPlace(point: LatLng): Promise<void> {
  await Linking.openURL(placeUrl(point))
}

/**
 * Pulls coordinates out of whatever the customer pasted.
 *
 * Accepts a bare "40.37911, 49.85668" and the shapes a shared Google Maps link takes: the
 * `@lat,lng,17z` of a browser URL and the `q=`/`!3d!4d` of a share link. Null when the
 * string holds nothing coordinate-shaped.
 */
export function parseLatLng(text: string): LatLng | null {
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]q=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (!m) continue
    const lat = Number(m[1])
    const lng = Number(m[2])
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng }
    }
  }
  return null
}
