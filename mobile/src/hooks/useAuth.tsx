import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ApiError,
  getMe,
  login as apiLogin,
  register as apiRegister,
  type LoginInput,
  type RegisterInput,
  type User,
} from "../lib/api"
import { clearToken, hydrateToken, setToken } from "../lib/auth-storage"

interface AuthContextValue {
  user: User | undefined
  isLoading: boolean
  login: (input: LoginInput) => Promise<User>
  signup: (input: RegisterInput) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [hasToken, setHasToken] = useState(false)
  // AsyncStorage can only be read asynchronously, so the first paint has to wait for it —
  // otherwise a logged-in user would flash the signed-out header on every cold start.
  const [restored, setRestored] = useState(false)

  useEffect(() => {
    let alive = true
    hydrateToken().then((token) => {
      if (!alive) return
      setHasToken(Boolean(token))
      setRestored(true)
    })
    return () => {
      alive = false
    }
  }, [])

  const me = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getMe,
    enabled: restored && hasToken,
    retry: false,
  })

  const loginMutation = useMutation({
    mutationFn: apiLogin,
    onSuccess: (res) => {
      setToken(res.access_token)
      setHasToken(true)
      queryClient.setQueryData(["auth", "me"], res.user)
    },
  })

  const registerMutation = useMutation({ mutationFn: apiRegister })

  async function login(input: LoginInput): Promise<User> {
    const res = await loginMutation.mutateAsync(input)
    return res.user
  }

  async function signup(input: RegisterInput): Promise<void> {
    await registerMutation.mutateAsync(input)
    await login({ email: input.email, password: input.password })
  }

  function logout(): void {
    clearToken()
    setHasToken(false)
    queryClient.setQueryData(["auth", "me"], undefined)
  }

  const isInvalidToken = me.isError && me.error instanceof ApiError && me.error.status === 401

  useEffect(() => {
    if (isInvalidToken) logout()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInvalidToken])

  const user = hasToken && !isInvalidToken ? me.data : undefined
  const isLoading = !restored || (hasToken && me.isLoading)

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>{children}</AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
