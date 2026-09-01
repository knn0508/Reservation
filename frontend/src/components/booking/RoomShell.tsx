import type { Doorway, Fixture, FloorPlanSpec, Opening, Wall } from "../../lib/floorPlan"
import { UNITS_PER_METRE } from "../../lib/floorPlan"

/** The static, architectural half of the plan: walls, glazing, door swings, fixed furniture
 *  and the drawing annotations. Nothing here reacts to availability — tables are drawn on top
 *  by FloorPlan, so this layer stays a pure function of the room spec. */

const FONT = "Outfit, ui-sans-serif, system-ui, sans-serif"

/** Blank sheet around the room, and the extra strip below it that holds the title block. */
export const SHEET_MARGIN = 22
export const SHEET_FOOTER = 62

export const sheetViewBox = (spec: FloorPlanSpec) =>
  `${-SHEET_MARGIN} ${-SHEET_MARGIN} ${spec.room.w + SHEET_MARGIN * 2} ${spec.room.h + SHEET_MARGIN + SHEET_FOOTER}`

const INK = "#211b17"
const CREAM = "#faf7f1"
const EMBER = "#c05f34"
const MOSS = "#6b7d5e"

/** Unit vector pointing from a wall into the room. */
const INWARD: Record<Wall, { x: number; y: number }> = {
  north: { x: 0, y: 1 },
  south: { x: 0, y: -1 },
  west: { x: 1, y: 0 },
  east: { x: -1, y: 0 },
}

const isHorizontal = (wall: Wall) => wall === "north" || wall === "south"

/** A point on `wall`, `along` units from the top-left corner of the room and `depth` units in
 *  from the outer face. Lets openings and door swings be written once for all four walls. */
function pointOn(spec: FloorPlanSpec, wall: Wall, along: number, depth: number) {
  const { w, h } = spec.room
  switch (wall) {
    case "north":
      return { x: along, y: depth }
    case "south":
      return { x: along, y: h - depth }
    case "west":
      return { x: depth, y: along }
    case "east":
      return { x: w - depth, y: along }
  }
}

/** The slab of wall an opening removes. */
function openingRect(spec: FloorPlanSpec, o: Opening) {
  const { w, h, wall: t } = spec.room
  const span = o.to - o.from
  switch (o.wall) {
    case "north":
      return { x: o.from, y: 0, w: span, h: t }
    case "south":
      return { x: o.from, y: h - t, w: span, h: t }
    case "west":
      return { x: 0, y: o.from, w: t, h: span }
    case "east":
      return { x: w - t, y: o.from, w: t, h: span }
  }
}

/** Caption placement for an opening: just inside the room, centred on the gap. */
function labelAnchor(spec: FloorPlanSpec, o: Opening, gap: number) {
  const mid = (o.from + o.to) / 2
  const p = pointOn(spec, o.wall, mid, spec.room.wall + gap)
  return { ...p, rotate: isHorizontal(o.wall) ? 0 : o.wall === "west" ? 90 : -90 }
}

function WindowRun({ spec, run }: { spec: FloorPlanSpec; run: Opening }) {
  const t = spec.room.wall
  const rect = openingRect(spec, run)
  const horizontal = isHorizontal(run.wall)
  const inward = INWARD[run.wall]
  const span = run.to - run.from

  // Glass sits in the middle third of the wall thickness, with a frame line on each face.
  const inset = t * 0.34
  const glass = horizontal
    ? { x: rect.x, y: rect.y + inset, w: span, h: t - inset * 2 }
    : { x: rect.x + inset, y: rect.y, w: t - inset * 2, h: span }

  // A mullion every ~135 units, so long runs read as a series of panes.
  const panes = Math.max(2, Math.round(span / 135))
  const mullions = Array.from({ length: panes - 1 }, (_, i) => run.from + (span * (i + 1)) / panes)

  // Daylight spilling onto the floor, fading away from the glass.
  const spill = 120
  const inner = pointOn(spec, run.wall, run.from, t)
  const light = horizontal
    ? { x: run.from, y: Math.min(inner.y, inner.y + inward.y * spill), w: span, h: spill }
    : { x: Math.min(inner.x, inner.x + inward.x * spill), y: run.from, w: spill, h: span }

  return (
    <g>
      <rect x={light.x} y={light.y} width={light.w} height={light.h} fill={`url(#fp-daylight-${run.wall})`} />
      <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill={CREAM} />
      <rect x={glass.x} y={glass.y} width={glass.w} height={glass.h} fill="url(#fp-glass)" />
      <g stroke="rgba(33,27,23,0.5)" strokeWidth={1.6} strokeLinecap="square">
        {horizontal ? (
          <>
            <line x1={rect.x} y1={rect.y + 1} x2={rect.x + span} y2={rect.y + 1} />
            <line x1={rect.x} y1={rect.y + t - 1} x2={rect.x + span} y2={rect.y + t - 1} />
          </>
        ) : (
          <>
            <line x1={rect.x + 1} y1={rect.y} x2={rect.x + 1} y2={rect.y + span} />
            <line x1={rect.x + t - 1} y1={rect.y} x2={rect.x + t - 1} y2={rect.y + span} />
          </>
        )}
      </g>
      <g stroke="rgba(33,27,23,0.38)" strokeWidth={1.4}>
        {mullions.map((at) => {
          const a = pointOn(spec, run.wall, at, 0)
          const b = pointOn(spec, run.wall, at, t)
          return <line key={at} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
        })}
      </g>
    </g>
  )
}

function DoorSwing({ spec, door }: { spec: FloorPlanSpec; door: Doorway }) {
  const t = spec.room.wall
  const rect = openingRect(spec, door)
  const n = INWARD[door.wall]
  const span = door.to - door.from
  const mid = (door.from + door.to) / 2

  // One leaf per hinge: a line from the hinge into the room, closed by the quarter circle it
  // sweeps. Double doors hinge at both jambs and meet in the middle.
  const leaves: { hinge: number; jamb: number }[] =
    door.leaves === 2
      ? [
          { hinge: door.from, jamb: mid },
          { hinge: door.to, jamb: mid },
        ]
      : [{ hinge: door.from, jamb: door.to }]

  return (
    <g>
      <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill={CREAM} />
      {leaves.map(({ hinge, jamb }) => {
        const H = pointOn(spec, door.wall, hinge, t)
        const F = pointOn(spec, door.wall, jamb, t)
        const r = Math.abs(jamb - hinge)
        const L = { x: H.x + n.x * r, y: H.y + n.y * r }
        // Screen-space cross product picks the arc direction that stays inside the room.
        const cross = (F.x - H.x) * (L.y - H.y) - (F.y - H.y) * (L.x - H.x)
        return (
          <g key={hinge}>
            <path
              d={`M ${F.x} ${F.y} A ${r} ${r} 0 0 ${cross > 0 ? 1 : 0} ${L.x} ${L.y}`}
              fill="none"
              stroke={door.kind === "main" ? "rgba(192,95,52,0.45)" : "rgba(33,27,23,0.22)"}
              strokeWidth={1.5}
              strokeDasharray="7 5"
            />
            <line
              x1={H.x}
              y1={H.y}
              x2={L.x}
              y2={L.y}
              stroke={door.kind === "main" ? EMBER : "rgba(33,27,23,0.45)"}
              strokeWidth={4}
              strokeLinecap="round"
            />
          </g>
        )
      })}
      {/* Threshold, so the gap still reads as a doorway when the swing is faint. */}
      <line
        x1={isHorizontal(door.wall) ? rect.x : rect.x + t / 2}
        y1={isHorizontal(door.wall) ? rect.y + t / 2 : rect.y}
        x2={isHorizontal(door.wall) ? rect.x + span : rect.x + t / 2}
        y2={isHorizontal(door.wall) ? rect.y + t / 2 : rect.y + span}
        stroke={door.kind === "main" ? "rgba(192,95,52,0.5)" : "rgba(33,27,23,0.28)"}
        strokeWidth={3}
        strokeLinecap="round"
      />
    </g>
  )
}

/** Which side of a fixture opens onto the room — decides where the counter front and stools go. */
function inferFacing(spec: FloorPlanSpec, f: Fixture): Wall {
  const dx = spec.room.w / 2 - (f.x + f.w / 2)
  const dy = spec.room.h / 2 - (f.y + f.h / 2)
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "east" : "west"
  return dy > 0 ? "south" : "north"
}

function FixtureLabel({ f, size = 15 }: { f: Fixture; size?: number }) {
  if (!f.label) return null
  const cx = f.x + f.w / 2
  const cy = f.y + f.h / 2
  return (
    <text
      x={cx}
      y={cy}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={size}
      fontFamily={FONT}
      fontWeight={600}
      letterSpacing={2.4}
      fill="rgba(95,81,72,0.82)"
      transform={f.vertical ? `rotate(-90 ${cx} ${cy})` : undefined}
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      {f.label.toUpperCase()}
    </text>
  )
}

function FixtureShape({ spec, f }: { spec: FloorPlanSpec; f: Fixture }) {
  const facing = f.facing ?? inferFacing(spec, f)
  const frontIsHorizontal = facing === "north" || facing === "south"

  // The service edge: a band along the room-facing side, with the stool line just beyond it.
  const depth = 9
  const front = {
    north: { x: f.x, y: f.y, w: f.w, h: depth },
    south: { x: f.x, y: f.y + f.h - depth, w: f.w, h: depth },
    west: { x: f.x, y: f.y, w: depth, h: f.h },
    east: { x: f.x + f.w - depth, y: f.y, w: depth, h: f.h },
  }[facing]

  const outward = INWARD[
    facing === "north" ? "south" : facing === "south" ? "north" : facing === "west" ? "east" : "west"
  ]
  const stoolSpan = frontIsHorizontal ? f.w : f.h
  const stoolCount = Math.max(2, Math.floor(stoolSpan / 62))
  const stools = Array.from({ length: stoolCount }, (_, i) => {
    const at = (stoolSpan * (i + 0.5)) / stoolCount
    const base = frontIsHorizontal
      ? { x: f.x + at, y: facing === "north" ? f.y : f.y + f.h }
      : { x: facing === "west" ? f.x : f.x + f.w, y: f.y + at }
    return { cx: base.x + outward.x * 20, cy: base.y + outward.y * 20 }
  })

  switch (f.kind) {
    case "kitchen":
      return (
        <g>
          <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={6} fill="rgba(33,27,23,0.05)" />
          <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={6} fill="url(#fp-hatch)" />
          <rect
            x={f.x}
            y={f.y}
            width={f.w}
            height={f.h}
            rx={6}
            fill="none"
            stroke="rgba(33,27,23,0.28)"
            strokeWidth={2}
          />
          {/* Pass-through to the dining room. */}
          <rect
            x={frontIsHorizontal ? f.x + f.w * 0.28 : front.x - 2}
            y={frontIsHorizontal ? front.y - 2 : f.y + f.h * 0.28}
            width={frontIsHorizontal ? f.w * 0.44 : depth + 4}
            height={frontIsHorizontal ? depth + 4 : f.h * 0.44}
            rx={4}
            fill={CREAM}
            stroke="rgba(33,27,23,0.3)"
            strokeWidth={1.5}
          />
          <FixtureLabel f={f} />
        </g>
      )

    case "bar":
      return (
        <g>
          {f.stools !== false &&
            stools.map((s, i) => (
              <circle
                key={i}
                cx={s.cx}
                cy={s.cy}
                r={11}
                fill="rgba(33,27,23,0.13)"
                stroke="rgba(33,27,23,0.18)"
                strokeWidth={1.2}
              />
            ))}
          <rect
            x={f.x}
            y={f.y}
            width={f.w}
            height={f.h}
            rx={8}
            fill="rgba(33,27,23,0.07)"
            stroke="rgba(33,27,23,0.24)"
            strokeWidth={2}
          />
          <rect x={front.x} y={front.y} width={front.w} height={front.h} rx={4} fill="rgba(33,27,23,0.26)" />
          <FixtureLabel f={f} />
        </g>
      )

    case "reception":
      return (
        <g>
          <rect
            x={f.x}
            y={f.y}
            width={f.w}
            height={f.h}
            rx={10}
            fill="rgba(192,95,52,0.10)"
            stroke="rgba(192,95,52,0.42)"
            strokeWidth={2.2}
          />
          <rect x={front.x} y={front.y} width={front.w} height={front.h} rx={4} fill="rgba(192,95,52,0.5)" />
          {/* The host stands behind the desk, on the side away from the room. */}
          <circle
            cx={frontIsHorizontal ? f.x + f.w / 2 : facing === "west" ? f.x + f.w + 22 : f.x - 22}
            cy={frontIsHorizontal ? (facing === "north" ? f.y + f.h + 22 : f.y - 22) : f.y + f.h / 2}
            r={11}
            fill="rgba(33,27,23,0.10)"
            stroke="rgba(33,27,23,0.18)"
            strokeWidth={1.2}
          />
          <text
            x={f.x + f.w / 2}
            y={f.y + f.h / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={15}
            fontFamily={FONT}
            fontWeight={700}
            letterSpacing={2.6}
            fill="rgba(163,74,38,0.95)"
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            {(f.label ?? "Reception").toUpperCase()}
          </text>
        </g>
      )

    case "restroom":
    case "service":
      return (
        <g>
          <rect
            x={f.x}
            y={f.y}
            width={f.w}
            height={f.h}
            rx={6}
            fill="rgba(33,27,23,0.035)"
            stroke="rgba(33,27,23,0.2)"
            strokeWidth={1.8}
            strokeDasharray={f.kind === "service" ? "8 6" : undefined}
          />
          {f.kind === "restroom" && (
            <line
              x1={f.x + f.w / 2}
              y1={f.y + 10}
              x2={f.x + f.w / 2}
              y2={f.y + f.h - 10}
              stroke="rgba(33,27,23,0.16)"
              strokeWidth={1.5}
            />
          )}
          <FixtureLabel f={f} size={f.kind === "restroom" ? 17 : 14} />
        </g>
      )

    case "planter": {
      const cx = f.x + f.w / 2
      const cy = f.y + f.h / 2
      const r = Math.min(f.w, f.h) / 2
      return (
        <g>
          <circle cx={cx} cy={cy} r={r} fill="rgba(107,125,94,0.13)" stroke="rgba(107,125,94,0.32)" strokeWidth={1.6} />
          <circle cx={cx - r * 0.28} cy={cy - r * 0.2} r={r * 0.42} fill="rgba(107,125,94,0.42)" />
          <circle cx={cx + r * 0.3} cy={cy - r * 0.06} r={r * 0.36} fill="rgba(107,125,94,0.32)" />
          <circle cx={cx - r * 0.02} cy={cy + r * 0.32} r={r * 0.33} fill="rgba(107,125,94,0.36)" />
        </g>
      )
    }
  }
}

/** Scale bar, north point and drawing caption — the marks that make it read as a plan. The
 *  title block sits in the sheet margin below the room, so it can never collide with furniture. */
function Annotations({ spec }: { spec: FloorPlanSpec }) {
  const metres = 3
  const barW = metres * UNITS_PER_METRE
  const strip = spec.room.h + SHEET_MARGIN + 16
  // Stops short of the right edge, which the zoom controls overlay.
  const x = spec.room.w - barW - 120

  return (
    <g style={{ pointerEvents: "none", userSelect: "none" }}>
      <line
        x1={0}
        y1={spec.room.h + SHEET_MARGIN - 6}
        x2={spec.room.w}
        y2={spec.room.h + SHEET_MARGIN - 6}
        stroke="rgba(33,27,23,0.14)"
        strokeWidth={1.2}
      />

      <g transform={`translate(${x} ${strip})`}>
        <g stroke="rgba(33,27,23,0.55)" strokeWidth={1.6}>
          <line x1={0} y1={0} x2={barW} y2={0} />
          <line x1={0} y1={-5} x2={0} y2={5} />
          <line x1={barW / 2} y1={-4} x2={barW / 2} y2={4} />
          <line x1={barW} y1={-5} x2={barW} y2={5} />
        </g>
        <rect x={0} y={-3.5} width={barW / 2} height={7} fill="rgba(33,27,23,0.55)" />
        <text
          x={barW / 2}
          y={15}
          textAnchor="middle"
          fontSize={11}
          fontFamily={FONT}
          letterSpacing={1.2}
          fill="rgba(95,81,72,0.8)"
        >
          {metres} M
        </text>
        <text x={-14} y={0} textAnchor="end" dominantBaseline="central" fontSize={11} fontFamily={FONT} fill="rgba(95,81,72,0.55)">
          SCALE
        </text>
      </g>

      <g transform={`translate(${spec.room.wall + 44} ${spec.room.wall + 44})`}>
        <circle r={19} fill="rgba(251,248,243,0.85)" stroke="rgba(33,27,23,0.16)" strokeWidth={1.2} />
        <path d="M 0 -12 L 5.5 7 L 0 3 L -5.5 7 Z" fill="rgba(33,27,23,0.62)" />
        <text
          x={0}
          y={14.5}
          textAnchor="middle"
          fontSize={9}
          fontWeight={700}
          fontFamily={FONT}
          fill="rgba(95,81,72,0.85)"
        >
          N
        </text>
      </g>

      <text
        x={0}
        y={strip}
        dominantBaseline="central"
        fontSize={13}
        fontFamily={FONT}
        fontWeight={500}
        letterSpacing={2.6}
        fill="rgba(95,81,72,0.62)"
      >
        {spec.caption.toUpperCase()}
      </text>
    </g>
  )
}

export function RoomShellDefs() {
  return (
    <defs>
      <pattern id="fp-grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M40 0H0V40" fill="none" stroke="rgba(33,27,23,0.05)" strokeWidth={1} />
      </pattern>
      <pattern id="fp-grid-major" width="200" height="200" patternUnits="userSpaceOnUse">
        <path d="M200 0H0V200" fill="none" stroke="rgba(33,27,23,0.085)" strokeWidth={1.3} />
      </pattern>
      <pattern id="fp-hatch" width="11" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1={0} y1={0} x2={0} y2={11} stroke="rgba(33,27,23,0.16)" strokeWidth={2.4} />
      </pattern>
      <linearGradient id="fp-glass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={MOSS} stopOpacity={0.34} />
        <stop offset="100%" stopColor={MOSS} stopOpacity={0.14} />
      </linearGradient>
      {(["north", "south", "east", "west"] as const).map((wall) => {
        const [x1, y1, x2, y2] =
          wall === "north"
            ? [0, 0, 0, 1]
            : wall === "south"
              ? [0, 1, 0, 0]
              : wall === "west"
                ? [0, 0, 1, 0]
                : [1, 0, 0, 0]
        return (
          <linearGradient key={wall} id={`fp-daylight-${wall}`} x1={x1} y1={y1} x2={x2} y2={y2}>
            <stop offset="0%" stopColor="#f2e8cf" stopOpacity={0.7} />
            <stop offset="100%" stopColor="#f2e8cf" stopOpacity={0} />
          </linearGradient>
        )
      })}
      <filter id="fp-chip-shadow" x="-30%" y="-50%" width="160%" height="220%">
        <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor={INK} floodOpacity="0.24" />
      </filter>
    </defs>
  )
}

export function RoomShell({ spec }: { spec: FloorPlanSpec }) {
  const { w, h, wall: t } = spec.room

  return (
    <g>
      {/* Floor slab and its survey grid. */}
      <rect x={t} y={t} width={w - t * 2} height={h - t * 2} fill={CREAM} />
      <rect x={t} y={t} width={w - t * 2} height={h - t * 2} fill="url(#fp-grid)" />
      <rect x={t} y={t} width={w - t * 2} height={h - t * 2} fill="url(#fp-grid-major)" />

      {/* Poché: the wall ring, drawn solid the way a plan section is. */}
      <path d={`M0 0H${w}V${h}H0Z M${t} ${t}H${w - t}V${h - t}H${t}Z`} fillRule="evenodd" fill={INK} opacity={0.88} />
      <rect
        x={t}
        y={t}
        width={w - t * 2}
        height={h - t * 2}
        fill="none"
        stroke="rgba(251,248,243,0.28)"
        strokeWidth={1}
      />

      {spec.windows.map((run, i) => (
        <WindowRun key={`win-${i}`} spec={spec} run={run} />
      ))}
      {spec.doors.map((door, i) => (
        <DoorSwing key={`door-${i}`} spec={spec} door={door} />
      ))}

      {spec.fixtures.map((f, i) => (
        <FixtureShape key={`fix-${i}`} spec={spec} f={f} />
      ))}

      {/* Opening captions last, so no fixture draws over them. */}
      <g style={{ pointerEvents: "none", userSelect: "none" }}>
        {[...spec.windows, ...spec.doors]
          .filter((o) => o.label)
          .map((o, i) => {
            const a = labelAnchor(spec, o, 20)
            const main = "kind" in o && o.kind === "main"
            return (
              <text
                key={`lbl-${i}`}
                x={a.x}
                y={a.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={12}
                fontFamily={FONT}
                fontWeight={600}
                letterSpacing={2.6}
                fill={main ? "rgba(163,74,38,0.9)" : "rgba(95,81,72,0.7)"}
                transform={a.rotate ? `rotate(${a.rotate} ${a.x} ${a.y})` : undefined}
              >
                {o.label!.toUpperCase()}
              </text>
            )
          })}
      </g>

      <Annotations spec={spec} />
    </g>
  )
}
