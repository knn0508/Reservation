import type { CourierKpi } from "../../lib/api"
import { CATEGORICAL } from "../../lib/chartColors"
import { money } from "./Panels"

function minutes(value: number | null): string {
  // "—" rather than "0 min": a courier with no completed runs has no average, which is a
  // different statement from an average of zero.
  if (value === null) return "—"
  return `${value.toFixed(0)} min`
}

export function CourierKpiTable({ rows, isLoading }: { rows: CourierKpi[]; isLoading: boolean }) {
  if (isLoading) return <p className="text-sm text-ink-600/60">Loading courier performance…</p>
  if (rows.length === 0) {
    return <p className="text-sm text-ink-600/60">No couriers on this restaurant yet.</p>
  }

  const most = Math.max(1, ...rows.map((r) => r.deliveries))

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-ink-600">
            <th className="pb-2 font-medium">Courier</th>
            <th className="pb-2 text-right font-medium">Deliveries</th>
            <th className="pb-2 text-right font-medium">Revenue</th>
            {/* Splitting the clock is the point: a slow total with a fine road time is a
                kitchen problem, not a courier problem. */}
            <th className="pb-2 text-right font-medium">Total</th>
            <th className="pb-2 text-right font-medium">Pickup</th>
            <th className="pb-2 text-right font-medium">Road</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.courier_id} className="border-t border-ink-900/[0.07]">
              <td className="py-2.5 pr-3">
                <span className="text-ink-900">{row.full_name}</span>
                <span className="mt-1 block h-1.5 w-24 rounded-full bg-ink-900/[0.06]">
                  <span
                    className="block h-1.5 rounded-full"
                    style={{
                      width: `${(row.deliveries / most) * 100}%`,
                      backgroundColor: CATEGORICAL[0],
                    }}
                  />
                </span>
              </td>
              <td className="py-2.5 text-right font-mono text-xs text-ink-950">{row.deliveries}</td>
              <td className="py-2.5 text-right font-mono text-xs text-ink-950">{money(row.revenue)}</td>
              <td className="py-2.5 text-right font-mono text-xs text-ink-700">{minutes(row.avg_total_minutes)}</td>
              <td className="py-2.5 text-right font-mono text-xs text-ink-700">{minutes(row.avg_pickup_minutes)}</td>
              <td className="py-2.5 text-right font-mono text-xs text-ink-700">{minutes(row.avg_road_minutes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
