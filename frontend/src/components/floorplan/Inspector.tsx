import { ELEMENT_PRESETS, TABLE_SHAPES, defaultTableSize, type TableShape } from "../../lib/floorplan"
import type { CanvasElement, CanvasTable } from "./FloorCanvas"

const fieldClass =
  "w-full rounded-lg border border-ink-900/15 bg-parchment-50 px-2 py-1.5 text-sm text-ink-900 outline-none focus:border-ember-400"
const labelClass = "text-[11px] font-medium uppercase tracking-wide text-ink-600"

function NumberField({
  label,
  value,
  min,
  max,
  step = 10,
  onChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <input
        type="number"
        className={`${fieldClass} mt-1`}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const next = Number(e.target.value)
          if (Number.isFinite(next)) onChange(next)
        }}
      />
    </label>
  )
}

export function Inspector({
  table,
  element,
  onTableChange,
  onElementChange,
  onDelete,
}: {
  table: CanvasTable | null
  element: CanvasElement | null
  onTableChange: (patch: Partial<CanvasTable>) => void
  onElementChange: (patch: Partial<CanvasElement>) => void
  onDelete: () => void
}) {
  if (!table && !element) {
    return (
      <p className="text-sm text-ink-600/70">
        Select something on the plan to edit it, or add an item from the palette.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {table && (
        <>
          <label className="block">
            <span className={labelClass}>Table number</span>
            <input
              className={`${fieldClass} mt-1`}
              value={table.table_number}
              maxLength={10}
              onChange={(e) => onTableChange({ table_number: e.target.value })}
            />
          </label>

          <label className="block">
            <span className={labelClass}>Shape</span>
            <select
              className={`${fieldClass} mt-1`}
              value={table.shape}
              onChange={(e) => {
                const shape = e.target.value as TableShape
                onTableChange({ shape, ...defaultTableSize(shape, table.seats) })
              }}
            >
              {TABLE_SHAPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <NumberField
            label="Seats"
            value={table.seats}
            min={1}
            max={30}
            step={1}
            onChange={(seats) => {
              const clamped = Math.max(1, Math.min(30, Math.round(seats)))
              onTableChange({ seats: clamped, ...defaultTableSize(table.shape, clamped) })
            }}
          />
          <p className="-mt-2 text-[11px] leading-snug text-ink-600/70">
            Booking assigns tables by capacity: 1–2 seats book as a two-top, 3+ as a four-top.
          </p>
        </>
      )}

      {element && (
        <>
          <p className="text-sm font-medium text-ink-900">{ELEMENT_PRESETS[element.kind].label}</p>
          <label className="block">
            <span className={labelClass}>Label</span>
            <input
              className={`${fieldClass} mt-1`}
              value={element.label ?? ""}
              maxLength={40}
              placeholder={ELEMENT_PRESETS[element.kind].label}
              onChange={(e) => onElementChange({ label: e.target.value || null })}
            />
          </label>
          <NumberField
            label="Layer"
            value={element.z_index}
            min={-100}
            max={100}
            step={1}
            onChange={(z) => onElementChange({ z_index: Math.round(z) })}
          />
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="X (cm)"
          value={table?.x_cm ?? element!.x_cm}
          onChange={(v) => (table ? onTableChange({ x_cm: v }) : onElementChange({ x_cm: v }))}
        />
        <NumberField
          label="Y (cm)"
          value={table?.y_cm ?? element!.y_cm}
          onChange={(v) => (table ? onTableChange({ y_cm: v }) : onElementChange({ y_cm: v }))}
        />
        <NumberField
          label="Width (cm)"
          value={table?.width_cm ?? element!.width_cm}
          min={20}
          onChange={(v) =>
            table ? onTableChange({ width_cm: Math.max(20, v) }) : onElementChange({ width_cm: Math.max(20, v) })
          }
        />
        <NumberField
          label="Height (cm)"
          value={table?.height_cm ?? element!.height_cm}
          min={20}
          onChange={(v) =>
            table ? onTableChange({ height_cm: Math.max(20, v) }) : onElementChange({ height_cm: Math.max(20, v) })
          }
        />
      </div>

      <NumberField
        label="Rotation (°)"
        value={table?.rotation ?? element!.rotation}
        min={0}
        max={359}
        step={15}
        onChange={(v) => {
          const rotation = ((Math.round(v) % 360) + 360) % 360
          return table ? onTableChange({ rotation }) : onElementChange({ rotation })
        }}
      />

      <button
        type="button"
        onClick={onDelete}
        className="w-full rounded-full border border-rust-500/40 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-rust-500 transition-colors hover:bg-rust-500/10"
      >
        Remove from plan
      </button>
    </div>
  )
}
