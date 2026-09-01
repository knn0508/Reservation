import { motion } from "framer-motion"
import type { AvailableTable } from "../../lib/api"

type GlyphState = "available" | "selected" | "taken"

/** Inline colours (not Tailwind classes) so the SVG stays readable regardless of utility purging. */
const PALETTE: Record<GlyphState, { top: string; edge: string; chair: string; label: string }> = {
  available: { top: "#f4ede2", edge: "rgba(33,27,23,0.28)", chair: "rgba(33,27,23,0.22)", label: "#191512" },
  selected: { top: "#191512", edge: "#c05f34", chair: "#c05f34", label: "#fbf8f3" },
  taken: { top: "#ffffff", edge: "rgba(33,27,23,0.09)", chair: "rgba(33,27,23,0.07)", label: "rgba(95,81,72,0.35)" },
}

function TableGlyph({ seats, state, label }: { seats: number; state: GlyphState; label: string }) {
  const c = PALETTE[state]
  const chairs =
    seats <= 2
      ? [
          { x: 6, y: 34, w: 15, h: 32 },
          { x: 99, y: 34, w: 15, h: 32 },
        ]
      : [
          { x: 46, y: 5, w: 28, h: 13 },
          { x: 46, y: 82, w: 28, h: 13 },
          { x: 7, y: 36, w: 13, h: 28 },
          { x: 100, y: 36, w: 13, h: 28 },
        ]

  return (
    <svg viewBox="0 0 120 100" className="h-[4.5rem] w-full" aria-hidden="true">
      {chairs.map((chair, i) => (
        <rect key={i} x={chair.x} y={chair.y} width={chair.w} height={chair.h} rx={5} fill={c.chair} />
      ))}
      {seats <= 2 ? (
        <circle cx={60} cy={50} r={29} fill={c.top} stroke={c.edge} strokeWidth={1.5} />
      ) : (
        <rect x={31} y={21} width={58} height={58} rx={11} fill={c.top} stroke={c.edge} strokeWidth={1.5} />
      )}
      <text
        x={60}
        y={50}
        textAnchor="middle"
        dominantBaseline="central"
        fill={c.label}
        fontSize={15}
        fontWeight={state === "taken" ? 400 : 700}
        fontFamily="Outfit, ui-sans-serif, system-ui, sans-serif"
      >
        {label}
      </text>
    </svg>
  )
}

export function TableMap({
  tables,
  seats,
  value,
  onChange,
  disabled = false,
}: {
  tables: AvailableTable[]
  /** Every table in a slot belongs to one category, so a single seat count covers the whole map. */
  seats: number
  value: number | null
  onChange: (tableId: number) => void
  disabled?: boolean
}) {
  const freeCount = tables.filter((table) => table.available).length
  const showZones = new Set(tables.map((table) => table.zone)).size > 1

  if (tables.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink-900/15 px-4 py-8 text-center text-sm text-ink-600">
        No tables of this size in the dining room.
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-ink-900/10 bg-parchment-100/60 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-ink-900/10 pb-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-600">
          Dining room — {freeCount} of {tables.length} free
        </p>
        <div className="flex items-center gap-4 text-[11px] text-ink-600">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border border-ink-900/30 bg-parchment-100" />
            <span className="font-bold text-ink-950">Available</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border border-ink-900/10 bg-white" />
            <span className="font-light text-ink-600/40">Taken</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {tables.map((table, i) => {
          const selected = value === table.id && table.available
          const state: GlyphState = selected ? "selected" : table.available ? "available" : "taken"
          return (
            <motion.button
              key={table.id}
              type="button"
              disabled={!table.available || disabled}
              onClick={() => onChange(table.id)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02, type: "spring", stiffness: 420, damping: 32 }}
              whileTap={table.available && !disabled ? { scale: 0.96 } : undefined}
              aria-pressed={selected}
              aria-label={`Table ${table.table_number}, ${seats} seats, ${
                table.available ? "available" : "unavailable"
              }`}
              className={`flex flex-col items-center rounded-2xl border px-2 pb-2.5 pt-3 transition-colors duration-200 ${
                selected
                  ? "border-ember-500 bg-ink-950/[0.04]"
                  : table.available
                    ? "border-ink-900/15 bg-parchment-50 hover:border-ember-400/70"
                    : "cursor-not-allowed border-ink-900/[0.06] bg-white/60"
              }`}
            >
              <TableGlyph seats={seats} state={state} label={table.table_number} />
              <span
                className={`mt-1.5 text-[11px] uppercase tracking-wide ${
                  table.available ? "font-bold text-ink-950" : "font-light text-ink-600/40"
                }`}
              >
                {table.available ? `${seats} seats` : "Taken"}
              </span>
              {showZones && (
                <span
                  className={`text-[10px] capitalize ${table.available ? "text-ink-600" : "text-ink-600/30"}`}
                >
                  {table.zone}
                </span>
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
