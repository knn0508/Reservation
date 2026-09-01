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
    // One column, heading on top: the floor plan is the widest thing on this page, so nothing
    // sits beside the wizard and takes width away from it.
    <div className="mx-auto max-w-[84rem] px-4 py-10 md:px-8 md:py-14">
      <header className="mb-6">
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-ember-600">Reserving at</span>
        <h1 className="mt-1.5 font-display text-4xl leading-[1.05] text-ink-950 md:text-5xl">{restaurant.name}</h1>
      </header>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
        className="rounded-[2rem] bg-ink-900/[0.04] p-2 ring-1 ring-ink-900/5"
      >
        <div className="rounded-[calc(2rem-0.5rem)] border border-ink-900/8 bg-parchment-100 p-5 md:p-8">
          <BookingWizard restaurantId={restaurant.id} restaurantSlug={restaurant.slug} />
        </div>
      </motion.div>
    </div>
  )
}
