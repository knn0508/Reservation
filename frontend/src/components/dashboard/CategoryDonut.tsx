import { useState } from "react"

const SIZE = 200
const STROKE = 30
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export interface DonutSlice {
  key: string
  label: string
  value: number
  percent: number
  color: string
}

export function CategoryDonut({
  slices,
  selectedKey,
  onSelect,
}: {
  slices: DonutSlice[]
  selectedKey: string | null
  onSelect: (key: string) => void
}) {
  const [hoverKey, setHoverKey] = useState<string | null>(null)
  let cumulative = 0

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <div className="relative mx-auto shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--color-ink-900)" strokeOpacity={0.05} strokeWidth={STROKE} />
          {slices.map((s) => {
            const dash = (s.percent / 100) * CIRCUMFERENCE
            const gap = CIRCUMFERENCE - dash
            const offset = -((cumulative / 100) * CIRCUMFERENCE)
            cumulative += s.percent
            const active = hoverKey === null || hoverKey === s.key
            return (
              <circle
                key={s.key}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={s.color}
                strokeWidth={STROKE}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={offset}
                opacity={active ? 1 : 0.35}
                className="cursor-pointer transition-opacity duration-150"
                onMouseEnter={() => setHoverKey(s.key)}
                onMouseLeave={() => setHoverKey(null)}
                onClick={() => onSelect(s.key)}
              />
            )
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] uppercase tracking-wide text-ink-600">
            {hoverKey ? slices.find((s) => s.key === hoverKey)?.label : "Total"}
          </span>
          <span className="font-display text-lg text-ink-950">
            {hoverKey
              ? `${slices.find((s) => s.key === hoverKey)?.percent.toFixed(1)}%`
              : `${slices.reduce((sum, s) => sum + s.value, 0).toFixed(0)} ₼`}
          </span>
        </div>
      </div>

      <ul className="flex-1 space-y-1.5 text-sm">
        {slices.map((s) => (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => onSelect(s.key)}
              onMouseEnter={() => setHoverKey(s.key)}
              onMouseLeave={() => setHoverKey(null)}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                selectedKey === s.key ? "bg-ink-900/[0.05]" : "hover:bg-ink-900/[0.03]"
              }`}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="flex-1 truncate text-ink-800">{s.label}</span>
              <span className="shrink-0 font-mono text-xs text-ink-600">{s.percent.toFixed(1)}%</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
