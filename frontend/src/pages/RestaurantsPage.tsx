import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { ArrowUpRight, Image as ImageIcon } from "@phosphor-icons/react"
import { Link, Navigate } from "react-router-dom"
import { getRestaurants } from "../lib/api"
import { getRestaurantContent } from "../lib/restaurantContent"
import { useAuth } from "../hooks/useAuth"

const EASE = [0.32, 0.72, 0, 1] as const

export function RestaurantsPage() {
  const { user } = useAuth()
  const restaurants = useQuery({ queryKey: ["restaurants"], queryFn: getRestaurants })

  if (user?.role === "admin") {
    return <Navigate to="/admin" replace />
  }

  return (
    <div className="mx-auto max-w-[72rem] px-4 py-16 md:px-10 md:py-24">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE }}
        className="max-w-2xl"
      >
        <span className="inline-flex items-center rounded-full border border-ember-500/25 bg-ember-500/5 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-ember-600">
          Reservations
        </span>
        <h1 className="mt-5 font-display text-5xl leading-[1.02] text-ink-950 md:text-6xl">
          Choose your table,
          <br />
          <span className="italic text-ember-600">held for tonight.</span>
        </h1>
        <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-ink-600">
          Two dining rooms, one account. Pick a restaurant to see real-time table availability and book in under a
          minute.
        </p>
      </motion.div>

      <div className="mt-16 grid gap-5 md:grid-cols-2">
        {restaurants.isLoading &&
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-[2rem] bg-ink-900/5" />
          ))}

        {restaurants.data?.map((r, i) => {
          const content = getRestaurantContent(r.slug)
          const cardImage = content.images[0]
          return (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 32, filter: "blur(6px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, delay: i * 0.1, ease: EASE }}
              className="rounded-[2rem] bg-ink-900/[0.04] p-2 ring-1 ring-ink-900/5"
            >
              <Link
                to={`/restaurants/${r.slug}`}
                className="group relative flex h-80 flex-col justify-end overflow-hidden rounded-[calc(2rem-0.5rem)] border border-ink-900/8 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1"
              >
                {cardImage ? (
                  <img
                    src={cardImage}
                    alt={content.displayName}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,var(--color-ink-800),var(--color-ink-950))]">
                    <ImageIcon size={36} weight="thin" className="text-parchment-50/25" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/25 to-transparent" />

                <div className="relative z-10 p-7">
                  {content.cuisine && (
                    <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-parchment-50/70">
                      {content.cuisine}
                    </span>
                  )}
                  <h2 className="mt-3 font-display text-3xl text-parchment-50">{content.displayName}</h2>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm text-parchment-50/75">View restaurant</span>
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-parchment-50 text-ink-950 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                      <ArrowUpRight size={16} weight="light" />
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
