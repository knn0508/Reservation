import { type ReactNode } from "react"

/** The dashboard's two containers and its money format, shared by every dashboard page so
 *  the sales view and the delivery view cannot drift apart visually. */

export function money(n: number): string {
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} ₼`
}

export function StatTile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-ink-900/10 bg-parchment-100/60 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-600">
        {accent && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />}
        {label}
      </div>
      <p className="mt-1.5 font-display text-2xl text-ink-950">{value}</p>
    </div>
  )
}

export function ChartCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="rounded-[1.75rem] border border-ink-900/10 bg-parchment-100/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg text-ink-950">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-ink-600">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  )
}
