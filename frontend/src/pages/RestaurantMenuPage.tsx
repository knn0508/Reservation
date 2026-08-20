import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useParams } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, Plus, ShoppingCart, Check, Image as ImageIcon, ForkKnife } from "@phosphor-icons/react"
import { mamajanMenu, type MenuItem } from "../lib/mamajanMenu"
import { getRestaurantContent } from "../lib/restaurantContent"
import { getRestaurants } from "../lib/api"
import { useCart, CartProvider } from "../hooks/useCart"
import { CartDrawer } from "../components/menu/CartDrawer"

const EASE = [0.32, 0.72, 0, 1] as const

function formatPrice(n: number): string {
  return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)} ₼`
}

function MenuItemCard({ item }: { item: MenuItem }) {
  const { add } = useCart()
  const [justAdded, setJustAdded] = useState(false)

  function handleAdd() {
    add(item)
    setJustAdded(true)
    window.setTimeout(() => setJustAdded(false), 900)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="flex flex-col justify-between overflow-hidden rounded-2xl border border-ink-900/8 bg-parchment-100"
    >
      <div>
        {item.image ? (
          <div className="aspect-[4/3] w-full overflow-hidden bg-ink-900/[0.04]">
            <img
              src={item.image}
              alt={item.name}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center bg-ink-900/[0.03] text-ink-600/25">
            <ImageIcon size={26} weight="thin" />
          </div>
        )}
        <div className="p-5 pb-0">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-lg leading-snug text-ink-950">{item.name}</h3>
            <span className="shrink-0 font-mono text-sm text-ember-600">{formatPrice(item.price)}</span>
          </div>
          {item.description && (
            <p className="mt-2 text-[13px] leading-relaxed text-ink-600">{item.description}</p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={handleAdd}
        className="mx-5 mb-5 mt-4 flex items-center justify-center gap-2 self-start rounded-full border border-ink-900/12 px-4 py-2 text-xs font-medium text-ink-800 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-ember-500/40 hover:text-ember-600 active:scale-95"
      >
        <AnimatePresence mode="wait" initial={false}>
          {justAdded ? (
            <motion.span
              key="added"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1.5 text-moss-500"
            >
              <Check size={13} weight="bold" /> Added
            </motion.span>
          ) : (
            <motion.span
              key="add"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1.5"
            >
              <Plus size={13} weight="bold" /> Add
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </motion.div>
  )
}

function MenuInner() {
  const { slug = "" } = useParams<{ slug: string }>()
  const content = getRestaurantContent(slug)
  const restaurants = useQuery({ queryKey: ["restaurants"], queryFn: getRestaurants })
  const restaurantId = restaurants.data?.find((r) => r.slug === slug)?.id ?? null
  const [group, setGroup] = useState<"food" | "bar">("food")
  const categories = useMemo(() => mamajanMenu.filter((c) => c.group === group), [group])
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id ?? "")
  const [cartOpen, setCartOpen] = useState(false)
  const { count, total } = useCart()

  const activeCategory = categories.find((c) => c.id === activeCategoryId) ?? categories[0]

  function handleGroupChange(next: "food" | "bar") {
    setGroup(next)
    const first = mamajanMenu.find((c) => c.group === next)
    if (first) setActiveCategoryId(first.id)
  }

  return (
    <div className="relative min-h-[100dvh] pb-28">
      <div className="sticky top-0 z-30 border-b border-ink-900/8 bg-parchment-50/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[72rem] items-center justify-between px-4 py-3 md:px-10">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-950 text-parchment-50">
              <ForkKnife size={13} weight="light" />
            </span>
            <span className="font-display text-[17px] tracking-tight text-ink-950">
              ITB <span className="italic text-ember-600">Reservation</span>
            </span>
          </Link>
          <Link
            to={`/restaurants/${slug}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-600 transition-colors duration-300 hover:text-ember-600"
          >
            <ArrowLeft size={13} weight="light" /> Back to {content.displayName}
          </Link>
        </div>

        <div className="mx-auto max-w-[72rem] px-4 pb-5 md:px-10">
          <div className="flex items-center justify-between gap-4">
            <h1 className="font-display text-3xl text-ink-950 md:text-4xl">Menu</h1>
            <div className="flex shrink-0 rounded-full border border-ink-900/10 p-1">
              <button
                type="button"
                onClick={() => handleGroupChange("food")}
                className={`rounded-full px-4 py-2 text-xs font-medium transition-colors duration-300 ${
                  group === "food" ? "bg-ink-950 text-parchment-50" : "text-ink-600"
                }`}
              >
                Food
              </button>
              <button
                type="button"
                onClick={() => handleGroupChange("bar")}
                className={`rounded-full px-4 py-2 text-xs font-medium transition-colors duration-300 ${
                  group === "bar" ? "bg-ink-950 text-parchment-50" : "text-ink-600"
                }`}
              >
                Bar &amp; Drinks
              </button>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCategoryId(c.id)}
                className={`shrink-0 rounded-full border px-4 py-2 text-xs font-medium transition-colors duration-300 ${
                  c.id === activeCategory?.id
                    ? "border-ember-500 bg-ember-500 text-parchment-50"
                    : "border-ink-900/10 text-ink-700 hover:border-ink-900/25"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[72rem] px-4 py-10 md:px-10">
        <AnimatePresence mode="wait">
          {activeCategory && (
            <motion.div
              key={activeCategory.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeCategory.items.map((item) => (
                  <MenuItemCard key={item.id} item={item} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.button
        type="button"
        onClick={() => setCartOpen(true)}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full bg-ink-950 py-3 pl-5 pr-3 text-sm font-medium text-parchment-50 shadow-[0_20px_50px_-16px_rgba(0,0,0,0.5)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97]"
      >
        <ShoppingCart size={16} weight="light" />
        {count > 0 ? (
          <span>
            {count} item{count === 1 ? "" : "s"} · {formatPrice(total)}
          </span>
        ) : (
          <span>Your order</span>
        )}
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
          <ArrowLeft size={14} weight="light" className="rotate-180" />
        </span>
      </motion.button>

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        restaurantName={content.displayName}
        restaurantId={restaurantId}
      />
    </div>
  )
}

export function RestaurantMenuPage() {
  return (
    <CartProvider>
      <MenuInner />
    </CartProvider>
  )
}
