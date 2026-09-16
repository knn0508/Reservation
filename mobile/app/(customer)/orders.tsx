import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Feather } from "@expo/vector-icons"
import { FlatList, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  ApiError,
  cancelDeliveryOrder,
  getMyDeliveryOrders,
  type DeliveryOrder,
  type DeliveryStatus,
} from "../../src/lib/api"
import {
  formatDistance,
  formatEtaRange,
  useDeliveryTracking,
} from "../../src/hooks/useDeliveryTracking"
import { Button, Card, EmptyState, Eyebrow, Loading, Pill, Screen, Title } from "../../src/components/ui"
import { colors, formatPrice, formatTime } from "../../src/lib/theme"
import { formatLatLng, openPlace } from "../../src/lib/maps"

/** While an order is live the screen re-reads it on a timer. Courier *position* is the
 * socket-driven part of the build guide and comes next; order status changes a handful of
 * times per delivery, which a 10 s poll covers without a socket. */
const POLL_MS = 10000

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  placed: "Waiting for a courier",
  accepted: "Courier assigned",
  picked_up: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
}

/** The four states worth showing a customer, in order. `cancelled` falls off the track. */
const TRACK: DeliveryStatus[] = ["placed", "accepted", "picked_up", "delivered"]

function Progress({ status }: { status: DeliveryStatus }) {
  if (status === "cancelled") {
    return (
      <View style={styles.row}>
        <Feather name="x-circle" size={14} color={colors.rust500} />
        <Text style={styles.cancelled}>Cancelled</Text>
      </View>
    )
  }
  const currentIndex = TRACK.indexOf(status)
  return (
    <View style={styles.track}>
      {TRACK.map((s, i) => {
        const reached = i <= currentIndex
        return (
          <View key={s} style={styles.trackStep}>
            <View style={[styles.trackDot, reached && styles.trackDotOn]} />
            <Text style={[styles.trackLabel, reached && styles.trackLabelOn]}>
              {STATUS_LABEL[s]}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

/**
 * Live courier position, while there is one to show.
 *
 * Distance and an ETA range rather than a map: an embedded map needs a Google Maps API key
 * per platform and a native rebuild, which this app deliberately avoids (see LocationPicker).
 * "1.2 km away, 8-12 min" answers the question the customer actually has.
 */
function LiveTracking({ order }: { order: DeliveryOrder }) {
  const active = order.status === "accepted" || order.status === "picked_up"
  const { tracking, live } = useDeliveryTracking(order.id, active)

  if (!active) return null

  return (
    <View style={styles.tracking}>
      <View style={styles.trackingHead}>
        <Feather name="navigation" size={13} color={colors.ember600} />
        <Text style={styles.trackingTitle}>
          {order.status === "picked_up" ? "On the way to you" : "Courier heading to the kitchen"}
        </Text>
        {/* No dot rather than a red one: a dropped socket is a normal blip on mobile data,
            and the numbers below are still the last known truth. */}
        {live ? <View style={styles.liveDot} /> : null}
      </View>

      {tracking ? (
        <>
          <Text style={styles.trackingEta}>
            {formatEtaRange(tracking.eta_low_s, tracking.eta_high_s)}
          </Text>
          <Text style={styles.trackingDistance}>
            {formatDistance(tracking.distance_m)} away
          </Text>
        </>
      ) : (
        <Text style={styles.muted}>
          Waiting for the courier's signal — this updates itself as they move.
        </Text>
      )}
    </View>
  )
}

export default function OrdersScreen() {
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()

  const orders = useQuery({
    queryKey: ["delivery", "orders", "me"],
    queryFn: getMyDeliveryOrders,
    refetchInterval: POLL_MS,
  })

  const cancel = useMutation({
    mutationFn: cancelDeliveryOrder,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["delivery", "orders", "me"] }),
  })

  function renderOrder({ item: order }: { item: DeliveryOrder }) {
    const canCancel = order.status === "placed" || order.status === "accepted"
    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.code}>{order.public_code}</Text>
            <Text style={styles.amount}>{formatPrice(order.total)}</Text>
          </View>
          <Pill
            label={STATUS_LABEL[order.status]}
            tone={
              order.status === "cancelled"
                ? "rust"
                : order.status === "delivered" || order.status === "picked_up"
                  ? "moss"
                  : "ember"
            }
          />
        </View>

        <View style={styles.cardBody}>
          <Progress status={order.status} />

          <LiveTracking order={order} />

          {order.courier ? (
            <View style={styles.row}>
              <Feather name="truck" size={14} color={colors.ember600} />
              <Text style={styles.courier}>
                {order.courier.full_name}
                {order.courier.plate_number ? ` · ${order.courier.plate_number}` : ""}
              </Text>
            </View>
          ) : order.status === "placed" ? (
            <Text style={styles.muted}>Looking for a courier…</Text>
          ) : null}

          <View style={styles.addressRow}>
            <Feather name="map-pin" size={14} color={colors.ink600} style={styles.pinIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.address}>{order.address_text}</Text>
              <Text style={styles.coords}>{formatLatLng({ lat: order.lat, lng: order.lng })}</Text>
            </View>
          </View>

          <Button
            title="Show drop point on Google Maps"
            variant="outline"
            onPress={() => void openPlace({ lat: order.lat, lng: order.lng })}
          />

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

          <Text style={styles.placed}>Placed {formatTime(order.placed_at)}</Text>

          {canCancel && (
            <Button
              title="Cancel order"
              variant="outline"
              onPress={() => cancel.mutate(order.id)}
              loading={cancel.isPending && cancel.variables === order.id}
            />
          )}
          {cancel.isError && cancel.variables === order.id ? (
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
        data={orders.data ?? []}
        keyExtractor={(o) => o.id}
        renderItem={renderOrder}
        contentContainerStyle={[styles.list, { paddingTop: insets.top + 16 }]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Eyebrow>Sifarişlərim</Eyebrow>
            <Title>My orders</Title>
          </View>
        }
        ListEmptyComponent={
          orders.isLoading ? (
            <Loading />
          ) : (
            <EmptyState
              title="No delivery orders yet"
              body="Pick a restaurant, fill your basket, and have it brought over."
            />
          )
        }
        refreshing={orders.isFetching && !orders.isLoading}
        onRefresh={() => void orders.refetch()}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingBottom: 32, gap: 14 },
  header: { marginBottom: 10 },
  card: { padding: 0 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  code: { fontSize: 12, color: colors.ink600, fontVariant: ["tabular-nums"] },
  amount: { fontSize: 20, color: colors.ink950, marginTop: 4 },
  cardBody: { padding: 16, gap: 12 },
  track: { gap: 6 },
  trackStep: { flexDirection: "row", alignItems: "center", gap: 8 },
  trackDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "rgba(36,30,25,0.15)" },
  trackDotOn: { backgroundColor: colors.ember500 },
  trackLabel: { fontSize: 12, color: "rgba(122,110,99,0.6)" },
  trackLabelOn: { color: colors.ink950 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  tracking: {
    borderWidth: 1,
    borderColor: "rgba(234,88,12,0.3)",
    backgroundColor: colors.tintEmber,
    borderRadius: 14,
    padding: 12,
    gap: 2,
  },
  trackingHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  trackingTitle: {
    flex: 1,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.ember600,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.moss500 },
  trackingEta: { fontSize: 22, color: colors.ink950, marginTop: 4 },
  trackingDistance: { fontSize: 12, color: colors.ink600, fontVariant: ["tabular-nums"] },
  courier: { fontSize: 14, color: colors.ink900 },
  cancelled: { fontSize: 13, color: colors.rust500 },
  muted: { fontSize: 12, color: colors.ink600 },
  addressRow: { flexDirection: "row", gap: 8 },
  pinIcon: { marginTop: 2 },
  address: { fontSize: 14, color: colors.ink900 },
  coords: { fontSize: 11, color: "rgba(122,110,99,0.8)", marginTop: 2, fontVariant: ["tabular-nums"] },
  divider: { height: 1, backgroundColor: colors.line },
  itemRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  itemName: { flex: 1, fontSize: 13, color: colors.ink700 },
  itemQty: { color: colors.ink600 },
  itemPrice: { fontSize: 13, color: colors.ink950, fontVariant: ["tabular-nums"] },
  placed: { fontSize: 11, color: colors.ink600 },
  error: { fontSize: 12, color: colors.rust500 },
})
