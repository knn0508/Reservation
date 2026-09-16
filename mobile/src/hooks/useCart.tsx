import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import type { MenuItem } from "../lib/menu"

export interface CartLine {
  item: MenuItem
  qty: number
}

/**
 * Where this basket is going. The whole point of the split:
 *
 * - `delivery`    → a delivery order. A courier picks it up and drives it to a pin.
 * - `reservation` → a pre-order attached to a booking. The kitchen cooks it for the
 *                   reservation time and it is handed over at the table. No courier, ever.
 *
 * It is on the cart rather than decided at the last screen because entering the menu from a
 * booking already answers the question, and a customer who did that should never be asked
 * for a delivery address.
 */
export type Fulfilment = "delivery" | "reservation"

interface CartContextValue {
  lines: CartLine[]
  /** Which restaurant this basket belongs to; adding from another one replaces it. */
  restaurantSlug: string | null
  fulfilment: Fulfilment
  /** Set when the customer came in from a specific booking. */
  reservationId: string | null
  add: (item: MenuItem, restaurantSlug: string) => void
  remove: (itemId: string) => void
  setQty: (itemId: string, qty: number) => void
  setFulfilment: (f: Fulfilment) => void
  setReservationId: (id: string | null) => void
  clear: () => void
  count: number
  total: number
}

const CartContext = createContext<CartContextValue | null>(null)
const STORAGE_KEY = "itb.cart"

interface StoredCart {
  restaurantSlug: string | null
  lines: CartLine[]
  fulfilment?: Fulfilment
  reservationId?: string | null
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])
  const [restaurantSlug, setRestaurantSlug] = useState<string | null>(null)
  const [fulfilment, setFulfilmentState] = useState<Fulfilment>("delivery")
  const [reservationId, setReservationIdState] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return
        const parsed = JSON.parse(raw) as StoredCart
        setLines(parsed.lines ?? [])
        setRestaurantSlug(parsed.restaurantSlug ?? null)
        setFulfilmentState(parsed.fulfilment ?? "delivery")
        setReservationIdState(parsed.reservationId ?? null)
      })
      .catch(() => {})
      .finally(() => setHydrated(true))
  }, [])

  useEffect(() => {
    // Guarded on `hydrated` so the first render doesn't overwrite the stored cart with the
    // empty initial state before it has been read back.
    if (!hydrated) return
    void AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ restaurantSlug, lines, fulfilment, reservationId }),
    )
  }, [lines, restaurantSlug, fulfilment, reservationId, hydrated])

  function add(item: MenuItem, slug: string) {
    // One kitchen cooks one order. Switching restaurants starts a new basket rather than
    // silently mixing dishes nobody can serve together - and drops the booking it was
    // attached to, since that booking is at the other restaurant.
    if (restaurantSlug && restaurantSlug !== slug) {
      setRestaurantSlug(slug)
      setLines([{ item, qty: 1 }])
      setFulfilmentState("delivery")
      setReservationIdState(null)
      return
    }
    setRestaurantSlug(slug)
    setLines((prev) => {
      const existing = prev.find((l) => l.item.id === item.id)
      if (existing) return prev.map((l) => (l.item.id === item.id ? { ...l, qty: l.qty + 1 } : l))
      return [...prev, { item, qty: 1 }]
    })
  }

  function remove(itemId: string) {
    setLines((prev) => prev.filter((l) => l.item.id !== itemId))
  }

  function setQty(itemId: string, qty: number) {
    if (qty <= 0) {
      remove(itemId)
      return
    }
    setLines((prev) => prev.map((l) => (l.item.id === itemId ? { ...l, qty } : l)))
  }

  function setFulfilment(f: Fulfilment) {
    setFulfilmentState(f)
    // Switching back to delivery drops the booking link; keeping it would let a basket
    // claim a reservation it is no longer for.
    if (f === "delivery") setReservationIdState(null)
  }

  function setReservationId(id: string | null) {
    setReservationIdState(id)
    if (id) setFulfilmentState("reservation")
  }

  function clear() {
    setLines([])
    setRestaurantSlug(null)
    setFulfilmentState("delivery")
    setReservationIdState(null)
  }

  const count = useMemo(() => lines.reduce((n, l) => n + l.qty, 0), [lines])
  const total = useMemo(() => lines.reduce((n, l) => n + l.qty * l.item.price, 0), [lines])

  return (
    <CartContext.Provider
      value={{
        lines,
        restaurantSlug,
        fulfilment,
        reservationId,
        add,
        remove,
        setQty,
        setFulfilment,
        setReservationId,
        clear,
        count,
        total,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart must be used within CartProvider")
  return ctx
}
