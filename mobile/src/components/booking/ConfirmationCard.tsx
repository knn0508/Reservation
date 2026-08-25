import { StyleSheet, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { Reservation } from "../../lib/api"
import { formatFullDate, formatSlotTime, toDayKey } from "../../lib/time"
import { alpha, colors, fonts } from "../../lib/theme"
import { FadeIn } from "../ui/FadeIn"

export function ConfirmationCard({ reservation }: { reservation: Reservation }) {
  const dayKey = toDayKey(new Date(reservation.start_time))

  return (
    <FadeIn offset={8} duration={380}>
      <View style={styles.card}>
        <View style={styles.headline}>
          <Ionicons name="checkmark-circle" size={22} color={colors.moss500} />
          <Text style={styles.headlineText}>Table confirmed</Text>
        </View>

        <Text style={styles.subtitle}>
          A confirmation has been sent to <Text style={styles.subtitleStrong}>{reservation.guest_email}</Text>.
        </Text>

        <View style={styles.details}>
          <Row icon="time-outline">
            {formatFullDate(dayKey)} at {formatSlotTime(reservation.start_time)}
          </Row>
          <Row icon="people-outline">{reservation.party_size} guests</Row>
          <Row icon="pricetag-outline" mono>
            {reservation.id}
          </Row>
        </View>
      </View>
    </FadeIn>
  )
}

function Row({
  icon,
  children,
  mono,
}: {
  icon: keyof typeof Ionicons.glyphMap
  children: React.ReactNode
  mono?: boolean
}) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={16} color={colors.ember600} />
      <Text style={[styles.rowText, mono && styles.rowTextMono]} numberOfLines={mono ? 1 : undefined}>
        {children}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: alpha.moss(0.25),
    backgroundColor: alpha.moss(0.04),
    padding: 20,
  },
  headline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headlineText: {
    fontFamily: fonts.display,
    fontSize: 19,
    color: colors.ink950,
  },
  subtitle: {
    marginTop: 8,
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink600,
  },
  subtitleStrong: {
    color: colors.ink900,
  },
  details: {
    marginTop: 18,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: alpha.ink(0.1),
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink800,
  },
  rowTextMono: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.ink600,
  },
})
