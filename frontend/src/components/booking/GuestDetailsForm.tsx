import { useState } from "react"
import { motion } from "framer-motion"

export interface GuestDetails {
  guest_name: string
  guest_email: string
  guest_phone: string
}

function validate(details: GuestDetails): Partial<Record<keyof GuestDetails, string>> {
  const errors: Partial<Record<keyof GuestDetails, string>> = {}
  if (!details.guest_name.trim()) errors.guest_name = "Name is required."
  if (!/^\S+@\S+\.\S+$/.test(details.guest_email)) errors.guest_email = "Enter a valid email."
  if (!/^[+\d][\d\s-]{6,}$/.test(details.guest_phone)) errors.guest_phone = "Enter a valid phone number."
  return errors
}

export function GuestDetailsForm({
  details,
  onChange,
  onSubmit,
  submitLabel,
  isSubmitting,
  serverError,
}: {
  details: GuestDetails
  onChange: (details: GuestDetails) => void
  onSubmit: () => void
  submitLabel: string
  isSubmitting: boolean
  serverError?: string | null
}) {
  const [touched, setTouched] = useState<Partial<Record<keyof GuestDetails, boolean>>>({})
  const errors = validate(details)

  function field(key: keyof GuestDetails) {
    return {
      value: details[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...details, [key]: e.target.value }),
      onBlur: () => setTouched((t) => ({ ...t, [key]: true })),
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched({ guest_name: true, guest_email: true, guest_phone: true })
    if (Object.keys(errors).length === 0) onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:max-w-md">
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-600">Full name</label>
        <input
          {...field("guest_name")}
          type="text"
          placeholder="Aygün Məmmədova"
          className="w-full rounded-lg border border-ink-900/15 bg-parchment-50 px-3.5 py-2.5 text-sm text-ink-950 outline-none transition-colors duration-200 placeholder:text-ink-600/40 focus:border-ember-500"
        />
        {touched.guest_name && errors.guest_name && (
          <p className="mt-1 text-xs text-rust-500">{errors.guest_name}</p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-600">Email</label>
        <input
          {...field("guest_email")}
          type="email"
          placeholder="you@example.com"
          className="w-full rounded-lg border border-ink-900/15 bg-parchment-50 px-3.5 py-2.5 text-sm text-ink-950 outline-none transition-colors duration-200 placeholder:text-ink-600/40 focus:border-ember-500"
        />
        {touched.guest_email && errors.guest_email && (
          <p className="mt-1 text-xs text-rust-500">{errors.guest_email}</p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-600">Phone</label>
        <input
          {...field("guest_phone")}
          type="tel"
          placeholder="+994 50 123 45 67"
          className="w-full rounded-lg border border-ink-900/15 bg-parchment-50 px-3.5 py-2.5 text-sm text-ink-950 outline-none transition-colors duration-200 placeholder:text-ink-600/40 focus:border-ember-500"
        />
        {touched.guest_phone && errors.guest_phone && (
          <p className="mt-1 text-xs text-rust-500">{errors.guest_phone}</p>
        )}
      </div>

      {serverError && (
        <div className="rounded-lg border border-rust-500/30 bg-rust-500/5 px-3.5 py-2.5 text-sm text-rust-500">
          {serverError}
        </div>
      )}

      <motion.button
        type="submit"
        disabled={isSubmitting}
        whileTap={{ scale: 0.98 }}
        className="w-full rounded-lg bg-ink-950 px-4 py-3 text-sm font-medium text-parchment-50 transition-opacity duration-200 disabled:opacity-50"
      >
        {isSubmitting ? "Confirming…" : submitLabel}
      </motion.button>
    </form>
  )
}
