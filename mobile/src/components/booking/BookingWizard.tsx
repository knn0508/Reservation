import { useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { PartySizeStep } from "./PartySizeStep"
import { DateStrip } from "./DateStrip"
import { SlotGrid } from "./SlotGrid"
import { FloorPlan } from "./FloorPlan"
import { ConfirmationCard } from "./ConfirmationCard"
import { useAvailability } from "../../hooks/useAvailability"
import { useCreateReservation } from "../../hooks/useReservation"
import { useAuth } from "../../hooks/useAuth"
import { formatSlotTime, toDayKey } from "../../lib/time"
import { randomUUID } from "../../lib/uuid"
import { ApiError } from "../../lib/api"
import { colors, fonts } from "../../lib/theme"
import { Body, Display, ErrorNote, Eyebrow } from "../ui/Primitives"
import { FadeIn } from "../ui/FadeIn"
import { PressScale } from "../ui/Pressable"

type Step = "date" | "party" | "time" | "table" | "done"

export function BookingWizard({ restaurantId, restaurantSlug }: { restaurantId: number; restaurantSlug?: string }) {
  const { user } = useAuth()
  const [step, setStep] = useState<Step>("date")
  const [day, setDay] = useState(() => toDayKey(new Date()))
  const [partySize, setPartySize] = useState<number | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null)
  const [idempotencyKey] = useState(() => randomUUID())

  const availability = useAvailability(restaurantId, day, partySize ?? 2)
  const createReservation = useCreateReservation()

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
    <View>
      {canBack && (
        <PressScale onPress={() => goTo(backTarget[step]!)} scaleTo={0.96} style={styles.back}>
          <View style={styles.backInner}>
            <Ionicons name="chevron-back" size={13} color={colors.ink600} />
            <Text style={styles.backLabel}>Back</Text>
          </View>
        </PressScale>
      )}

      {/* Re-keying on the step replays the entrance animation, the way AnimatePresence did. */}
      <FadeIn key={step} offset={12} duration={340}>
        {step === "date" && (
          <View>
            <Eyebrow>Step 1</Eyebrow>
            <Display size={26} style={{ marginTop: 4 }}>
              Pick a date
            </Display>
            <Body style={{ marginTop: 8 }}>Reservations open up to 7 days ahead.</Body>
            <View style={{ marginTop: 20 }}>
              <DateStrip
                value={day}
                days={7}
                onChange={(value) => {
                  setDay(value)
                  goTo("party")
                }}
              />
            </View>
          </View>
        )}

        {step === "party" && (
          <PartySizeStep
            value={partySize}
            onChange={(size) => {
              setPartySize(size)
              goTo("time")
            }}
          />
        )}

        {step === "time" && partySize && (
          <View>
            <Eyebrow>Step 3</Eyebrow>
            <Display size={26} style={{ marginTop: 4 }}>
              Pick a time
            </Display>
            <Body style={{ marginTop: 8 }}>
              Booking as {user?.full_name} ({user?.email}).
            </Body>
            <View style={{ marginTop: 18 }}>
              <SlotGrid
                slots={availability.data}
                value={null}
                onChange={handleSelectSlot}
                isLoading={availability.isLoading || createReservation.isPending}
              />
            </View>
          </View>
        )}

        {step === "table" && selectedTime && (
          <View>
            <Eyebrow>Step 4</Eyebrow>
            <Display size={26} style={{ marginTop: 4 }}>
              Choose your table
            </Display>
            {/* The seating the plan is drawn for is named in the plan's own header, and the
                reserve action lives in its detail sheet — nothing here repeats either. */}
            <View style={{ marginTop: 14 }}>
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
            </View>

            {createReservation.isError && (
              <View style={{ marginTop: 14 }}>
                <ErrorNote>
                  {createReservation.error instanceof ApiError
                    ? createReservation.error.message
                    : "Something went wrong — please try again."}
                </ErrorNote>
              </View>
            )}
          </View>
        )}

        {step === "done" && createReservation.data && <ConfirmationCard reservation={createReservation.data} />}
      </FadeIn>
    </View>
  )
}

const styles = StyleSheet.create({
  back: {
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  backInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  backLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.ink600,
  },
})
