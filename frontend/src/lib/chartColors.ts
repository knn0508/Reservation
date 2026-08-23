// Validated categorical palette (see dataviz skill reference) - fixed order, never cycled.
// Slot 1/2 double as the app's two-series identity everywhere: "from the app" is always
// blue, "in-restaurant" is always orange, whichever chart it appears in.
export const CATEGORICAL = [
  "#2a78d6", // 1 blue
  "#eb6834", // 2 orange
  "#1baf7a", // 3 aqua
  "#eda100", // 4 yellow
  "#e87ba4", // 5 magenta
  "#008300", // 6 green
  "#4a3aa7", // 7 violet
  "#e34948", // 8 red
] as const

export const OTHER_COLOR = "#8f8a82"
