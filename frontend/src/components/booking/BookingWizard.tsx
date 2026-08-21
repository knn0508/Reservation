import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { CaretLeft } from "@phosphor-icons/react"
import { PartySizeStep } from "./PartySizeStep"
import { DateStrip } from "./DateStrip"
import { SlotGrid } from "./SlotGrid"
import { FloorPlan } from "./FloorPlan"
import { ConfirmationCard } from "./ConfirmationCard"
import { useAvailability } from "../../hooks/useAvailability"
import { useCreateReservation } from "../../hooks/useReservation"
import { useAuth } from "../../hooks/useAuth"
import { formatSlotTime, toDayKey } from "../../lib/time"
import { ApiError } from "../../lib/api"

type Step = "date" | "party" | "time" | "table" | "done"

const STEP_ORDER: Step[] = ["date", "party", "time", "table", "done"]

const variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 24 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -24 }),
}

export function BookingWizard({ restaurantId }: { restaurantId: number }) {
  const { user } = useAuth()
  const [step, setStep] = useState<Step>("date")
  const [day, setDay] = useState(() => toDayKey(new Date()))
  const [partySize, setPartySize] = useState<number | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null)
  const [idempotencyKey] = useState(() => crypto.randomUUID())

  const availability = useAvailability(restaurantId, day, partySize ?? 2)
  const createReservation = useCreateReservation()

  const dir = (target: Step) => (STEP_ORDER.indexOf(target) > STEP_ORDER.indexOf(step) ? 1 : -1)

  function goTo(target: Step) {
    setStep(target)
  }

  function handleSelectSlot(time: string) {
    setSelectedTime(time)
    setSelectedTableId(null)
    goTo("table")
  }

  function handleConfirm() {
    if (!partySize || !user || !selectedTime || selectedTableId === null) return
    createReservation.mutate(
      {
        restaurant_id: restaurantId,
        guest_name: user.full_name,
        guest_email: user.email,
        guest_phone: user.phone,
        party_size: partySize,
        start_time: selectedTime,
        table_id: selectedTableId,
        idempotency_key: idempotencyKey,
      },
      { onSuccess: () => goTo("done") },
    )
  }

  const slotTables = availability.data?.find((slot) => slot.time === selectedTime)?.tables ?? []
  // A live availability push can take the highlighted table away; treat it as no longer selected.
  const selectedTable = slotTables.find((table) => table.id === selectedTableId && table.available) ?? null

  const backTarget: Partial<Record<Step, Step>> = { party: "date", time: "party", table: "time" }
  const canBack = step in backTarget

  return (
    <div className="relative min-h-[26rem]">
      {canBack && (
        <button
          type="button"
          onClick={() => goTo(backTarget[step]!)}
          className="mb-5 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-ink-600 transition-colors hover:text-ink-950"
        >
          <CaretLeft size={13} weight="bold" />
          Back
        </button>
      )}

      <AnimatePresence mode="wait" custom={dir(step)} initial={false}>
        <motion.div
          key={step}
          custom={dir(step)}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: "spring", stiffness: 340, damping: 32 }}
        >
          {step === "date" && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-ember-600">Step 1</p>
              <h2 className="font-display text-2xl text-ink-950 md:text-3xl">Pick a date</h2>
              <p className="mt-2 max-w-[46ch] text-sm leading-relaxed text-ink-600">
                Reservations open up to 7 days ahead.
              </p>
              <div className="mt-6">
                <DateStrip
                  value={day}
                  days={7}
                  onChange={(value) => {
                    setDay(value)
                    goTo("party")
                  }}
                />
              </div>
            </div>
          )}

          {step === "party" && (
            <div>
              <PartySizeStep
                value={partySize}
                onChange={(size) => {
                  setPartySize(size)
                  goTo("time")
                }}
              />
            </div>
          )}

          {step === "time" && partySize && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-ember-600">Step 3</p>
              <h2 className="font-display text-2xl text-ink-950 md:text-3xl">Pick a time</h2>
              <p className="mt-2 max-w-[46ch] text-sm leading-relaxed text-ink-600">
                Booking as {user?.full_name} ({user?.email}).
              </p>
              <div className="mt-5">
                <SlotGrid
                  slots={availability.data}
                  value={null}
                  onChange={handleSelectSlot}
                  isLoading={availability.isLoading || createReservation.isPending}
                />
              </div>
            </div>
          )}

          {step === "table" && selectedTime && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-ember-600">Step 4</p>
              <h2 className="font-display text-2xl text-ink-950 md:text-3xl">Choose your table</h2>
              <p className="mt-2 max-w-[46ch] text-sm leading-relaxed text-ink-600">
                {formatSlotTime(selectedTime)} · party of {partySize}. This is the dining room seen from
                above — bold tables are open at that time, faded ones are already booked.
              </p>

              <div className="mt-5">
                <FloorPlan
                  tables={slotTables}
                  value={selectedTableId}
                  onChange={setSelectedTableId}
                  disabled={createReservation.isPending}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-600">
                  {selectedTable ? (
                    <>
                      Table <span className="font-bold text-ink-950">{selectedTable.table_number}</span> selected
                    </>
                  ) : (
                    "Tap a table to select it."
                  )}
                </p>
                <button
                  type="button"
                  disabled={!selectedTable || createReservation.isPending}
                  onClick={handleConfirm}
                  className="rounded-xl bg-ink-950 px-5 py-2.5 text-sm font-medium text-parchment-50 transition-colors duration-200 hover:bg-ember-600 disabled:cursor-not-allowed disabled:bg-ink-900/15 disabled:text-ink-600/50"
                >
                  {createReservation.isPending ? "Reserving…" : "Confirm reservation"}
                </button>
              </div>

              {createReservation.isError && (
                <div className="mt-4 rounded-lg border border-rust-500/30 bg-rust-500/5 px-3.5 py-2.5 text-sm text-rust-500">
                  {createReservation.error instanceof ApiError
                    ? createReservation.error.message
                    : "Something went wrong — please try again."}
                </div>
              )}
            </div>
          )}

          {step === "done" && createReservation.data && <ConfirmationCard reservation={createReservation.data} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
