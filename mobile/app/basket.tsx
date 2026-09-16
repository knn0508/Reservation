import { useQuery } from "@tanstack/react-query"
import { useRouter } from "expo-router"
import { Feather } from "@expo/vector-icons"
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { getDeliveryQuote, getMyReservations, getRestaurants } from "../src/lib/api"
import { useCart, type CartLine, type Fulfilment } from "../src/hooks/useCart"
import { Button, Card, EmptyState, Eyebrow, Screen, Title } from "../src/components/ui"
import { colors, formatPrice, radius } from "../src/lib/theme"
import { formatFullDate, formatSlotTime } from "../src/lib/time"

/**
 * The basket, and the fork that decides where the order goes.
 *
 * Two destinations, never mixed:
 *   Delivery    → a courier collects it and drives it to a pin. Carries a delivery fee.
 *   Reservation → the kitchen cooks it for a booking. No courier, no fee, no address.
 *
 * The fork lives here rather than at the end of checkout because the two paths ask for
 * completely different things, and nobody should fill in a delivery address only to find
 * out they meant their table booking.
 */
export default function BasketScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { lines, setQty, remove, clear, count, total, restaurantSlug, fulfilment, setFulfilment } =
    useCart()

  const restaurants = useQuery({ queryKey: ["restaurants"], queryFn: getRestaurants })
  const restaurant = (restaurants.data ?? []).find((r) => r.slug === restaurantSlug)

  const reservations = useQuery({
    queryKey: ["reservations", "me"],
    queryFn: getMyReservations,
    enabled: lines.length > 0,
  })
  const upcomingHere = (reservations.data ?? []).filter(
    (r) =>
      r.restaurant_id === restaurant?.id &&
      r.status === "booked" &&
      new Date(r.start_time) > new Date(),
  )
  const nextBooking = upcomingHere[0]

  const quote = useQuery({
    queryKey: ["delivery", "quote", total],
    queryFn: () => getDeliveryQuote(total),
    enabled: lines.length > 0 && fulfilment === "delivery",
  })
  // A pre-order is eaten at the table, so there is no delivery fee on that path at all.
  const fee = fulfilment === "delivery" ? (quote.data?.delivery_fee ?? 0) : 0

  function renderLine({ item: line }: { item: CartLine }) {
    const { item, qty } = line
    return (
      <View style={styles.line}>
        <View style={styles.lineText}>
          <Text style={styles.lineName}>{item.name}</Text>
          <Text style={styles.lineUnit}>{formatPrice(item.price)} each</Text>
          <View style={styles.stepper}>
            <Pressable
              onPress={() => setQty(item.id, qty - 1)}
              hitSlop={8}
              style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
              accessibilityLabel={`Decrease ${item.name}`}
            >
              <Feather name="minus" size={13} color={colors.ink700} />
            </Pressable>
            <Text style={styles.stepQty}>{qty}</Text>
            <Pressable
              onPress={() => setQty(item.id, qty + 1)}
              hitSlop={8}
              style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
              accessibilityLabel={`Increase ${item.name}`}
            >
              <Feather name="plus" size={13} color={colors.ink700} />
            </Pressable>
          </View>
        </View>
        <View style={styles.lineRight}>
          <Text style={styles.lineTotal}>{formatPrice(item.price * qty)}</Text>
          <Pressable onPress={() => remove(item.id)} hitSlop={10} accessibilityLabel={`Remove ${item.name}`}>
            <Feather name="trash-2" size={15} color={colors.ink600} />
          </Pressable>
        </View>
      </View>
    )
  }

  function Choice({
    value,
    icon,
    title,
    body,
  }: {
    value: Fulfilment
    icon: keyof typeof Feather.glyphMap
    title: string
    body: string
  }) {
    const active = fulfilment === value
    return (
      <Pressable
        onPress={() => setFulfilment(value)}
        style={[styles.choice, active && styles.choiceActive]}
      >
        <Feather name={icon} size={17} color={active ? colors.ember600 : colors.ink600} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.choiceTitle, active && styles.choiceTitleActive]}>{title}</Text>
          <Text style={styles.choiceBody}>{body}</Text>
        </View>
        {active && <Feather name="check" size={16} color={colors.ember600} />}
      </Pressable>
    )
  }

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Feather name="arrow-left" size={18} color={colors.ink800} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Eyebrow>Səbət</Eyebrow>
          <Title>Your basket</Title>
        </View>
        {lines.length > 0 && (
          <Pressable onPress={clear} hitSlop={10}>
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={lines}
        keyExtractor={(l) => l.item.id}
        renderItem={renderLine}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        contentContainerStyle={[styles.list, lines.length > 0 && styles.listWithBar]}
        ListHeaderComponent={
          lines.length > 0 ? (
            <View style={styles.headerBlock}>
              {restaurant ? <Text style={styles.from}>From {restaurant.name}</Text> : null}

              <Card style={styles.choiceCard}>
                <Text style={styles.choiceHeading}>How do you want this order?</Text>
                <Choice
                  value="delivery"
                  icon="truck"
                  title="Delivery"
                  body="A courier collects it and brings it to your door."
                />
                <Choice
                  value="reservation"
                  icon="calendar"
                  title="With my reservation"
                  body={
                    nextBooking
                      ? `Ready at your ${formatFullDate(nextBooking.start_time)} · ${formatSlotTime(nextBooking.start_time)} booking.`
                      : "Cooked for your booking time and served at your table."
                  }
                />
                {fulfilment === "reservation" && upcomingHere.length === 0 && !reservations.isLoading ? (
                  <Text style={styles.warn}>
                    You have no upcoming booking here yet — you'll be asked to make one on the next
                    screen.
                  </Text>
                ) : null}
              </Card>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            title="Nothing in the basket"
            body="Add a few dishes from the menu and they'll show up here."
          />
        }
      />

      {lines.length > 0 && (
        <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.barRow}>
            <Text style={styles.barLabel}>Subtotal</Text>
            <Text style={styles.barValue}>{formatPrice(total)}</Text>
          </View>
          {fulfilment === "delivery" ? (
            <View style={styles.barRow}>
              <Text style={styles.barLabel}>Delivery</Text>
              <Text style={styles.barValue}>{fee === 0 ? "Free" : formatPrice(fee)}</Text>
            </View>
          ) : (
            <View style={styles.barRow}>
              <Text style={styles.barLabel}>Served at your table</Text>
              <Text style={styles.barValue}>No fee</Text>
            </View>
          )}
          <View style={[styles.barRow, styles.barTotalRow]}>
            <Text style={styles.barTotalLabel}>Total</Text>
            <Text style={styles.barTotalValue}>{formatPrice(total + fee)}</Text>
          </View>
          {fulfilment === "delivery" && quote.data && fee > 0 ? (
            <Text style={styles.freeHint}>
              Delivery is free over {formatPrice(quote.data.free_over)}.
            </Text>
          ) : null}
          <Button
            title={
              fulfilment === "delivery"
                ? `Continue to delivery · ${count} item${count === 1 ? "" : "s"}`
                : `Continue to my booking · ${count} item${count === 1 ? "" : "s"}`
            }
            onPress={() => router.push(fulfilment === "delivery" ? "/checkout" : "/preorder")}
            style={styles.cta}
          />
        </View>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  back: { padding: 4 },
  clear: { fontSize: 13, color: colors.ink600 },
  headerBlock: { gap: 12, marginBottom: 14 },
  from: { fontSize: 12, color: colors.ink600 },
  choiceCard: { padding: 14, gap: 10 },
  choiceHeading: { fontSize: 15, color: colors.ink950 },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  choiceActive: { borderColor: colors.ember500, backgroundColor: colors.tintEmber },
  choiceTitle: { fontSize: 14, color: colors.ink800, fontWeight: "600" },
  choiceTitleActive: { color: colors.ink950 },
  choiceBody: { fontSize: 12, lineHeight: 17, color: colors.ink600, marginTop: 2 },
  warn: { fontSize: 12, lineHeight: 18, color: colors.ember600 },
  list: { paddingHorizontal: 20, paddingBottom: 32 },
  listWithBar: { paddingBottom: 280 },
  sep: { height: 1, backgroundColor: colors.line },
  line: { flexDirection: "row", gap: 14, paddingVertical: 14 },
  lineText: { flex: 1, gap: 3 },
  lineName: { fontSize: 15, color: colors.ink950 },
  lineUnit: { fontSize: 12, color: colors.ink600 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  stepButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.6 },
  stepQty: {
    minWidth: 20,
    textAlign: "center",
    fontSize: 14,
    color: colors.ink950,
    fontVariant: ["tabular-nums"],
  },
  lineRight: { alignItems: "flex-end", justifyContent: "space-between", gap: 10 },
  lineTotal: { fontSize: 15, color: colors.ink950 },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 6,
    backgroundColor: colors.parchment100,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  barRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  barLabel: { fontSize: 13, color: colors.ink600 },
  barValue: { fontSize: 13, color: colors.ink900, fontVariant: ["tabular-nums"] },
  barTotalRow: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8, marginTop: 4 },
  barTotalLabel: { fontSize: 14, fontWeight: "600", color: colors.ink950 },
  barTotalValue: { fontSize: 18, color: colors.ink950, fontVariant: ["tabular-nums"] },
  freeHint: { fontSize: 11, color: colors.ink600 },
  cta: { marginTop: 10 },
})
