import { motion } from "framer-motion"

const SIZES = [1, 2, 3, 4]

export function PartySizeStep({
  value,
  onChange,
}: {
  value: number | null
  onChange: (size: number) => void
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-ember-600">Step 1</p>
      <h2 className="font-display text-2xl text-ink-950 md:text-3xl">How many at your table?</h2>
      <p className="mt-2 max-w-[46ch] text-sm leading-relaxed text-ink-600">
        Parties larger than four are seated as a shared table experience — call the house directly and we
        will arrange it.
      </p>
      <div className="mt-7 grid grid-cols-4 gap-3 sm:max-w-md">
        {SIZES.map((size) => {
          const active = value === size
          return (
            <motion.button
              key={size}
              type="button"
              onClick={() => onChange(size)}
              whileTap={{ scale: 0.96 }}
              className={`flex aspect-square flex-col items-center justify-center rounded-2xl border transition-colors duration-200 ${
                active
                  ? "border-ember-500 bg-ink-950 text-parchment-50"
                  : "border-ink-900/15 bg-parchment-100 text-ink-800 hover:border-ember-400/60"
              }`}
            >
              <span className="font-display text-2xl">{size}</span>
              <span className="mt-0.5 text-[11px] uppercase tracking-wide opacity-70">
                {size === 1 ? "guest" : "guests"}
              </span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
