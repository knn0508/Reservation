/**
 * The web app's palette, transcribed for React Native.
 *
 * Tailwind isn't here, so the values that live in the web app's CSS tokens live as plain
 * constants instead. Keep the two in step: a customer who books on the site and orders in
 * the app should not feel like they changed brands.
 */
export const colors = {
  parchment50: "#faf7f2",
  parchment100: "#f4efe6",
  ink950: "#191512",
  ink900: "#241e19",
  ink800: "#3a322b",
  ink700: "#554b42",
  ink600: "#7a6e63",
  ember600: "#c2410c",
  ember500: "#ea580c",
  moss500: "#4d7c52",
  rust500: "#b4442e",
  /** Hairlines and card borders - ink at low alpha, matching the web's ink-900/8..15. */
  line: "rgba(36,30,25,0.10)",
  lineStrong: "rgba(36,30,25,0.18)",
  tintEmber: "rgba(234,88,12,0.08)",
  tintMoss: "rgba(77,124,82,0.10)",
  tintRust: "rgba(180,68,46,0.08)",
} as const

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
} as const

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
} as const

export function formatPrice(n: number): string {
  return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)} ₼`
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}
