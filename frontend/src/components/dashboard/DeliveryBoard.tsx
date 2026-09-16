import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ApiError, assignFleetOrder, type BoardOrder, type DeliveryStatus, type FleetCourier } from "../../lib/api"
import { money } from "./Panels"

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  placed: "Waiting",
  accepted: "To pick up",
  picked_up: "On the road",
  delivered: "Delivered",
  cancelled: "Cancelled",
}

const STATUS_CLASS: Record<DeliveryStatus, string> = {
  placed: "bg-ember-600/10 text-ember-600",
  accepted: "bg-[#2a78d6]/10 text-[#2a78d6]",
  picked_up: "bg-[#1baf7a]/10 text-[#1baf7a]",
  delivered: "bg-ink-900/[0.06] text-ink-600",
  cancelled: "bg-[#e34948]/10 text-[#e34948]",
}

function waitingMinutes(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
}

function AssignControl({
  order,
  couriers,
}: {
  order: BoardOrder
  couriers: FleetCourier[]
}) {
  const queryClient = useQueryClient()
  const [courierId, setCourierId] = useState<string>("")

  const assign = useMutation({
    mutationFn: () => assignFleetOrder(order.id, Number(courierId)),
    onSuccess: () => {
      setCourierId("")
      queryClient.invalidateQueries({ queryKey: ["admin", "fleet"] })
    },
  })

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={courierId}
        onChange={(e) => setCourierId(e.target.value)}
        className="rounded-full border border-ink-900/15 bg-parchment-50 px-3 py-1.5 text-xs text-ink-800"
        aria-label={`Assign ${order.public_code} to a courier`}
      >
        <option value="">Assign to…</option>
        {couriers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.full_name}
            {c.is_on_shift ? "" : " (off shift)"}
            {c.active_load > 0 ? ` · ${c.active_load} in hand` : ""}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!courierId || assign.isPending}
        onClick={() => assign.mutate()}
        className="rounded-full bg-ink-950 px-3 py-1.5 text-xs font-medium text-parchment-50 transition-opacity disabled:opacity-40"
      >
        {assign.isPending ? "Assigning…" : order.courier_id ? "Reassign" : "Assign"}
      </button>
      {assign.isError && (
        <span className="text-xs text-[#e34948]">
          {assign.error instanceof ApiError ? assign.error.message : "Could not assign that."}
        </span>
      )}
    </div>
  )
}

export function DeliveryBoard({
  orders,
  couriers,
  isLoading,
}: {
  orders: BoardOrder[]
  couriers: FleetCourier[]
  isLoading: boolean
}) {
  if (isLoading) return <p className="text-sm text-ink-600/60">Loading the board…</p>
  if (orders.length === 0) {
    return (
      <p className="text-sm text-ink-600/60">
        Nothing in flight. New delivery orders appear here the moment a customer places one.
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {orders.map((order) => {
        const waiting = waitingMinutes(order.placed_at)
        // An unassigned order that has been sitting is the one thing on this screen that
        // needs a dispatcher right now, so it is the only thing that gets an alarm colour.
        const stuck = order.courier_id === null && waiting >= 10
        return (
          <li
            key={order.id}
            className={`rounded-2xl border p-4 ${
              stuck ? "border-[#e34948]/40 bg-[#e34948]/[0.04]" : "border-ink-900/10 bg-parchment-100/50"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-ink-600">{order.public_code}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STATUS_CLASS[order.status]}`}
                  >
                    {STATUS_LABEL[order.status]}
                  </span>
                </div>
                <p className="mt-1 font-display text-lg text-ink-950">{order.recipient_name}</p>
                <p className="truncate text-xs text-ink-600">{order.address_text}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm text-ink-950">{money(order.total)}</p>
                <p className={`text-[11px] ${stuck ? "text-[#e34948]" : "text-ink-600"}`}>
                  {waiting} min ago
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-ink-900/[0.07] pt-3">
              <p className="text-xs text-ink-600">
                {order.courier_name ? (
                  <>
                    Carried by <span className="text-ink-900">{order.courier_name}</span>
                  </>
                ) : (
                  "No courier yet"
                )}
              </p>
              {order.status !== "delivered" && order.status !== "cancelled" && (
                <AssignControl order={order} couriers={couriers} />
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
