import { motion } from "framer-motion"
import { useQuery } from "@tanstack/react-query"
import { CalendarBlank, Clock, Users, XCircle } from "@phosphor-icons/react"
import { useMyReservations, useCancelReservation } from "../hooks/useReservation"
import { getRestaurants, type Reservation } from "../lib/api"
import { formatFullDate, formatSlotTime, toDayKey } from "../lib/time"

const EASE = [0.32, 0.72, 0, 1] as const

const STATUS_STYLE: Record<string, string> = {
  booked: "bg-moss-500/10 text-moss-500",
  seated: "bg-ember-500/10 text-ember-600",
  completed: "bg-ink-900/8 text-ink-600",
  cancelled: "bg-rust-500/10 text-rust-500",
  no_show: "bg-rust-500/10 text-rust-500",
}

function ReservationCard({
  reservation,
  restaurantName,
  onCancel,
  isCancelling,
}: {
  reservation: Reservation
  restaurantName: string
  onCancel: () => void
  isCancelling: boolean
}) {
  return (
    <div className="rounded-[1.75rem] bg-ink-900/[0.04] p-1.5 ring-1 ring-ink-900/5">
      <div className="rounded-[calc(1.75rem-0.375rem)] border border-ink-900/8 bg-parchment-100 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-ember-600">
              {restaurantName}
            </span>
            <p className="mt-1 font-display text-lg text-ink-950">
              {formatFullDate(toDayKey(new Date(reservation.start_time)))}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${STATUS_STYLE[reservation.status] ?? ""}`}
          >
            {reservation.status.replace("_", " ")}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-700">
          <span className="flex items-center gap-1.5">
            <Clock size={15} className="text-ember-600" />
            {formatSlotTime(reservation.start_time)}
          </span>
          <span className="flex items-center gap-1.5">
            <Users size={15} className="text-ember-600" />
            {reservation.party_size} guests
          </span>
        </div>

        {reservation.status === "booked" && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isCancelling}
            className="mt-4 flex items-center gap-1.5 rounded-full border border-rust-500/30 px-3.5 py-1.5 text-xs font-medium text-rust-500 transition-colors hover:bg-rust-500/5 disabled:opacity-50"
          >
            <XCircle size={14} />
            {isCancelling ? "Cancelling…" : "Cancel reservation"}
          </button>
        )}
      </div>
    </div>
  )
}

export function MyReservationsPage() {
  const reservations = useMyReservations()
  const restaurants = useQuery({ queryKey: ["restaurants"], queryFn: getRestaurants })
  const cancel = useCancelReservation()

  const restaurantName = (id: number) => restaurants.data?.find((r) => r.id === id)?.name ?? `Restaurant #${id}`

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 md:px-10">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-ember-600">Account</p>
        <h1 className="mt-2 font-display text-3xl text-ink-950">My reservations</h1>
      </motion.div>

      {reservations.isLoading && (
        <div className="mt-8 space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-[1.75rem] bg-ink-900/5" />
          ))}
        </div>
      )}

      {reservations.data?.length === 0 && (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-[1.75rem] border border-dashed border-ink-900/15 px-6 py-14 text-center">
          <CalendarBlank size={28} className="text-ink-600/50" weight="light" />
          <p className="text-sm text-ink-600">You don't have any reservations yet.</p>
        </div>
      )}

      <div className="mt-8 space-y-3">
        {reservations.data?.map((r, i) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.05, ease: EASE }}
          >
            <ReservationCard
              reservation={r}
              restaurantName={restaurantName(r.restaurant_id)}
              onCancel={() => cancel.mutate(r.id)}
              isCancelling={cancel.isPending && cancel.variables === r.id}
            />
          </motion.div>
        ))}
      </div>
    </div>
  )
}
