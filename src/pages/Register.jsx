import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PROVINCES, AGE_CATEGORIES } from '../lib/constants'
import toast from 'react-hot-toast'
import { Button, Input, PasswordInput, Select } from '../components/ui'
import { APP_NAME, APP_LOGO_SRC, APP_TAGLINE } from '../constants/branding'
import { User, Star, Users } from 'lucide-react'
import './auth.css'

const ROLES = [
  {
    id: 'user',
    icon: User,
    label: 'Rider',
    desc: 'I compete and want to track my own times and eligibility.',
  },
  {
    id: 'supporter',
    icon: Star,
    label: 'Supporter',
    desc: 'I follow riders I care about and want to view their progress.',
  },
  {
    id: 'club_head',
    icon: Users,
    label: 'Club / Family Head',
    desc: 'I manage riders under my club or family stable.',
  },
]

export default function Register() {
  const [role, setRole] = useState('user')
  const [formData, setFormData] = useState({
    rider_name: '',
    email: '',
    password: '',
    confirm_password: '',
    province: '',
    age_category: '',
  })
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const isSupporter = role === 'supporter'
  const isClubHead = role === 'club_head'
  const needsAgeCategory = !isSupporter && !isClubHead

  function handleChange(e) {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (formData.password !== formData.confirm_password) {
      toast.error('Passwords do not match')
      return
    }
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    if (!formData.province) {
      toast.error('Please select your province')
      return
    }
    if (needsAgeCategory && !formData.age_category) {
      toast.error('Please select your age category')
      return
    }
    setLoading(true)
    try {
      const { error } = await signUp(formData.email, formData.password, {
        rider_name: formData.rider_name,
        province: formData.province,
        age_category: formData.age_category,
        role,
      })
      if (error) { toast.error(error.message); return }
      navigate('/pending')
    } catch {
      toast.error('Something went wrong. Please try again.')
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
            Join hundreds of SAWMGA riders, supporters, and club heads managing their season in one place.
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

          <h1 className="auth-form-title">Create your account</h1>
          <p className="auth-form-sub">Free to join. Your account will be reviewed before activation.</p>

          {/* Role selector */}
          <div className="auth-role-group">
            <p className="auth-label">I am registering as a…</p>
            <div className="auth-role-grid">
              {ROLES.map(({ id, icon: Icon, label, desc }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRole(id)}
                  className={`auth-role-btn${role === id ? ' auth-role-btn--active' : ''}`}
                >
                  <div className="auth-role-icon">
                    <Icon size={18} />
                  </div>
                  <span className="auth-role-label">{label}</span>
                  <span className="auth-role-desc">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="auth-form-fields">
            <div className="auth-field">
              <label className="auth-label">
                {isSupporter || isClubHead ? 'Full name' : 'Full name (rider name)'}
              </label>
              <Input
                type="text"
                name="rider_name"
                value={formData.rider_name}
                onChange={handleChange}
                required
                placeholder="Your full name"
                autoComplete="name"
              />
            </div>

            <div className="auth-field">
              <label className="auth-label">Email address</label>
              <Input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="your@email.com"
                autoComplete="email"
              />
            </div>

            <div className="auth-fields-row">
              <div className="auth-field">
                <label className="auth-label">Province</label>
                <Select
                  name="province"
                  value={formData.province}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select province</option>
                  {PROVINCES.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </Select>
              </div>

              {needsAgeCategory && (
                <div className="auth-field">
                  <label className="auth-label">Age category</label>
                  <Select
                    name="age_category"
                    value={formData.age_category}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select category</option>
                    {AGE_CATEGORIES.map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </Select>
                </div>
              )}
            </div>

            <div className="auth-fields-row">
              <div className="auth-field">
                <label className="auth-label">Password</label>
                <PasswordInput
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  placeholder="Min. 6 characters"
                  autoComplete="new-password"
                />
              </div>
              <div className="auth-field">
                <label className="auth-label">Confirm password</label>
                <PasswordInput
                  name="confirm_password"
                  value={formData.confirm_password}
                  onChange={handleChange}
                  required
                  placeholder="Repeat password"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
          </form>

          <p className="auth-switch-text">
            Already have an account?{' '}
            <Link to="/login" className="auth-switch-link">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
