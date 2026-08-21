import { useState } from "react"
import { motion } from "framer-motion"
import type { AvailableTable } from "../../lib/api"

/** Room drawing space. Table positions arrive as percentages of the floor box, so one layout
 *  renders correctly at any width. */
const ROOM = { w: 120, h: 104 }
const FLOOR = { x: 24, y: 16, w: 82, h: 72 }

const toX = (posX: number) => FLOOR.x + (posX / 100) * FLOOR.w
const toY = (posY: number) => FLOOR.y + (posY / 100) * FLOOR.h

/** `wrongSize` tables belong to the room but not to this party size - drawn as furniture. */
type TableState = "available" | "hovered" | "selected" | "taken" | "wrongSize"

const PALETTE: Record<TableState, { top: string; edge: string; chair: string; label: string }> = {
  available: { top: "#f4ede2", edge: "rgba(33,27,23,0.30)", chair: "rgba(33,27,23,0.22)", label: "#191512" },
  hovered: { top: "#fbf8f3", edge: "#c05f34", chair: "rgba(192,95,52,0.55)", label: "#191512" },
  selected: { top: "#191512", edge: "#c05f34", chair: "#c05f34", label: "#fbf8f3" },
  taken: { top: "#ffffff", edge: "rgba(33,27,23,0.10)", chair: "rgba(33,27,23,0.07)", label: "rgba(95,81,72,0.34)" },
  wrongSize: { top: "#faf7f2", edge: "rgba(33,27,23,0.11)", chair: "rgba(33,27,23,0.08)", label: "rgba(95,81,72,0.30)" },
}

function Table({
  table,
  state,
  onSelect,
  onHover,
}: {
  table: AvailableTable
  state: TableState
  onSelect: () => void
  onHover: (id: number | null) => void
}) {
  const c = PALETTE[state]
  const cx = toX(table.pos_x)
  const cy = toY(table.pos_y)
  const clickable = table.fits && table.available

  // Chairs sit just outside the tabletop: two facing each other for a deuce, four around
  // the edges for a four-top.
  const chairs =
    table.seats <= 2
      ? [
          { x: cx - 10.6, y: cy - 3.8, w: 3.6, h: 7.6 },
          { x: cx + 7.0, y: cy - 3.8, w: 3.6, h: 7.6 },
        ]
      : [
          { x: cx - 3.8, y: cy - 10.7, w: 7.6, h: 3.6 },
          { x: cx - 3.8, y: cy + 7.1, w: 7.6, h: 3.6 },
          { x: cx - 10.7, y: cy - 3.8, w: 3.6, h: 7.6 },
          { x: cx + 7.1, y: cy - 3.8, w: 3.6, h: 7.6 },
        ]

  return (
    <g
      role="button"
      tabIndex={clickable ? 0 : -1}
      aria-disabled={!clickable}
      aria-pressed={state === "selected"}
      aria-label={`Table ${table.table_number}, ${table.seats} seats, ${table.zone} zone, ${
        !table.fits ? "not offered for this party size" : table.available ? "available" : "already booked"
      }`}
      onClick={clickable ? onSelect : undefined}
      onKeyDown={(event) => {
        if (clickable && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault()
          onSelect()
        }
      }}
      onMouseEnter={() => onHover(table.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(table.id)}
      onBlur={() => onHover(null)}
      style={{ cursor: clickable ? "pointer" : "not-allowed" }}
    >
      {state === "selected" && (
        <circle cx={cx} cy={cy} r={12.4} fill="none" stroke="#c05f34" strokeWidth={0.7} strokeDasharray="2 1.6" />
      )}
      {chairs.map((chair, i) => (
        <rect key={i} x={chair.x} y={chair.y} width={chair.w} height={chair.h} rx={1.4} fill={c.chair} />
      ))}
      {table.seats <= 2 ? (
        <circle cx={cx} cy={cy} r={5.4} fill={c.top} stroke={c.edge} strokeWidth={0.6} />
      ) : (
        <rect
          x={cx - 6.3}
          y={cy - 6.3}
          width={12.6}
          height={12.6}
          rx={2.4}
          fill={c.top}
          stroke={c.edge}
          strokeWidth={0.6}
        />
      )}
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill={c.label}
        fontSize={4}
        fontWeight={state === "available" || state === "hovered" || state === "selected" ? 700 : 400}
        fontFamily="Outfit, ui-sans-serif, system-ui, sans-serif"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {table.table_number}
      </text>
      {state === "taken" && (
        <g transform={`translate(${cx + 4.6} ${cy - 4.6})`}>
          <circle r={2.6} fill="#ffffff" stroke="rgba(163,67,47,0.35)" strokeWidth={0.5} />
          <g stroke="rgba(163,67,47,0.75)" strokeWidth={0.6} strokeLinecap="round">
            <line x1={-1.1} y1={-1.1} x2={1.1} y2={1.1} />
            <line x1={1.1} y1={-1.1} x2={-1.1} y2={1.1} />
          </g>
        </g>
      )}
      {/* Generous invisible hit area so tables stay easy to tap on a phone. */}
      <rect x={cx - 11.5} y={cy - 11.5} width={23} height={23} fill="transparent" />
    </g>
  )
}

export function FloorPlan({
  tables,
  value,
  onChange,
  disabled = false,
}: {
  tables: AvailableTable[]
  value: number | null
  onChange: (tableId: number) => void
  disabled?: boolean
}) {
  const [hoveredId, setHoveredId] = useState<number | null>(null)

  const fitting = tables.filter((table) => table.fits)
  const freeCount = fitting.filter((table) => table.available).length
  const focused = tables.find((table) => table.id === (hoveredId ?? value)) ?? null

  if (tables.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink-900/15 px-4 py-8 text-center text-sm text-ink-600">
        No tables of this size in the dining room.
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-ink-900/10 bg-parchment-100/70 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-600">
          Dining room — <span className="font-bold text-ink-950">{freeCount}</span> of {fitting.length} free
        </p>
        <div className="flex items-center gap-3.5 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border border-ink-900/30 bg-parchment-100" />
            <span className="font-bold text-ink-950">Available</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border border-ink-900/10 bg-white" />
            <span className="font-light text-ink-600/40">Taken</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm border border-ink-900/10 bg-parchment-50" />
            <span className="font-light text-ink-600/40">Other size</span>
          </span>
        </div>
      </div>

      <motion.svg
        viewBox={`0 0 ${ROOM.w} ${ROOM.h}`}
        className="h-auto w-full touch-manipulation"
        initial={{ opacity: 0 }}
        animate={{ opacity: disabled ? 0.55 : 1 }}
        transition={{ duration: 0.35 }}
        role="group"
        aria-label="Dining room floor plan"
      >
        {/* Room shell */}
        <rect
          x={2}
          y={2}
          width={ROOM.w - 4}
          height={ROOM.h - 4}
          rx={4}
          fill="#fbf8f3"
          stroke="rgba(33,27,23,0.18)"
          strokeWidth={0.9}
        />

        {/* Window wall along the top */}
        <rect x={2} y={2} width={ROOM.w - 4} height={5.5} rx={2.5} fill="rgba(107,125,94,0.14)" />
        {[24, 46, 68, 90].map((x) => (
          <line key={x} x1={x} y1={3} x2={x} y2={7} stroke="rgba(33,27,23,0.16)" strokeWidth={0.5} />
        ))}
        <text
          x={ROOM.w / 2}
          y={5.4}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={2.6}
          letterSpacing={0.7}
          fill="rgba(95,81,72,0.7)"
          fontFamily="Outfit, ui-sans-serif, system-ui, sans-serif"
        >
          WINDOWS
        </text>

        {/* Bar counter along the left wall */}
        <rect
          x={5.5}
          y={26}
          width={8}
          height={52}
          rx={2.5}
          fill="rgba(33,27,23,0.07)"
          stroke="rgba(33,27,23,0.14)"
          strokeWidth={0.5}
        />
        <text
          x={9.5}
          y={52}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={3}
          letterSpacing={1.1}
          fill="rgba(95,81,72,0.75)"
          fontFamily="Outfit, ui-sans-serif, system-ui, sans-serif"
          transform="rotate(-90 9.5 52)"
        >
          BAR
        </text>

        {/* Entrance on the bottom wall */}
        <rect x={16} y={ROOM.h - 6.6} width={26} height={4.6} rx={2.2} fill="rgba(192,95,52,0.16)" />
        <text
          x={29}
          y={ROOM.h - 4.3}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={2.5}
          letterSpacing={0.7}
          fill="rgba(163,74,38,0.85)"
          fontFamily="Outfit, ui-sans-serif, system-ui, sans-serif"
        >
          ENTRANCE
        </text>

        {tables.map((table) => {
          const selected = value === table.id && table.fits && table.available
          const state: TableState = !table.fits
            ? "wrongSize"
            : !table.available
              ? "taken"
              : selected
                ? "selected"
                : hoveredId === table.id
                  ? "hovered"
                  : "available"
          return (
            <Table
              key={table.id}
              table={table}
              state={state}
              onSelect={() => !disabled && onChange(table.id)}
              onHover={setHoveredId}
            />
          )
        })}
      </motion.svg>

      <div className="mt-3 min-h-9 rounded-xl border border-ink-900/8 bg-parchment-50 px-3 py-2 text-xs">
        {focused ? (
          <span className={focused.fits && focused.available ? "text-ink-800" : "text-ink-600/60"}>
            <span className="font-bold text-ink-950">Table {focused.table_number}</span> · {focused.seats} seats ·{" "}
            <span className="capitalize">{focused.zone}</span> ·{" "}
            {!focused.fits ? (
              <span className="font-light">Not offered for your party size</span>
            ) : focused.available ? (
              <span className="font-bold text-moss-500">Available at this time</span>
            ) : (
              <span className="font-light">Already booked for this seating</span>
            )}
          </span>
        ) : (
          <span className="text-ink-600">Hover or tap a table on the plan to see its details.</span>
        )}
      </div>
    </div>
  )
}
