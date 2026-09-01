import { ScrollView, StyleSheet, Text, View } from "react-native"
import { formatShortDate, nextNDays } from "../../lib/time"
import { alpha, colors, fonts, radius } from "../../lib/theme"
import { PressScale } from "../ui/Pressable"

export function DateStrip({
  value,
  onChange,
  days: dayCount = 30,
}: {
  value: string
  onChange: (day: string) => void
  days?: number
}) {
  const days = nextNDays(dayCount)

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      // Matches the web's `-mx-1 … pr-6` bleed so the last chip isn't flush with the edge.
      style={styles.scroller}
    >
      {days.map((day) => {
        const active = day === value
        const { weekday, day: dayNum } = formatShortDate(day)
        return (
          <PressScale key={day} onPress={() => onChange(day)} scaleTo={0.94}>
            <View style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}>
              <Text style={[styles.weekday, active && styles.textActive]}>{weekday}</Text>
              <Text style={[styles.dayNum, active && styles.textActive]}>{dayNum}</Text>
            </View>
          </PressScale>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroller: {
    marginHorizontal: -4,
  },
  row: {
    gap: 8,
    paddingHorizontal: 4,
    paddingRight: 24,
    paddingVertical: 2,
  },
  chip: {
    minWidth: 60,
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chipIdle: {
    borderColor: alpha.ink(0.15),
    backgroundColor: colors.parchment100,
  },
  chipActive: {
    borderColor: colors.ember500,
    backgroundColor: colors.ink950,
  },
  weekday: {
    fontFamily: fonts.sans,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.ink700,
    opacity: 0.7,
  },
  dayNum: {
    fontFamily: fonts.display,
    fontSize: 18,
    lineHeight: 24,
    color: colors.ink700,
  },
  textActive: {
    color: colors.parchment50,
  },
})
