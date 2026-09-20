import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import AppShell from './components/AppShell'
import Login from './routes/Login'
import Onboarding from './routes/Onboarding'
import Dashboard from './routes/Dashboard'

// Analytics (Recharts) and the rest of the secondary screens are lazy-loaded
// so the initial mobile load only pays for the dashboard.
const Upload = lazy(() => import('./routes/Upload'))
const Review = lazy(() => import('./routes/Review'))
const Transactions = lazy(() => import('./routes/Transactions'))
const Budgets = lazy(() => import('./routes/Budgets'))
const Forecast = lazy(() => import('./routes/Forecast'))
const Analytics = lazy(() => import('./routes/Analytics'))
const Settings = lazy(() => import('./routes/Settings'))

function RouteFallback() {
  return <div className="p-8 text-center text-sm text-stone-400">Loading…</div>
}

export default function App() {
  const { loading, user, household } = useAuth()

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-stone-50">
        <div className="text-stone-400">Loading…</div>
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  if (!household) {
    return (
      <Routes>
        <Route path="*" element={<Onboarding />} />
      </Routes>
    )
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/review/:documentId" element={<Review />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/forecast" element={<Forecast />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
