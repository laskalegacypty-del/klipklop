import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import SharedTimesView from '../components/times/SharedTimesView'
import { fetchSharedTimes } from '../lib/shareLink'
import { APP_NAME, APP_LOGO_SRC, APP_TAGLINE } from '../constants/branding'
import { Skeleton } from '../components/ui'

function ShareBrandedShell({ children, footer = true }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <img src={APP_LOGO_SRC} alt={`${APP_NAME} logo`} className="h-10 w-10 object-contain" />
          <div>
            <p className="text-base font-bold text-green-900">{APP_NAME}</p>
            <p className="text-xs text-gray-500">{APP_TAGLINE}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 pb-28">
        {children}
      </main>

      {footer && (
        <footer className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] z-20">
          <div className="max-w-3xl mx-auto px-4 py-3">
            <p className="text-sm font-medium text-gray-800 text-center mb-2">
              Track your own times on {APP_NAME}
            </p>
            <div className="flex gap-2">
              <Link
                to="/register"
                className="flex-1 text-center bg-green-800 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-green-900 transition"
              >
                Create free account
              </Link>
              <Link
                to="/login"
                className="flex-1 text-center bg-green-50 text-green-800 py-2.5 rounded-lg text-sm font-semibold hover:bg-green-100 transition border border-green-200"
              >
                Log in
              </Link>
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}

function ShareErrorState({ title, message }) {
  return (
    <ShareBrandedShell>
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-gray-600 text-sm leading-relaxed">{message}</p>
        <p className="text-gray-500 text-sm mt-6">
          Want to share your own times? Join {APP_NAME}.
        </p>
      </div>
    </ShareBrandedShell>
  )
}

export default function ShareTimes() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [payload, setPayload] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchSharedTimes(token)
        if (!cancelled) setPayload(data)
      } catch (err) {
        if (!cancelled) {
          setError({
            title: err.status === 410 ? 'Link unavailable' : 'Something went wrong',
            message: err.message || 'Could not load shared times.',
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (token) load()
    return () => { cancelled = true }
  }, [token])

  useEffect(() => {
    if (payload?.share_meta?.share_title) {
      document.title = payload.share_meta.share_title
    }
    return () => {
      document.title = APP_NAME
    }
  }, [payload])

  if (loading) {
    return (
      <ShareBrandedShell footer={false}>
        <Skeleton className="h-20 mb-4" />
        <Skeleton className="h-48" />
      </ShareBrandedShell>
    )
  }

  if (error) {
    return <ShareErrorState title={error.title} message={error.message} />
  }

  const meta = payload?.share_meta
  const times = payload?.times

  return (
    <ShareBrandedShell>
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {meta?.horse_name}
              {meta?.rider_name ? ` × ${meta.rider_name}` : ''}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {meta?.season_year} season · Shared by a {APP_NAME} rider
            </p>
          </div>
        </div>
      </div>

      <SharedTimesView
        combo={times?.combo}
        selectedYear={times?.selected_year || new Date().getFullYear()}
        preloaded={{
          personal_bests: times?.personal_bests,
          year_bests: times?.year_bests,
          history: times?.history,
          trend_rows: times?.trend_rows,
        }}
        tabQueryKey="view"
        showPoweredBy
      />
    </ShareBrandedShell>
  )
}
