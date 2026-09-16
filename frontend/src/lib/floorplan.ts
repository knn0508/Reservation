import type { TableCategory } from "./api"

export type TableShape = "round" | "square" | "rect"

export type FloorElementKind =
  | "wall"
  | "window"
  | "door"
  | "entrance"
  | "bar"
  | "kitchen"
  | "sofa"
  | "booth"
  | "plant"
  | "pillar"
  | "stairs"
  | "restroom"
  | "divider"
  | "label"

export interface FloorElement {
  id: number
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

export interface FloorTable {
  id: number
  restaurant_id: number
  floor_plan_id: number | null
  table_number: string
  category: TableCategory
  zone: string
  is_active: boolean
  shape: TableShape
  seats: number
  x_cm: number
  y_cm: number
  width_cm: number
  height_cm: number
  rotation: number
}

export interface FloorPlanMeta {
  id: number
  restaurant_id: number
  name: string
  width_cm: number
  height_cm: number
  sort_order: number
}

export interface FloorPlanDetail extends FloorPlanMeta {
  tables: FloorTable[]
  elements: FloorElement[]
}

/** Everything on the canvas is stored in centimetres, so the drawing is independent of the
 * screen size the admin happened to draw it on. */
export const GRID_CM = 10
export const CHAIR_CM = 42
/** Gap between the table edge and the chair drawn beside it. */
const CHAIR_GAP_CM = 8

export interface ElementPreset {
  label: string
  /** Grouping in the palette rail. */
  group: "structure" | "furniture"
  width_cm: number
  height_cm: number
  fill: string
  stroke: string
  /** Elements people walk through/past read better as thin bars than filled boxes. */
  thin?: boolean
}

export const ELEMENT_PRESETS: Record<FloorElementKind, ElementPreset> = {
  wall: { label: "Wall", group: "structure", width_cm: 400, height_cm: 20, fill: "#2d2521", stroke: "#191512", thin: true },
  window: { label: "Window", group: "structure", width_cm: 220, height_cm: 18, fill: "#bcd4e0", stroke: "#7ba3b8", thin: true },
  door: { label: "Door", group: "structure", width_cm: 90, height_cm: 18, fill: "#e9dcc9", stroke: "#a38b6a", thin: true },
  entrance: { label: "Entrance", group: "structure", width_cm: 160, height_cm: 22, fill: "#d97a4c", stroke: "#a34a26", thin: true },
  pillar: { label: "Pillar", group: "structure", width_cm: 45, height_cm: 45, fill: "#5f5148", stroke: "#2d2521" },
  stairs: { label: "Stairs", group: "structure", width_cm: 120, height_cm: 220, fill: "#e9dcc9", stroke: "#a38b6a" },
  restroom: { label: "Restroom", group: "structure", width_cm: 180, height_cm: 160, fill: "#efe7da", stroke: "#a38b6a" },
  kitchen: { label: "Kitchen", group: "structure", width_cm: 320, height_cm: 220, fill: "#efe7da", stroke: "#a38b6a" },
  divider: { label: "Divider", group: "structure", width_cm: 200, height_cm: 14, fill: "#8a7a6a", stroke: "#5f5148", thin: true },
  bar: { label: "Bar", group: "furniture", width_cm: 400, height_cm: 80, fill: "#453a33", stroke: "#211b17" },
  sofa: { label: "Sofa", group: "furniture", width_cm: 200, height_cm: 75, fill: "#a86b4c", stroke: "#7a4a30" },
  booth: { label: "Booth", group: "furniture", width_cm: 200, height_cm: 130, fill: "#b8815f", stroke: "#7a4a30" },
  plant: { label: "Plant", group: "furniture", width_cm: 55, height_cm: 55, fill: "#6b7d5e", stroke: "#4d5b43" },
  label: { label: "Text", group: "furniture", width_cm: 180, height_cm: 40, fill: "transparent", stroke: "#a38b6a" },
}

export const ELEMENT_KINDS = Object.keys(ELEMENT_PRESETS) as FloorElementKind[]

export const TABLE_SHAPES: { value: TableShape; label: string }[] = [
  { value: "round", label: "Round" },
  { value: "square", label: "Square" },
  { value: "rect", label: "Rectangle" },
]

export function snapCm(value: number, enabled = true): number {
  return enabled ? Math.round(value / GRID_CM) * GRID_CM : Math.round(value)
}

/** Booking still assigns tables by `category`, so the two must not drift apart: a table with
 * 3+ seats is a four-top as far as availability is concerned. */
export function categoryForSeats(seats: number): TableCategory {
  return seats <= 2 ? "2_seater" : "4_seater"
}

export function defaultTableSize(shape: TableShape, seats: number): { width_cm: number; height_cm: number } {
  if (shape === "round") {
    const d = Math.max(70, 50 + seats * 12)
    return { width_cm: d, height_cm: d }
  }
  if (shape === "square") {
    const s = Math.max(70, 55 + seats * 8)
    return { width_cm: s, height_cm: s }
  }
  return { width_cm: Math.max(100, 40 * Math.ceil(seats / 2)), height_cm: 80 }
}

export interface ChairSpot {
  /** Chair centre, in table-local coordinates (origin at the table's centre, unrotated). */
  x: number
  y: number
  /** Degrees; 0 means the chair sits below the table facing up. */
  angle: number
}

/** Chairs are derived from `seats` and the table's shape rather than placed by hand - that is
 * how real floor-plan tools do it, and it keeps a table's seat count and its drawing in sync. */
export function chairPositions(shape: TableShape, seats: number, width: number, height: number): ChairSpot[] {
  const n = Math.max(0, Math.min(seats, 30))
  if (n === 0) return []

  if (shape === "round") {
    const radius = Math.max(width, height) / 2 + CHAIR_GAP_CM + CHAIR_CM / 2
    return Array.from({ length: n }, (_, i) => {
      // Start at the bottom and go clockwise so a 2-top reads as "one each side".
      const theta = (Math.PI * 2 * i) / n + Math.PI / 2
      return {
        x: Math.cos(theta) * radius,
        y: Math.sin(theta) * radius,
        angle: (theta * 180) / Math.PI - 90,
      }
    })
  }

  // Rectangular tables: seat the long sides first, then the short ones.
  const horizontal = Math.min(n, Math.max(2, Math.round((n * width) / (width + height))))
  const vertical = n - horizontal
  const top = Math.ceil(horizontal / 2)
  const bottom = horizontal - top
  const left = Math.ceil(vertical / 2)
  const right = vertical - left

  const offsetY = height / 2 + CHAIR_GAP_CM + CHAIR_CM / 2
  const offsetX = width / 2 + CHAIR_GAP_CM + CHAIR_CM / 2
  const spots: ChairSpot[] = []

  const spread = (count: number, span: number) =>
    Array.from({ length: count }, (_, i) => -span / 2 + (span * (i + 1)) / (count + 1))

  for (const x of spread(top, width)) spots.push({ x, y: -offsetY, angle: 180 })
  for (const x of spread(bottom, width)) spots.push({ x, y: offsetY, angle: 0 })
  for (const y of spread(left, height)) spots.push({ x: -offsetX, y, angle: 90 })
  for (const y of spread(right, height)) spots.push({ x: offsetX, y, angle: -90 })

  return spots
}

/** How a table reads on the live view. `free` also covers a table whose sitting has ended. */
export type TableStatus = "free" | "booked" | "seated" | "done"

export const STATUS_FILL: Record<TableStatus, { fill: string; stroke: string; text: string }> = {
  free: { fill: "#f4ede2", stroke: "#a38b6a", text: "#453a33" },
  booked: { fill: "#6b7d5e", stroke: "#4d5b43", text: "#fbf8f3" },
  seated: { fill: "#c05f34", stroke: "#a34a26", text: "#fbf8f3" },
  done: { fill: "#e0d6c6", stroke: "#a38b6a", text: "#5f5148" },
}
