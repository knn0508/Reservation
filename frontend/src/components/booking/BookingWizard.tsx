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
import { defaultBookableDay, formatSlotTime } from "../../lib/time"
import { ApiError } from "../../lib/api"

type Step = "date" | "party" | "time" | "table" | "done"

const STEP_ORDER: Step[] = ["date", "party", "time", "table", "done"]

const variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 24 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -24 }),
}

export function BookingWizard({ restaurantId, restaurantSlug }: { restaurantId: number; restaurantSlug?: string }) {
  const { user } = useAuth()
  const [step, setStep] = useState<Step>("date")
  const [day, setDay] = useState(() => defaultBookableDay())
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
    if (!partySize || !user || !selectedTime || selectedTable === null) return
    createReservation.mutate(
      {
        restaurant_id: restaurantId,
        guest_name: user.full_name,
        guest_email: user.email,
        guest_phone: user.phone,
        party_size: partySize,
        start_time: selectedTime,
        table_id: selectedTable.id,
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
                onChange={(size) => setPartySize(size)}
                onContinue={() => {
                  setPartySize((prev) => prev ?? 2)
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
              {/* The plan reaches into the card's padding — it is the one step that wants
                  every pixel of width it can get. The seating it is drawn for is named in the
                  plan's own header, so nothing above it repeats that. */}
              <div className="-mx-4 mt-4 md:-mx-7">
                <FloorPlan
                  tables={slotTables}
                  restaurantSlug={restaurantSlug}
                  value={selectedTableId}
                  onChange={setSelectedTableId}
                  disabled={createReservation.isPending}
                  partySize={partySize}
                  slotLabel={formatSlotTime(selectedTime)}
                  onConfirm={handleConfirm}
                  confirmPending={createReservation.isPending}
                />
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
