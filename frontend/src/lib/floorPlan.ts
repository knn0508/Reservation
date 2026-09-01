// Architectural definition of each restaurant's dining room, in abstract "plan units".
// The room shell (walls, glazing, doors) and the fixed furniture (bar, kitchen, reception,
// restrooms, planters) live here; the tables themselves come from the API and are placed by
// mapping their pos_x/pos_y percentages onto `floor`.
//
// One unit is roughly 1.2 cm, so the shared 1000x720 shell reads as a 12 m x 8.6 m room.
// UNITS_PER_METRE lets the plan draw a truthful scale bar.

export const UNITS_PER_METRE = 83.33

export type Wall = "north" | "south" | "east" | "west"

/** A gap cut into a wall. `from`/`to` run along that wall: x for north/south, y for east/west. */
export interface Opening {
  wall: Wall
  from: number
  to: number
  label?: string
}

export interface Doorway extends Opening {
  kind: "main" | "service"
  /** 1 = single leaf hinged at `from`, 2 = double doors hinged at both jambs. */
  leaves: 1 | 2
}

export type FixtureKind = "bar" | "kitchen" | "restroom" | "reception" | "service" | "planter"

export interface Fixture {
  kind: FixtureKind
  x: number
  y: number
  w: number
  h: number
  label?: string
  /** Rotate the label -90 degrees, for tall fixtures standing against a side wall. */
  vertical?: boolean
  /** Which way the counter faces — decides where stools and the service edge are drawn. */
  facing?: Wall
  /** Bars get stools by default; a back bar or pass counter sets this false. */
  stools?: boolean
}

export interface FloorPlanSpec {
  room: { w: number; h: number; wall: number }
  /** The rectangle table percentages (0-100) are mapped onto. */
  floor: { x: number; y: number; w: number; h: number }
  windows: Opening[]
  doors: Doorway[]
  fixtures: Fixture[]
  caption: string
}

/** Bar down the west wall, kitchen and restrooms east, host stand beside the street door. */
const MAMAJAN: FloorPlanSpec = {
  room: { w: 1000, h: 720, wall: 16 },
  floor: { x: 132, y: 72, w: 700, h: 476 },
  windows: [{ wall: "north", from: 130, to: 870, label: "Street windows" }],
  doors: [
    { wall: "south", from: 150, to: 300, kind: "main", leaves: 2, label: "Entrance" },
    { wall: "west", from: 600, to: 680, kind: "service", leaves: 1, label: "Staff" },
  ],
  fixtures: [
    { kind: "bar", x: 26, y: 150, w: 66, h: 410, label: "Bar", vertical: true, facing: "east" },
    { kind: "kitchen", x: 852, y: 72, w: 122, h: 250, label: "Kitchen", vertical: true },
    { kind: "restroom", x: 852, y: 350, w: 122, h: 150, label: "WC" },
    { kind: "service", x: 852, y: 528, w: 122, h: 96, label: "Service" },
    { kind: "reception", x: 600, y: 612, w: 240, h: 72, label: "Reception", facing: "north" },
    { kind: "planter", x: 348, y: 618, w: 56, h: 56 },
    { kind: "planter", x: 448, y: 618, w: 56, h: 56 },
  ],
  caption: "Ground floor · dining room",
}

/** Garden glazing down the east wall, kitchen west, entrance and bar along the south. */
const NAR_BAGI: FloorPlanSpec = {
  room: { w: 1000, h: 720, wall: 16 },
  floor: { x: 132, y: 64, w: 700, h: 452 },
  windows: [
    { wall: "north", from: 130, to: 870, label: "Street windows" },
    { wall: "east", from: 90, to: 470, label: "Garden" },
  ],
  doors: [
    { wall: "south", from: 420, to: 570, kind: "main", leaves: 2, label: "Entrance" },
    { wall: "west", from: 92, to: 172, kind: "service", leaves: 1, label: "Staff" },
  ],
  fixtures: [
    { kind: "kitchen", x: 26, y: 180, w: 108, h: 250, label: "Kitchen", vertical: true },
    { kind: "bar", x: 132, y: 600, w: 230, h: 72, label: "Bar", facing: "north", stools: false },
    { kind: "reception", x: 640, y: 600, w: 200, h: 72, label: "Reception", facing: "north" },
    { kind: "restroom", x: 856, y: 520, w: 120, h: 120, label: "WC" },
    { kind: "planter", x: 856, y: 120, w: 54, h: 54 },
    { kind: "planter", x: 856, y: 292, w: 54, h: 54 },
    { kind: "planter", x: 856, y: 420, w: 54, h: 54 },
  ],
  caption: "Ground floor · garden room",
}

const PLANS: Record<string, FloorPlanSpec> = {
  "mamajan-georgian-cuisine": MAMAJAN,
  "nar-bagi": NAR_BAGI,
}

/** Any restaurant without a drawn room falls back to the Mamajan shell, which suits the
 *  default seeded layout (window row along the top, hall in the middle, lounge at the bottom). */
export function getFloorPlan(slug?: string): FloorPlanSpec {
  return (slug && PLANS[slug]) || MAMAJAN
}

/** Tone each named zone gets on the plan. Unknown zones fall back to the neutral hall tone. */
export const ZONE_TONE: Record<string, { fill: string; stroke: string; text: string }> = {
  window: { fill: "rgba(107,125,94,0.075)", stroke: "rgba(107,125,94,0.24)", text: "rgba(84,99,74,0.9)" },
  garden: { fill: "rgba(107,125,94,0.075)", stroke: "rgba(107,125,94,0.24)", text: "rgba(84,99,74,0.9)" },
  terrace: { fill: "rgba(107,125,94,0.075)", stroke: "rgba(107,125,94,0.24)", text: "rgba(84,99,74,0.9)" },
  hall: { fill: "rgba(33,27,23,0.028)", stroke: "rgba(33,27,23,0.10)", text: "rgba(95,81,72,0.85)" },
  lounge: { fill: "rgba(192,95,52,0.055)", stroke: "rgba(192,95,52,0.20)", text: "rgba(163,74,38,0.85)" },
}

export const DEFAULT_ZONE_TONE = ZONE_TONE.hall
