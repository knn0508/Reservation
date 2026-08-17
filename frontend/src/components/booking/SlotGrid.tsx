import { motion } from "framer-motion"
import type { AvailabilitySlot } from "../../lib/api"
import { formatSlotTime } from "../../lib/time"

function categoryFree(slot: AvailabilitySlot, partySize: number): number {
  return partySize <= 2 ? slot.tables_2_free : slot.tables_4_free
}

export function SlotGrid({
  slots,
  partySize,
  value,
  onChange,
  isLoading,
}: {
  slots: AvailabilitySlot[] | undefined
  partySize: number
  value: string | null
  onChange: (time: string) => void
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-11 animate-pulse rounded-xl bg-ink-900/8" />
        ))}
      </div>
    )
  }

  if (!slots || slots.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink-900/15 px-4 py-8 text-center text-sm text-ink-600">
        No service hours configured for this day.
      </div>
    )
  }

  const anyOpen = slots.some((slot) => categoryFree(slot, partySize) > 0)

  if (!anyOpen) {
    return (
      <div className="rounded-xl border border-dashed border-ink-900/15 px-4 py-8 text-center text-sm text-ink-600">
        Fully booked for this party size on this day — try another date.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
      {slots.map((slot, i) => {
        const free = categoryFree(slot, partySize)
        const disabled = free <= 0
        const active = value === slot.time
        return (
          <motion.button
            key={slot.time}
            type="button"
            disabled={disabled}
            onClick={() => onChange(slot.time)}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.015, type: "spring", stiffness: 420, damping: 32 }}
            whileTap={disabled ? undefined : { scale: 0.95 }}
            className={`rounded-xl border px-2 py-2.5 text-sm font-medium tabular-nums transition-colors duration-200 ${
              disabled
                ? "cursor-not-allowed border-ink-900/8 bg-ink-900/[0.03] text-ink-600/40 line-through"
                : active
                  ? "border-ember-500 bg-ink-950 text-parchment-50"
                  : "border-ink-900/15 bg-parchment-100 text-ink-800 hover:border-ember-400/60"
            }`}
          >
            {formatSlotTime(slot.time)}
          </motion.button>
        )
      })}
    </div>
  )
}
