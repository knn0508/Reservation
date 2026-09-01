import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import type { MenuItem } from "../lib/mamajanMenu"

interface CartLine {
  item: MenuItem
  qty: number
}

interface CartContextValue {
  lines: CartLine[]
  add: (item: MenuItem) => void
  remove: (itemId: string) => void
  setQty: (itemId: string, qty: number) => void
  clear: () => void
  count: number
  total: number
}

const CartContext = createContext<CartContextValue | null>(null)
const STORAGE_KEY = "itb-cart-mamajan"

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])
  // The web version seeded state straight from localStorage. AsyncStorage can only be read
  // asynchronously, so the cart loads on mount and the persist effect is held back until then —
  // otherwise the empty first render would immediately overwrite the saved cart.
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!alive) return
        if (raw) {
          try {
            setLines(JSON.parse(raw) as CartLine[])
          } catch {
            // A corrupt cart is not worth surfacing — start empty.
          }
        }
        setLoaded(true)
      })
      .catch(() => alive && setLoaded(true))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!loaded) return
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
  }, [lines, loaded])

  function add(item: MenuItem) {
    setLines((prev) => {
      const existing = prev.find((l) => l.item.id === item.id)
      if (existing) {
        return prev.map((l) => (l.item.id === item.id ? { ...l, qty: l.qty + 1 } : l))
      }
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

  function clear() {
    setLines([])
  }

  const count = useMemo(() => lines.reduce((n, l) => n + l.qty, 0), [lines])
  const total = useMemo(() => lines.reduce((n, l) => n + l.qty * l.item.price, 0), [lines])

  return (
    <CartContext.Provider value={{ lines, add, remove, setQty, clear, count, total }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart must be used within CartProvider")
  return ctx
}
