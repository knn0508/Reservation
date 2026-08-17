import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  cancelReservation,
  completeReservation,
  getAdminReservations,
  getAdminTables,
  markNoShow,
  seatReservation,
  type Reservation,
} from "../lib/api"
import { DateStrip } from "../components/booking/DateStrip"
import { formatSlotTime, toDayKey } from "../lib/time"

const STATUS_STYLE: Record<string, string> = {
  booked: "bg-moss-500/10 text-moss-500",
  seated: "bg-ember-500/10 text-ember-600",
  completed: "bg-ink-900/8 text-ink-600",
  cancelled: "bg-rust-500/10 text-rust-500",
  no_show: "bg-rust-500/10 text-rust-500",
}

const actionButtonClass =
  "rounded-full border border-ink-900/15 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-ink-700 transition-colors hover:border-ember-400/60 hover:text-ink-950 disabled:opacity-40"

function RowActions({
  reservation,
  tableOptions,
  onChanged,
}: {
  reservation: Reservation
  tableOptions: { id: number; label: string }[]
  onChanged: () => void
}) {
  const [tableId, setTableId] = useState<number | "">("")

  const seat = useMutation({
    mutationFn: (id: number) => seatReservation(reservation.id, id),
    onSuccess: onChanged,
  })
  const noShow = useMutation({ mutationFn: () => markNoShow(reservation.id), onSuccess: onChanged })
  const complete = useMutation({ mutationFn: () => completeReservation(reservation.id), onSuccess: onChanged })
  const cancel = useMutation({ mutationFn: () => cancelReservation(reservation.id), onSuccess: onChanged })

  const busy = seat.isPending || noShow.isPending || complete.isPending || cancel.isPending

  if (reservation.status === "booked") {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={tableId}
          onChange={(e) => setTableId(e.target.value ? Number(e.target.value) : "")}
          className="rounded-full border border-ink-900/15 bg-parchment-50 px-2 py-1 text-[11px] text-ink-700 outline-none focus:border-ember-500"
        >
          <option value="">Table…</option>
          {tableOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy || tableId === ""}
          onClick={() => tableId !== "" && seat.mutate(tableId)}
          className={actionButtonClass}
        >
          Seat
        </button>
        <button type="button" disabled={busy} onClick={() => noShow.mutate()} className={actionButtonClass}>
          No-show
        </button>
        <button type="button" disabled={busy} onClick={() => cancel.mutate()} className={actionButtonClass}>
          Cancel
        </button>
      </div>
    )
  }

  if (reservation.status === "seated") {
    return (
      <button type="button" disabled={busy} onClick={() => complete.mutate()} className={actionButtonClass}>
        Complete
      </button>
    )
  }

  return <span className="text-xs text-ink-600/50">—</span>
}

export function AdminPage() {
  const [day, setDay] = useState(() => toDayKey(new Date()))
  const queryClient = useQueryClient()

  const reservationsKey = ["admin", "reservations", day]
  const reservations = useQuery({
    queryKey: reservationsKey,
    queryFn: () => getAdminReservations(day),
    refetchInterval: 15_000,
  })

  const tables = useQuery({ queryKey: ["admin", "tables"], queryFn: getAdminTables })

  function refresh() {
    queryClient.invalidateQueries({ queryKey: reservationsKey })
  }

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10 md:px-10 md:py-16">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-ember-600">Floor</p>
      <h1 className="mt-2 font-display text-3xl text-ink-950">Service overview</h1>

      <div className="mt-6">
        <DateStrip value={day} onChange={setDay} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="overflow-x-auto rounded-2xl border border-ink-900/10">
          <table className="w-full min-w-[44rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink-900/10 bg-parchment-100/60 text-left text-xs uppercase tracking-wide text-ink-600">
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Guest</th>
                <th className="px-4 py-3 font-medium">Party</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reservations.isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ink-600">
                    Loading…
                  </td>
                </tr>
              )}
              {reservations.data?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ink-600">
                    No reservations for this day.
                  </td>
                </tr>
              )}
              {reservations.data?.map((r) => (
                <tr key={r.id} className="border-b border-ink-900/6 last:border-0">
                  <td className="px-4 py-3 tabular-nums text-ink-900">{formatSlotTime(r.start_time)}</td>
                  <td className="px-4 py-3 text-ink-900">{r.guest_name}</td>
                  <td className="px-4 py-3 text-ink-700">{r.party_size}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${STATUS_STYLE[r.status] ?? ""}`}
                    >
                      {r.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <RowActions
                      reservation={r}
                      onChanged={refresh}
                      tableOptions={(tables.data ?? [])
                        .filter((t) => t.category === r.table_category)
                        .map((t) => ({ id: t.id, label: `${t.table_number} · ${t.zone}` }))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl border border-ink-900/10 bg-parchment-100/60 p-5">
          <h2 className="font-display text-lg text-ink-950">Tables</h2>
          <div className="mt-4 space-y-2">
            {tables.data?.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <span className="text-ink-800">
                  {t.table_number} · {t.zone}
                </span>
                <span className="text-xs uppercase tracking-wide text-ink-600">
                  {t.category.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
