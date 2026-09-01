import { useMemo, useState } from "react"
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useQuery } from "@tanstack/react-query"
import { Ionicons } from "@expo/vector-icons"
import { useCart } from "../../hooks/useCart"
import { useCreatePreorder } from "../../hooks/useReservation"
import { useAuth } from "../../hooks/useAuth"
import { getMyReservations, ApiError } from "../../lib/api"
import { formatFullDate, formatSlotTime, toDayKey } from "../../lib/time"
import { alpha, colors, fonts, radius } from "../../lib/theme"
import { ErrorNote, Field, PrimaryButton } from "../ui/Primitives"
import { PressScale } from "../ui/Pressable"

function formatPrice(n: number): string {
  return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)} ₼`
}

type ReadyStep = "cart" | "ask-ready" | "pick-reservation" | "not-ready-done" | "sent"

interface CartDrawerProps {
  open: boolean
  onClose: () => void
  restaurantName: string
  restaurantId: number | null
}

/** The slide-in order panel. On the web this was a right-hand drawer; on a phone it is a
 *  full-height sheet, which is the same thing at this width. */
export function CartDrawer({ open, onClose, restaurantName, restaurantId }: CartDrawerProps) {
  const { lines, setQty, remove, clear, total } = useCart()
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
  const [step, setStep] = useState<ReadyStep>("cart")
  const [reservationId, setReservationId] = useState("")

  const myReservations = useQuery({
    queryKey: ["reservations", "me"],
    queryFn: getMyReservations,
    enabled: Boolean(user) && step === "pick-reservation",
  })

  const upcomingHere = useMemo(
    () =>
      (myReservations.data ?? []).filter(
        (r) => r.restaurant_id === restaurantId && r.status === "booked" && new Date(r.start_time) > new Date(),
      ),
    [myReservations.data, restaurantId],
  )

  const createPreorder = useCreatePreorder()

  function handleClose() {
    onClose()
    // Reset the ready-flow (but not the cart) once the sheet is closed, so a fresh
    // "Review order" tap always starts the question from scratch.
    setTimeout(() => {
      setStep("cart")
      setReservationId("")
      createPreorder.reset()
    }, 300)
  }

  function handleSend() {
    if (!reservationId.trim() || !restaurantId) return
    createPreorder.mutate(
      {
        reservationId: reservationId.trim(),
        restaurantId,
        items: lines.map((l) => ({ name: l.item.name, quantity: l.qty, price: l.item.price })),
      },
      {
        onSuccess: () => {
          clear()
          setStep("sent")
        },
      },
    )
  }

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={handleClose} accessibilityLabel="Close cart" />

        <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
          <View style={[styles.header, { paddingTop: insets.top > 0 ? 16 : 20 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerEyebrow}>{step === "cart" ? "Your order" : "Ready on arrival"}</Text>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {restaurantName}
              </Text>
            </View>
            <PressScale onPress={handleClose} accessibilityLabel="Close cart" scaleTo={0.9}>
              <View style={styles.closeButton}>
                <Ionicons name="close" size={17} color={colors.ink700} />
              </View>
            </PressScale>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {step === "cart" &&
              (lines.length === 0 ? (
                <View style={styles.centered}>
                  <Ionicons name="cart-outline" size={32} color={alpha.ink(0.3)} />
                  <Text style={styles.centeredText}>
                    Nothing here yet. Add dishes from the menu to build your order.
                  </Text>
                </View>
              ) : (
                <View>
                  {lines.map(({ item, qty }) => (
                    <View key={item.id} style={styles.line}>
                      <View style={styles.lineMain}>
                        <Text style={styles.lineName}>{item.name}</Text>
                        <Text style={styles.lineUnit}>{formatPrice(item.price)} each</Text>
                        <View style={styles.stepper}>
                          <PressScale
                            onPress={() => setQty(item.id, qty - 1)}
                            accessibilityLabel="Decrease quantity"
                            scaleTo={0.88}
                          >
                            <View style={styles.stepperButton}>
                              <Ionicons name="remove" size={12} color={colors.ink700} />
                            </View>
                          </PressScale>
                          <Text style={styles.stepperValue}>{qty}</Text>
                          <PressScale
                            onPress={() => setQty(item.id, qty + 1)}
                            accessibilityLabel="Increase quantity"
                            scaleTo={0.88}
                          >
                            <View style={styles.stepperButton}>
                              <Ionicons name="add" size={12} color={colors.ink700} />
                            </View>
                          </PressScale>
                        </View>
                      </View>
                      <View style={styles.lineSide}>
                        <Text style={styles.lineTotal}>{formatPrice(item.price * qty)}</Text>
                        <PressScale
                          onPress={() => remove(item.id)}
                          accessibilityLabel={`Remove ${item.name}`}
                          scaleTo={0.85}
                          hitSlop={8}
                        >
                          <Ionicons name="trash-outline" size={15} color={alpha.ink(0.4)} />
                        </PressScale>
                      </View>
                    </View>
                  ))}
                </View>
              ))}

            {step === "ask-ready" && (
              <View style={styles.centered}>
                <Ionicons name="restaurant-outline" size={30} color={colors.ember600} />
                <Text style={styles.promptTitle}>Have it ready when you arrive?</Text>
                <Text style={styles.promptBody}>
                  We can tell the kitchen to have this order ready right at your reservation time.
                </Text>
                <View style={styles.promptActions}>
                  <PressScale onPress={() => setStep("not-ready-done")} scaleTo={0.96} style={{ flex: 1 }}>
                    <View style={styles.outlineButton}>
                      <Text style={styles.outlineButtonText}>No, I'll order there</Text>
                    </View>
                  </PressScale>
                  <PrimaryButton
                    label="Yes, get it ready"
                    onPress={() => setStep("pick-reservation")}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            )}

            {step === "pick-reservation" && (
              <View style={{ gap: 18 }}>
                <View>
                  <Text style={styles.promptTitle}>Which reservation?</Text>
                  <Text style={[styles.promptBody, { textAlign: "left" }]}>
                    We'll send this order to the restaurant, timed for that reservation.
                  </Text>
                </View>

                {user && upcomingHere.length > 0 ? (
                  <View style={{ gap: 8 }}>
                    {upcomingHere.map((r) => {
                      const picked = reservationId === r.id
                      return (
                        <PressScale key={r.id} onPress={() => setReservationId(r.id)} scaleTo={0.98}>
                          <View style={[styles.reservationOption, picked && styles.reservationOptionPicked]}>
                            <Text style={[styles.reservationText, picked && { color: colors.ink950 }]}>
                              {formatFullDate(toDayKey(new Date(r.start_time)))} · {formatSlotTime(r.start_time)}
                            </Text>
                            <Text style={styles.reservationParty}>{r.party_size} guests</Text>
                          </View>
                        </PressScale>
                      )
                    })}
                    <Text style={styles.orPaste}>or paste an ID below</Text>
                  </View>
                ) : null}

                <Field
                  label="Reservation ID"
                  value={reservationId}
                  onChangeText={setReservationId}
                  placeholder="Paste it from My Reservation"
                  autoCapitalize="none"
                  autoCorrect={false}
                  hint={'Find it on the "My Reservation" screen under each booking.'}
                />

                {createPreorder.isError && (
                  <ErrorNote>
                    {createPreorder.error instanceof ApiError
                      ? createPreorder.error.message
                      : "Couldn't send that — please try again."}
                  </ErrorNote>
                )}

                <View style={styles.promptActions}>
                  <PressScale onPress={() => setStep("ask-ready")} scaleTo={0.96}>
                    <View style={styles.outlineButton}>
                      <Text style={styles.outlineButtonText}>Back</Text>
                    </View>
                  </PressScale>
                  <PrimaryButton
                    label={createPreorder.isPending ? "Sending…" : "Send to kitchen"}
                    onPress={handleSend}
                    disabled={!reservationId.trim() || !restaurantId}
                    loading={createPreorder.isPending}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            )}

            {step === "not-ready-done" && (
              <View style={styles.centered}>
                <View style={styles.successMark}>
                  <Ionicons name="checkmark" size={22} color={colors.moss500} />
                </View>
                <Text style={styles.promptTitle}>Good to know</Text>
                <Text style={styles.promptBody}>
                  No problem — order at your table when you arrive. Your cart is still saved here.
                </Text>
                <PressScale onPress={() => setStep("cart")} scaleTo={0.96}>
                  <View style={styles.outlineButton}>
                    <Text style={styles.outlineButtonText}>Back to cart</Text>
                  </View>
                </PressScale>
              </View>
            )}

            {step === "sent" && (
              <View style={styles.centered}>
                <View style={styles.successMark}>
                  <Ionicons name="checkmark" size={22} color={colors.moss500} />
                </View>
                <Text style={styles.promptTitle}>Sent to the restaurant</Text>
                <Text style={styles.promptBody}>
                  They've been notified — your food will be ready right at your reservation time.
                </Text>
                <PrimaryButton label="Done" onPress={handleClose} style={{ alignSelf: "stretch" }} />
              </View>
            )}
          </ScrollView>

          {step === "cart" && lines.length > 0 && (
            <View style={styles.footer}>
              <View style={styles.subtotalRow}>
                <Text style={styles.subtotalLabel}>Subtotal</Text>
                <Text style={styles.subtotalValue}>{formatPrice(total)}</Text>
              </View>
              <Text style={styles.footerNote}>
                Final pricing is confirmed with your server, or by phone, when you arrive.
              </Text>
              <View style={styles.footerActions}>
                <PressScale onPress={clear} scaleTo={0.96}>
                  <View style={styles.outlineButton}>
                    <Text style={styles.outlineButtonText}>Clear</Text>
                  </View>
                </PressScale>
                <PrimaryButton label="Review order" onPress={() => setStep("ask-ready")} style={{ flex: 1 }} />
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(25,21,18,0.5)",
    justifyContent: "flex-end",
  },
  backdropTap: {
    height: 56,
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.parchment50,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: alpha.ink(0.08),
    paddingHorizontal: 22,
    paddingBottom: 16,
  },
  headerEyebrow: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.ember600,
  },
  headerTitle: {
    marginTop: 4,
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink950,
  },
  closeButton: {
    height: 40,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: alpha.ink(0.1),
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 22,
    paddingVertical: 20,
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  centeredText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 20,
    color: alpha.ink(0.45),
    textAlign: "center",
    maxWidth: 240,
  },
  promptTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink950,
    textAlign: "center",
  },
  promptBody: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink600,
    textAlign: "center",
  },
  promptActions: {
    flexDirection: "row",
    gap: 10,
    alignSelf: "stretch",
    alignItems: "center",
  },
  outlineButton: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: alpha.ink(0.15),
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: "center",
  },
  outlineButtonText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.ink800,
  },
  line: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: alpha.ink(0.06),
    paddingBottom: 16,
    marginBottom: 16,
  },
  lineMain: {
    flex: 1,
  },
  lineName: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.ink950,
  },
  lineUnit: {
    marginTop: 2,
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.ink600,
  },
  stepper: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepperButton: {
    height: 28,
    width: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: alpha.ink(0.12),
  },
  stepperValue: {
    minWidth: 20,
    textAlign: "center",
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.ink900,
  },
  lineSide: {
    alignItems: "flex-end",
    gap: 10,
  },
  lineTotal: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.ink950,
  },
  reservationOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha.ink(0.12),
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  reservationOptionPicked: {
    borderColor: colors.ember500,
    backgroundColor: alpha.ember(0.05),
  },
  reservationText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink700,
  },
  reservationParty: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.ink600,
  },
  orPaste: {
    paddingTop: 4,
    textAlign: "center",
    fontFamily: fonts.sans,
    fontSize: 11,
    color: alpha.ink(0.45),
  },
  successMark: {
    height: 48,
    width: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: alpha.moss(0.1),
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: alpha.ink(0.08),
    paddingHorizontal: 22,
    paddingVertical: 18,
  },
  subtotalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  subtotalLabel: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink600,
  },
  subtotalValue: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.ink950,
  },
  footerNote: {
    marginTop: 8,
    fontFamily: fonts.sans,
    fontSize: 11,
    lineHeight: 17,
    color: alpha.ink(0.45),
  },
  footerActions: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
})
