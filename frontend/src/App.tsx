import { Routes, Route, useLocation, matchPath } from "react-router-dom"
import { SiteHeader } from "./components/layout/SiteHeader"
import { RequireAuth } from "./components/auth/RequireAuth"
import { RestaurantsPage } from "./pages/RestaurantsPage"
import { RestaurantProfilePage } from "./pages/RestaurantProfilePage"
import { RestaurantMenuPage } from "./pages/RestaurantMenuPage"
import { BookingPage } from "./pages/BookingPage"
import { LoginPage } from "./pages/LoginPage"
import { SignupPage } from "./pages/SignupPage"
import { AdminLoginPage } from "./pages/AdminLoginPage"
import { MyReservationsPage } from "./pages/MyReservationsPage"
import { AdminPage } from "./pages/AdminPage"
import { AdminDashboard } from "./pages/AdminDashboard"
import { AdminDeliveryPage } from "./pages/AdminDeliveryPage"
import { AdminFloorPlanPage } from "./pages/AdminFloorPlanPage"

function App() {
  const location = useLocation()
  const hideSiteHeader = matchPath("/restaurants/:slug/menu", location.pathname)

  return (
    <div className="relative min-h-[100dvh] bg-parchment-50">
      <div className="pointer-events-none fixed inset-0 z-50 opacity-[0.035] mix-blend-multiply" aria-hidden style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      }} />
      {!hideSiteHeader && <SiteHeader />}
      <Routes>
        <Route path="/" element={<RestaurantsPage />} />
        <Route path="/restaurants/:slug" element={<RestaurantProfilePage />} />
        <Route path="/restaurants/:slug/menu" element={<RestaurantMenuPage />} />
        <Route
          path="/restaurants/:slug/book"
          element={
            <RequireAuth role="customer">
              <BookingPage />
            </RequireAuth>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route
          path="/my-reservation"
          element={
            <RequireAuth role="customer">
              <MyReservationsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAuth role="admin">
              <AdminPage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/floor-plan"
          element={
            <RequireAuth role="admin">
              <AdminFloorPlanPage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <RequireAuth role="admin">
              <AdminDashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/deliveries"
          element={
            <RequireAuth role="admin">
              <AdminDeliveryPage />
            </RequireAuth>
          }
        />
      </Routes>
    </div>
  )
}

export default App
