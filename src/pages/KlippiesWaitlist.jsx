import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, CheckCircle2 } from 'lucide-react'
import { APP_LOGO_SRC } from '../constants/branding'

const MASCOT_SRC = '/klippies-mascot.png'

// Launch is one week out from when this page shipped.
const LAUNCH_AT = new Date('2026-08-26T00:00:00+02:00').getTime()

function getTimeLeft() {
  const diff = LAUNCH_AT - Date.now()
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true }
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    done: false,
  }
}

function CountdownUnit({ value, label }) {
  return (
    <div className="flex flex-col items-center bg-white/10 border border-white/20 rounded-2xl px-3 py-3 sm:px-5 sm:py-4 min-w-[68px] sm:min-w-[84px]">
      <span className="text-white font-black text-2xl sm:text-4xl tabular-nums leading-none">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-green-400 text-[10px] sm:text-xs font-semibold uppercase tracking-widest mt-1.5">
        {label}
      </span>
    </div>
  )
}

export default function KlippiesWaitlist() {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft)
  const [count, setCount] = useState(null)
  const [form, setForm] = useState({ name: '', surname: '', email: '', phone: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(getTimeLeft()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/klippies/waitlist')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (!cancelled && data) setCount(data.count) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const launchDateLabel = useMemo(() => (
    new Date(LAUNCH_AT).toLocaleDateString('en-ZA', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
  ), [])

  function updateField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
    if (error) setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitting) return

    const { name, surname, email, phone } = form
    if (!name.trim() || !surname.trim() || !email.trim() || !phone.trim()) {
      setError('Please fill in every field.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/klippies/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Something went wrong, please try again.')
        return
      }
      if (typeof data.count === 'number') setCount(data.count)
      setSubmitted(true)
    } catch {
      setError('Could not reach the server. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-950 via-green-950 to-green-900 flex flex-col">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-green-800/60">
        <div className="flex items-center gap-2.5">
          <img src={APP_LOGO_SRC} alt="KlipKlop" className="h-8 w-8 object-contain" />
          <div>
            <span className="text-white font-black text-sm tracking-tight">Klippies</span>
            <span className="text-green-400 text-xs font-medium ml-1.5">by KlipKlop</span>
          </div>
        </div>
        <Link to="/klippies" className="text-green-300 hover:text-white text-xs font-medium transition">
          Try the demo →
        </Link>
      </header>

      <div className="flex-1 flex flex-col items-center w-full max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* ── Mascot + signup counter ──────────────────────────────────────── */}
        <div className="relative w-40 sm:w-56 mb-2">
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: '130%', height: '130%', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'radial-gradient(ellipse, rgba(74,222,128,0.2) 0%, transparent 70%)',
              filter: 'blur(20px)',
            }}
          />
          <img
            src={MASCOT_SRC}
            alt="Klippies mascot"
            className="relative object-contain w-full"
            style={{
              filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.5)) drop-shadow(0 0 20px rgba(74,222,128,0.2))',
              animation: 'klippies-float 4s ease-in-out infinite',
            }}
          />
        </div>

        <h1 className="font-black text-white text-center tracking-tight text-2xl sm:text-4xl">
          Klippies is coming!
        </h1>
        <p className="text-green-300/80 text-center text-sm sm:text-base mt-2 max-w-md">
          Your SAWMGA AI guide is launching soon. Pop your details in below and we'll let you know the moment it's live.
        </p>

        {/* ── Signup counter ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mt-5 bg-white/10 border border-white/20 rounded-full px-4 py-2">
          <Users size={16} className="text-green-400" />
          <span className="text-white font-bold text-sm">
            {count === null ? '—' : count.toLocaleString('en-ZA')}
          </span>
          <span className="text-green-300 text-xs font-medium">
            {count === 1 ? 'person has' : 'people have'} signed up
          </span>
        </div>

        {/* ── Countdown ─────────────────────────────────────────────────────── */}
        <div className="w-full mt-7">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-green-500 mb-3">
            Going live {launchDateLabel}
          </p>
          <div className="flex justify-center gap-2 sm:gap-3">
            <CountdownUnit value={timeLeft.days} label="Days" />
            <CountdownUnit value={timeLeft.hours} label="Hours" />
            <CountdownUnit value={timeLeft.minutes} label="Mins" />
            <CountdownUnit value={timeLeft.seconds} label="Secs" />
          </div>
          {timeLeft.done && (
            <p className="text-center text-green-400 font-semibold text-sm mt-3">
              Klippies is live — <Link to="/klippies" className="underline">try it now →</Link>
            </p>
          )}
        </div>

        {/* ── Signup form ───────────────────────────────────────────────────── */}
        <div className="w-full mt-8 bg-white/10 border border-white/20 rounded-2xl p-5 sm:p-6">
          {submitted ? (
            <div className="flex flex-col items-center text-center py-4">
              <CheckCircle2 size={36} className="text-green-400 mb-2" />
              <p className="text-white font-bold">You're on the list!</p>
              <p className="text-green-300 text-sm mt-1">We'll email you the moment Klippies goes live.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={form.name}
                  onChange={e => updateField('name', e.target.value)}
                  placeholder="Name"
                  className="w-full rounded-xl bg-white/10 border border-white/20 px-3.5 py-2.5 text-sm text-white placeholder-green-400/60 focus:outline-none focus:ring-2 focus:ring-green-400/50"
                />
                <input
                  type="text"
                  value={form.surname}
                  onChange={e => updateField('surname', e.target.value)}
                  placeholder="Surname"
                  className="w-full rounded-xl bg-white/10 border border-white/20 px-3.5 py-2.5 text-sm text-white placeholder-green-400/60 focus:outline-none focus:ring-2 focus:ring-green-400/50"
                />
              </div>
              <input
                type="email"
                value={form.email}
                onChange={e => updateField('email', e.target.value)}
                placeholder="Email address"
                className="w-full rounded-xl bg-white/10 border border-white/20 px-3.5 py-2.5 text-sm text-white placeholder-green-400/60 focus:outline-none focus:ring-2 focus:ring-green-400/50"
              />
              <input
                type="tel"
                value={form.phone}
                onChange={e => updateField('phone', e.target.value)}
                placeholder="Cell number"
                className="w-full rounded-xl bg-white/10 border border-white/20 px-3.5 py-2.5 text-sm text-white placeholder-green-400/60 focus:outline-none focus:ring-2 focus:ring-green-400/50"
              />

              {error && <p className="text-red-300 text-xs">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-green-500 hover:bg-green-400 text-white text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Signing up…' : 'Notify me when it launches'}
              </button>
            </form>
          )}
        </div>
      </div>

      <style>{`
        @keyframes klippies-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
      `}</style>
    </div>
  )
}
