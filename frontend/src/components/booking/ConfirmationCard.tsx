import { motion } from "framer-motion"
import { CheckCircle, Users, Clock, Hash } from "@phosphor-icons/react"
import type { Reservation } from "../../lib/api"
import { formatFullDate, formatSlotTime, toDayKey } from "../../lib/time"

export function ConfirmationCard({ reservation }: { reservation: Reservation }) {
  const dayKey = toDayKey(new Date(reservation.start_time))

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      className="max-w-md rounded-2xl border border-moss-500/25 bg-moss-500/[0.04] p-6"
    >
      <div className="flex items-center gap-2.5 text-moss-500">
        <CheckCircle size={22} weight="fill" />
        <span className="font-display text-lg text-ink-950">Table confirmed</span>
      </div>

      <p className="mt-2 text-sm text-ink-600">
        A confirmation has been sent to <span className="text-ink-900">{reservation.guest_email}</span>.
      </p>

      <dl className="mt-5 space-y-3 border-t border-ink-900/10 pt-5">
        <div className="flex items-center gap-3 text-sm">
          <Clock size={17} className="shrink-0 text-ember-600" />
          <span className="text-ink-800">
            {formatFullDate(dayKey)} at {formatSlotTime(reservation.start_time)}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Users size={17} className="shrink-0 text-ember-600" />
          <span className="text-ink-800">{reservation.party_size} guests</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Hash size={17} className="shrink-0 text-ember-600" />
          <span className="font-mono text-xs text-ink-600">{reservation.id}</span>
        </div>
      </dl>
    </motion.div>
  )
}
