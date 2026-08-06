import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { APP_NAME, APP_LOGO_SRC } from '../constants/branding'
import toast from 'react-hot-toast'
import {
  Timer, Trophy, LineChart, HeartPulse, Star, Users, CheckCircle2,
  Zap, Shield, User,
} from 'lucide-react'

const PLANS = {
  supporter: {
    name: 'Supporter',
    tagline: "You're registered as a Supporter",
    description: 'Follow the riders you care about, see their times and progress, and stay connected all season.',
    icon: Star,
    accentColor: '#166534',
    features: [
      { icon: Star,       text: 'Follow any rider and see their live results' },
      { icon: Timer,      text: 'View qualifier times and personal bests' },
      { icon: LineChart,  text: 'See level progression and trends across the season' },
      { icon: Trophy,     text: 'Stay updated on nationals eligibility for riders you follow' },
    ],
    monthly: { code: import.meta.env.VITE_PAYSTACK_SUPPORTER_PLAN,        amount: 2900,   price: 'R29',    period: '/month' },
    annual:  { code: import.meta.env.VITE_PAYSTACK_SUPPORTER_ANNUAL_PLAN, amount: 29000,  price: 'R290',   period: '/year',  perMonth: 'R24/mo' },
  },
  user: {
    name: 'Rider',
    tagline: "You're registered as a Rider",
    description: "Track your qualifying times, manage your horses, and always know where you stand for nationals.",
    icon: User,
    accentColor: '#166534',
    features: [
      { icon: Timer,      text: 'Log times after every qualifier and track personal bests' },
      { icon: Trophy,     text: 'Always know your nationals eligibility — games and events at a glance' },
      { icon: LineChart,  text: 'Per-game trend charts and level breakdowns' },
      { icon: HeartPulse, text: 'Horse health logs — vaccinations, care reminders, medical records' },
      { icon: Shield,     text: 'AI rules assistant — instant answers on SAWMGA rules' },
      { icon: Zap,        text: 'Share your results page with supporters and coaches' },
    ],
    monthly: { code: import.meta.env.VITE_PAYSTACK_RIDER_PLAN,        amount: 4900,   price: 'R49',    period: '/month' },
    annual:  { code: import.meta.env.VITE_PAYSTACK_RIDER_ANNUAL_PLAN, amount: 49000,  price: 'R490',   period: '/year',  perMonth: 'R41/mo' },
  },
  club_head: {
    name: 'Club / Family Head',
    tagline: "You're registered as a Club / Family Head",
    description: 'Manage your entire stable under one account — log times for your riders, track eligibility, and oversee the whole club.',
    icon: Users,
    accentColor: '#166534',
    features: [
      { icon: Users,      text: 'Manage unlimited riders under your club or family account' },
      { icon: Timer,      text: 'Log qualifier times on behalf of any of your riders' },
      { icon: Trophy,     text: 'Track nationals eligibility for every member at a glance' },
      { icon: LineChart,  text: 'Club-wide overview and leaderboard' },
      { icon: HeartPulse, text: 'Horse health records and care reminders per horse' },
      { icon: Shield,     text: 'AI rules assistant and full qualifier history' },
    ],
    monthly: { code: import.meta.env.VITE_PAYSTACK_CLUB_HEAD_PLAN,        amount: 24900,  price: 'R249',   period: '/month' },
    annual:  { code: import.meta.env.VITE_PAYSTACK_CLUB_HEAD_ANNUAL_PLAN, amount: 249000, price: 'R2,490', period: '/year',  perMonth: 'R208/mo' },
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
  const RoleIcon = plan.icon

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
    <div className="min-h-screen bg-gray-50">

      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src={APP_LOGO_SRC} alt={APP_NAME} className="h-8 w-8 object-contain" />
          <span className="text-sm font-bold text-green-900">{APP_NAME}</span>
        </div>
        <button
          onClick={handleSignOut}
          className="text-xs text-gray-400 hover:text-gray-600 transition"
        >
          Sign out
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-14">

        {/* Role header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-800 text-white mb-4 shadow-md">
            <RoleIcon size={26} />
          </div>
          <p className="text-xs font-bold text-green-700 tracking-widest uppercase mb-2">{plan.tagline}</p>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-3">
            Here's what's included
          </h1>
          <p className="text-sm sm:text-base text-gray-500 max-w-md mx-auto leading-relaxed">
            {plan.description}
          </p>
        </div>

        {/* Features grid */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
          <ul className="space-y-4">
            {plan.features.map((f) => {
              const FIcon = f.icon
              return (
                <li key={f.text} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                    <FIcon size={16} className="text-green-700" />
                  </div>
                  <span className="text-sm text-gray-700 leading-5 pt-1.5">{f.text}</span>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Billing + payment */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-bold text-gray-900 mb-4 text-center">Choose your billing plan</h2>

          {/* Billing toggle */}
          <div className="flex bg-gray-100 rounded-full p-1 mb-6 max-w-xs mx-auto">
            <button
              onClick={() => setBilling('monthly')}
              className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all ${
                billing === 'monthly'
                  ? 'bg-white text-green-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('annual')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-sm font-semibold transition-all ${
                billing === 'annual'
                  ? 'bg-white text-green-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Annual
              <span className="text-xs font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                2 months free
              </span>
            </button>
          </div>

          {/* Price display */}
          <div className="text-center mb-6">
            <div className="flex items-baseline justify-center gap-0.5">
              <span className="text-lg font-bold text-gray-400 self-start mt-1.5">R</span>
              <span className="text-5xl font-black text-gray-900 tracking-tighter leading-none">
                {selected.price.replace('R', '').replace(',', '')}
              </span>
              <span className="text-sm text-gray-400 font-medium self-end mb-1">{selected.period}</span>
            </div>
            {billing === 'annual' && plan.annual.perMonth && (
              <p className="text-xs text-gray-400 mt-1.5">
                That's {plan.annual.perMonth} — 2 months free vs monthly
              </p>
            )}
          </div>

          {/* Pay button */}
          <button
            onClick={handleSubscribe}
            disabled={!scriptLoaded || verifying}
            className="w-full bg-green-700 hover:bg-green-800 active:bg-green-900 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-base transition-colors shadow-sm"
          >
            {verifying
              ? 'Activating your account...'
              : !scriptLoaded
              ? 'Loading payment...'
              : `Subscribe — ${selected.price}${selected.period}`}
          </button>

          <div className="flex items-center justify-center gap-1 mt-3">
            <CheckCircle2 size={13} className="text-gray-300" />
            <p className="text-xs text-gray-400">
              Secure payment via Paystack · Cancel any time · ZAR
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
