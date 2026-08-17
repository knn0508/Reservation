import { useState } from "react"
import { motion } from "framer-motion"
import { MagnifyingGlass, Clock, Users, XCircle } from "@phosphor-icons/react"
import { useReservationLookup, useCancelReservation } from "../hooks/useReservation"
import { formatFullDate, formatSlotTime, toDayKey } from "../lib/time"
import { ApiError } from "../lib/api"

export function LookupPage() {
  const [input, setInput] = useState("")
  const [id, setId] = useState<string | null>(null)
  const lookup = useReservationLookup(id)
  const cancel = useCancelReservation()

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setId(input.trim())
  }

  const reservation = lookup.data

  return (
    <div className="mx-auto max-w-lg px-6 py-14 md:px-10">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-ember-600">Manage</p>
      <h1 className="mt-2 font-display text-3xl text-ink-950">Find your reservation</h1>
      <p className="mt-2 text-sm text-ink-600">Paste the confirmation ID from your booking email.</p>

      <form onSubmit={handleSearch} className="mt-6 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Reservation ID"
          className="flex-1 rounded-lg border border-ink-900/15 bg-parchment-50 px-3.5 py-2.5 text-sm text-ink-950 outline-none transition-colors duration-200 focus:border-ember-500"
        />
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-lg bg-ink-950 px-4 py-2.5 text-sm font-medium text-parchment-50"
        >
          <MagnifyingGlass size={15} />
          Find
        </button>
      </form>

      {lookup.isFetching && <p className="mt-6 text-sm text-ink-600">Searching…</p>}

      {lookup.isError && id && (
        <div className="mt-6 rounded-lg border border-rust-500/30 bg-rust-500/5 px-3.5 py-2.5 text-sm text-rust-500">
          {lookup.error instanceof ApiError ? lookup.error.message : "Reservation not found."}
        </div>
      )}

      {reservation && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 rounded-2xl border border-ink-900/10 bg-parchment-100/60 p-6"
        >
          <div className="flex items-center justify-between">
            <span className="font-display text-lg text-ink-950">
              {formatFullDate(toDayKey(new Date(reservation.start_time)))}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${
                reservation.status === "cancelled" || reservation.status === "no_show"
                  ? "bg-rust-500/10 text-rust-500"
                  : reservation.status === "completed"
                    ? "bg-ink-900/8 text-ink-600"
                    : "bg-moss-500/10 text-moss-500"
              }`}
            >
              {reservation.status.replace("_", " ")}
            </span>
          </div>

          <div className="mt-4 space-y-2.5 text-sm text-ink-800">
            <div className="flex items-center gap-2.5">
              <Clock size={16} className="text-ember-600" />
              {formatSlotTime(reservation.start_time)}
            </div>
            <div className="flex items-center gap-2.5">
              <Users size={16} className="text-ember-600" />
              {reservation.party_size} guests
            </div>
          </div>

          {reservation.status === "booked" && (
            <button
              type="button"
              onClick={() => cancel.mutate(reservation.id)}
              disabled={cancel.isPending}
              className="mt-5 flex items-center gap-1.5 rounded-lg border border-rust-500/30 px-3.5 py-2 text-sm font-medium text-rust-500 transition-colors hover:bg-rust-500/5 disabled:opacity-50"
            >
              <XCircle size={16} />
              {cancel.isPending ? "Cancelling…" : "Cancel reservation"}
            </button>
          )}
        </motion.div>
      )}
    </div>
  )
}
