import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Feather } from "@expo/vector-icons"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  ApiError,
  createReservation,
  getAvailability,
  getRestaurants,
  type AvailabilitySlot,
} from "../../src/lib/api"
import { useAuth } from "../../src/hooks/useAuth"
import { Button, Card, ErrorNote, Eyebrow, Hint, Loading, Screen, Subtitle, Title } from "../../src/components/ui"
import { colors, radius } from "../../src/lib/theme"
import { addDays, formatDayNumber, formatDayShort, formatSlotTime, randomKey, toDayKey } from "../../src/lib/time"

/** The server refuses bookings beyond this, so don't offer days it will reject. */
const DAYS_AHEAD = 7
const PARTY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8]

/** Book a table: party size → day → slot. This is "the reservation process" — finishing it
 * lands the customer on the Reservations tab, where they can attach a pre-order. */
export default function BookScreen() {
  const { slug = "" } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const restaurants = useQuery({ queryKey: ["restaurants"], queryFn: getRestaurants })
  const restaurant = (restaurants.data ?? []).find((r) => r.slug === slug)

  const [partySize, setPartySize] = useState(2)
  const [day, setDay] = useState(() => toDayKey(new Date()))
  const [slot, setSlot] = useState<string | null>(null)

  const days = useMemo(() => {
    const today = new Date()
    return Array.from({ length: DAYS_AHEAD + 1 }, (_, i) => addDays(today, i))
  }, [])

  const availability = useQuery({
    queryKey: ["availability", restaurant?.id, day, partySize],
    queryFn: () => getAvailability(restaurant!.id, day, partySize),
    enabled: Boolean(restaurant),
  })

  const book = useMutation({ mutationFn: createReservation })

  function handleBook() {
    if (!restaurant || !slot || !user) return
    book.mutate(
      {
        restaurant_id: restaurant.id,
        guest_name: user.full_name,
        guest_email: user.email,
        guest_phone: user.phone,
        party_size: partySize,
        start_time: slot,
        // Protects against a double-tap creating two tables' worth of booking.
        idempotency_key: randomKey(),
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["reservations", "me"] })
          router.replace("/(customer)/reservations")
        },
      },
    )
  }

  const slots: AvailabilitySlot[] = availability.data ?? []
  const openSlots = slots.filter((s) => s.available_count > 0)

  if (restaurants.isLoading) {
    return (
      <Screen>
        <Loading />
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
            <Eyebrow>Rezervasiya</Eyebrow>
            <Title>Book a table</Title>
          </View>
        </View>
        <Subtitle>{restaurant?.name ?? slug}</Subtitle>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>How many of you?</Text>
          <View style={styles.chipWrap}>
            {PARTY_SIZES.map((n) => (
              <Pressable
                key={n}
                onPress={() => {
                  setPartySize(n)
                  setSlot(null)
                }}
                style={[styles.sizeChip, partySize === n && styles.chipActive]}
              >
                <Text style={[styles.chipText, partySize === n && styles.chipTextActive]}>{n}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Which day?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
            {days.map((d) => {
              const key = toDayKey(d)
              const active = key === day
              return (
                <Pressable
                  key={key}
                  onPress={() => {
                    setDay(key)
                    setSlot(null)
                  }}
                  style={[styles.dayChip, active && styles.chipActive]}
                >
                  <Text style={[styles.dayName, active && styles.chipTextActive]}>
                    {formatDayShort(d)}
                  </Text>
                  <Text style={[styles.dayNum, active && styles.chipTextActive]}>
                    {formatDayNumber(d)}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>What time?</Text>
          {availability.isLoading ? (
            <Loading />
          ) : openSlots.length === 0 ? (
            <Hint>
              Nothing free for {partySize} on this day. Try another day or a smaller party.
            </Hint>
          ) : (
            <View style={styles.chipWrap}>
              {openSlots.map((s) => {
                const active = slot === s.time
                return (
                  <Pressable
                    key={s.time}
                    onPress={() => setSlot(s.time)}
                    style={[styles.slotChip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {formatSlotTime(s.time)}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          )}
        </Card>

        {book.isError ? (
          <ErrorNote>
            {book.error instanceof ApiError ? book.error.message : "Couldn't book that — try again."}
          </ErrorNote>
        ) : null}

        <Button
          title="Confirm reservation"
          onPress={handleBook}
          disabled={!slot || !restaurant}
          loading={book.isPending}
          style={{ marginBottom: insets.bottom + 24 }}
        />
        <Hint>
          Booked under {user?.full_name ?? "your account"}. You can add a pre-order afterwards, so
          the kitchen starts it in time.
        </Hint>
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
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chipActive: { borderColor: colors.ember500, backgroundColor: colors.tintEmber },
  chipText: { fontSize: 14, color: colors.ink700 },
  chipTextActive: { color: colors.ink950, fontWeight: "600" },
  sizeChip: {
    minWidth: 44,
    alignItems: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  slotChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dayRow: { gap: 8, paddingRight: 8 },
  dayChip: {
    alignItems: "center",
    gap: 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 56,
  },
  dayName: { fontSize: 11, color: colors.ink600, textTransform: "uppercase" },
  dayNum: { fontSize: 17, color: colors.ink900 },
})
