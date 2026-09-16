import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  getDashboardCategories,
  getDashboardCategoryProducts,
  getDashboardClients,
  getDashboardSales,
  type DashboardRange,
} from "../lib/api"
import { TwoSeriesLineChart } from "../components/dashboard/TwoSeriesLineChart"
import { CategoryDonut, type DonutSlice } from "../components/dashboard/CategoryDonut"
import { ChartCard, StatTile, money } from "../components/dashboard/Panels"
import { CATEGORICAL, OTHER_COLOR } from "../lib/chartColors"

const RANGE_OPTIONS: { value: DashboardRange; label: string }[] = [
  { value: "this_month", label: "This month" },
  { value: "last_2_months", label: "Last 2 months" },
  { value: "this_year", label: "This year" },
]

const MAX_DONUT_SLICES = 7

export function AdminDashboard() {
  const [range, setRange] = useState<DashboardRange>("this_month")
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)

  const sales = useQuery({ queryKey: ["admin", "dashboard", "sales", range], queryFn: () => getDashboardSales(range) })
  const clients = useQuery({ queryKey: ["admin", "dashboard", "clients", range], queryFn: () => getDashboardClients(range) })
  const categories = useQuery({
    queryKey: ["admin", "dashboard", "categories", range],
    queryFn: () => getDashboardCategories(range),
  })

  const topCategories = (categories.data ?? []).slice(0, MAX_DONUT_SLICES)
  const otherRevenue = (categories.data ?? []).slice(MAX_DONUT_SLICES).reduce((sum, c) => sum + c.revenue, 0)
  const otherPercent = (categories.data ?? []).slice(MAX_DONUT_SLICES).reduce((sum, c) => sum + c.percent, 0)

  const donutSlices: DonutSlice[] = [
    ...topCategories.map((c, i) => ({
      key: String(c.category_id),
      label: c.name,
      value: c.revenue,
      percent: c.percent,
      color: CATEGORICAL[i],
    })),
    ...(otherRevenue > 0
      ? [{ key: "other", label: "Other", value: otherRevenue, percent: otherPercent, color: OTHER_COLOR }]
      : []),
  ]

  const effectiveCategoryId = selectedCategoryId ?? topCategories[0]?.category_id ?? null
  const products = useQuery({
    queryKey: ["admin", "dashboard", "category-products", range, effectiveCategoryId],
    queryFn: () => getDashboardCategoryProducts(range, effectiveCategoryId as number),
    enabled: effectiveCategoryId !== null,
  })

  return (
    <div className="mx-auto max-w-[72rem] px-4 py-10 md:px-10 md:py-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-ember-600">Sales</p>
          <h1 className="mt-1 font-display text-3xl text-ink-950">Dashboard</h1>
        </div>
        <div className="flex gap-1.5 rounded-full border border-ink-900/10 bg-parchment-100/60 p-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRange(opt.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                range === opt.value ? "bg-ink-950 text-parchment-50" : "text-ink-700 hover:text-ink-950"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatTile label="Total sales" value={money(sales.data?.totals.total ?? 0)} />
        <StatTile label="Online sales" value={money(sales.data?.totals.online ?? 0)} accent={CATEGORICAL[0]} />
        <StatTile label="Restaurant sales" value={money(sales.data?.totals.restaurant ?? 0)} accent={CATEGORICAL[1]} />
      </div>

      <div className="mt-6">
        <ChartCard title="Sales over time" subtitle="Online pre-orders vs. in-restaurant sales">
          {sales.data && (
            <TwoSeriesLineChart
              points={sales.data.points.map((p) => ({ period: p.period, a: p.online, b: p.restaurant }))}
              granularity={sales.data.granularity}
              seriesLabels={["Online", "Restaurant"]}
              seriesColors={[CATEGORICAL[0], CATEGORICAL[1]]}
              valueFormatter={money}
            />
          )}
        </ChartCard>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <StatTile label="Clients from the app" value={`${clients.data?.totals.from_app ?? 0} tables`} accent={CATEGORICAL[0]} />
        <StatTile label="Total clients" value={`${clients.data?.totals.total ?? 0} tables`} accent={CATEGORICAL[1]} />
      </div>

      <div className="mt-6">
        <ChartCard title="Clients over time" subtitle="Counted by table seated, not headcount">
          {clients.data && (
            <TwoSeriesLineChart
              points={clients.data.points.map((p) => ({ period: p.period, a: p.from_app, b: p.total }))}
              granularity={clients.data.granularity}
              seriesLabels={["From the app", "Total"]}
              seriesColors={[CATEGORICAL[0], CATEGORICAL[1]]}
              valueFormatter={(n) => n.toFixed(0)}
            />
          )}
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Sales by category" subtitle="Share of revenue in the selected period">
          {donutSlices.length > 0 ? (
            <CategoryDonut
              slices={donutSlices}
              selectedKey={effectiveCategoryId !== null ? String(effectiveCategoryId) : null}
              onSelect={(key) => {
                if (key === "other") return
                setSelectedCategoryId(Number(key))
              }}
            />
          ) : (
            <p className="text-sm text-ink-600/60">No sales in this period.</p>
          )}
        </ChartCard>

        <ChartCard
          title={products.data?.name ? `${products.data.name} products` : "Products"}
          subtitle="Share of this category's revenue"
        >
          {products.data && products.data.products.length > 0 ? (
            <ul className="space-y-2.5">
              {products.data.products.map((p) => (
                <li key={p.product_id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate text-ink-800">{p.name}</span>
                    <span className="ml-2 shrink-0 font-mono text-xs text-ink-600">{p.percent.toFixed(1)}%</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-ink-900/[0.06]">
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${p.percent}%`, backgroundColor: CATEGORICAL[0] }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-600/60">Select a category to see its products.</p>
          )}
        </ChartCard>
      </div>
    </div>
  )
}
