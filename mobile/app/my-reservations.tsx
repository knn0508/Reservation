import { useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useQuery } from "@tanstack/react-query"
import { Ionicons } from "@expo/vector-icons"
import * as Clipboard from "expo-clipboard"
import { useCancelReservation, useMyReservations } from "../src/hooks/useReservation"
import { getRestaurants, type Reservation } from "../src/lib/api"
import { formatFullDate, formatSlotTime, toDayKey } from "../src/lib/time"
import { alpha, colors, fonts, radius } from "../src/lib/theme"
import { RequireAuth } from "../src/components/auth/RequireAuth"
import { Display, Eyebrow, Screen, Skeleton } from "../src/components/ui/Primitives"
import { StatusPill } from "../src/components/ui/StatusPill"
import { FadeIn } from "../src/components/ui/FadeIn"
import { PressScale } from "../src/components/ui/Pressable"

function ReservationCard({
  reservation,
  restaurantName,
  onCancel,
  isCancelling,
}: {
  reservation: Reservation
  restaurantName: string
  onCancel: () => void
  isCancelling: boolean
}) {
  const [copied, setCopied] = useState(false)
  const [orderOpen, setOrderOpen] = useState(false)

  async function handleCopyId() {
    await Clipboard.setStringAsync(reservation.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const items = reservation.preorder_items ?? []
  const orderTotal = items.reduce((sum, i) => sum + i.quantity * i.price, 0)

  return (
    <View style={styles.tray}>
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.restaurant}>{restaurantName}</Text>
            <Text style={styles.date}>{formatFullDate(toDayKey(new Date(reservation.start_time)))}</Text>
          </View>
          <StatusPill status={reservation.status} />
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={15} color={colors.ember600} />
            <Text style={styles.metaText}>{formatSlotTime(reservation.start_time)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={15} color={colors.ember600} />
            <Text style={styles.metaText}>{reservation.party_size} guests</Text>
          </View>
        </View>

        <PressScale
          onPress={handleCopyId}
          scaleTo={0.97}
          accessibilityLabel="Copy reservation ID"
          style={{ alignSelf: "flex-start" }}
        >
          <View style={styles.idChip}>
            <Ionicons
              name={copied ? "checkmark" : "copy-outline"}
              size={12}
              color={copied ? colors.moss500 : colors.ink600}
            />
            <Text style={styles.idText} numberOfLines={1}>
              {reservation.id}
            </Text>
          </View>
        </PressScale>

        {items.length > 0 && (
          <View style={styles.orderBox}>
            <PressScale onPress={() => setOrderOpen((v) => !v)} scaleTo={0.99}>
              <View style={styles.orderHead}>
                <View style={styles.orderHeadMain}>
                  <Ionicons name="restaurant-outline" size={13} color={colors.moss500} />
                  <Text style={styles.orderHeadText}>
                    Food pre-order — {items.length} item{items.length === 1 ? "" : "s"} · {orderTotal.toFixed(2)} ₼
                  </Text>
                </View>
                <Ionicons name={orderOpen ? "chevron-up" : "chevron-down"} size={12} color={colors.moss500} />
              </View>
            </PressScale>

            {orderOpen && (
              <FadeIn offset={-4} duration={220}>
                <View style={styles.orderList}>
                  {items.map((item, i) => (
                    <View key={i} style={styles.orderLine}>
                      <Text style={styles.orderLineName}>
                        {item.quantity}× {item.name}
                      </Text>
                      <Text style={styles.orderLinePrice}>{(item.quantity * item.price).toFixed(2)} ₼</Text>
                    </View>
                  ))}
                </View>
              </FadeIn>
            )}
          </View>
        )}

        {reservation.status === "booked" && (
          <PressScale
            onPress={onCancel}
            disabled={isCancelling}
            scaleTo={0.97}
            style={{ alignSelf: "flex-start", marginTop: 16 }}
          >
            <View style={styles.cancelButton}>
              <Ionicons name="close-circle-outline" size={14} color={colors.rust500} />
              <Text style={styles.cancelText}>{isCancelling ? "Cancelling…" : "Cancel reservation"}</Text>
            </View>
          </PressScale>
        )}
      </View>
    </View>
  )
}

function MyReservationsInner() {
  const reservations = useMyReservations()
  const restaurants = useQuery({ queryKey: ["restaurants"], queryFn: getRestaurants })
  const cancel = useCancelReservation()

  const restaurantName = (id: number) => restaurants.data?.find((r) => r.id === id)?.name ?? `Restaurant #${id}`

  return (
    <Screen>
      <FadeIn offset={16} duration={550} style={{ paddingTop: 20 }}>
        <Eyebrow>Account</Eyebrow>
        <Display size={28} style={{ marginTop: 6 }}>
          My reservations
        </Display>
      </FadeIn>

      {reservations.isLoading && (
        <View style={{ marginTop: 28, gap: 12 }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} height={128} />
          ))}
        </View>
      )}

      {reservations.data?.length === 0 && (
        <View style={styles.empty}>
          <Ionicons name="calendar-outline" size={28} color={alpha.ink(0.3)} />
          <Text style={styles.emptyText}>You don't have any reservations yet.</Text>
        </View>
      )}

      <View style={{ marginTop: 28, gap: 12 }}>
        {reservations.data?.map((r, i) => (
          <FadeIn key={r.id} delay={i * 50} offset={12} duration={480}>
            <ReservationCard
              reservation={r}
              restaurantName={restaurantName(r.restaurant_id)}
              onCancel={() => cancel.mutate(r.id)}
              isCancelling={cancel.isPending && cancel.variables === r.id}
            />
          </FadeIn>
        ))}
      </View>
    </Screen>
  )
}

export default function MyReservationsScreen() {
  return (
    <RequireAuth role="customer">
      <MyReservationsInner />
    </RequireAuth>
  )
}

const styles = StyleSheet.create({
  tray: {
    borderRadius: 28,
    backgroundColor: alpha.ink(0.04),
    borderWidth: 1,
    borderColor: alpha.ink(0.05),
    padding: 6,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: alpha.ink(0.08),
    backgroundColor: colors.parchment100,
    padding: 18,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  restaurant: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.ember600,
  },
  date: {
    marginTop: 4,
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.ink950,
  },
  metaRow: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 18,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink700,
  },
  idChip: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: alpha.ink(0.08),
    backgroundColor: alpha.ink(0.03),
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  idText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.ink600,
  },
  orderBox: {
    marginTop: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha.moss(0.2),
    backgroundColor: alpha.moss(0.05),
    overflow: "hidden",
  },
  orderHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  orderHeadMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  orderHeadText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.moss500,
  },
  orderList: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 4,
  },
  orderLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  orderLineName: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.ink700,
  },
  orderLinePrice: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.ink600,
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: alpha.rust(0.3),
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  cancelText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.rust500,
  },
  empty: {
    marginTop: 36,
    alignItems: "center",
    gap: 12,
    borderRadius: 28,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: alpha.ink(0.15),
    paddingHorizontal: 24,
    paddingVertical: 52,
  },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink600,
  },
})
