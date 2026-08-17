import { NavLink } from "react-router-dom"

const linkBase =
  "text-sm tracking-wide transition-colors duration-200 pb-1 border-b-[1.5px] border-transparent"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-900/10 bg-parchment-50/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-5 md:px-10">
        <NavLink to="/" className="flex items-baseline gap-2">
          <span className="font-display text-xl tracking-tight text-ink-950">Muğam</span>
          <span className="font-display text-xl italic tracking-tight text-ember-600">Masası</span>
        </NavLink>
        <nav className="flex items-center gap-6 md:gap-8">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `${linkBase} ${isActive ? "border-ember-500 text-ink-950" : "text-ink-600 hover:text-ink-900"}`
            }
          >
            Reserve
          </NavLink>
          <NavLink
            to="/my-reservation"
            className={({ isActive }) =>
              `${linkBase} ${isActive ? "border-ember-500 text-ink-950" : "text-ink-600 hover:text-ink-900"}`
            }
          >
            My Reservation
          </NavLink>
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `${linkBase} hidden md:inline ${isActive ? "border-ember-500 text-ink-950" : "text-ink-600 hover:text-ink-900"}`
            }
          >
            Floor
          </NavLink>
        </nav>
      </div>
    </header>
  )
}
