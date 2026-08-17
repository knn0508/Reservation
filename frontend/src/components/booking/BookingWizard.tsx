import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { CaretLeft } from "@phosphor-icons/react"
import { PartySizeStep } from "./PartySizeStep"
import { DateStrip } from "./DateStrip"
import { SlotGrid } from "./SlotGrid"
import { GuestDetailsForm, type GuestDetails } from "./GuestDetailsForm"
import { ConfirmationCard } from "./ConfirmationCard"
import { useAvailability } from "../../hooks/useAvailability"
import { useCreateReservation } from "../../hooks/useReservation"
import { toDayKey } from "../../lib/time"
import { ApiError } from "../../lib/api"

type Step = "party" | "slot" | "details" | "done"

const STEP_ORDER: Step[] = ["party", "slot", "details", "done"]

const variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 24 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -24 }),
}

export function BookingWizard() {
  const [step, setStep] = useState<Step>("party")
  const [partySize, setPartySize] = useState<number | null>(null)
  const [day, setDay] = useState(() => toDayKey(new Date()))
  const [slotTime, setSlotTime] = useState<string | null>(null)
  const [details, setDetails] = useState<GuestDetails>({ guest_name: "", guest_email: "", guest_phone: "" })
  const [idempotencyKey] = useState(() => crypto.randomUUID())

  const availability = useAvailability(day)
  const createReservation = useCreateReservation()

  const dir = (target: Step) => (STEP_ORDER.indexOf(target) > STEP_ORDER.indexOf(step) ? 1 : -1)

  function goTo(target: Step) {
    setStep(target)
  }

  function handleSubmit() {
    if (!slotTime) return
    createReservation.mutate(
      { ...details, party_size: partySize as number, start_time: slotTime, idempotency_key: idempotencyKey },
      { onSuccess: () => goTo("done") },
    )
  }

  const canBack = step === "slot" || step === "details"

  return (
    <div className="relative min-h-[26rem]">
      {canBack && (
        <button
          type="button"
          onClick={() => goTo(step === "details" ? "slot" : "party")}
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
          {step === "party" && (
            <div>
              <PartySizeStep
                value={partySize}
                onChange={(size) => {
                  setPartySize(size)
                  goTo("slot")
                }}
              />
            </div>
          )}

          {step === "slot" && partySize && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-ember-600">Step 2</p>
              <h2 className="font-display text-2xl text-ink-950 md:text-3xl">Pick a date and time</h2>
              <div className="mt-6">
                <DateStrip value={day} onChange={setDay} />
              </div>
              <div className="mt-5">
                <SlotGrid
                  slots={availability.data}
                  partySize={partySize}
                  value={slotTime}
                  onChange={(time) => {
                    setSlotTime(time)
                    goTo("details")
                  }}
                  isLoading={availability.isLoading}
                />
              </div>
            </div>
          )}

          {step === "details" && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-ember-600">Step 3</p>
              <h2 className="font-display text-2xl text-ink-950 md:text-3xl">Your details</h2>
              <div className="mt-6">
                <GuestDetailsForm
                  details={details}
                  onChange={setDetails}
                  onSubmit={handleSubmit}
                  submitLabel="Confirm reservation"
                  isSubmitting={createReservation.isPending}
                  serverError={
                    createReservation.isError
                      ? createReservation.error instanceof ApiError
                        ? createReservation.error.message
                        : "Something went wrong — please try again."
                      : null
                  }
                />
              </div>
            </div>
          )}

          {step === "done" && createReservation.data && <ConfirmationCard reservation={createReservation.data} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
