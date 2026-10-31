import { RefreshCw, X } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const UPDATE_CHECK_INTERVAL_MS = 60_000

/**
 * Mounted once at the app root (outside auth gating, so it shows on the
 * login/onboarding screens too). The service worker is registered in
 * 'prompt' mode — a new version sits waiting rather than taking over
 * silently — so this is the only thing that surfaces it to the user.
 */
export default function UpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      // A browser only revalidates the service worker file on its own
      // around once a day, or on navigation — not while the app just sits
      // open. Poll explicitly so a deploy is noticed promptly either way.
      setInterval(() => registration.update(), UPDATE_CHECK_INTERVAL_MS)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="safe-top fixed inset-x-0 top-0 z-30 flex justify-center px-4 pt-3">
      <div className="flex w-full max-w-sm items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-lg">
        <p className="flex-1 text-sm text-stone-700">A new version of Parsely is ready.</p>
        <button
          onClick={() => updateServiceWorker(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white active:bg-brand-700"
        >
          <RefreshCw size={13} /> Refresh
        </button>
        <button onClick={() => setNeedRefresh(false)} aria-label="Dismiss" className="shrink-0 text-stone-400">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
