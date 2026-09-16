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
import { clearToken, getToken, setToken } from "../lib/auth-storage"

interface AuthContextValue {
  user: User | undefined
  /** True until we know whether the stored token is still good. */
  isLoading: boolean
  login: (input: LoginInput) => Promise<User>
  signup: (input: RegisterInput) => Promise<User>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  // Unlike the web, reading the token is async, so there is a third state before we even
  // know whether to ask the server who we are. Routing must wait for it or it will bounce
  // a signed-in user to the login screen on every cold start.
  const [hasToken, setHasToken] = useState<boolean | null>(null)

  useEffect(() => {
    getToken().then((t) => setHasToken(Boolean(t)))
  }, [])

  const me = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getMe,
    enabled: hasToken === true,
    retry: false,
  })

  const loginMutation = useMutation({
    mutationFn: apiLogin,
    onSuccess: async (res) => {
      await setToken(res.access_token)
      setHasToken(true)
      queryClient.setQueryData(["auth", "me"], res.user)
    },
  })

  const registerMutation = useMutation({ mutationFn: apiRegister })

  async function login(input: LoginInput): Promise<User> {
    const res = await loginMutation.mutateAsync(input)
    return res.user
  }

  async function signup(input: RegisterInput): Promise<User> {
    await registerMutation.mutateAsync(input)
    return login({ email: input.email, password: input.password })
  }

  async function logout(): Promise<void> {
    await clearToken()
    setHasToken(false)
    queryClient.clear()
  }

  const isInvalidToken = me.isError && me.error instanceof ApiError && me.error.status === 401

  useEffect(() => {
    if (isInvalidToken) void logout()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInvalidToken])

  const user = hasToken === true && !isInvalidToken ? me.data : undefined
  const isLoading = hasToken === null || (hasToken === true && me.isLoading)

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
