import { useState } from "react"
import { NavLink, useNavigate } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import { List, X, ForkKnife } from "@phosphor-icons/react"
import { useAuth } from "../../hooks/useAuth"

const EASE = [0.32, 0.72, 0, 1] as const

const linkBase = "text-[13px] font-medium tracking-wide transition-colors duration-300"

function NavItem({ to, children, end }: { to: string; children: React.ReactNode; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `${linkBase} ${isActive ? "text-ink-950" : "text-ink-600 hover:text-ink-950"}`}
    >
      {children}
    </NavLink>
  )
}

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    setOpen(false)
    navigate("/")
  }

  return (
    <>
      <header className="sticky top-0 z-40 flex justify-center px-4 pt-6">
        <div className="flex w-full max-w-[62rem] items-center justify-between gap-6 rounded-full border border-ink-900/10 bg-parchment-50/80 px-5 py-3 shadow-[0_1px_1px_rgba(25,21,18,0.03),0_12px_32px_-16px_rgba(25,21,18,0.18)] backdrop-blur-xl">
          <NavLink to="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-950 text-parchment-50">
              <ForkKnife size={13} weight="light" />
            </span>
            <span className="font-display text-[17px] tracking-tight text-ink-950">
              ITB <span className="italic text-ember-600">Reservation</span>
            </span>
          </NavLink>

          <nav className="hidden items-center gap-7 md:flex">
            {user?.role === "admin" ? (
              <>
                <NavItem to="/admin" end>
                  Floor
                </NavItem>
                <NavItem to="/admin/dashboard">Dashboard</NavItem>
              </>
            ) : (
              <>
                <NavItem to="/" end>
                  Restaurants
                </NavItem>
                <NavItem to="/my-reservation">My Reservation</NavItem>
              </>
            )}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            {user ? (
              <>
                <span className="text-[13px] text-ink-600">{user.full_name.split(" ")[0]}</span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="group flex items-center gap-2 rounded-full bg-ink-950 py-2 pl-4 pr-2 text-[13px] font-medium text-parchment-50 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <NavItem to="/login">Log in</NavItem>
                <NavLink
                  to="/signup"
                  className="group flex items-center gap-2 rounded-full bg-ink-950 py-2 pl-4 pr-2 text-[13px] font-medium text-parchment-50 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
                >
                  Sign up
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px">
                    ↗
                  </span>
                </NavLink>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="relative flex h-8 w-8 items-center justify-center md:hidden"
            aria-label="Toggle menu"
          >
            <AnimatePresence mode="wait" initial={false}>
              {open ? (
                <motion.span key="x" initial={{ rotate: -45, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 45, opacity: 0 }} transition={{ duration: 0.25, ease: EASE }}>
                  <X size={20} weight="light" />
                </motion.span>
              ) : (
                <motion.span key="list" initial={{ rotate: 45, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -45, opacity: 0 }} transition={{ duration: 0.25, ease: EASE }}>
                  <List size={20} weight="light" />
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="fixed inset-0 z-30 bg-parchment-50/95 backdrop-blur-2xl md:hidden"
          >
            <div className="flex h-full flex-col items-center justify-center gap-7">
              {(user?.role === "admin"
                ? [
                    { to: "/admin", label: "Floor", end: true },
                    { to: "/admin/dashboard", label: "Dashboard", end: false },
                  ]
                : [
                    { to: "/", label: "Restaurants", end: true },
                    { to: "/my-reservation", label: "My Reservation", end: false },
                  ]
              ).map((item, i) => (
                <motion.div
                  key={item.to}
                  initial={{ y: 32, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.08 + i * 0.05, duration: 0.5, ease: EASE }}
                >
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={() => setOpen(false)}
                    className="font-display text-3xl text-ink-950"
                  >
                    {item.label}
                  </NavLink>
                </motion.div>
              ))}

              <motion.div
                initial={{ y: 32, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5, ease: EASE }}
                className="mt-4 flex items-center gap-4"
              >
                {user ? (
                  <button type="button" onClick={handleLogout} className="rounded-full bg-ink-950 px-6 py-3 text-sm font-medium text-parchment-50">
                    Log out
                  </button>
                ) : (
                  <>
                    <NavLink to="/login" onClick={() => setOpen(false)} className="rounded-full border border-ink-900/15 px-6 py-3 text-sm font-medium text-ink-900">
                      Log in
                    </NavLink>
                    <NavLink to="/signup" onClick={() => setOpen(false)} className="rounded-full bg-ink-950 px-6 py-3 text-sm font-medium text-parchment-50">
                      Sign up
                    </NavLink>
                  </>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
