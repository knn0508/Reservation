import { type ReactNode } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "../../hooks/useAuth"

export function RequireAuth({
  children,
  role,
}: {
  children: ReactNode
  /** "customer" or "admin" restricts to that account type; omit to allow either. */
  role?: "customer" | "admin"
}) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <div className="mx-auto max-w-lg px-6 py-24 text-center text-sm text-ink-600">Loading…</div>
  }

  if (!user) {
    const loginPath = role === "admin" ? "/admin/login" : "/login"
    return <Navigate to={`${loginPath}?next=${encodeURIComponent(location.pathname)}`} replace />
  }

  if (role && user.role !== role) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/"} replace />
  }

  return <>{children}</>
}
