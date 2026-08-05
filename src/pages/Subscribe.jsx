import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { APP_NAME, APP_LOGO_SRC } from '../constants/branding'
import toast from 'react-hot-toast'

const PLANS = {
  supporter: {
    name: 'Supporter',
    description: 'Follow the riders you care about and stay updated all season.',
    features: [
      'Follow riders you support',
      'View qualifier progress & times',
      'See level progression at a glance',
      'Stay updated through the season',
    ],
    monthly: { code: import.meta.env.VITE_PAYSTACK_SUPPORTER_PLAN,        amount: 2900,   price: 'R29',     period: '/month' },
    annual:  { code: import.meta.env.VITE_PAYSTACK_SUPPORTER_ANNUAL_PLAN, amount: 29000,  price: 'R290',    period: '/year',  perMonth: 'R24/mo' },
  },
  user: {
    name: 'Rider',
    description: 'Track your season, horses, and nationals eligibility.',
    features: [
      'Unlimited horse profiles',
      'Full qualifier history & personal bests',
      'Nationals eligibility tracker',
      'AI rules assistant',
    ],
    monthly: { code: import.meta.env.VITE_PAYSTACK_RIDER_PLAN,        amount: 4900,   price: 'R49',     period: '/month' },
    annual:  { code: import.meta.env.VITE_PAYSTACK_RIDER_ANNUAL_PLAN, amount: 49000,  price: 'R490',    period: '/year',  perMonth: 'R41/mo' },
  },
  club_head: {
    name: 'Club Head',
    description: 'Manage your entire club or family stable under one account.',
    features: [
      'Everything in Rider',
      'Unlimited managed riders',
      'Log times on behalf of riders',
      'Club-wide overview & leaderboard',
    ],
    monthly: { code: import.meta.env.VITE_PAYSTACK_CLUB_HEAD_PLAN,        amount: 24900,  price: 'R249',    period: '/month' },
    annual:  { code: import.meta.env.VITE_PAYSTACK_CLUB_HEAD_ANNUAL_PLAN, amount: 249000, price: 'R2,490',  period: '/year',  perMonth: 'R208/mo' },
  },
}

export default function Subscribe() {
  const { user, profile, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [billing, setBilling] = useState('monthly')

  const role = profile?.role ?? 'user'
  const plan = PLANS[role] ?? PLANS.user
  const selected = billing === 'annual' ? plan.annual : plan.monthly

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
      amount: selected.amount,
      currency: 'ZAR',
      plan: selected.code,
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
          toast.success('Subscription activated! Welcome to KlipKlop.')
          navigate('/dashboard')
        } catch (err) {
          console.error('Subscription verification failed:', err)
          toast.error('Payment received but verification failed — please contact support')
        } finally {
          setVerifying(false)
        }
      },
      onCancel: () => {},
    })
    handler.openIframe()
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-green-50 px-4 py-12">

      {/* Logo */}
      <div className="text-center mb-6">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-md">
          <img src={APP_LOGO_SRC} alt={APP_NAME} className="h-10 w-10 object-contain" />
        </div>
        <p className="text-xs font-bold text-green-800 tracking-widest uppercase">{APP_NAME}</p>
      </div>

      <h1 className="text-2xl sm:text-3xl font-black text-gray-900 text-center mb-2 tracking-tight">
        Activate Your {plan.name} Membership
      </h1>
      <p className="text-sm sm:text-base text-gray-500 text-center mb-8 max-w-sm leading-relaxed">
        {plan.description}
      </p>

      {/* Billing toggle */}
      <div className="flex bg-white border border-gray-200 rounded-full p-1 shadow-sm mb-8">
        <button
          onClick={() => setBilling('monthly')}
          className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${
            billing === 'monthly'
              ? 'bg-green-700 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setBilling('annual')}
          className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-semibold transition-all ${
            billing === 'annual'
              ? 'bg-green-700 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Annual
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            billing === 'annual'
              ? 'bg-white/20 text-white'
              : 'bg-green-100 text-green-700'
          }`}>
            2 months free
          </span>
        </button>
      </div>

      {/* Plan card */}
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm p-7 mb-4">

        {/* Price */}
        <div className="text-center mb-6">
          <div className="flex items-baseline justify-center gap-0.5">
            <span className="text-xl font-bold text-gray-400 self-start mt-2">R</span>
            <span className="text-6xl font-black text-gray-900 tracking-tighter leading-none">
              {selected.price.replace('R', '').replace(',', '')}
            </span>
            <span className="text-base text-gray-400 font-medium self-end mb-1">{selected.period}</span>
          </div>
          {billing === 'annual' && plan.annual.perMonth && (
            <p className="text-xs text-gray-400 mt-2">
              That's {plan.annual.perMonth} — 2 months free vs monthly
            </p>
          )}
        </div>

        {/* Features */}
        <ul className="space-y-3 mb-7">
          {plan.features.map(f => (
            <li key={f} className="flex items-start gap-2.5 text-sm text-gray-700">
              <span className="text-green-600 font-bold flex-shrink-0">✓</span>
              {f}
            </li>
          ))}
        </ul>

        {/* Subscribe button */}
        <button
          onClick={handleSubscribe}
          disabled={!scriptLoaded || verifying}
          className="w-full bg-green-700 hover:bg-green-800 active:bg-green-900 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-base transition-colors shadow-sm"
        >
          {verifying ? 'Activating your account...'
           : !scriptLoaded ? 'Loading payment...'
           : `Subscribe — ${selected.price}${selected.period}`}
        </button>

        <p className="text-xs text-gray-400 text-center mt-3">
          Secure payment via Paystack · Cancel any time
        </p>
      </div>

      <button
        onClick={handleSignOut}
        className="text-xs text-gray-400 hover:text-gray-600 transition"
      >
        Sign out
      </button>
    </div>
  )
}
