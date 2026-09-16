import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Redirect, useRouter } from "expo-router"
import { Feather } from "@expo/vector-icons"
import { FlatList, Linking, Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  ApiError,
  acceptDelivery,
  completeDelivery,
  getAvailableDeliveries,
  getCourierProfile,
  getMyDeliveries,
  pickUpDelivery,
  setCourierShift,
  type DeliveryOrder,
} from "../src/lib/api"
import { useAuth } from "../src/hooks/useAuth"
import { useCourierLocationReporter } from "../src/hooks/useCourierLocationReporter"
import { Button, Card, EmptyState, ErrorNote, Eyebrow, Loading, Pill, Screen, Title } from "../src/components/ui"
import { colors, formatPrice, formatTime, radius } from "../src/lib/theme"
import { formatLatLng, openDirections } from "../src/lib/maps"

/** The board changes when an order is placed or another courier claims one - events per
 * minute, not per second, so a poll is honest here. Live courier position is the socket
 * part of the build guide and is the next step, not this list. */
const POLL_MS = 10000

/** Everything the courier needs at the door, in the order they need it. */
function OrderCard({
  order,
  actionLabel,
  onAction,
  isPending,
}: {
  order: DeliveryOrder
  actionLabel: string | null
  onAction: (order: DeliveryOrder) => void
  isPending: boolean
}) {
  const extras = [
    order.building && `Bld. ${order.building}`,
    order.entrance && `Entrance ${order.entrance}`,
    order.floor && `Floor ${order.floor}`,
    order.apartment && `Apt. ${order.apartment}`,
  ].filter(Boolean) as string[]

  return (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.code}>{order.public_code}</Text>
          {/* The name is what gets said out loud at the door, so it leads the card. */}
          <Text style={styles.name}>{order.recipient_name}</Text>
          <Text style={styles.placed}>Placed {formatTime(order.placed_at)}</Text>
        </View>
        <Pill
          label={order.status === "placed" ? "Waiting" : order.status === "accepted" ? "To pick up" : "On the road"}
          tone={order.status === "placed" ? "ember" : order.status === "picked_up" ? "moss" : "neutral"}
        />
      </View>

      <View style={styles.cardBody}>
        <Pressable
          onPress={() => void Linking.openURL(`tel:${order.recipient_phone.replace(/\s/g, "")}`)}
          style={styles.row}
        >
          <Feather name="phone" size={14} color={colors.ink600} />
          <Text style={styles.phone}>{order.recipient_phone}</Text>
        </Pressable>

        <View style={styles.addressRow}>
          <Feather name="map-pin" size={14} color={colors.ink600} style={styles.pinIcon} />
          <View style={{ flex: 1 }}>
            <Text style={styles.address}>{order.address_text}</Text>
            {extras.length > 0 && <Text style={styles.extras}>{extras.join(" · ")}</Text>}
            <Text style={styles.coords}>{formatLatLng({ lat: order.lat, lng: order.lng })}</Text>
          </View>
        </View>

        {order.courier_note ? (
          <View style={styles.note}>
            <Text style={styles.noteLabel}>Note from the customer</Text>
            <Text style={styles.noteText}>{order.courier_note}</Text>
          </View>
        ) : null}

        <View style={styles.divider} />
        {order.items.map((item, i) => (
          <View key={i} style={styles.itemRow}>
            <Text style={styles.itemName}>
              <Text style={styles.itemQty}>{item.quantity}× </Text>
              {item.name_snapshot}
            </Text>
            <Text style={styles.itemPrice}>{formatPrice(item.unit_price * item.quantity)}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>
            {order.payment_method === "cash" ? "Collect cash" : "Card at the door"}
          </Text>
          <Text style={styles.totalValue}>{formatPrice(order.total)}</Text>
        </View>

        <Button
          title="Navigate in Google Maps"
          onPress={() => void openDirections({ lat: order.lat, lng: order.lng })}
        />

        {actionLabel && (
          <Button
            title={actionLabel}
            variant="outline"
            onPress={() => onAction(order)}
            loading={isPending}
          />
        )}
      </View>
    </Card>
  )
}

export default function CourierScreen() {
  const { user, isLoading: authLoading, logout } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<"available" | "mine">("available")
  const [error, setError] = useState<string | null>(null)

  const profile = useQuery({
    queryKey: ["courier", "me"],
    queryFn: getCourierProfile,
    enabled: user?.role === "courier",
  })
  const available = useQuery({
    queryKey: ["courier", "orders", "available"],
    queryFn: getAvailableDeliveries,
    refetchInterval: POLL_MS,
    enabled: user?.role === "courier",
  })
  const mine = useQuery({
    queryKey: ["courier", "orders", "mine"],
    queryFn: getMyDeliveries,
    refetchInterval: POLL_MS,
    enabled: user?.role === "courier",
  })

  const shift = useMutation({
    mutationFn: setCourierShift,
    onSuccess: (p) => queryClient.setQueryData(["courier", "me"], p),
  })

  /** One mutation for all three transitions; they differ only in which endpoint runs. */
  const advance = useMutation({
    mutationFn: ({ order }: { order: DeliveryOrder }) => {
      if (order.status === "placed") return acceptDelivery(order.id)
      if (order.status === "accepted") return pickUpDelivery(order.id)
      return completeDelivery(order.id)
    },
    onSuccess: (updated) => {
      setError(null)
      queryClient.invalidateQueries({ queryKey: ["courier"] })
      // A just-claimed order moves to the courier's own list, so follow it there.
      if (updated.status === "accepted") setTab("mine")
    },
    onError: (e) => {
      setError(e instanceof ApiError ? e.message : "That didn't go through — try again.")
      queryClient.invalidateQueries({ queryKey: ["courier"] })
    },
  })

  // The run the device reports against: the one order actually in this courier's hands.
  // Position is attached to it so the customer watching that order - and nobody else - sees
  // the marker move.
  const activeRun = (mine.data ?? []).find(
    (o) => o.status === "accepted" || o.status === "picked_up",
  )
  useCourierLocationReporter({
    enabled: Boolean(profile.data?.is_on_shift),
    orderId: activeRun?.id ?? null,
    phase: activeRun?.status === "picked_up" ? "on_route" : activeRun ? "to_pickup" : "idle",
  })

  if (authLoading) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Loading />
        </View>
      </Screen>
    )
  }
  if (!user) return <Redirect href="/login" />
  if (user.role !== "courier") return <Redirect href="/" />

  const activeMine = (mine.data ?? []).filter(
    (o) => o.status === "accepted" || o.status === "picked_up",
  )
  const list = tab === "available" ? (available.data ?? []) : activeMine
  const isLoading = tab === "available" ? available.isLoading : mine.isLoading

  function actionLabelFor(order: DeliveryOrder): string | null {
    if (order.status === "placed") return "Accept this delivery"
    if (order.status === "accepted") return "Picked up from the restaurant"
    if (order.status === "picked_up") return "Delivered to the customer"
    return null
  }

  async function handleLogout() {
    await logout()
    router.replace("/login")
  }

  return (
    <Screen>
      <FlatList
        data={list}
        keyExtractor={(o) => o.id}
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            actionLabel={actionLabelFor(item)}
            onAction={(o) => advance.mutate({ order: o })}
            isPending={advance.isPending && advance.variables?.order.id === item.id}
          />
        )}
        contentContainerStyle={[
          styles.list,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
        ]}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View style={{ flex: 1 }}>
                <Eyebrow>Kuryer paneli</Eyebrow>
                <Title>{profile.data?.full_name ?? user.full_name}</Title>
                <Text style={styles.vehicle}>
                  {profile.data?.vehicle_type ?? "—"}
                  {profile.data?.plate_number ? ` · ${profile.data.plate_number}` : ""}
                </Text>
              </View>
              <Pressable onPress={handleLogout} hitSlop={10} style={styles.logout}>
                <Feather name="log-out" size={17} color={colors.ink600} />
              </Pressable>
            </View>

            {profile.data && (
              <Button
                title={profile.data.is_on_shift ? "On shift" : "Off shift — tap to start"}
                variant={profile.data.is_on_shift ? "primary" : "outline"}
                onPress={() => shift.mutate(!profile.data!.is_on_shift)}
                loading={shift.isPending}
              />
            )}

            <View style={styles.tabs}>
              {(
                [
                  ["available", "Available", available.data?.length ?? 0],
                  ["mine", "My runs", activeMine.length],
                ] as const
              ).map(([value, label, n]) => (
                <Pressable
                  key={value}
                  onPress={() => setTab(value)}
                  style={[styles.tab, tab === value && styles.tabActive]}
                >
                  <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>
                    {label} {n}
                  </Text>
                </Pressable>
              ))}
            </View>

            {profile.data && !profile.data.is_on_shift && tab === "available" ? (
              <Text style={styles.offShift}>
                You're off shift. You can see what's waiting, but go on shift before taking a run.
              </Text>
            ) : null}

            {error ? <ErrorNote>{error}</ErrorNote> : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <Loading />
          ) : tab === "available" ? (
            <EmptyState
              title="Nothing waiting"
              body="No orders on the board right now. This refreshes itself every few seconds."
            />
          ) : (
            <EmptyState
              title="Nothing in your hands"
              body="Take one from the Available tab to start a run."
            />
          )
        }
        refreshing={available.isFetching && !available.isLoading}
        onRefresh={() => {
          void available.refetch()
          void mine.refetch()
        }}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, gap: 14 },
  header: { gap: 14, marginBottom: 4 },
  headerTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  vehicle: { fontSize: 12, color: colors.ink600, marginTop: 6 },
  logout: { padding: 6 },
  tabs: { flexDirection: "row", gap: 8 },
  tab: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  tabActive: { borderColor: colors.ember500, backgroundColor: colors.tintEmber },
  tabText: { fontSize: 13, color: colors.ink700 },
  tabTextActive: { color: colors.ink950, fontWeight: "600" },
  offShift: { fontSize: 12, lineHeight: 18, color: colors.ink600 },
  card: { padding: 0 },
  cardHeader: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  code: { fontSize: 12, color: colors.ink600, fontVariant: ["tabular-nums"] },
  name: { fontSize: 20, color: colors.ink950, marginTop: 4 },
  placed: { fontSize: 11, color: colors.ink600, marginTop: 3 },
  cardBody: { padding: 16, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  phone: { fontSize: 15, color: colors.ink900, fontWeight: "600" },
  addressRow: { flexDirection: "row", gap: 8 },
  pinIcon: { marginTop: 2 },
  address: { fontSize: 14, color: colors.ink900 },
  extras: { fontSize: 12, color: colors.ink600, marginTop: 2 },
  coords: { fontSize: 11, color: "rgba(122,110,99,0.8)", marginTop: 2, fontVariant: ["tabular-nums"] },
  note: {
    borderWidth: 1,
    borderColor: "rgba(234,88,12,0.3)",
    backgroundColor: colors.tintEmber,
    borderRadius: radius.md,
    padding: 12,
    gap: 4,
  },
  noteLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.ember600,
  },
  noteText: { fontSize: 14, lineHeight: 20, color: colors.ink900 },
  divider: { height: 1, backgroundColor: colors.line },
  itemRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  itemName: { flex: 1, fontSize: 13, color: colors.ink700 },
  itemQty: { color: colors.ink600 },
  itemPrice: { fontSize: 13, color: colors.ink950, fontVariant: ["tabular-nums"] },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 10,
  },
  totalLabel: { fontSize: 13, color: colors.ink600 },
  totalValue: { fontSize: 17, color: colors.ink950, fontVariant: ["tabular-nums"] },
})
