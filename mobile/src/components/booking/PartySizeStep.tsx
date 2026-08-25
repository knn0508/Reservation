import { StyleSheet, Text, View } from "react-native"
import { alpha, colors, fonts } from "../../lib/theme"
import { Body, Display, Eyebrow } from "../ui/Primitives"
import { PressScale } from "../ui/Pressable"

const SIZES = [1, 2, 3, 4]

export function PartySizeStep({
  value,
  onChange,
}: {
  value: number | null
  onChange: (size: number) => void
}) {
  return (
    <View>
      <Eyebrow>Step 2</Eyebrow>
      <Display size={26} style={{ marginTop: 4 }}>
        How many at your table?
      </Display>
      <Body style={{ marginTop: 8 }}>
        Parties larger than four are seated as a shared table experience — call the house directly and we will
        arrange it.
      </Body>

      <View style={styles.grid}>
        {SIZES.map((size) => {
          const active = value === size
          return (
            <PressScale key={size} onPress={() => onChange(size)} scaleTo={0.94} style={styles.cell}>
              <View style={[styles.tile, active ? styles.tileActive : styles.tileIdle]}>
                <Text style={[styles.number, active && styles.textActive]}>{size}</Text>
                <Text style={[styles.caption, active && styles.textActive]}>{size === 1 ? "guest" : "guests"}</Text>
              </View>
            </PressScale>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {
    marginTop: 24,
    flexDirection: "row",
    gap: 10,
  },
  cell: {
    flex: 1,
  },
  tile: {
    // Square tiles, the way `aspect-square` rendered them on the web.
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    borderWidth: 1,
  },
  tileIdle: {
    borderColor: alpha.ink(0.15),
    backgroundColor: colors.parchment100,
  },
  tileActive: {
    borderColor: colors.ember500,
    backgroundColor: colors.ink950,
  },
  number: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.ink800,
  },
  caption: {
    marginTop: 2,
    fontFamily: fonts.sans,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.ink800,
    opacity: 0.7,
  },
  textActive: {
    color: colors.parchment50,
  },
})
