import { useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useParams } from "react-router-dom"
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion"
import {
  ArrowUpRight,
  InstagramLogo,
  FacebookLogo,
  WhatsappLogo,
  MapPin,
  Phone,
  Clock,
  Image as ImageIcon,
} from "@phosphor-icons/react"
import { getRestaurants } from "../lib/api"
import { getRestaurantContent } from "../lib/restaurantContent"
import { ImageLightbox } from "../components/restaurant/ImageLightbox"

const EASE = [0.32, 0.72, 0, 1] as const

export function RestaurantProfilePage() {
  const { slug = "" } = useParams<{ slug: string }>()
  const restaurants = useQuery({ queryKey: ["restaurants"], queryFn: getRestaurants })
  const restaurant = restaurants.data?.find((r) => r.slug === slug)
  const content = getRestaurantContent(slug)

  const reduceMotion = useReducedMotion()
  const heroRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] })
  const heroImageY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"])
  const heroImageScale = useTransform(scrollYProgress, [0, 1], [1, 1.15])
  const heroTextY = useTransform(scrollYProgress, [0, 1], ["0%", "-20%"])
  const heroOverlayOpacity = useTransform(scrollYProgress, [0, 1], [0.45, 0.85])

  const [lightboxIndex, setLightboxIndex] = useState(-1)

  if (restaurants.isLoading) {
    return <div className="mx-auto max-w-lg px-6 py-24 text-center text-sm text-ink-600">Loading…</div>
  }

  if (!restaurant) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center text-sm text-ink-600">
        Restaurant not found.
        <div className="mt-4">
          <Link to="/" className="text-ember-600 underline underline-offset-4">
            Back to restaurants
          </Link>
        </div>
      </div>
    )
  }

  const hasGallery = content.images.length > 0

  return (
    <div className="relative">
      {/* Hero */}
      <section ref={heroRef} className="relative flex min-h-[100dvh] items-end overflow-hidden">
        <motion.div
          className="absolute inset-0"
          style={reduceMotion ? undefined : { y: heroImageY, scale: heroImageScale }}
        >
          {content.hasRealImages ? (
            <button
              type="button"
              onClick={() => setLightboxIndex(0)}
              aria-label="Open photo gallery"
              className="group absolute inset-0 h-full w-full cursor-zoom-in"
            >
              <img
                src={content.images[0]}
                alt={content.displayName}
                className="h-full w-full object-cover"
              />
              <span className="absolute inset-0 bg-ink-950/0 transition-colors duration-500 group-hover:bg-ink-950/10" />
            </button>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,var(--color-ink-800),var(--color-ink-950))]">
              <div className="flex flex-col items-center gap-3 text-parchment-50/30">
                <ImageIcon size={40} weight="thin" />
                <span className="text-[11px] uppercase tracking-[0.2em]">Hero photo placeholder</span>
              </div>
            </div>
          )}
        </motion.div>

        <motion.div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/40 to-ink-950/10"
          style={reduceMotion ? undefined : { opacity: heroOverlayOpacity }}
        />

        <motion.div
          className="relative z-10 mx-auto w-full max-w-[72rem] px-4 pb-16 md:px-10 md:pb-20"
          style={reduceMotion ? undefined : { y: heroTextY }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.1 }}
        >
          <span className="inline-flex items-center rounded-full border border-parchment-50/25 bg-parchment-50/5 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-parchment-50/90 backdrop-blur-sm">
            {content.cuisine || "Restaurant"}
          </span>
          <h1 className="mt-5 max-w-2xl font-display text-5xl leading-[1.05] text-parchment-50 md:text-7xl">
            {content.displayName}
          </h1>
          <p className="mt-4 max-w-[42ch] text-[15px] leading-relaxed text-parchment-50/80">{content.tagline}</p>
        </motion.div>
      </section>

      {/* About */}
      <section className="mx-auto max-w-[72rem] px-4 py-20 md:px-10 md:py-28">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:gap-16">
          <div>
            <h2 className="font-display text-4xl text-ink-950 md:text-5xl">About</h2>
            <div className="mt-6 space-y-5">
              {content.about.map((p, i) => (
                <motion.p
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.6, ease: EASE, delay: i * 0.06 }}
                  className="max-w-[62ch] text-[15px] leading-relaxed text-ink-600"
                >
                  {p}
                </motion.p>
              ))}
            </div>

            <div className="mt-9 grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <MapPin size={18} weight="light" className="mt-0.5 shrink-0 text-ember-600" />
                <a
                  href="https://maps.app.goo.gl/rXMxNHUJXm9QgdTr6"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-ink-600 underline hover:no-underline"
                >
                  {content.address}
                </a>
              </div>
              <div className="flex items-start gap-3">
                <Clock size={18} weight="light" className="mt-0.5 shrink-0 text-ember-600" />
                <span className="text-sm text-ink-600">{content.hours}</span>
              </div>
              <div className="flex items-start gap-3">
                <Phone size={18} weight="light" className="mt-0.5 shrink-0 text-ember-600" />
                <span className="text-sm text-ink-600">{content.phone}</span>
              </div>
            </div>

            <div className="mt-7 flex items-center gap-3">
              <a
                href={content.social.instagram}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-ink-900/10 text-ink-700 transition-colors duration-300 hover:border-ember-500/40 hover:text-ember-600"
              >
                <InstagramLogo size={17} weight="light" />
              </a>
              <a
                href={content.social.facebook}
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-ink-900/10 text-ink-700 transition-colors duration-300 hover:border-ember-500/40 hover:text-ember-600"
              >
                <FacebookLogo size={17} weight="light" />
              </a>
              <a
                href={content.social.whatsapp}
                target="_blank"
                rel="noreferrer"
                aria-label="WhatsApp"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-ink-900/10 text-ink-700 transition-colors duration-300 hover:border-ember-500/40 hover:text-ember-600"
              >
                <WhatsappLogo size={17} weight="light" />
              </a>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            {hasGallery ? (
              <button
                type="button"
                onClick={() => setLightboxIndex(Math.min(1, content.images.length - 1))}
                className="group relative block aspect-[4/5] w-full overflow-hidden rounded-[1.75rem] ring-1 ring-ink-900/8"
              >
                <img
                  src={content.images[Math.min(1, content.images.length - 1)]}
                  alt={`${content.displayName} interior`}
                  className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
                />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/60 to-transparent p-5">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-parchment-50/85">View gallery</span>
                </span>
              </button>
            ) : (
              <div className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-3 rounded-[1.75rem] border border-dashed border-ink-900/15 bg-ink-900/[0.03] text-ink-600/50">
                <ImageIcon size={32} weight="thin" />
                <span className="text-[11px] uppercase tracking-[0.18em]">Gallery photo placeholder</span>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Menu */}
      <section className="border-t border-ink-900/8 bg-ink-900/[0.03]">
        <div className="mx-auto max-w-[72rem] px-4 py-20 md:px-10 md:py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: EASE }}
            className="flex flex-col items-start justify-between gap-8 rounded-[2rem] border border-ink-900/8 bg-parchment-50 p-8 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)] md:flex-row md:items-center md:p-12"
          >
            <div className="max-w-xl">
              <h2 className="font-display text-4xl text-ink-950 md:text-5xl">Menu</h2>
              <p className="mt-4 text-[15px] leading-relaxed text-ink-600">
                Click the button see the menu and order before you come.
              </p>
            </div>
            {content.menuUrl.startsWith("/") ? (
              <Link
                to={content.menuUrl}
                target="_blank"
                rel="noreferrer"
                className="group flex shrink-0 items-center gap-2 rounded-full bg-ink-950 py-3 pl-6 pr-3 text-sm font-medium text-parchment-50 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
              >
                View the menu
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                  <ArrowUpRight size={15} weight="light" />
                </span>
              </Link>
            ) : (
              <a
                href={content.menuUrl}
                target="_blank"
                rel="noreferrer"
                className="group flex shrink-0 items-center gap-2 rounded-full bg-ink-950 py-3 pl-6 pr-3 text-sm font-medium text-parchment-50 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
              >
                View the menu
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                  <ArrowUpRight size={15} weight="light" />
                </span>
              </a>
            )}
          </motion.div>
        </div>
      </section>

      {/* Reservation */}
      <section className="mx-auto max-w-[72rem] px-4 py-20 md:px-10 md:py-28">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: EASE }}
          className="relative overflow-hidden rounded-[2rem] bg-ink-950 p-10 md:p-16"
        >
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-20 blur-3xl"
            style={{ background: "radial-gradient(circle, #c05f34, transparent 70%)" }}
          />
          <span className="inline-flex items-center rounded-full border border-parchment-50/20 bg-parchment-50/5 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-parchment-50/80">
            Reservation
          </span>
          <h2 className="mt-5 max-w-lg font-display text-4xl leading-[1.05] text-parchment-50 md:text-5xl">
            Hold your table at {content.displayName}.
          </h2>
          <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-parchment-50/70">
            Pick a date and party size, we'll show real-time availability and confirm in under a minute.
          </p>
          <Link
            to={`/restaurants/${slug}/book`}
            className="group mt-8 inline-flex items-center gap-2 rounded-full bg-parchment-50 py-3 pl-6 pr-3 text-sm font-medium text-ink-950 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
          >
            Reserve a table
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-950/10 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
              <ArrowUpRight size={15} weight="light" />
            </span>
          </Link>
        </motion.div>
      </section>

      {hasGallery && (
        <ImageLightbox
          images={content.images}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(-1)}
          onIndexChange={setLightboxIndex}
        />
      )}
    </div>
  )
}
