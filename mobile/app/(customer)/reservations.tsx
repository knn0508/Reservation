import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "expo-router"
import { Feather } from "@expo/vector-icons"
import { FlatList, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  ApiError,
  cancelReservation,
  getMyReservations,
  getRestaurants,
  type Reservation,
} from "../../src/lib/api"
import { useCart } from "../../src/hooks/useCart"
import { Button, Card, EmptyState, Eyebrow, Loading, Pill, Screen, Title } from "../../src/components/ui"
import { colors, formatPrice } from "../../src/lib/theme"
import { formatFullDate, formatSlotTime } from "../../src/lib/time"

/**
 * Bookings, and the pre-orders attached to them.
 *
 * This is the entry point for the reservation path: "Pre-order for this booking" opens the
 * menu with the reservation already attached, so the basket knows it is headed for the
 * kitchen and never asks for a delivery address.
 */
export default function ReservationsScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { setReservationId } = useCart()

  const reservations = useQuery({ queryKey: ["reservations", "me"], queryFn: getMyReservations })
  const restaurants = useQuery({ queryKey: ["restaurants"], queryFn: getRestaurants })

  const cancel = useMutation({
    mutationFn: cancelReservation,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["reservations", "me"] }),
  })

  function startPreorder(reservation: Reservation) {
    const slug = (restaurants.data ?? []).find((r) => r.id === reservation.restaurant_id)?.slug
    if (!slug) return
    setReservationId(reservation.id)
    router.push(`/menu/${slug}?reservationId=${reservation.id}`)
  }

  function renderReservation({ item: r }: { item: Reservation }) {
    const restaurant = (restaurants.data ?? []).find((x) => x.id === r.restaurant_id)
    const upcoming = r.status === "booked" && new Date(r.start_time) > new Date()
    const preorderTotal = (r.preorder_items ?? []).reduce(
      (n, i) => n + i.price * i.quantity,
      0,
    )

    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.restaurant}>{restaurant?.name ?? `Restaurant #${r.restaurant_id}`}</Text>
            <Text style={styles.when}>
              {formatFullDate(r.start_time)} · {formatSlotTime(r.start_time)}
            </Text>
            <Text style={styles.party}>
              {r.party_size} {r.party_size === 1 ? "guest" : "guests"}
            </Text>
          </View>
          <Pill
            label={r.status === "booked" ? "Booked" : r.status.replace("_", " ")}
            tone={
              r.status === "cancelled" || r.status === "no_show"
                ? "rust"
                : r.status === "booked"
                  ? "ember"
                  : "moss"
            }
          />
        </View>

        <View style={styles.cardBody}>
          {r.preorder_items && r.preorder_items.length > 0 ? (
            <View style={styles.preorder}>
              <View style={styles.row}>
                <Feather name="check-circle" size={13} color={colors.moss500} />
                <Text style={styles.preorderLabel}>
                  Pre-order sent to the kitchen — ready at {formatSlotTime(r.start_time)}
                </Text>
              </View>
              {r.preorder_items.map((i, idx) => (
                <View key={idx} style={styles.itemRow}>
                  <Text style={styles.itemName}>
                    <Text style={styles.itemQty}>{i.quantity}× </Text>
                    {i.name}
                  </Text>
                  <Text style={styles.itemPrice}>{formatPrice(i.price * i.quantity)}</Text>
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Pre-order total</Text>
                <Text style={styles.totalValue}>{formatPrice(preorderTotal)}</Text>
              </View>
            </View>
          ) : upcoming ? (
            <Text style={styles.muted}>
              No pre-order yet. Send one and the kitchen will have it ready when you sit down.
            </Text>
          ) : null}

          {upcoming && (
            <>
              <Button
                title={
                  r.preorder_items && r.preorder_items.length > 0
                    ? "Replace the pre-order"
                    : "Pre-order for this booking"
                }
                onPress={() => startPreorder(r)}
              />
              <Button
                title="Cancel reservation"
                variant="outline"
                onPress={() => cancel.mutate(r.id)}
                loading={cancel.isPending && cancel.variables === r.id}
              />
            </>
          )}

          {cancel.isError && cancel.variables === r.id ? (
            <Text style={styles.error}>
              {cancel.error instanceof ApiError ? cancel.error.message : "Couldn't cancel that."}
            </Text>
          ) : null}
        </View>
      </Card>
    )
  }

  return (
    <Screen>
      <FlatList
        data={reservations.data ?? []}
        keyExtractor={(r) => r.id}
        renderItem={renderReservation}
        contentContainerStyle={[styles.list, { paddingTop: insets.top + 16 }]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Eyebrow>Rezervasiyalarım</Eyebrow>
            <Title>My reservations</Title>
            <Text style={styles.headerHint}>
              A pre-order here is cooked for your booking time and served at your table — it does
              not go to a courier.
            </Text>
          </View>
        }
        ListEmptyComponent={
          reservations.isLoading ? (
            <Loading />
          ) : (
            <EmptyState
              title="No reservations yet"
              body="Book a table from the Restaurants tab, then pre-order so your food is waiting."
            />
          )
        }
        refreshing={reservations.isFetching && !reservations.isLoading}
        onRefresh={() => void reservations.refetch()}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingBottom: 32, gap: 14 },
  header: { marginBottom: 10 },
  headerHint: { fontSize: 12, lineHeight: 18, color: colors.ink600, marginTop: 8 },
  card: { padding: 0 },
  cardHeader: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  restaurant: { fontSize: 18, color: colors.ink950 },
  when: { fontSize: 13, color: colors.ink700, marginTop: 4 },
  party: { fontSize: 12, color: colors.ink600, marginTop: 2 },
  cardBody: { padding: 16, gap: 12 },
  preorder: {
    borderWidth: 1,
    borderColor: "rgba(77,124,82,0.25)",
    backgroundColor: colors.tintMoss,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  preorderLabel: { flex: 1, fontSize: 12, color: colors.ink900 },
  itemRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  itemName: { flex: 1, fontSize: 13, color: colors.ink700 },
  itemQty: { color: colors.ink600 },
  itemPrice: { fontSize: 13, color: colors.ink950, fontVariant: ["tabular-nums"] },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(77,124,82,0.2)",
    paddingTop: 8,
  },
  totalLabel: { fontSize: 13, color: colors.ink700 },
  totalValue: { fontSize: 14, color: colors.ink950, fontVariant: ["tabular-nums"] },
  muted: { fontSize: 12, lineHeight: 18, color: colors.ink600 },
  error: { fontSize: 12, color: colors.rust500 },
})
