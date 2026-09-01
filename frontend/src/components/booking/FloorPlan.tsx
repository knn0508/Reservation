import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ArrowCounterClockwise, MagnifyingGlassMinus, MagnifyingGlassPlus, X } from "@phosphor-icons/react"
import type { AvailableTable } from "../../lib/api"
import { DEFAULT_ZONE_TONE, ZONE_TONE, getFloorPlan, type FloorPlanSpec } from "../../lib/floorPlan"
import { BENCH, CHAIR, tableFurniture, type Bench, type Chair, type TableFurniture } from "../../lib/tableFurniture"
import { RoomShell, RoomShellDefs, sheetViewBox } from "./RoomShell"

/** A seating plan of the real dining room. The room shell comes from the per-restaurant spec in
 *  lib/floorPlan; the tables come from live availability and are placed by mapping their
 *  pos_x/pos_y percentages onto the spec's floor rectangle, so one layout renders at any size.
 *
 *  Each table is drawn as its actual furniture (lib/tableFurniture) rather than as an icon, and
 *  a table that is too small for the party dims instead of disappearing — so the room a guest
 *  sees here is the room they walk into. */

const FONT = "Outfit, ui-sans-serif, system-ui, sans-serif"

const MAX_ZOOM = 2.6
const ZOOM_STEP = 0.45
const TOAST_MS = 2800

/** `wrongSize` tables belong to the room but not to this party size — drawn as furniture only. */
type TableState = "available" | "hovered" | "selected" | "taken" | "wrongSize"

interface Tone {
  top: string
  edge: string
  edgeWidth: number
  chair: string
  label: string
  opacity: number
}

const PALETTE: Record<TableState, Tone> = {
  available: { top: "#f7f0e4", edge: "#211b17", edgeWidth: 2.2, chair: "rgba(33,27,23,0.34)", label: "#191512", opacity: 1 },
  hovered: { top: "#fffdf8", edge: "#c05f34", edgeWidth: 3, chair: "rgba(192,95,52,0.6)", label: "#191512", opacity: 1 },
  selected: { top: "#c05f34", edge: "#7a3116", edgeWidth: 3, chair: "#c05f34", label: "#fbf8f3", opacity: 1 },
  taken: { top: "url(#fp-booked)", edge: "rgba(33,27,23,0.22)", edgeWidth: 2, chair: "rgba(33,27,23,0.12)", label: "rgba(95,81,72,0.55)", opacity: 1 },
  wrongSize: { top: "#f4ede2", edge: "rgba(33,27,23,0.3)", edgeWidth: 1.8, chair: "rgba(33,27,23,0.24)", label: "rgba(95,81,72,0.8)", opacity: 0.32 },
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Booked tables are hatched rather than greyed out, the way a plan marks a slab that is
 *  already spoken for — it stays legible as furniture while reading clearly as unavailable. */
function TableDefs() {
  return (
    <defs>
      <pattern id="fp-booked" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="14" height="14" fill="#f1e8da" />
        <line x1={0} y1={0} x2={0} y2={14} stroke="rgba(33,27,23,0.16)" strokeWidth={4.5} />
      </pattern>
    </defs>
  )
}

function ChairGlyph({ chair, fill }: { chair: Chair; fill: string }) {
  return (
    <g transform={`translate(${chair.x} ${chair.y}) rotate(${chair.rotation})`} fill={fill}>
      <rect x={CHAIR.back.x} y={CHAIR.back.y} width={CHAIR.back.w} height={CHAIR.back.h} rx={3} />
      <rect x={CHAIR.seat.x} y={CHAIR.seat.y} width={CHAIR.seat.w} height={CHAIR.seat.h} rx={4} />
    </g>
  )
}

function BenchGlyph({ bench, fill }: { bench: Bench; fill: string }) {
  const backWidth = bench.w + BENCH.backOverhang
  return (
    <g transform={`translate(${bench.x} ${bench.y}) rotate(${bench.rotation})`} fill={fill}>
      {bench.back && (
        <rect
          x={-backWidth / 2}
          y={BENCH.backInset}
          width={backWidth}
          height={BENCH.backHeight}
          rx={3}
        />
      )}
      <rect x={-bench.w / 2} y={BENCH.seatInset} width={bench.w} height={BENCH.seatHeight} rx={5} />
    </g>
  )
}

function TableGlyph({
  table,
  furniture,
  state,
  cx,
  cy,
  onActivate,
  onFocusChange,
  index,
  animate,
}: {
  table: AvailableTable
  furniture: TableFurniture
  state: TableState
  cx: number
  cy: number
  onActivate: () => void
  onFocusChange: (id: number | null) => void
  index: number
  animate: boolean
}) {
  const c = PALETTE[state]
  const clickable = table.fits && table.available
  const { top } = furniture
  const lifted = state !== "taken" && state !== "wrongSize"

  const status = !table.fits
    ? "not offered for this party size"
    : table.available
      ? "available"
      : "already booked"

  return (
    <motion.g
      role="button"
      tabIndex={clickable ? 0 : -1}
      aria-disabled={!clickable}
      aria-pressed={state === "selected"}
      aria-label={`Table ${table.table_number}, ${table.seats} seats, ${table.zone} zone, ${furniture.kind}, ${status}`}
      onClick={onActivate}
      onKeyDown={(event) => {
        if (clickable && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault()
          onActivate()
        }
      }}
      onMouseEnter={() => onFocusChange(table.id)}
      onMouseLeave={() => onFocusChange(null)}
      onFocus={() => onFocusChange(table.id)}
      onBlur={() => onFocusChange(null)}
      style={{
        cursor: clickable ? "pointer" : "default",
        outline: "none",
        transformOrigin: `${cx}px ${cy}px`,
      }}
      initial={animate ? { opacity: 0, scale: 0.9 } : false}
      animate={{ opacity: c.opacity, scale: 1 }}
      transition={{ delay: animate ? Math.min(index, 16) * 0.022 : 0, type: "spring", stiffness: 380, damping: 30 }}
    >
      <g transform={`translate(${cx} ${cy})`}>
        {state === "selected" && (
          <circle
            r={Math.max(furniture.reach.x, furniture.reach.y) + 16}
            fill="none"
            stroke="#c05f34"
            strokeWidth={1.6}
            strokeDasharray="9 7"
            opacity={0.7}
          />
        )}

        {/* Seating first, so the tabletop always reads as sitting on top of it. */}
        {furniture.benches.map((bench, i) => (
          <BenchGlyph key={`b${i}`} bench={bench} fill={c.chair} />
        ))}
        {furniture.chairs.map((chair, i) => (
          <ChairGlyph key={`c${i}`} chair={chair} fill={c.chair} />
        ))}

        {/* A flat offset copy stands in for a drop shadow — a blur filter per table is far too
            expensive to rasterise once a full room is on screen. */}
        {lifted &&
          (top.round ? (
            <circle cy={3.5} r={top.w / 2} fill="rgba(33,27,23,0.18)" />
          ) : (
            <rect
              x={-top.w / 2}
              y={-top.h / 2 + 3.5}
              width={top.w}
              height={top.h}
              rx={9}
              fill="rgba(33,27,23,0.18)"
            />
          ))}

        {top.round ? (
          <circle r={top.w / 2} fill={c.top} stroke={c.edge} strokeWidth={c.edgeWidth} />
        ) : (
          <rect
            x={-top.w / 2}
            y={-top.h / 2}
            width={top.w}
            height={top.h}
            rx={9}
            fill={c.top}
            stroke={c.edge}
            strokeWidth={c.edgeWidth}
          />
        )}

        <text
          textAnchor="middle"
          dominantBaseline="central"
          fill={c.label}
          fontSize={16}
          fontWeight={state === "taken" || state === "wrongSize" ? 500 : 700}
          fontFamily={FONT}
          letterSpacing={0.4}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {table.table_number}
        </text>

        {state === "selected" && (
          <g transform={`translate(${top.w / 2 - 4} ${-top.h / 2 - 4})`} style={{ pointerEvents: "none" }}>
            <circle r={12} fill="#191512" />
            <path
              d="M -5 0 L -1.5 3.6 L 5.2 -3.4"
              fill="none"
              stroke="#fbf8f3"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        )}

        {/* Generous invisible hit area, so tables stay easy to tap on a phone. */}
        <rect
          x={-furniture.reach.x - 10}
          y={-furniture.reach.y - 10}
          width={furniture.reach.x * 2 + 20}
          height={furniture.reach.y * 2 + 20}
          fill="transparent"
        />
      </g>
    </motion.g>
  )
}

/** Floating caption for the table under the cursor. Sized from the text length, since SVG has
 *  no intrinsic layout, and flipped below the table when it would clip the top wall. */
function TableChip({
  table,
  furniture,
  cx,
  cy,
  room,
}: {
  table: AvailableTable
  furniture: TableFurniture
  cx: number
  cy: number
  room: { w: number; h: number }
}) {
  const status = !table.fits ? "Other party size" : table.available ? "Available" : "Booked"
  const text = `${table.table_number} · ${table.seats} seats · ${table.zone}`
  const w = Math.max(190, text.length * 7.4 + status.length * 6.6 + 62)
  const h = 34
  const gap = furniture.reach.y + 22
  const below = cy - gap - h < 6
  const x = clamp(cx - w / 2, 8, room.w - w - 8)
  const y = below ? cy + gap : cy - gap - h
  const dotColor = !table.fits ? "rgba(95,81,72,0.35)" : table.available ? "#6b7d5e" : "rgba(163,67,47,0.6)"
  const tip = clamp(cx, x + 18, x + w - 18)

  return (
    <g style={{ pointerEvents: "none" }}>
      <rect x={x} y={y} width={w} height={h} rx={17} fill="#191512" filter="url(#fp-chip-shadow)" />
      <path
        d={
          below
            ? `M ${tip - 7} ${y} L ${tip} ${y - 8} L ${tip + 7} ${y} Z`
            : `M ${tip - 7} ${y + h} L ${tip} ${y + h + 8} L ${tip + 7} ${y + h} Z`
        }
        fill="#191512"
      />
      <circle cx={x + 17} cy={y + h / 2} r={4.5} fill={dotColor} />
      <text x={x + 29} y={y + h / 2} dominantBaseline="central" fontSize={13} fontFamily={FONT} fill="#fbf8f3">
        <tspan fontWeight={700}>{table.table_number}</tspan>
        <tspan fill="rgba(251,248,243,0.62)">{`  ${table.seats} seats · `}</tspan>
        <tspan fill="rgba(251,248,243,0.62)" style={{ textTransform: "capitalize" }}>
          {table.zone}
        </tspan>
        <tspan fill="rgba(251,248,243,0.35)">{"  ·  "}</tspan>
        <tspan fontWeight={600} fill={dotColor === "#6b7d5e" ? "#a7bb96" : "rgba(251,248,243,0.7)"}>
          {status}
        </tspan>
      </text>
    </g>
  )
}

interface Band {
  zone: string
  top: number
  bottom: number
  free: number
  total: number
}

/** Zone bands are derived from where the tables actually sit, not hard-coded, so a reseeded
 *  layout can never leave a band floating over empty floor. Adjacent bands that would overlap
 *  after padding are split at the midpoint between the two rows of tables. */
function zoneBands(tables: AvailableTable[], floor: FloorPlanSpec["floor"]): Band[] {
  const groups = new Map<string, { min: number; max: number; free: number; total: number }>()
  for (const table of tables) {
    const y = floor.y + (table.pos_y / 100) * floor.h
    const g = groups.get(table.zone)
    const free = table.fits && table.available ? 1 : 0
    const fits = table.fits ? 1 : 0
    if (g) {
      g.min = Math.min(g.min, y)
      g.max = Math.max(g.max, y)
      g.free += free
      g.total += fits
    } else {
      groups.set(table.zone, { min: y, max: y, free, total: fits })
    }
  }

  const raw = [...groups.entries()]
    .map(([zone, g]) => ({ zone, ...g }))
    .sort((a, b) => (a.min + a.max) / 2 - (b.min + b.max) / 2)

  const pad = 66
  const bands: Band[] = raw.map((g) => ({ zone: g.zone, top: g.min - pad, bottom: g.max + pad, free: g.free, total: g.total }))
  for (let i = 1; i < bands.length; i++) {
    if (bands[i].top < bands[i - 1].bottom) {
      const mid = (raw[i - 1].max + raw[i].min) / 2
      bands[i - 1].bottom = mid - 5
      bands[i].top = mid + 5
    }
  }
  return bands
}

/** What every mark on the plan means, drawn with the same shapes the plan uses. */
function Legend() {
  const item = "flex items-center gap-1.5"
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink-900/8 bg-parchment-100/40 px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-600/75 sm:px-5">
      <span className={item}>
        <svg width="15" height="15" aria-hidden="true">
          <rect x="1.5" y="1.5" width="12" height="12" rx="2.5" fill="#f7f0e4" stroke="#211b17" strokeWidth="2" />
        </svg>
        Free
      </span>
      <span className={item}>
        <svg width="15" height="15" aria-hidden="true">
          <defs>
            <pattern id="fp-legend-booked" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="7" height="7" fill="#f1e8da" />
              <line x1="0" y1="0" x2="0" y2="7" stroke="rgba(33,27,23,0.22)" strokeWidth="2.4" />
            </pattern>
          </defs>
          <rect
            x="1.5"
            y="1.5"
            width="12"
            height="12"
            rx="2.5"
            fill="url(#fp-legend-booked)"
            stroke="rgba(33,27,23,0.3)"
            strokeWidth="1.6"
          />
        </svg>
        Booked
      </span>
      <span className={item}>
        <svg width="15" height="15" aria-hidden="true">
          <rect x="1.5" y="1.5" width="12" height="12" rx="2.5" fill="#c05f34" stroke="#7a3116" strokeWidth="2" />
        </svg>
        Yours
      </span>
      <span className={item}>
        <svg width="15" height="15" aria-hidden="true" opacity="0.32">
          <rect x="1.5" y="1.5" width="12" height="12" rx="2.5" fill="#f4ede2" stroke="rgba(33,27,23,0.4)" strokeWidth="1.6" />
        </svg>
        Other size
      </span>
      <span className={item}>
        <svg width="15" height="15" aria-hidden="true">
          <rect x="4" y="1.5" width="7" height="12" fill="rgba(107,125,94,0.28)" stroke="#211b17" strokeWidth="1.5" />
        </svg>
        Window
      </span>
      <span className={item}>
        <svg width="15" height="15" aria-hidden="true">
          <path d="M2.5 13V2.5" stroke="#c05f34" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M2.5 2.5a10.5 10.5 0 0 1 10.5 10.5" fill="none" stroke="rgba(192,95,52,0.45)" strokeWidth="1.4" strokeDasharray="3 3" />
        </svg>
        Door
      </span>
    </div>
  )
}

/** The sheet below the plan: what the guest is looking at, and the one action they can take.
 *  It follows the selection, falling back to whatever is under the cursor. */
function DetailSheet({
  table,
  furniture,
  isSelected,
  partySize,
  slotLabel,
  onChoose,
  onConfirm,
  onClear,
  confirmPending,
  freeCount,
  disabled,
}: {
  table: AvailableTable | null
  furniture: TableFurniture | null
  isSelected: boolean
  partySize?: number | null
  slotLabel?: string
  onChoose: () => void
  onConfirm?: () => void
  onClear: () => void
  confirmPending: boolean
  freeCount: number
  disabled: boolean
}) {
  if (!table || !furniture) {
    return (
      <div className="flex min-h-[7.5rem] items-center gap-3.5 border-t-2 border-ink-950 bg-parchment-100/60 px-4 py-4 sm:px-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-ink-900/12 font-display text-lg text-ink-600/45">
          ?
        </span>
        <div>
          <p className="text-[15px] font-bold text-ink-950">Tap a table on the plan</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-600/75">
            {freeCount} {freeCount === 1 ? "table fits" : "tables fit"}
            {partySize ? ` your party of ${partySize}` : " your party"} at this time.
          </p>
        </div>
      </div>
    )
  }

  const bookable = table.fits && table.available
  const statusLabel = !table.fits ? "Other party size" : !table.available ? "Booked" : isSelected ? "Selected" : "Available"
  const statusClass = !bookable
    ? "border-ink-900/12 bg-ink-900/5 text-ink-600/70"
    : isSelected
      ? "border-ember-500/30 bg-ember-500/12 text-ember-600"
      : "border-moss-500/30 bg-moss-500/10 text-moss-500"

  const cta = !table.fits
    ? `Sized for a different party`
    : !table.available
      ? "Already booked at this time"
      : isSelected
        ? `Reserve table ${table.table_number}${slotLabel ? ` · ${slotLabel}` : ""}`
        : `Choose table ${table.table_number}`

  const footnote = !table.fits
    ? `Seats ${table.seats} · we only offer it to parties it suits`
    : !table.available
      ? "Someone else has this seating — pick another table"
      : `Seats ${table.seats}${partySize ? ` · your party of ${partySize} fits` : ""} · free to change until the day before`

  return (
    <motion.div
      key={table.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="border-t-2 border-ink-950 bg-parchment-100/60 px-4 py-4 sm:px-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-600/60">{table.zone}</p>
          <p className="mt-0.5 font-display text-2xl leading-tight text-ink-950">Table {table.table_number}</p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${statusClass}`}
        >
          {statusLabel}
        </span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-ink-700">{furniture.description}</p>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {furniture.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-ink-900/12 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-ink-600"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Capped: on a wide plan a full-bleed black bar reads as a banner, not a button. */}
      <div className="mt-3.5 flex max-w-xl gap-2">
        <button
          type="button"
          disabled={!bookable || disabled || confirmPending || (isSelected && !onConfirm)}
          onClick={isSelected ? onConfirm : onChoose}
          className="flex-1 rounded-xl bg-ink-950 px-4 py-3.5 text-left text-sm font-medium text-parchment-50 transition-colors duration-200 hover:bg-ember-600 disabled:cursor-not-allowed disabled:bg-ink-900/12 disabled:text-ink-600/50"
        >
          {confirmPending ? "Reserving…" : cta}
        </button>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear the selection"
          className="flex w-[3.25rem] items-center justify-center rounded-xl border border-ink-900/12 text-ink-700 transition-colors duration-200 hover:border-ink-900/25 hover:bg-ink-900/5"
        >
          <X size={16} weight="bold" />
        </button>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-ink-600/70">{footnote}</p>
    </motion.div>
  )
}

export function FloorPlan({
  tables,
  restaurantSlug,
  value,
  onChange,
  disabled = false,
  partySize,
  slotLabel,
  onConfirm,
  confirmPending = false,
}: {
  tables: AvailableTable[]
  restaurantSlug?: string
  value: number | null
  onChange: (tableId: number | null) => void
  disabled?: boolean
  /** Party the plan is being read for — drives the dimming and the sheet's copy. */
  partySize?: number | null
  /** The seating time, so the sheet's call to action can name it. */
  slotLabel?: string
  /** When given, a selected table can be reserved straight from the sheet. */
  onConfirm?: () => void
  confirmPending?: boolean
}) {
  const spec: FloorPlanSpec = useMemo(() => getFloorPlan(restaurantSlug), [restaurantSlug])
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const [view, setView] = useState({ s: 1, tx: 0, ty: 0 })
  const [toast, setToast] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const drag = useRef<{ px: number; py: number; tx: number; ty: number } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reduceMotion = useReducedMotion()

  const toX = (posX: number) => spec.floor.x + (posX / 100) * spec.floor.w
  const toY = (posY: number) => spec.floor.y + (posY / 100) * spec.floor.h

  const furnitureById = useMemo(
    () => new Map(tables.map((table) => [table.id, tableFurniture(table)])),
    [tables],
  )

  const fitting = tables.filter((table) => table.fits)
  const freeCount = fitting.filter((table) => table.available).length
  const selected = tables.find((table) => table.id === value) ?? null
  const hovered = tables.find((table) => table.id === hoveredId) ?? null
  // The sheet stays on the selection; the hover chip on the plan covers everything else.
  const subject = selected ?? hovered
  const bands = useMemo(() => zoneBands(tables, spec.floor), [tables, spec.floor])

  const panLimit = { x: ((view.s - 1) * spec.room.w) / 2, y: ((view.s - 1) * spec.room.h) / 2 }

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])

  function flash(message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS)
  }

  /** Tapping a table that cannot be booked says why, instead of doing nothing. */
  function activate(table: AvailableTable) {
    if (disabled) return
    if (!table.fits) {
      flash(
        `Table ${table.table_number} seats ${table.seats}${
          partySize ? ` — it is not offered for a party of ${partySize}` : " — not offered for this party size"
        }.`,
      )
      return
    }
    if (!table.available) {
      flash(`Table ${table.table_number} is already booked for this seating. Pick another one.`)
      return
    }
    setToast(null)
    onChange(table.id)
  }

  // Zooming into a room is only useful if it zooms into the table being looked at.
  useEffect(() => {
    if (!selected || view.s <= 1) return
    const px = toX(selected.pos_x)
    const py = toY(selected.pos_y)
    const lx = ((view.s - 1) * spec.room.w) / 2
    const ly = ((view.s - 1) * spec.room.h) / 2
    setView((v) => ({
      s: v.s,
      tx: clamp(-v.s * (px - spec.room.w / 2), -lx, lx),
      ty: clamp(-v.s * (py - spec.room.h / 2), -ly, ly),
    }))
    // Recentring is a response to the selection changing, not to every pan.
  }, [value])

  function zoomBy(delta: number) {
    setView((v) => {
      const s = clamp(v.s + delta, 1, MAX_ZOOM)
      const lx = ((s - 1) * spec.room.w) / 2
      const ly = ((s - 1) * spec.room.h) / 2
      // Zooming with a table picked keeps that table centred rather than the room.
      if (selected && s > 1) {
        return {
          s,
          tx: clamp(-s * (toX(selected.pos_x) - spec.room.w / 2), -lx, lx),
          ty: clamp(-s * (toY(selected.pos_y) - spec.room.h / 2), -ly, ly),
        }
      }
      return { s, tx: clamp(v.tx, -lx, lx), ty: clamp(v.ty, -ly, ly) }
    })
  }

  function startPan(event: React.PointerEvent<SVGSVGElement>) {
    if (view.s <= 1 || event.button !== 0) return
    drag.current = { px: event.clientX, py: event.clientY, tx: view.tx, ty: view.ty }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function movePan(event: React.PointerEvent<SVGSVGElement>) {
    const d = drag.current
    const svg = svgRef.current
    if (!d || !svg) return
    // The pan offset is applied outside the zoom transform, so pixel deltas convert with the
    // viewBox ratio alone.
    const k = spec.room.w / svg.getBoundingClientRect().width
    setView((v) => ({
      s: v.s,
      tx: clamp(d.tx + (event.clientX - d.px) * k, -panLimit.x, panLimit.x),
      ty: clamp(d.ty + (event.clientY - d.py) * k, -panLimit.y, panLimit.y),
    }))
  }

  function endPan(event: React.PointerEvent<SVGSVGElement>) {
    if (!drag.current) return
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  if (tables.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-900/15 px-4 py-10 text-center text-sm text-ink-600">
        No tables in the dining room for this seating.
      </div>
    )
  }

  const cx = spec.room.w / 2
  const cy = spec.room.h / 2
  const zoomed = view.s > 1

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-ink-900/10 bg-parchment-50 shadow-[0_18px_40px_-32px_rgba(25,21,18,0.55)]">
      <header className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1.5 border-b-2 border-ink-900/10 bg-parchment-100/70 px-4 py-3 sm:px-5">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ember-600">Dining room plan</p>
          <p className="mt-0.5 font-display text-lg leading-none text-ink-950">
            {freeCount} of {fitting.length} tables free
          </p>
        </div>
        <p className="text-[13px] font-medium text-ink-700">
          {slotLabel}
          {slotLabel && partySize ? " · " : ""}
          {partySize ? `party of ${partySize}` : ""}
        </p>
      </header>

      {bands.length > 1 && (
        <div className="flex flex-wrap gap-1.5 border-b border-ink-900/8 px-4 py-2.5 sm:px-5">
          {bands.map((band) => {
            const tone = ZONE_TONE[band.zone] ?? DEFAULT_ZONE_TONE
            return (
              <span
                key={band.zone}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink-900/10 bg-parchment-50 py-1 pl-1.5 pr-2.5 text-[11px] text-ink-600"
              >
                <span
                  className="h-3.5 w-3.5 rounded-full"
                  style={{ backgroundColor: tone.fill, boxShadow: `inset 0 0 0 1.5px ${tone.stroke}` }}
                />
                <span className="font-medium capitalize text-ink-800">{band.zone}</span>
                {band.total > 0 && (
                  <span className={band.free > 0 ? "font-bold text-moss-500" : "font-light text-ink-600/45"}>
                    {band.free}/{band.total}
                  </span>
                )}
              </span>
            )
          })}
        </div>
      )}

      <div className="relative bg-[#f6f2ea]">
        {/* The plan keeps a minimum drawn width so labels stay legible on a phone; below that the
            room scrolls sideways inside its own box rather than shrinking to nothing. The zoom
            controls live outside this scroller so they stay pinned to the visible corner. */}
        <div className="overflow-x-auto">
          <motion.svg
            ref={svgRef}
            viewBox={sheetViewBox(spec)}
            className="h-auto w-full min-w-[38rem] select-none"
            style={{ touchAction: zoomed ? "none" : "manipulation", cursor: zoomed ? "grab" : "default" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: disabled ? 0.5 : 1 }}
            transition={{ duration: 0.35 }}
            role="group"
            aria-label="Dining room floor plan — pick a table"
            onPointerDown={startPan}
            onPointerMove={movePan}
            onPointerUp={endPan}
            onPointerCancel={endPan}
          >
            <RoomShellDefs />
            <TableDefs />

            <g transform={`translate(${view.tx} ${view.ty}) translate(${cx} ${cy}) scale(${view.s}) translate(${-cx} ${-cy})`}>
              <RoomShell spec={spec} />

              {/* Seating zones, tinted behind the tables. */}
              <g style={{ pointerEvents: "none" }}>
                {bands.map((band) => {
                  const tone = ZONE_TONE[band.zone] ?? DEFAULT_ZONE_TONE
                  const x = spec.floor.x - 10
                  const w = spec.floor.w + 20
                  return (
                    <g key={band.zone}>
                      <rect
                        x={x}
                        y={band.top}
                        width={w}
                        height={band.bottom - band.top}
                        rx={16}
                        fill={tone.fill}
                        stroke={tone.stroke}
                        strokeWidth={1.4}
                        strokeDasharray="10 8"
                      />
                      <text
                        x={spec.floor.x + spec.floor.w - 6}
                        y={(band.top + band.bottom) / 2}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={11}
                        fontFamily={FONT}
                        fontWeight={600}
                        letterSpacing={3}
                        fill={tone.text}
                        transform={`rotate(-90 ${spec.floor.x + spec.floor.w - 6} ${(band.top + band.bottom) / 2})`}
                      >
                        {band.zone.toUpperCase()}
                      </text>
                    </g>
                  )
                })}
              </g>

              {/* Context furniture first, so a live table is never hidden behind a ghosted one. */}
              {[...tables]
                .sort((a, b) => Number(a.fits) - Number(b.fits))
                .map((table, i) => {
                  const isSelected = value === table.id && table.fits && table.available
                  const state: TableState = !table.fits
                    ? "wrongSize"
                    : !table.available
                      ? "taken"
                      : isSelected
                        ? "selected"
                        : hoveredId === table.id
                          ? "hovered"
                          : "available"
                  return (
                    <TableGlyph
                      key={table.id}
                      table={table}
                      furniture={furnitureById.get(table.id)!}
                      state={state}
                      cx={toX(table.pos_x)}
                      cy={toY(table.pos_y)}
                      index={i}
                      animate={!reduceMotion}
                      onActivate={() => activate(table)}
                      onFocusChange={setHoveredId}
                    />
                  )
                })}

              {hovered && (
                <TableChip
                  table={hovered}
                  furniture={furnitureById.get(hovered.id)!}
                  cx={toX(hovered.pos_x)}
                  cy={toY(hovered.pos_y)}
                  room={spec.room}
                />
              )}
            </g>
          </motion.svg>
        </div>

        <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-xl border border-ink-900/10 bg-parchment-50/95 shadow-sm backdrop-blur-sm">
          <button
            type="button"
            onClick={() => zoomBy(ZOOM_STEP)}
            disabled={view.s >= MAX_ZOOM}
            aria-label="Zoom in"
            className="p-2 text-ink-700 transition-colors hover:bg-ink-900/5 disabled:text-ink-600/25 disabled:hover:bg-transparent"
          >
            <MagnifyingGlassPlus size={16} weight="bold" />
          </button>
          <button
            type="button"
            onClick={() => zoomBy(-ZOOM_STEP)}
            disabled={view.s <= 1}
            aria-label="Zoom out"
            className="border-t border-ink-900/8 p-2 text-ink-700 transition-colors hover:bg-ink-900/5 disabled:text-ink-600/25 disabled:hover:bg-transparent"
          >
            <MagnifyingGlassMinus size={16} weight="bold" />
          </button>
          <button
            type="button"
            onClick={() => setView({ s: 1, tx: 0, ty: 0 })}
            disabled={view.s === 1 && view.tx === 0 && view.ty === 0}
            aria-label="Reset the view"
            className="border-t border-ink-900/8 p-2 text-ink-700 transition-colors hover:bg-ink-900/5 disabled:text-ink-600/25 disabled:hover:bg-transparent"
          >
            <ArrowCounterClockwise size={16} weight="bold" />
          </button>
        </div>

        {zoomed && (
          <span className="pointer-events-none absolute bottom-4 left-4 rounded-full bg-ink-950/75 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-parchment-50">
            Drag to pan · {view.s.toFixed(1)}×
          </span>
        )}

        <AnimatePresence>
          {toast && (
            <motion.p
              role="status"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="pointer-events-none absolute inset-x-3 bottom-3 rounded-xl bg-ink-950 px-3.5 py-2.5 text-xs leading-relaxed text-parchment-50 shadow-lg"
            >
              {toast}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <Legend />

      <AnimatePresence mode="wait" initial={false}>
        <DetailSheet
          key={subject?.id ?? "empty"}
          table={subject}
          furniture={subject ? (furnitureById.get(subject.id) ?? null) : null}
          isSelected={!!selected && subject?.id === selected.id}
          partySize={partySize}
          slotLabel={slotLabel}
          onChoose={() => subject && activate(subject)}
          onConfirm={onConfirm}
          onClear={() => {
            setHoveredId(null)
            setToast(null)
            onChange(null)
          }}
          confirmPending={confirmPending}
          freeCount={freeCount}
          disabled={disabled}
        />
      </AnimatePresence>
    </section>
  )
}
