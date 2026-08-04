import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { APP_NAME, APP_LOGO_SRC } from '../constants/branding'
import toast from 'react-hot-toast'

export default function Subscribe() {
  const { user, profile, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [verifying, setVerifying] = useState(false)

  const isClubHead = profile?.role === 'club_head'
  const amount = isClubHead ? 25000 : 5000
  const planLabel = isClubHead ? 'KlipKlop Club — R250/month' : 'KlipKlop Rider — R50/month'
  const planCode = isClubHead
    ? import.meta.env.VITE_PAYSTACK_CLUB_HEAD_PLAN
    : import.meta.env.VITE_PAYSTACK_RIDER_PLAN

  useEffect(() => {
    const existing = document.querySelector('script[src="https://js.paystack.co/v1/inline.js"]')
    if (existing) { setScriptLoaded(true); return }
    const script = document.createElement('script')
    script.src = 'https://js.paystack.co/v1/inline.js'
    script.onload = () => setScriptLoaded(true)
    document.body.appendChild(script)
  }, [])

  async function handleSubscribe() {
    if (!scriptLoaded || !window.PaystackPop) {
      toast.error('Payment system not ready — please wait a moment')
      return
    }

    const handler = window.PaystackPop.setup({
      key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
      email: user.email,
      amount,
      currency: 'ZAR',
      plan: planCode,
      ref: `klipklop_${user.id}_${Date.now()}`,
      onSuccess: async (transaction) => {
        setVerifying(true)
        try {
          const { data: { session } } = await supabase.auth.getSession()
          const res = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-paystack`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
                apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              },
              body: JSON.stringify({ reference: transaction.reference }),
            }
          )
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.error || 'Verification failed')
          }
          await refreshProfile()
          toast.success('Subscription activated!')
          navigate('/dashboard')
        } catch (err) {
          console.error('Subscription verification failed:', err)
          toast.error('Payment received but verification failed — please contact support')
        } finally {
          setVerifying(false)
        }
      },
      onCancel: () => toast.error('Payment cancelled'),
    })
    handler.openIframe()
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="text-center p-5 sm:p-8 bg-white rounded-2xl shadow w-full max-w-md">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 shadow-sm">
          <img src={APP_LOGO_SRC} alt={`${APP_NAME} logo`} className="h-10 w-10 object-contain" />
        </div>
        <p className="text-sm font-semibold text-green-900 mb-1">{APP_NAME}</p>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">Activate Your Membership</h2>
        <p className="text-sm text-gray-500 leading-relaxed mb-6">
          Your account has been approved! Subscribe below to start tracking your times and qualifiers.
        </p>

        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-6">
          <p className="text-sm font-semibold text-green-800">{planLabel}</p>
          <p className="text-xs text-green-600 mt-0.5">Cancel any time from your Paystack account</p>
        </div>

        <button
          onClick={handleSubscribe}
          disabled={!scriptLoaded || verifying}
          className="w-full bg-green-700 text-white py-3 rounded-xl font-semibold text-sm hover:bg-green-800 transition disabled:opacity-50 disabled:cursor-not-allowed mb-4"
        >
          {verifying ? 'Activating...' : !scriptLoaded ? 'Loading...' : 'Subscribe Now'}
        </button>

        <button
          onClick={handleSignOut}
          className="text-xs text-gray-400 hover:text-gray-600 transition"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
