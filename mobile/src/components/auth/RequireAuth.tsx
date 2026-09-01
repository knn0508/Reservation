import { useEffect, type ReactNode } from "react"
import { useRouter } from "expo-router"
import { useAuth } from "../../hooks/useAuth"
import { LoadingScreen } from "../ui/Primitives"

/** The route guard from the web app. React Router could redirect during render with
 *  `<Navigate>`; expo-router navigates imperatively, so the redirect moves into an effect and
 *  the guard renders a spinner until it fires. */
export function RequireAuth({
  children,
  role,
}: {
  children: ReactNode
  /** "customer" or "admin" restricts to that account type; omit to allow either. */
  role?: "customer" | "admin"
}) {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  const wrongRole = Boolean(user && role && user.role !== role)
  const signedOut = !isLoading && !user

  useEffect(() => {
    if (isLoading) return
    if (signedOut) {
      router.replace(role === "admin" ? "/admin/login" : "/login")
      return
    }
    if (wrongRole) {
      router.replace(user!.role === "admin" ? "/admin" : "/")
    }
  }, [isLoading, signedOut, wrongRole, role, router, user])

  if (isLoading) return <LoadingScreen />
  if (signedOut || wrongRole) return <LoadingScreen label="Redirecting…" />

  return <>{children}</>
}
