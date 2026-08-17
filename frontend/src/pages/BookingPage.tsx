import { useQuery } from "@tanstack/react-query"
import { useParams } from "react-router-dom"
import { motion } from "framer-motion"
import { getRestaurants } from "../lib/api"
import { BookingWizard } from "../components/booking/BookingWizard"

export function BookingPage() {
  const { slug } = useParams<{ slug: string }>()
  const restaurants = useQuery({ queryKey: ["restaurants"], queryFn: getRestaurants })
  const restaurant = restaurants.data?.find((r) => r.slug === slug)

  if (restaurants.isLoading) {
    return <div className="mx-auto max-w-lg px-6 py-24 text-center text-sm text-ink-600">Loading…</div>
  }

  if (!restaurant) {
    return <div className="mx-auto max-w-lg px-6 py-24 text-center text-sm text-ink-600">Restaurant not found.</div>
  }

  return (
    <div className="mx-auto max-w-[72rem] px-4 py-12 md:px-10 md:py-20">
      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="order-2 md:order-1">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
            className="rounded-[2rem] bg-ink-900/[0.04] p-2 ring-1 ring-ink-900/5"
          >
            <div className="rounded-[calc(2rem-0.5rem)] border border-ink-900/8 bg-parchment-100 p-6 md:p-9">
              <BookingWizard restaurantId={restaurant.id} />
            </div>
          </motion.div>
        </div>
        <div className="order-1 md:order-2">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-ember-600">Reserving at</span>
          <h1 className="mt-2 font-display text-4xl leading-[1.05] text-ink-950 md:text-5xl">{restaurant.name}</h1>
          <p className="mt-5 max-w-[38ch] text-sm leading-relaxed text-ink-600">
            Pick a date within the next week, then a party size — we'll show you real, live table availability.
          </p>
        </div>
      </div>
    </div>
  )
}
