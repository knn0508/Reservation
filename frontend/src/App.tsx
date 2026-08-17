import { Routes, Route } from "react-router-dom"
import { SiteHeader } from "./components/layout/SiteHeader"
import { HomePage } from "./pages/HomePage"
import { LookupPage } from "./pages/LookupPage"
import { AdminPage } from "./pages/AdminPage"

function App() {
  return (
    <div className="min-h-[100dvh] bg-parchment-50">
      <SiteHeader />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/my-reservation" element={<LookupPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </div>
  )
}

export default App
