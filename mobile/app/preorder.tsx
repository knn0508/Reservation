import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "expo-router"
import { Feather } from "@expo/vector-icons"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  ApiError,
  createPreorder,
  getMyReservations,
  getRestaurants,
  type Reservation,
} from "../src/lib/api"
import { useCart } from "../src/hooks/useCart"
import {
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Eyebrow,
  Hint,
  Loading,
  Screen,
  Subtitle,
  Title,
} from "../src/components/ui"
import { colors, formatPrice, radius } from "../src/lib/theme"
import { formatFullDate, formatSlotTime } from "../src/lib/time"

/**
 * The reservation half of checkout: pick which booking this basket belongs to and send it.
 *
 * There is no address, no fee and no courier here, because a pre-order never leaves the
 * restaurant - it is cooked for the booking time and handed over at the table. That is the
 * whole difference from `checkout.tsx`.
 */
export default function PreorderScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const { lines, total, clear, restaurantSlug, reservationId, setReservationId } = useCart()

  const restaurants = useQuery({ queryKey: ["restaurants"], queryFn: getRestaurants })
  const restaurant = (restaurants.data ?? []).find((r) => r.slug === restaurantSlug)

  const reservations = useQuery({ queryKey: ["reservations", "me"], queryFn: getMyReservations })

  // Only bookings that are still ahead, still active, and at this basket's restaurant can
  // receive it - the server enforces the restaurant match too, this just avoids the 422.
  const eligible: Reservation[] = (reservations.data ?? []).filter(
    (r) =>
      r.restaurant_id === restaurant?.id &&
      r.status === "booked" &&
      new Date(r.start_time) > new Date(),
  )

  const [selected, setSelected] = useState<string | null>(reservationId)

  // If the customer entered the menu from a booking, that booking is already the answer.
  useEffect(() => {
    if (reservationId) setSelected(reservationId)
    else if (eligible.length === 1) setSelected(eligible[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId, eligible.length])

  const send = useMutation({
    mutationFn: ({ id, restaurantId }: { id: string; restaurantId: number }) =>
      createPreorder(
        id,
        restaurantId,
        lines.map((l) => ({ name: l.item.name, quantity: l.qty, price: l.item.price })),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations", "me"] })
      clear()
      router.replace("/(customer)/reservations")
    },
  })

  function handleSend() {
    if (!selected || !restaurant) return
    setReservationId(selected)
    send.mutate({ id: selected, restaurantId: restaurant.id })
  }

  if (lines.length === 0) {
    return (
      <Screen>
        <View style={{ paddingTop: insets.top + 60 }}>
          <EmptyState
            title="Your basket is empty"
            body="Add dishes from the menu, then send them to the kitchen for your booking."
          />
        </View>
      </Screen>
    )
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
            <Feather name="arrow-left" size={18} color={colors.ink800} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Eyebrow>Rezervasiya sifarişi</Eyebrow>
            <Title>Ready when you arrive</Title>
          </View>
        </View>
        <Subtitle>
          {restaurant?.name ?? "The kitchen"} will start this so it lands on your table at your
          booking time. Nothing here goes to a courier.
        </Subtitle>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Which booking?</Text>
          {reservations.isLoading ? (
            <Loading />
          ) : eligible.length === 0 ? (
            <View style={{ gap: 12 }}>
              <Hint>
                You have no upcoming booking at {restaurant?.name ?? "this restaurant"}. Book a
                table first, or have this basket delivered instead.
              </Hint>
              {restaurantSlug ? (
                <Button
                  title="Book a table"
                  onPress={() => router.replace(`/book/${restaurantSlug}`)}
                />
              ) : null}
              <Button title="Back to basket" variant="outline" onPress={() => router.back()} />
            </View>
          ) : (
            eligible.map((r) => {
              const active = selected === r.id
              return (
                <Pressable
                  key={r.id}
                  onPress={() => setSelected(r.id)}
                  style={[styles.option, active && styles.optionActive]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionWhen}>
                      {formatFullDate(r.start_time)} · {formatSlotTime(r.start_time)}
                    </Text>
                    <Text style={styles.optionParty}>
                      {r.party_size} {r.party_size === 1 ? "guest" : "guests"}
                      {r.preorder_items && r.preorder_items.length > 0
                        ? " · already has a pre-order"
                        : ""}
                    </Text>
                  </View>
                  {active && <Feather name="check" size={16} color={colors.ember600} />}
                </Pressable>
              )
            })
          )}
        </Card>

        {eligible.length > 0 && (
          <>
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Your order</Text>
              {lines.map(({ item, qty }) => (
                <View key={item.id} style={styles.itemRow}>
                  <Text style={styles.itemName}>
                    <Text style={styles.itemQty}>{qty}× </Text>
                    {item.name}
                  </Text>
                  <Text style={styles.itemPrice}>{formatPrice(item.price * qty)}</Text>
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{formatPrice(total)}</Text>
              </View>
              <Hint>You settle this at the table — no delivery fee, no payment up front.</Hint>
            </Card>

            {send.isError ? (
              <ErrorNote>
                {send.error instanceof ApiError
                  ? send.error.message
                  : "Couldn't send that — please try again."}
              </ErrorNote>
            ) : null}

            <Button
              title="Send to the kitchen"
              onPress={handleSend}
              disabled={!selected}
              loading={send.isPending}
              style={{ marginBottom: insets.bottom + 24 }}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  back: { padding: 4 },
  section: { padding: 18, gap: 12 },
  sectionTitle: { fontSize: 17, color: colors.ink950 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionActive: { borderColor: colors.ember500, backgroundColor: colors.tintEmber },
  optionWhen: { fontSize: 14, color: colors.ink950 },
  optionParty: { fontSize: 12, color: colors.ink600, marginTop: 2 },
  itemRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  itemName: { flex: 1, fontSize: 13, color: colors.ink700 },
  itemQty: { color: colors.ink600 },
  itemPrice: { fontSize: 13, color: colors.ink950, fontVariant: ["tabular-nums"] },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 8,
  },
  totalLabel: { fontSize: 14, fontWeight: "600", color: colors.ink950 },
  totalValue: { fontSize: 18, color: colors.ink950, fontVariant: ["tabular-nums"] },
})
