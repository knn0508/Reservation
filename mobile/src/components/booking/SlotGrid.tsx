import { StyleSheet, Text, View } from "react-native"
import type { AvailabilitySlot } from "../../lib/api"
import { formatSlotTime } from "../../lib/time"
import { alpha, colors, fonts, radius } from "../../lib/theme"
import { EmptyNote, Skeleton } from "../ui/Primitives"
import { FadeIn } from "../ui/FadeIn"
import { PressScale } from "../ui/Pressable"

export function SlotGrid({
  slots,
  value,
  onChange,
  isLoading,
}: {
  slots: AvailabilitySlot[] | undefined
  value: string | null
  onChange: (time: string) => void
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <View style={styles.grid}>
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} height={44} style={styles.cell} />
        ))}
      </View>
    )
  }

  if (!slots || slots.length === 0) {
    return <EmptyNote>No service hours configured for this day.</EmptyNote>
  }

  const now = Date.now()
  const upcomingSlots = slots.filter((slot) => new Date(slot.time).getTime() > now)

  if (upcomingSlots.length === 0) {
    return <EmptyNote>No more service hours left today — try another date.</EmptyNote>
  }

  const anyOpen = upcomingSlots.some((slot) => slot.available_count > 0)

  if (!anyOpen) {
    return <EmptyNote>Fully booked for this party size on this day — try another date.</EmptyNote>
  }

  return (
    <View style={styles.grid}>
      {upcomingSlots.map((slot, i) => {
        const disabled = slot.available_count <= 0
        const active = value === slot.time
        return (
          <FadeIn key={slot.time} delay={i * 15} offset={6} duration={300} style={styles.cell}>
            <PressScale onPress={() => onChange(slot.time)} disabled={disabled} scaleTo={0.95}>
              <View
                style={[
                  styles.slot,
                  disabled ? styles.slotDisabled : active ? styles.slotActive : styles.slotIdle,
                ]}
              >
                <Text
                  style={[
                    styles.slotText,
                    disabled ? styles.slotTextDisabled : active ? styles.slotTextActive : null,
                  ]}
                >
                  {formatSlotTime(slot.time)}
                </Text>
              </View>
            </PressScale>
          </FadeIn>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  cell: {
    // Three per row with two 10px gaps, matching the web's `grid-cols-3`.
    width: "31%",
  },
  slot: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: 11,
    alignItems: "center",
  },
  slotIdle: {
    borderColor: alpha.ink(0.15),
    backgroundColor: colors.parchment100,
  },
  slotActive: {
    borderColor: colors.ember500,
    backgroundColor: colors.ink950,
  },
  slotDisabled: {
    borderColor: alpha.ink(0.08),
    backgroundColor: alpha.ink(0.03),
  },
  slotText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.ink800,
  },
  slotTextActive: {
    color: colors.parchment50,
  },
  slotTextDisabled: {
    color: alpha.ink(0.28),
    textDecorationLine: "line-through",
  },
})
