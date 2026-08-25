import { useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Ionicons } from "@expo/vector-icons"
import {
  ApiError,
  cancelReservation,
  completeReservation,
  getAdminReservations,
  getAdminTables,
  markNoShow,
  revertReservationStatus,
  seatReservation,
  type DiningTable,
  type Reservation,
} from "../../src/lib/api"
import { DateStrip } from "../../src/components/booking/DateStrip"
import { formatSlotTime, toDayKey } from "../../src/lib/time"
import { alpha, colors, fonts, radius } from "../../src/lib/theme"
import { RequireAuth } from "../../src/components/auth/RequireAuth"
import { Display, EmptyNote, Eyebrow, Screen, Skeleton } from "../../src/components/ui/Primitives"
import { StatusPill } from "../../src/components/ui/StatusPill"
import { FadeIn } from "../../src/components/ui/FadeIn"
import { PressScale } from "../../src/components/ui/Pressable"

const ARM_TIMEOUT_MS = 4000

/** Requires a second tap to actually fire, so a stray tap can't change a reservation's status.
 *  Reverts to the plain button on its own after a few seconds. */
function ConfirmButton({
  label,
  disabled,
  onConfirm,
  tone = "default",
}: {
  label: string
  disabled?: boolean
  onConfirm: () => void
  tone?: "default" | "danger"
}) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const timer = setTimeout(() => setArmed(false), ARM_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [armed])

  if (armed) {
    return (
      <View style={styles.armedRow}>
        <PressScale
          onPress={() => {
            setArmed(false)
            onConfirm()
          }}
          disabled={disabled}
          scaleTo={0.95}
        >
          <View
            style={[
              styles.armedButton,
              { backgroundColor: tone === "danger" ? colors.rust500 : colors.ink950, opacity: disabled ? 0.4 : 1 },
            ]}
          >
            <Ionicons name="checkmark" size={12} color={colors.parchment50} />
            <Text style={styles.armedLabel}>Confirm {label}</Text>
          </View>
        </PressScale>
        <PressScale onPress={() => setArmed(false)} accessibilityLabel="Cancel" scaleTo={0.9} hitSlop={6}>
          <View style={styles.armedDismiss}>
            <Ionicons name="close" size={12} color={colors.ink600} />
          </View>
        </PressScale>
      </View>
    )
  }

  return (
    <PressScale onPress={() => setArmed(true)} disabled={disabled} scaleTo={0.95}>
      <View style={[styles.actionButton, disabled && { opacity: 0.4 }]}>
        <Text style={styles.actionLabel}>{label}</Text>
      </View>
    </PressScale>
  )
}

// What each status undoes back to, for the "Undo" button's label.
const REVERT_TARGET_LABEL: Record<string, string> = {
  seated: "booked",
  completed: "seated",
  cancelled: "booked",
  no_show: "booked",
}

function RowActions({ reservation, onChanged }: { reservation: Reservation; onChanged: () => void }) {
  const seat = useMutation({ mutationFn: () => seatReservation(reservation.id), onSuccess: onChanged })
  const noShow = useMutation({ mutationFn: () => markNoShow(reservation.id), onSuccess: onChanged })
  const complete = useMutation({ mutationFn: () => completeReservation(reservation.id), onSuccess: onChanged })
  const cancel = useMutation({ mutationFn: () => cancelReservation(reservation.id), onSuccess: onChanged })
  const revert = useMutation({ mutationFn: () => revertReservationStatus(reservation.id), onSuccess: onChanged })

  const busy = seat.isPending || noShow.isPending || complete.isPending || cancel.isPending || revert.isPending
  const revertLabel = REVERT_TARGET_LABEL[reservation.status]

  return (
    <View>
      <View style={styles.actionRow}>
        {reservation.status === "booked" && (
          <>
            <ConfirmButton label="Seat" disabled={busy} onConfirm={() => seat.mutate()} />
            <ConfirmButton label="No-show" disabled={busy} onConfirm={() => noShow.mutate()} tone="danger" />
            <ConfirmButton label="Cancel" disabled={busy} onConfirm={() => cancel.mutate()} tone="danger" />
          </>
        )}
        {reservation.status === "seated" && (
          <ConfirmButton label="Complete" disabled={busy} onConfirm={() => complete.mutate()} />
        )}
        {revertLabel && (
          <PressScale onPress={() => revert.mutate()} disabled={busy} scaleTo={0.95}>
            <View style={[styles.actionButton, styles.actionButtonIcon, busy && { opacity: 0.4 }]}>
              <Ionicons name="arrow-undo-outline" size={12} color={colors.ink700} />
              <Text style={styles.actionLabel}>Undo</Text>
            </View>
          </PressScale>
        )}
      </View>
      {revert.isError && (
        <Text style={styles.actionError}>
          {revert.error instanceof ApiError ? revert.error.message : "Couldn't undo - try again."}
        </Text>
      )}
    </View>
  )
}

function tableLabel(tables: DiningTable[] | undefined, tableId: number): string {
  const table = tables?.find((t) => t.id === tableId)
  return table ? `${table.table_number} · ${table.zone}` : `#${tableId}`
}

function orderTotal(items: { quantity: number; price: number }[]): number {
  return items.reduce((sum, i) => sum + i.quantity * i.price, 0)
}

function AdminInner() {
  const [day, setDay] = useState(() => toDayKey(new Date()))
  const [openOrderId, setOpenOrderId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const reservationsKey = ["admin", "reservations", day]
  const reservations = useQuery({
    queryKey: reservationsKey,
    queryFn: () => getAdminReservations(day),
    refetchInterval: 15_000,
  })

  const tables = useQuery({ queryKey: ["admin", "tables"], queryFn: getAdminTables })

  // Already ordered by start_time from the API - filtering preserves that chronological order,
  // so the kitchen sees pre-orders queued by exact reservation time, never by table number.
  const ordersToday = (reservations.data ?? []).filter((r) => r.preorder_items && r.preorder_items.length > 0)

  function refresh() {
    queryClient.invalidateQueries({ queryKey: reservationsKey })
  }

  return (
    <Screen>
      <View style={{ paddingTop: 20 }}>
        <Eyebrow>Floor</Eyebrow>
        <Display size={28} style={{ marginTop: 6 }}>
          Service overview
        </Display>
      </View>

      <View style={{ marginTop: 20 }}>
        <DateStrip value={day} onChange={setDay} />
      </View>

      {/* The web laid the service list out as a wide table. A phone can't carry seven columns,
          so each reservation becomes a card with the same fields stacked. */}
      <View style={{ marginTop: 26, gap: 12 }}>
        {reservations.isLoading &&
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={150} />)}

        {reservations.data?.length === 0 && <EmptyNote>No reservations for this day.</EmptyNote>}

        {reservations.data?.map((r, i) => {
          const items = r.preorder_items ?? []
          const isOpen = openOrderId === r.id
          return (
            <FadeIn key={r.id} delay={Math.min(i, 8) * 40} offset={10} duration={420}>
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={styles.cardHeadMain}>
                    <Text style={styles.cardTime}>{formatSlotTime(r.start_time)}</Text>
                    <Text style={styles.cardGuest} numberOfLines={1}>
                      {r.guest_name}
                    </Text>
                  </View>
                  <StatusPill status={r.status} />
                </View>

                <View style={styles.cardMeta}>
                  <Meta label="Party" value={String(r.party_size)} />
                  <Meta label="Table" value={tableLabel(tables.data, r.assigned_table_id)} />
                </View>

                {items.length > 0 && (
                  <View style={{ marginTop: 12 }}>
                    <PressScale onPress={() => setOpenOrderId(isOpen ? null : r.id)} scaleTo={0.98}>
                      <View style={styles.orderToggle}>
                        <Ionicons name="restaurant-outline" size={11} color={colors.ember600} />
                        <Text style={styles.orderToggleText}>Ready for arrival ({items.length})</Text>
                        <Ionicons
                          name={isOpen ? "chevron-up" : "chevron-down"}
                          size={10}
                          color={colors.ember600}
                        />
                      </View>
                    </PressScale>

                    {isOpen && (
                      <FadeIn offset={-4} duration={220}>
                        <View style={styles.orderList}>
                          {items.map((item, index) => (
                            <View key={index} style={styles.orderLine}>
                              <Text style={styles.orderLineName}>
                                {item.quantity}× {item.name}
                              </Text>
                              <Text style={styles.orderLinePrice}>
                                {(item.quantity * item.price).toFixed(2)} ₼
                              </Text>
                            </View>
                          ))}
                          <View style={[styles.orderLine, styles.orderTotalLine]}>
                            <Text style={styles.orderTotalLabel}>Total</Text>
                            <Text style={styles.orderTotalValue}>{orderTotal(items).toFixed(2)} ₼</Text>
                          </View>
                        </View>
                      </FadeIn>
                    )}
                  </View>
                )}

                <View style={{ marginTop: 14 }}>
                  <RowActions reservation={r} onChanged={refresh} />
                </View>
              </View>
            </FadeIn>
          )
        })}
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Pre-orders</Text>
        <Text style={styles.panelSubtitle}>Sorted by reservation time — nothing to fire before then.</Text>
        <View style={{ marginTop: 16, gap: 10 }}>
          {ordersToday.length === 0 && <Text style={styles.panelEmpty}>None today.</Text>}
          {ordersToday.map((r) => (
            <View key={r.id} style={styles.preorderCard}>
              <View style={styles.preorderHead}>
                <Text style={styles.preorderTime}>{formatSlotTime(r.start_time)}</Text>
                <Text style={styles.preorderGuest} numberOfLines={1}>
                  {r.guest_name}
                </Text>
              </View>
              <View style={{ marginTop: 8, gap: 2 }}>
                {r.preorder_items!.map((item, i) => (
                  <Text key={i} style={styles.preorderItem}>
                    {item.quantity}× {item.name}
                  </Text>
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Tables</Text>
        <View style={{ marginTop: 16, gap: 8 }}>
          {tables.data?.map((t) => (
            <View key={t.id} style={styles.tableRow}>
              <Text style={styles.tableName}>
                {t.table_number} · {t.zone}
              </Text>
              <Text style={styles.tableCategory}>{t.category.replace("_", " ")}</Text>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaBlock}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  )
}

export default function AdminScreen() {
  return (
    <RequireAuth role="admin">
      <AdminInner />
    </RequireAuth>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: alpha.ink(0.1),
    backgroundColor: "rgba(244,237,226,0.4)",
    padding: 16,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  cardHeadMain: {
    flex: 1,
  },
  cardTime: {
    fontFamily: fonts.mono,
    fontSize: 15,
    color: colors.ember600,
  },
  cardGuest: {
    marginTop: 3,
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.ink900,
  },
  cardMeta: {
    marginTop: 14,
    flexDirection: "row",
    gap: 28,
  },
  metaBlock: {
    gap: 2,
  },
  metaLabel: {
    fontFamily: fonts.sans,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: alpha.ink(0.4),
  },
  metaValue: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink700,
  },
  orderToggle: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    backgroundColor: alpha.ember(0.1),
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  orderToggleText: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.ember600,
  },
  orderList: {
    marginTop: 10,
    borderRadius: radius.md,
    backgroundColor: alpha.ember(0.04),
    padding: 12,
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
  orderTotalLine: {
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: alpha.ink(0.08),
  },
  orderTotalLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.ink900,
  },
  orderTotalValue: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.ink900,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  actionButton: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: alpha.ink(0.15),
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  actionButtonIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.ink700,
  },
  actionError: {
    marginTop: 6,
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.rust500,
  },
  armedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  armedButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  armedLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.parchment50,
  },
  armedDismiss: {
    height: 24,
    width: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: alpha.ink(0.15),
  },
  panel: {
    marginTop: 28,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: alpha.ink(0.1),
    backgroundColor: "rgba(244,237,226,0.6)",
    padding: 18,
  },
  panelTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.ink950,
  },
  panelSubtitle: {
    marginTop: 4,
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.ink600,
  },
  panelEmpty: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: alpha.ink(0.4),
  },
  preorderCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha.ink(0.08),
    backgroundColor: colors.parchment50,
    padding: 12,
  },
  preorderHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  preorderTime: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.ember600,
  },
  preorderGuest: {
    flex: 1,
    textAlign: "right",
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink800,
  },
  preorderItem: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.ink600,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  tableName: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink800,
  },
  tableCategory: {
    fontFamily: fonts.sans,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.ink600,
  },
})
