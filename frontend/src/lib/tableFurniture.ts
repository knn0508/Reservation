// Every table on the plan is drawn as the furniture that actually stands there — a round top
// with its ring of chairs, a square four-top, a lounge booth between two benches, a banquette
// sofa along the glazing, a communal table with a bench down each side. Guests read the room
// the way they will walk into it, instead of reading a legend of icons.
//
// Geometry is in the same plan units as lib/floorPlan (one unit is roughly 1.2 cm) and is
// written relative to the table's centre, so a piece can be dropped at any pos_x/pos_y.

import type { AvailableTable } from "./api"

export type FurnitureKind = "round" | "square" | "booth" | "banquette" | "communal"

/** A loose chair: a seat pad with a back rail. `rotation` is degrees clockwise from
 *  "back at the top", i.e. a chair standing above the table and facing down into it. */
export interface Chair {
  x: number
  y: number
  rotation: number
}

/** Fixed seating — a booth bench or a banquette sofa. Same rotation convention as a chair;
 *  a bench without a back is a plain pad, the way communal benches are drawn. */
export interface Bench {
  x: number
  y: number
  /** Length along the table edge. */
  w: number
  rotation: number
  back: boolean
}

export interface TableFurniture {
  kind: FurnitureKind
  /** Tabletop, centred on the table's plan position. */
  top: { w: number; h: number; round: boolean }
  chairs: Chair[]
  benches: Bench[]
  /** Half-extent of everything drawn, used for the hit area and to place the hover chip. */
  reach: { x: number; y: number }
  /** One sentence describing the real furniture, shown in the detail sheet. */
  description: string
  tags: string[]
}

/** Seat pads sit this far beyond the tabletop edge, leaving the walkable gap a real setting
 *  has. Backs and pads are then drawn from that anchor by the glyphs below. */
const SEAT_GAP = 22

/** Chair glyph, in local coordinates around its anchor. */
export const CHAIR = {
  back: { x: -16, y: -11, w: 32, h: 8 },
  seat: { x: -13, y: -3, w: 26, h: 19 },
}

/** Bench glyph. The pad is stretched to the bench's own length at draw time. */
export const BENCH = {
  backInset: -11,
  backHeight: 8,
  /** A back rail overhangs its pad slightly, which is what makes a sofa read as a sofa. */
  backOverhang: 10,
  seatInset: -3,
  seatHeight: 20,
}

/** How far past the tabletop edge a piece of seating reaches, back rail included. */
const seatReach = (halfExtent: number, back: boolean) =>
  halfExtent + SEAT_GAP + (back ? -BENCH.backInset : -CHAIR.back.y)

const roundRadius = (seats: number) => (seats <= 2 ? 27 : seats <= 4 ? 33 : 39)

/** Chairs evenly around a round top, the first one at twelve o'clock. */
function ring(seats: number, radius: number): Chair[] {
  const n = Math.max(2, Math.min(seats, 8))
  const r = radius + SEAT_GAP
  return Array.from({ length: n }, (_, i) => {
    const a = (i * 2 * Math.PI) / n
    return { x: r * Math.sin(a), y: -r * Math.cos(a), rotation: (i * 360) / n }
  })
}

/** Chairs spread along one long side of a rectangular top, all facing it. */
function row(count: number, width: number, y: number, rotation: number): Chair[] {
  return Array.from({ length: count }, (_, i) => ({
    x: (width * (i + 0.5)) / count - width / 2,
    y,
    rotation,
  }))
}

const seatWord = (seats: number) => `${seats} seat${seats === 1 ? "" : "s"}`
const isGlazed = (zone: string) => zone === "window" || zone === "garden" || zone === "terrace"
const capitalise = (zone: string) => zone.charAt(0).toUpperCase() + zone.slice(1)

/** Which piece of furniture a table is. Derived from seats and zone rather than stored, so a
 *  reseeded layout still draws a believable room: deuces at the glass are round, the hall is
 *  laid with square tops, the lounge is booths, and anything long is communal. */
export function furnitureKind(table: AvailableTable): FurnitureKind {
  if (table.seats >= 7) return "communal"
  if (table.seats <= 2) return isGlazed(table.zone) ? "round" : "booth"
  if (table.seats <= 4) return isGlazed(table.zone) ? "banquette" : "square"
  return isGlazed(table.zone) ? "banquette" : "round"
}

export function tableFurniture(table: AvailableTable): TableFurniture {
  const kind = furnitureKind(table)
  const zoneTag = capitalise(table.zone)

  switch (kind) {
    case "round": {
      const r = roundRadius(table.seats)
      const reach = seatReach(r, false)
      return {
        kind,
        top: { w: r * 2, h: r * 2, round: true },
        chairs: ring(table.seats, r),
        benches: [],
        reach: { x: reach, y: reach },
        description: `Round table, ${seatWord(table.seats)}.`,
        tags: ["Round", zoneTag, seatWord(table.seats)],
      }
    }

    case "square": {
      const size = table.seats <= 2 ? 48 : 66
      const half = size / 2
      const anchor = half + SEAT_GAP
      // Two chairs face each other across a deuce; a four-top gets one on every side.
      const chairs: Chair[] =
        table.seats <= 2
          ? [
              { x: -anchor, y: 0, rotation: -90 },
              { x: anchor, y: 0, rotation: 90 },
            ]
          : [
              { x: 0, y: -anchor, rotation: 0 },
              { x: anchor, y: 0, rotation: 90 },
              { x: 0, y: anchor, rotation: 180 },
              { x: -anchor, y: 0, rotation: -90 },
            ]
      const reach = seatReach(half, false)
      return {
        kind,
        top: { w: size, h: size, round: false },
        chairs,
        benches: [],
        reach: { x: reach, y: reach },
        description:
          table.seats <= 2
            ? "Square 2-top, two chairs facing."
            : `Square table, ${seatWord(table.seats)} — one on each side.`,
        tags: ["Square", zoneTag, seatWord(table.seats)],
      }
    }

    case "booth": {
      const w = table.seats <= 2 ? 74 : 92
      const h = 44
      const anchor = h / 2 + SEAT_GAP
      return {
        kind,
        top: { w, h, round: false },
        chairs: [],
        benches: [
          { x: 0, y: -anchor, w: w + 6, rotation: 0, back: true },
          { x: 0, y: anchor, w: w + 6, rotation: 180, back: true },
        ],
        reach: { x: (w + 6 + BENCH.backOverhang) / 2, y: seatReach(h / 2, true) },
        description: "Booth — sofa benches on both sides of a fixed table.",
        tags: ["Booth", "Sofa", zoneTag],
      }
    }

    case "banquette": {
      const w = table.seats <= 4 ? 118 : 152
      const h = 56
      const anchor = h / 2 + SEAT_GAP
      const opposite = Math.max(2, table.seats - 2)
      const along = table.zone === "window" ? "window" : table.zone
      return {
        kind,
        top: { w, h, round: false },
        chairs: row(opposite, w, anchor, 180),
        benches: [{ x: 0, y: -anchor, w: w + 8, rotation: 0, back: true }],
        reach: { x: (w + 8 + BENCH.backOverhang) / 2, y: seatReach(h / 2, true) },
        description: `Long table — banquette sofa along the ${along}, ${opposite} chairs opposite.`,
        tags: ["Sofa", zoneTag, "Long table"],
      }
    }

    case "communal": {
      const w = 26 * table.seats
      const h = 62
      const anchor = h / 2 + 14
      return {
        kind,
        top: { w, h, round: false },
        chairs: [],
        benches: [
          { x: 0, y: -anchor, w: w - 20, rotation: 0, back: false },
          { x: 0, y: anchor, w: w - 20, rotation: 180, back: false },
        ],
        reach: { x: w / 2, y: anchor + BENCH.seatInset + BENCH.seatHeight },
        description: `Communal long table, bench seating for ${table.seats} — shared with other parties.`,
        tags: ["Benches", "Communal", "Long table"],
      }
    }
  }
}
