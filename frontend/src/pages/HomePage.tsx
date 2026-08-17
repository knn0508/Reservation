import { BookingWizard } from "../components/booking/BookingWizard"

export function HomePage() {
  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10 md:px-10 md:py-16">
      <div className="grid gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="order-2 md:order-1">
          <div className="rounded-2xl border border-ink-900/10 bg-parchment-100/60 p-6 md:p-9">
            <BookingWizard />
          </div>
        </div>
        <div className="order-1 md:order-2">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-ember-600">Reservations</p>
          <h1 className="mt-2 font-display text-4xl leading-[1.05] text-ink-950 md:text-5xl">
            A table,
            <br />
            held for you.
          </h1>
          <p className="mt-5 max-w-[38ch] text-sm leading-relaxed text-ink-600">
            Muğam Masası seats small parties across an intimate dining room. Book in under a minute — we'll hold
            your table for the full evening.
          </p>
        </div>
      </div>
    </div>
  )
}
