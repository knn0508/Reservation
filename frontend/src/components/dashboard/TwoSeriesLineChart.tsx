import { useMemo, useState } from "react"
import { formatPeriodLabel } from "../../lib/time"

const WIDTH = 720
const HEIGHT = 260
const PAD_LEFT = 44
const PAD_RIGHT = 12
const PAD_TOP = 12
const PAD_BOTTOM = 28

export function TwoSeriesLineChart({
  points,
  granularity,
  seriesLabels,
  seriesColors,
  valueFormatter = (n: number) => n.toFixed(0),
}: {
  points: { period: string; a: number; b: number }[]
  granularity: "day" | "month"
  seriesLabels: [string, string]
  seriesColors: [string, string]
  valueFormatter?: (n: number) => string
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const { pathA, pathB, xFor, yFor, gridLines } = useMemo(() => {
    const max = Math.max(1, ...points.map((p) => Math.max(p.a, p.b)))
    const niceMax = max * 1.15
    const innerW = WIDTH - PAD_LEFT - PAD_RIGHT
    const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM
    const xFor = (i: number) => PAD_LEFT + (points.length <= 1 ? 0 : (i / (points.length - 1)) * innerW)
    const yFor = (v: number) => PAD_TOP + innerH - (v / niceMax) * innerH

    const buildPath = (key: "a" | "b") =>
      points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(p[key]).toFixed(1)}`).join(" ")

    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
      y: PAD_TOP + innerH - f * innerH,
      value: niceMax * f,
    }))

    return { pathA: buildPath("a"), pathB: buildPath("b"), xFor, yFor, gridLines }
  }, [points])

  const labelStep = Math.max(1, Math.ceil(points.length / 8))
  const hovered = hoverIndex !== null ? points[hoverIndex] : null

  return (
    <div className="relative">
      <div className="mb-3 flex items-center gap-4 text-xs text-ink-700">
        {seriesLabels.map((label, i) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: seriesColors[i] }} />
            {label}
          </span>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full touch-none select-none"
        onMouseLeave={() => setHoverIndex(null)}
        onMouseMove={(e) => {
          const svg = e.currentTarget
          const rect = svg.getBoundingClientRect()
          const relX = ((e.clientX - rect.left) / rect.width) * WIDTH
          const innerW = WIDTH - PAD_LEFT - PAD_RIGHT
          const ratio = Math.min(1, Math.max(0, (relX - PAD_LEFT) / innerW))
          const idx = Math.round(ratio * (points.length - 1))
          setHoverIndex(Math.min(points.length - 1, Math.max(0, idx)))
        }}
      >
        {gridLines.map((g) => (
          <g key={g.y}>
            <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={g.y} y2={g.y} stroke="var(--color-ink-900)" strokeOpacity={0.06} strokeWidth={1} />
            <text x={PAD_LEFT - 8} y={g.y + 3} textAnchor="end" fontSize={9} fill="var(--color-ink-600)">
              {valueFormatter(g.value)}
            </text>
          </g>
        ))}

        {points.map((p, i) =>
          i % labelStep === 0 ? (
            <text key={p.period} x={xFor(i)} y={HEIGHT - 8} textAnchor="middle" fontSize={9} fill="var(--color-ink-600)">
              {formatPeriodLabel(p.period, granularity)}
            </text>
          ) : null,
        )}

        {hoverIndex !== null && (
          <line
            x1={xFor(hoverIndex)}
            x2={xFor(hoverIndex)}
            y1={PAD_TOP}
            y2={HEIGHT - PAD_BOTTOM}
            stroke="var(--color-ink-900)"
            strokeOpacity={0.15}
            strokeWidth={1}
          />
        )}

        <path d={pathA} fill="none" stroke={seriesColors[0]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <path d={pathB} fill="none" stroke={seriesColors[1]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {hoverIndex !== null && (
          <>
            <circle cx={xFor(hoverIndex)} cy={yFor(points[hoverIndex].a)} r={3.5} fill={seriesColors[0]} stroke="var(--color-parchment-50)" strokeWidth={1.5} />
            <circle cx={xFor(hoverIndex)} cy={yFor(points[hoverIndex].b)} r={3.5} fill={seriesColors[1]} stroke="var(--color-parchment-50)" strokeWidth={1.5} />
          </>
        )}
      </svg>

      {hovered && hoverIndex !== null && (
        <div
          className="pointer-events-none absolute top-0 rounded-lg border border-ink-900/10 bg-parchment-50 px-2.5 py-2 text-xs shadow-sm"
          style={{
            left: `${(xFor(hoverIndex) / WIDTH) * 100}%`,
            transform: hoverIndex > points.length / 2 ? "translateX(-100%)" : "translateX(0%)",
          }}
        >
          <div className="font-medium text-ink-900">{formatPeriodLabel(hovered.period, granularity)}</div>
          <div className="mt-1 flex items-center gap-1.5" style={{ color: seriesColors[0] }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: seriesColors[0] }} />
            {seriesLabels[0]}: {valueFormatter(hovered.a)}
          </div>
          <div className="flex items-center gap-1.5" style={{ color: seriesColors[1] }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: seriesColors[1] }} />
            {seriesLabels[1]}: {valueFormatter(hovered.b)}
          </div>
        </div>
      )}
    </div>
  )
}
