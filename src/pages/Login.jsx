import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Button, Input, PasswordInput } from '../components/ui'
import { APP_NAME, APP_LOGO_SRC, APP_TAGLINE } from '../constants/branding'
import { ArrowLeft, Mail } from 'lucide-react'
import './auth.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await signIn(email, password)
      if (error) { toast.error(error.message); return }
      setTimeout(() => navigate('/dashboard'), 500)
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgot(e) {
    e.preventDefault()
    if (!email.trim()) { toast.error('Please enter your email address'); return }
    setLoading(true)
    try {
      const { supabase } = await import('../lib/supabaseClient')
      await supabase.auth.resetPasswordForEmail(email.trim())
      setResetSent(true)
    } catch {
      toast.error('Could not send reset email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-layout">

      {/* ── Left panel ───────────────────────────────────────── */}
      <div className="auth-brand-panel">
        <Link to="/" className="auth-brand-logo-wrap">
          <img src={APP_LOGO_SRC} alt={`${APP_NAME} logo`} className="auth-brand-logo" />
        </Link>
        <div className="auth-brand-body">
          <h2 className="auth-brand-name">{APP_NAME}</h2>
          <p className="auth-brand-tag">{APP_TAGLINE}</p>
          <p className="auth-brand-desc">
            Track your qualifier times, manage your horses, and stay on top of your nationals eligibility — all in one place.
          </p>
        </div>
        <p className="auth-brand-foot">Built for SAWMGA riders, supporters &amp; clubs</p>
      </div>

      {/* ── Right panel ──────────────────────────────────────── */}
      <div className="auth-form-panel">
        <div className="auth-form-card">

          {/* Mobile logo */}
          <div className="auth-mobile-brand">
            <img src={APP_LOGO_SRC} alt={`${APP_NAME} logo`} className="auth-mobile-logo" />
            <span className="auth-mobile-name">{APP_NAME}</span>
          </div>

          {resetSent ? (
            /* ── Reset sent confirmation ── */
            <div className="auth-reset-confirm">
              <div className="auth-reset-icon">
                <Mail size={26} />
              </div>
              <h1 className="auth-form-title">Check your inbox</h1>
              <p className="auth-form-sub">
                We sent a password reset link to <strong>{email}</strong>. Check your email and follow the link to reset your password.
              </p>
              <button
                onClick={() => { setForgotMode(false); setResetSent(false) }}
                className="auth-back-link"
              >
                <ArrowLeft size={14} /> Back to login
              </button>
            </div>

          ) : forgotMode ? (
            /* ── Forgot password form ── */
            <>
              <button
                onClick={() => setForgotMode(false)}
                className="auth-back-link"
              >
                <ArrowLeft size={14} /> Back to login
              </button>
              <h1 className="auth-form-title">Reset your password</h1>
              <p className="auth-form-sub">
                Enter your email address and we'll send you a link to reset your password.
              </p>
              <form onSubmit={handleForgot} className="auth-form-fields">
                <div className="auth-field">
                  <label className="auth-label">Email address</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="your@email.com"
                    autoFocus
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full" size="lg">
                  {loading ? 'Sending…' : 'Send reset link'}
                </Button>
              </form>
            </>

          ) : (
            /* ── Login form ── */
            <>
              <h1 className="auth-form-title">Welcome back</h1>
              <p className="auth-form-sub">Sign in to continue your season.</p>
              <form onSubmit={handleSubmit} className="auth-form-fields">
                <div className="auth-field">
                  <label className="auth-label">Email address</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="your@email.com"
                    autoComplete="email"
                  />
                </div>
                <div className="auth-field">
                  <div className="auth-label-row">
                    <label className="auth-label">Password</label>
                    <button
                      type="button"
                      onClick={() => setForgotMode(true)}
                      className="auth-forgot-link"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <PasswordInput
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full" size="lg">
                  {loading ? 'Signing in…' : 'Sign in'}
                </Button>
              </form>
              <p className="auth-switch-text">
                Don't have an account?{' '}
                <Link to="/register" className="auth-switch-link">Create one — it's free</Link>
              </p>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
