import { motion } from "framer-motion"
import { CaretRight, Minus, Plus } from "@phosphor-icons/react"

const MIN_SIZE = 1
const MAX_SIZE = 40

export function PartySizeStep({
  value,
  onChange,
  onContinue,
}: {
  value: number | null
  onChange: (size: number) => void
  onContinue: () => void
}) {
  const size = value ?? 2
  const tablesNeeded = size <= 2 ? 1 : Math.ceil(size / 4)

  function step(delta: number) {
    const next = Math.min(MAX_SIZE, Math.max(MIN_SIZE, size + delta))
    onChange(next)
  }

  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-ember-600">Step 2</p>
      <h2 className="font-display text-2xl text-ink-950 md:text-3xl">How many at your table?</h2>
      <p className="mt-2 max-w-[46ch] text-sm leading-relaxed text-ink-600">
        Parties of five or more are seated across merged four-top tables when they're free at
        your chosen time.
      </p>

      <div className="mt-7 flex items-center gap-5 sm:max-w-md">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={size <= MIN_SIZE}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-ink-900/15 bg-parchment-100 text-ink-800 transition-colors hover:border-ember-400/60 disabled:opacity-30"
        >
          <Minus size={18} weight="bold" />
        </button>

        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-ember-500 bg-ink-950 py-3 text-parchment-50">
          <motion.span
            key={size}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="font-display text-3xl"
          >
            {size}
          </motion.span>
          <span className="mt-0.5 text-[11px] uppercase tracking-wide opacity-70">
            {size === 1 ? "guest" : "guests"}
          </span>
        </div>

        <button
          type="button"
          onClick={() => step(1)}
          disabled={size >= MAX_SIZE}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-ink-900/15 bg-parchment-100 text-ink-800 transition-colors hover:border-ember-400/60 disabled:opacity-30"
        >
          <Plus size={18} weight="bold" />
        </button>
      </div>

      {size > 4 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 max-w-md rounded-xl border border-ember-500/25 bg-ember-500/5 px-3.5 py-2.5 text-xs text-ember-700"
        >
          We'll merge {tablesNeeded} four-seat tables for your group — only shown as available if
          that many are free together at your chosen time.
        </motion.p>
      )}

      <button
        type="button"
        onClick={onContinue}
        className="mt-7 flex items-center gap-1.5 rounded-full bg-ink-950 px-5 py-2.5 text-sm font-medium text-parchment-50 transition-opacity hover:opacity-90"
      >
        Continue
        <CaretRight size={14} weight="bold" />
      </button>
    </div>
  )
}
