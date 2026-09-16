import { useEffect, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useRouter } from "expo-router"
import { Feather } from "@expo/vector-icons"
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  ApiError,
  createDeliveryOrder,
  getDeliveryQuote,
  getRestaurants,
  type CreateDeliveryOrderInput,
} from "../src/lib/api"
import { useAuth } from "../src/hooks/useAuth"
import { useCart } from "../src/hooks/useCart"
import { LocationPicker } from "../src/components/LocationPicker"
import {
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Eyebrow,
  Hint,
  Input,
  Label,
  Screen,
  Subtitle,
  Title,
} from "../src/components/ui"
import { colors, formatPrice, radius } from "../src/lib/theme"
import type { LatLng } from "../src/lib/maps"

/**
 * Where the order goes: recipient, pin, address detail, and the note the courier reads.
 *
 * The pin leads and the free-text address follows, deliberately. Azerbaijani street
 * addresses geocode badly, so the courier navigates by coordinates; the text and the
 * building/entrance/floor/apartment fields are what they read once they're at the door.
 */
export default function CheckoutScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { lines, total, clear, restaurantSlug } = useCart()

  const restaurants = useQuery({ queryKey: ["restaurants"], queryFn: getRestaurants })
  const restaurant = (restaurants.data ?? []).find((r) => r.slug === restaurantSlug)

  const quote = useQuery({
    queryKey: ["delivery", "quote", total],
    queryFn: () => getDeliveryQuote(total),
    enabled: lines.length > 0,
  })
  const fee = quote.data?.delivery_fee ?? 0

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [addressText, setAddressText] = useState("")
  const [building, setBuilding] = useState("")
  const [entrance, setEntrance] = useState("")
  const [floor, setFloor] = useState("")
  const [apartment, setApartment] = useState("")
  const [note, setNote] = useState("")
  const [payment, setPayment] = useState<"cash" | "card_on_delivery">("cash")
  const [pin, setPin] = useState<LatLng | null>(null)

  // Prefilled from the account but left editable: ordering to a friend's flat under their
  // name is normal, and the courier must see whoever actually opens the door.
  useEffect(() => {
    if (!user) return
    setName((v) => v || user.full_name)
    setPhone((v) => v || user.phone)
  }, [user])

  const createOrder = useMutation({ mutationFn: createDeliveryOrder })

  const missing: string[] = []
  if (!name.trim()) missing.push("your name")
  if (!phone.trim()) missing.push("a phone number")
  if (!pin) missing.push("a location pin")
  if (!addressText.trim()) missing.push("the address")
  const canSubmit = missing.length === 0 && lines.length > 0 && Boolean(restaurant)

  function handleSubmit() {
    if (!canSubmit || !restaurant || !pin) return
    const input: CreateDeliveryOrderInput = {
      restaurant_id: restaurant.id,
      recipient_name: name.trim(),
      recipient_phone: phone.trim(),
      lat: pin.lat,
      lng: pin.lng,
      address_text: addressText.trim(),
      building: building.trim() || null,
      entrance: entrance.trim() || null,
      floor: floor.trim() || null,
      apartment: apartment.trim() || null,
      courier_note: note.trim() || null,
      payment_method: payment,
      items: lines.map((l) => ({ name: l.item.name, unit_price: l.item.price, quantity: l.qty })),
    }
    createOrder.mutate(input, {
      onSuccess: () => {
        clear()
        router.replace("/(customer)/orders")
      },
    })
  }

  if (lines.length === 0) {
    return (
      <Screen>
        <View style={{ paddingTop: insets.top + 60 }}>
          <EmptyState
            title="Your basket is empty"
            body="Pick a few dishes from the menu and come back to have them delivered."
          />
          <Button
            title="Browse restaurants"
            onPress={() => router.replace("/(customer)/restaurants")}
            style={styles.emptyButton}
          />
        </View>
      </Screen>
    )
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 10 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
              <Feather name="arrow-left" size={18} color={colors.ink800} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Eyebrow>Online çatdırılma</Eyebrow>
              <Title>Where should we bring it?</Title>
            </View>
          </View>
          <Subtitle>
            {restaurant?.name ?? "The kitchen"} starts cooking as soon as this is placed. Drop a
            pin on your door — the courier navigates by the pin, not the street name.
          </Subtitle>

          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Who receives it</Text>
            <View style={styles.field}>
              <Label>Full name</Label>
              <Input value={name} onChangeText={setName} placeholder="Leyla Məmmədova" />
            </View>
            <View style={styles.field}>
              <Label>Phone</Label>
              <Input
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="+994 50 123 45 67"
              />
              <Hint>The courier calls this number when they arrive.</Hint>
            </View>
          </Card>

          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery location</Text>
            <LocationPicker value={pin} onChange={setPin} />

            <View style={styles.field}>
              <Label>Address</Label>
              <Input
                value={addressText}
                onChangeText={setAddressText}
                placeholder="Nizami küç. 28, Səbail"
              />
              <Hint>Street and district, as you'd say it out loud.</Hint>
            </View>

            <View style={styles.grid}>
              <View style={styles.gridCell}>
                <Label>Building</Label>
                <Input value={building} onChangeText={setBuilding} />
              </View>
              <View style={styles.gridCell}>
                <Label>Entrance</Label>
                <Input value={entrance} onChangeText={setEntrance} />
              </View>
              <View style={styles.gridCell}>
                <Label>Floor</Label>
                <Input value={floor} onChangeText={setFloor} />
              </View>
              <View style={styles.gridCell}>
                <Label>Apartment</Label>
                <Input value={apartment} onChangeText={setApartment} />
              </View>
            </View>
          </Card>

          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Note for the courier</Text>
            <Input
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={500}
              placeholder="Intercom 45, second gate past the pharmacy. Please call before coming up."
            />
            <Hint>Gate codes, a landmark, or “don't ring the bell” — the courier sees this.</Hint>
          </Card>

          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Payment</Text>
            <View style={styles.payRow}>
              {(
                [
                  ["cash", "Cash on delivery"],
                  ["card_on_delivery", "Card at the door"],
                ] as const
              ).map(([value, label]) => (
                <Pressable
                  key={value}
                  onPress={() => setPayment(value)}
                  style={[styles.payChip, payment === value && styles.payChipActive]}
                >
                  <Text style={[styles.payText, payment === value && styles.payTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>

          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Your order</Text>
            {lines.map(({ item, qty }) => (
              <View key={item.id} style={styles.summaryRow}>
                <Text style={styles.summaryName}>
                  <Text style={styles.summaryQty}>{qty}× </Text>
                  {item.name}
                </Text>
                <Text style={styles.summaryValue}>{formatPrice(item.price * qty)}</Text>
              </View>
            ))}
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>{formatPrice(total)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery</Text>
              <Text style={styles.summaryValue}>{fee === 0 ? "Free" : formatPrice(fee)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatPrice(total + fee)}</Text>
            </View>
          </Card>

          {createOrder.isError ? (
            <ErrorNote>
              {createOrder.error instanceof ApiError
                ? createOrder.error.message
                : "Couldn't place that order — please try again."}
            </ErrorNote>
          ) : null}

          {missing.length > 0 ? <Hint>Still needed: {missing.join(", ")}.</Hint> : null}

          <Button
            title="Place delivery order"
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={createOrder.isPending}
            style={{ marginBottom: insets.bottom + 24 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  back: { padding: 4 },
  section: { padding: 18, gap: 12 },
  sectionTitle: { fontSize: 17, color: colors.ink950 },
  field: { gap: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  gridCell: { flexGrow: 1, flexBasis: "45%" },
  payRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  payChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  payChipActive: { borderColor: colors.ember500, backgroundColor: colors.tintEmber },
  payText: { fontSize: 13, color: colors.ink700 },
  payTextActive: { color: colors.ink950, fontWeight: "600" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  summaryName: { flex: 1, fontSize: 13, color: colors.ink700 },
  summaryQty: { color: colors.ink600 },
  summaryLabel: { fontSize: 13, color: colors.ink600 },
  summaryValue: { fontSize: 13, color: colors.ink950, fontVariant: ["tabular-nums"] },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 4 },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8, marginTop: 4 },
  totalLabel: { fontSize: 14, fontWeight: "600", color: colors.ink950 },
  totalValue: { fontSize: 18, color: colors.ink950, fontVariant: ["tabular-nums"] },
  emptyButton: { marginHorizontal: 20, marginTop: 12 },
})
