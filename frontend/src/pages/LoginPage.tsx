import { useState } from "react"
import { useNavigate, useSearchParams, Link } from "react-router-dom"
import { motion } from "framer-motion"
import { useAuth } from "../hooks/useAuth"
import { ApiError } from "../lib/api"

export function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await login({ email, password })
      navigate(params.get("next") ?? "/")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
        className="rounded-[2rem] bg-ink-900/[0.04] p-2 ring-1 ring-ink-900/5"
      >
        <div className="rounded-[calc(2rem-0.5rem)] border border-ink-900/8 bg-parchment-100 p-8">
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-ember-600">Welcome back</span>
          <h1 className="mt-2 font-display text-3xl text-ink-950">Log in</h1>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-600">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-ink-900/15 bg-parchment-50 px-3.5 py-2.5 text-sm text-ink-950 outline-none transition-colors duration-200 focus:border-ember-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-600">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-ink-900/15 bg-parchment-50 px-3.5 py-2.5 text-sm text-ink-950 outline-none transition-colors duration-200 focus:border-ember-500"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-rust-500/30 bg-rust-500/5 px-3.5 py-2.5 text-sm text-rust-500">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-ink-950 px-4 py-3 text-sm font-medium text-parchment-50 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? "Logging in…" : "Log in"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-ink-600">
            No account?{" "}
            <Link to="/signup" className="text-ember-600 hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
