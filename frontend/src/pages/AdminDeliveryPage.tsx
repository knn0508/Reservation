import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  getCourierKpis,
  getFleetOrders,
  getFleetSummary,
  getOriginCells,
} from "../lib/api"
import { useAuth } from "../hooks/useAuth"
import { useCourierFleet } from "../hooks/useCourierFleet"
import { ChartCard, StatTile, money } from "../components/dashboard/Panels"
import { CourierKpiTable } from "../components/dashboard/CourierKpiTable"
import { DeliveryBoard } from "../components/dashboard/DeliveryBoard"
import { FleetMap } from "../components/dashboard/FleetMap"
import { OriginHeatmap } from "../components/dashboard/OriginHeatmap"
import { CATEGORICAL } from "../lib/chartColors"

const WINDOWS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
]

/**
 * The owner's delivery dashboard: where the couriers are, what is in flight, and where the
 * orders come from.
 *
 * The board polls rather than subscribing. Order status changes a handful of times per
 * delivery, so a 10 s poll is honest and far simpler than another socket; only courier
 * *position* moves fast enough to need one.
 */
export function AdminDeliveryPage() {
  const { user } = useAuth()
  const [days, setDays] = useState(30)

  const { couriers, connected, isLoading: fleetLoading } = useCourierFleet(user?.restaurant_id ?? null)

  const summary = useQuery({
    queryKey: ["admin", "fleet", "summary"],
    queryFn: getFleetSummary,
    refetchInterval: 15_000,
  })
  const orders = useQuery({
    queryKey: ["admin", "fleet", "orders"],
    queryFn: () => getFleetOrders(false),
    refetchInterval: 10_000,
  })
  const origins = useQuery({
    queryKey: ["admin", "fleet", "origins", days],
    queryFn: () => getOriginCells(days),
  })
  const kpis = useQuery({
    queryKey: ["admin", "fleet", "kpis", days],
    queryFn: () => getCourierKpis(days),
  })

  const activeOrders = orders.data ?? []

  return (
    <div className="mx-auto max-w-[72rem] px-4 py-10 md:px-10 md:py-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-ember-600">
            Kuryer izləmə
          </p>
          <h1 className="mt-1 font-display text-3xl text-ink-950">Deliveries</h1>
        </div>
        <div className="flex gap-1.5 rounded-full border border-ink-900/10 bg-parchment-100/60 p-1">
          {WINDOWS.map((w) => (
            <button
              key={w.days}
              type="button"
              onClick={() => setDays(w.days)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                days === w.days ? "bg-ink-950 text-parchment-50" : "text-ink-700 hover:text-ink-950"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Couriers live"
          value={`${summary.data?.couriers_live ?? 0} / ${summary.data?.couriers_on_shift ?? 0} on shift`}
          accent={CATEGORICAL[1]}
        />
        <StatTile label="In flight" value={`${summary.data?.active_orders ?? 0} orders`} />
        <StatTile
          label="Waiting for a courier"
          value={`${summary.data?.unassigned_orders ?? 0} orders`}
          accent={summary.data?.unassigned_orders ? "#e34948" : undefined}
        />
        <StatTile
          label="Delivered (24h)"
          value={`${summary.data?.delivered_today ?? 0} · ${money(summary.data?.revenue_today ?? 0)}`}
          accent={CATEGORICAL[2]}
        />
      </div>

      <div className="mt-6">
        <ChartCard
          title="Live fleet"
          subtitle="Courier positions, updated once a second while they are on shift"
        >
          <FleetMap couriers={couriers} orders={activeOrders} connected={connected} />
        </ChartCard>
      </div>

      <div className="mt-6">
        <ChartCard
          title="Dispatch board"
          subtitle="Everything in flight, oldest first — assign by hand when the board needs it"
        >
          <DeliveryBoard
            orders={activeOrders}
            couriers={couriers}
            isLoading={orders.isLoading || fleetLoading}
          />
        </ChartCard>
      </div>

      <div className="mt-6">
        <ChartCard
          title="Where orders come from"
          subtitle={`Delivered orders by ~100 m grid cell, last ${days} days`}
        >
          <OriginHeatmap cells={origins.data ?? []} isLoading={origins.isLoading} />
        </ChartCard>
      </div>

      <div className="mt-6">
        <ChartCard
          title="Courier performance"
          subtitle={`Averages over the last ${days} days — pickup is kitchen time, road is the drive`}
        >
          <CourierKpiTable rows={kpis.data ?? []} isLoading={kpis.isLoading} />
        </ChartCard>
      </div>
    </div>
  )
}
