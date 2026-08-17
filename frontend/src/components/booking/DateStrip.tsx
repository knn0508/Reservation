import { nextNDays, formatShortDate } from "../../lib/time"

export function DateStrip({
  value,
  onChange,
}: {
  value: string
  onChange: (day: string) => void
}) {
  const days = nextNDays(14)

  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto pb-2 pl-1 pr-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {days.map((day) => {
        const active = day === value
        const { weekday, day: dayNum } = formatShortDate(day)
        return (
          <button
            key={day}
            type="button"
            onClick={() => onChange(day)}
            className={`flex min-w-[3.75rem] flex-col items-center rounded-xl border px-3 py-2.5 transition-colors duration-200 ${
              active
                ? "border-ember-500 bg-ink-950 text-parchment-50"
                : "border-ink-900/15 bg-parchment-100 text-ink-700 hover:border-ember-400/60"
            }`}
          >
            <span className="text-[10px] uppercase tracking-wide opacity-70">{weekday}</span>
            <span className="font-display text-lg">{dayNum}</span>
          </button>
        )
      })}
    </div>
  )
}
