import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { X, Plus, Minus, Trash, ShoppingCart, Check, ForkKnife } from "@phosphor-icons/react"
import { useCart } from "../../hooks/useCart"
import { useCreatePreorder } from "../../hooks/useReservation"
import { useAuth } from "../../hooks/useAuth"
import { getMyReservations, ApiError } from "../../lib/api"
import { formatFullDate, formatSlotTime, toDayKey } from "../../lib/time"

const EASE = [0.32, 0.72, 0, 1] as const

function formatPrice(n: number): string {
  return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)} ₼`
}

type ReadyStep = "cart" | "ask-ready" | "pick-reservation" | "not-ready-done" | "sent"

interface CartDrawerProps {
  open: boolean
  onClose: () => void
  restaurantName: string
  restaurantId: number | null
}

export function CartDrawer({ open, onClose, restaurantName, restaurantId }: CartDrawerProps) {
  const { lines, setQty, remove, clear, total } = useCart()
  const { user } = useAuth()
  const [step, setStep] = useState<ReadyStep>("cart")
  const [reservationId, setReservationId] = useState("")

  const myReservations = useQuery({
    queryKey: ["reservations", "me"],
    queryFn: getMyReservations,
    enabled: Boolean(user) && step === "pick-reservation",
  })

  const upcomingHere = useMemo(
    () =>
      (myReservations.data ?? []).filter(
        (r) => r.restaurant_id === restaurantId && r.status === "booked" && new Date(r.start_time) > new Date(),
      ),
    [myReservations.data, restaurantId],
  )

  const createPreorder = useCreatePreorder()

  function handleClose() {
    onClose()
    // Reset the ready-flow (but not the cart) once the drawer is closed, so a fresh
    // "Review order" click always starts the question from scratch.
    window.setTimeout(() => {
      setStep("cart")
      setReservationId("")
      createPreorder.reset()
    }, 300)
  }

  function handleSend() {
    if (!reservationId.trim() || !restaurantId) return
    createPreorder.mutate(
      {
        reservationId: reservationId.trim(),
        restaurantId,
        items: lines.map((l) => ({ name: l.item.name, quantity: l.qty, price: l.item.price })),
      },
      {
        onSuccess: () => {
          clear()
          setStep("sent")
        },
      },
    )
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="fixed inset-0 z-[80] bg-ink-950/50 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.45, ease: EASE }}
            className="fixed right-0 top-0 z-[85] flex h-[100dvh] w-full max-w-md flex-col bg-parchment-50 shadow-[0_0_80px_-16px_rgba(0,0,0,0.4)]"
          >
            <div className="flex items-center justify-between border-b border-ink-900/8 px-6 py-5">
              <div>
                <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-ember-600">
                  {step === "cart" ? "Your order" : "Ready on arrival"}
                </span>
                <h2 className="mt-1 font-display text-2xl text-ink-950">{restaurantName}</h2>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close cart"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-ink-900/10 text-ink-700 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-105 active:scale-95"
              >
                <X size={17} weight="light" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {step === "cart" &&
                (lines.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-ink-600/60">
                    <ShoppingCart size={32} weight="thin" />
                    <p className="max-w-[24ch] text-sm">
                      Nothing here yet. Add dishes from the menu to build your order.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-4">
                    {lines.map(({ item, qty }) => (
                      <li key={item.id} className="flex items-start justify-between gap-3 border-b border-ink-900/6 pb-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink-950">{item.name}</p>
                          <p className="mt-0.5 text-xs text-ink-600">{formatPrice(item.price)} each</p>
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setQty(item.id, qty - 1)}
                              aria-label="Decrease quantity"
                              className="flex h-7 w-7 items-center justify-center rounded-full border border-ink-900/12 text-ink-700 transition-transform duration-200 active:scale-90"
                            >
                              <Minus size={12} weight="bold" />
                            </button>
                            <span className="w-5 text-center text-sm font-mono text-ink-900">{qty}</span>
                            <button
                              type="button"
                              onClick={() => setQty(item.id, qty + 1)}
                              aria-label="Increase quantity"
                              className="flex h-7 w-7 items-center justify-center rounded-full border border-ink-900/12 text-ink-700 transition-transform duration-200 active:scale-90"
                            >
                              <Plus size={12} weight="bold" />
                            </button>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <span className="text-sm font-medium text-ink-950">{formatPrice(item.price * qty)}</span>
                          <button
                            type="button"
                            onClick={() => remove(item.id)}
                            aria-label={`Remove ${item.name}`}
                            className="text-ink-600/50 transition-colors duration-200 hover:text-rust-500"
                          >
                            <Trash size={15} weight="light" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ))}

              {step === "ask-ready" && (
                <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
                  <ForkKnife size={30} weight="light" className="text-ember-600" />
                  <div>
                    <p className="font-display text-xl text-ink-950">Have it ready when you arrive?</p>
                    <p className="mt-2 max-w-[32ch] text-sm leading-relaxed text-ink-600">
                      We can tell the kitchen to have this order ready right at your reservation time.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep("not-ready-done")}
                      className="rounded-full border border-ink-900/15 px-5 py-2.5 text-sm font-medium text-ink-800 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95"
                    >
                      No, I'll order there
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep("pick-reservation")}
                      className="rounded-full bg-ink-950 px-5 py-2.5 text-sm font-medium text-parchment-50 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95"
                    >
                      Yes, get it ready
                    </button>
                  </div>
                </div>
              )}

              {step === "pick-reservation" && (
                <div className="flex h-full flex-col justify-center gap-5">
                  <div>
                    <p className="font-display text-xl text-ink-950">Which reservation?</p>
                    <p className="mt-2 text-sm leading-relaxed text-ink-600">
                      We'll send this order to the restaurant, timed for that reservation.
                    </p>
                  </div>

                  {user && upcomingHere.length > 0 ? (
                    <div className="space-y-2">
                      {upcomingHere.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setReservationId(r.id)}
                          className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-colors duration-200 ${
                            reservationId === r.id
                              ? "border-ember-500 bg-ember-500/5 text-ink-950"
                              : "border-ink-900/12 text-ink-700 hover:border-ink-900/25"
                          }`}
                        >
                          <span>
                            {formatFullDate(toDayKey(new Date(r.start_time)))} · {formatSlotTime(r.start_time)}
                          </span>
                          <span className="font-mono text-xs text-ink-600">{r.party_size} guests</span>
                        </button>
                      ))}
                      <p className="pt-1 text-center text-xs text-ink-600/70">or paste an ID below</p>
                    </div>
                  ) : null}

                  <div>
                    <label className="text-xs font-medium uppercase tracking-wide text-ink-600">
                      Reservation ID
                    </label>
                    <input
                      type="text"
                      value={reservationId}
                      onChange={(e) => setReservationId(e.target.value)}
                      placeholder="Paste it from My Reservation"
                      className="mt-2 w-full rounded-lg border border-ink-900/15 bg-parchment-100 px-3.5 py-2.5 font-mono text-sm text-ink-950 outline-none transition-colors focus:border-ember-500"
                    />
                    <p className="mt-2 text-xs text-ink-600/70">
                      Find it on the "My Reservation" page under each booking.
                    </p>
                  </div>

                  {createPreorder.isError && (
                    <div className="rounded-lg border border-rust-500/30 bg-rust-500/5 px-3.5 py-2.5 text-sm text-rust-500">
                      {createPreorder.error instanceof ApiError
                        ? createPreorder.error.message
                        : "Couldn't send that — please try again."}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setStep("ask-ready")}
                      className="rounded-full border border-ink-900/12 px-4 py-3 text-sm font-medium text-ink-700 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={!reservationId.trim() || !restaurantId || createPreorder.isPending}
                      className="flex-1 rounded-full bg-ink-950 py-3 text-sm font-medium text-parchment-50 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] disabled:opacity-50"
                    >
                      {createPreorder.isPending ? "Sending…" : "Send to kitchen"}
                    </button>
                  </div>
                </div>
              )}

              {step === "not-ready-done" && (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-moss-500/10 text-moss-500">
                    <Check size={22} weight="bold" />
                  </span>
                  <p className="font-display text-xl text-ink-950">Good to know</p>
                  <p className="max-w-[30ch] text-sm leading-relaxed text-ink-600">
                    No problem — order at your table when you arrive. Your cart is still saved here.
                  </p>
                  <button
                    type="button"
                    onClick={() => setStep("cart")}
                    className="mt-2 rounded-full border border-ink-900/12 px-5 py-2.5 text-sm font-medium text-ink-800"
                  >
                    Back to cart
                  </button>
                </div>
              )}

              {step === "sent" && (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-moss-500/10 text-moss-500">
                    <Check size={22} weight="bold" />
                  </span>
                  <p className="font-display text-xl text-ink-950">Sent to the restaurant</p>
                  <p className="max-w-[32ch] text-sm leading-relaxed text-ink-600">
                    They've been notified — your food will be ready right at your reservation time.
                  </p>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="mt-2 rounded-full bg-ink-950 px-5 py-2.5 text-sm font-medium text-parchment-50"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>

            {step === "cart" && lines.length > 0 && (
              <div className="border-t border-ink-900/8 px-6 py-5">
                <div className="flex items-center justify-between text-sm text-ink-600">
                  <span>Subtotal</span>
                  <span className="font-mono text-base text-ink-950">{formatPrice(total)}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink-600/70">
                  Final pricing is confirmed with your server, or by phone, when you arrive.
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={clear}
                    className="rounded-full border border-ink-900/12 px-4 py-3 text-sm font-medium text-ink-700 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep("ask-ready")}
                    className="flex-1 rounded-full bg-ink-950 py-3 text-sm font-medium text-parchment-50 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
                  >
                    Review order
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
