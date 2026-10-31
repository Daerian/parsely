import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const UPDATE_CHECK_INTERVAL_MS = 60_000

/**
 * Mounted once at the app root. The service worker registers in 'prompt'
 * mode — a new version sits waiting rather than taking over on its own —
 * but we immediately send the skip-waiting signal ourselves the moment one
 * is found, so updates apply with no banner and no tap. Trade-off, by
 * request: an update can land (and reload the page) while the app is open
 * mid-task, rather than waiting for the user to choose the moment.
 */
export default function AutoUpdater() {
  const {
    needRefresh: [needRefresh],
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

  useEffect(() => {
    if (needRefresh) updateServiceWorker()
  }, [needRefresh, updateServiceWorker])

  return null
}
