// The design tokens from the web app's Tailwind `@theme` block, as plain values. Every screen
// pulls colours and type from here, so the palette stays in one place the way it did in CSS.

export const colors = {
  ink950: "#191512",
  ink900: "#211b17",
  ink800: "#2d2521",
  ink700: "#453a33",
  ink600: "#5f5148",
  parchment50: "#fbf8f3",
  parchment100: "#f4ede2",
  parchment200: "#e9dcc9",
  ember400: "#d97a4c",
  ember500: "#c05f34",
  ember600: "#a34a26",
  moss500: "#6b7d5e",
  rust500: "#a3432f",
} as const

/** RGBA helpers for the many translucent borders/fills the web design leans on. */
export const alpha = {
  ink: (a: number) => `rgba(33,27,23,${a})`,
  ember: (a: number) => `rgba(192,95,52,${a})`,
  moss: (a: number) => `rgba(107,125,94,${a})`,
  rust: (a: number) => `rgba(163,67,47,${a})`,
  parchment: (a: number) => `rgba(251,248,243,${a})`,
} as const

/** Font families as registered by `useAppFonts` in src/hooks/useAppFonts.ts. */
export const fonts = {
  display: "Fraunces_400Regular",
  displayItalic: "Fraunces_400Regular_Italic",
  displayMedium: "Fraunces_500Medium",
  sans: "Outfit_400Regular",
  sansMedium: "Outfit_500Medium",
  sansSemi: "Outfit_600SemiBold",
  sansBold: "Outfit_700Bold",
  mono: "JetBrainsMono_400Regular",
} as const

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const

/** Uppercase eyebrow text — `text-[10px] uppercase tracking-[0.2em]` on the web. */
export const eyebrow = {
  fontFamily: fonts.sansMedium,
  fontSize: 10,
  letterSpacing: 2,
  textTransform: "uppercase" as const,
}
