import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowCounterClockwise, Check, X } from "@phosphor-icons/react"
import {
  ApiError,
  cancelReservation,
  completeReservation,
  getAdminReservations,
  getAdminTables,
  markNoShow,
  revertReservationStatus,
  seatReservation,
  type DiningTable,
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

const ARM_TIMEOUT_MS = 4000

/** Requires a second click to actually fire, so a stray/accidental click can't change a
 * reservation's status. Reverts to the plain button on its own after a few seconds. */
function ConfirmButton({
  label,
  disabled,
  onConfirm,
  tone = "default",
}: {
  label: string
  disabled?: boolean
  onConfirm: () => void
  tone?: "default" | "danger"
}) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const timer = setTimeout(() => setArmed(false), ARM_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [armed])

  return (
    <AnimatePresence mode="wait" initial={false}>
      {armed ? (
        <motion.div
          key="confirm"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.15 }}
          className="inline-flex items-center gap-1"
        >
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setArmed(false)
              onConfirm()
            }}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-parchment-50 transition-colors disabled:opacity-40 ${
              tone === "danger" ? "bg-rust-500" : "bg-ink-950"
            }`}
          >
            <Check size={12} weight="bold" />
            Confirm {label}
          </button>
          <button
            type="button"
            onClick={() => setArmed(false)}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-ink-900/15 text-ink-600 transition-colors hover:text-ink-950"
            aria-label="Cancel"
          >
            <X size={12} weight="bold" />
          </button>
        </motion.div>
      ) : (
        <motion.button
          key="idle"
          type="button"
          disabled={disabled}
          onClick={() => setArmed(true)}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.15 }}
          className={actionButtonClass}
        >
          {label}
        </motion.button>
      )}
    </AnimatePresence>
  )
}

// What each status undoes back to, for the "Undo" button's label.
const REVERT_TARGET_LABEL: Record<string, string> = {
  seated: "booked",
  completed: "seated",
  cancelled: "booked",
  no_show: "booked",
}

function RowActions({
  reservation,
  onChanged,
}: {
  reservation: Reservation
  onChanged: () => void
}) {
  const seat = useMutation({ mutationFn: () => seatReservation(reservation.id), onSuccess: onChanged })
  const noShow = useMutation({ mutationFn: () => markNoShow(reservation.id), onSuccess: onChanged })
  const complete = useMutation({ mutationFn: () => completeReservation(reservation.id), onSuccess: onChanged })
  const cancel = useMutation({ mutationFn: () => cancelReservation(reservation.id), onSuccess: onChanged })
  const revert = useMutation({ mutationFn: () => revertReservationStatus(reservation.id), onSuccess: onChanged })

  const busy = seat.isPending || noShow.isPending || complete.isPending || cancel.isPending || revert.isPending
  const revertLabel = REVERT_TARGET_LABEL[reservation.status]

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {reservation.status === "booked" && (
          <>
            <ConfirmButton label="Seat" disabled={busy} onConfirm={() => seat.mutate()} />
            <ConfirmButton label="No-show" disabled={busy} onConfirm={() => noShow.mutate()} tone="danger" />
            <ConfirmButton label="Cancel" disabled={busy} onConfirm={() => cancel.mutate()} tone="danger" />
          </>
        )}
        {reservation.status === "seated" && (
          <ConfirmButton label="Complete" disabled={busy} onConfirm={() => complete.mutate()} />
        )}
        {revertLabel && (
          <button
            type="button"
            disabled={busy}
            onClick={() => revert.mutate()}
            title={`Undo - set back to ${revertLabel}`}
            className="flex items-center gap-1 rounded-full border border-ink-900/15 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-ink-700 transition-colors hover:border-ember-400/60 hover:text-ink-950 disabled:opacity-40"
          >
            <ArrowCounterClockwise size={12} weight="bold" />
            Undo
          </button>
        )}
      </div>
      {revert.isError && (
        <p className="mt-1 text-[11px] text-rust-500">
          {revert.error instanceof ApiError ? revert.error.message : "Couldn't undo - try again."}
        </p>
      )}
    </div>
  )
}

function tableLabel(tables: DiningTable[] | undefined, tableId: number): string {
  const table = tables?.find((t) => t.id === tableId)
  return table ? `${table.table_number} · ${table.zone}` : `#${tableId}`
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
    <div className="mx-auto max-w-[72rem] px-4 py-10 md:px-10 md:py-16">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-ember-600">Floor</p>
      <h1 className="mt-2 font-display text-3xl text-ink-950">Service overview</h1>

      <div className="mt-6">
        <DateStrip value={day} onChange={setDay} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="overflow-x-auto rounded-[1.75rem] border border-ink-900/10 bg-parchment-100/40">
          <table className="w-full min-w-[48rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink-900/10 bg-parchment-100/60 text-left text-xs uppercase tracking-wide text-ink-600">
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Guest</th>
                <th className="px-4 py-3 font-medium">Party</th>
                <th className="px-4 py-3 font-medium">Table</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reservations.isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-ink-600">
                    Loading…
                  </td>
                </tr>
              )}
              {reservations.data?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-ink-600">
                    No reservations for this day.
                  </td>
                </tr>
              )}
              {reservations.data?.map((r) => (
                <tr key={r.id} className="border-b border-ink-900/6 last:border-0">
                  <td className="px-4 py-3 tabular-nums text-ink-900">{formatSlotTime(r.start_time)}</td>
                  <td className="px-4 py-3 text-ink-900">{r.guest_name}</td>
                  <td className="px-4 py-3 text-ink-700">{r.party_size}</td>
                  <td className="px-4 py-3 text-ink-700">{tableLabel(tables.data, r.assigned_table_id)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${STATUS_STYLE[r.status] ?? ""}`}
                    >
                      {r.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <RowActions reservation={r} onChanged={refresh} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-[1.75rem] border border-ink-900/10 bg-parchment-100/60 p-5">
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
