import { Link } from 'react-router-dom'
import {
  Bell,
  Flag,
  HeartPulse,
  LineChart,
  Mail,
  Star,
  TimerReset,
  Trophy,
  User,
  Users,
  CheckCircle2,
} from 'lucide-react'
import { APP_NAME, APP_LOGO_SRC, APP_TAGLINE } from '../constants/branding'
import './Landing.css'

const features = [
  {
    icon: TimerReset,
    title: 'Qualifier Tracking',
    description: 'Log your times after every qualifier and watch your personal bests build across the season.',
  },
  {
    icon: Trophy,
    title: 'Nationals Eligibility',
    description: 'Always know where you stand — qualifiers attended, games covered, and province events at a glance.',
  },
  {
    icon: LineChart,
    title: 'Time Trends',
    description: 'Per-game trend charts and level breakdowns show exactly where your improvements are happening.',
  },
  {
    icon: HeartPulse,
    title: 'Horse Health Logs',
    description: 'Keep medical records, vaccinations, and care reminders for each horse in one place.',
  },
  {
    icon: Flag,
    title: 'Club & Supporter Views',
    description: 'Club heads manage their entire stable. Supporters follow riders they care about.',
  },
  {
    icon: Bell,
    title: 'AI Rules Assistant',
    description: 'Ask anything about SAWMGA rules and get instant, grounded answers from the built-in assistant.',
  },
]

const roles = [
  {
    icon: User,
    title: 'Rider',
    points: [
      'Track your own times and personal bests',
      'Monitor nationals eligibility criteria',
      'Manage your horses and health records',
      'Share results with supporters and coaches',
    ],
  },
  {
    icon: Star,
    title: 'Supporter',
    points: [
      'Follow riders you support',
      'View qualifier progress and times',
      'Stay updated through the season',
      'See level progression at a glance',
    ],
  },
  {
    icon: Users,
    title: 'Club / Family Head',
    points: [
      'Manage multiple riders under one account',
      'Track times and eligibility for each member',
      'Oversee your family stable',
      'Log times on behalf of your riders',
    ],
  },
]

export default function Landing() {
  return (
    <div className="lp-root">

      {/* ── Top nav ─────────────────────────────────────────────────── */}
      <header className="lp-nav">
        <div className="lp-nav-inner container-page">
          <Link to="/" className="lp-nav-brand">
            <img src={APP_LOGO_SRC} alt="KlipKlop logo" className="lp-nav-logo" />
            <span className="lp-nav-name">{APP_NAME}</span>
          </Link>
          <nav className="lp-nav-links">
            <Link to="/login" className="lp-nav-login">Log in</Link>
            <Link to="/register" className="lp-nav-register">Get started</Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="lp-hero">
        <img
          src="/landing/rider-turn.png"
          alt="Western mounted games rider"
          className="lp-hero-img"
        />
        <div className="lp-hero-overlay" aria-hidden="true" />
        <div className="container-page lp-hero-content">
          <p className="lp-hero-eyebrow">Official platform for SAWMGA riders</p>
          <h1 className="lp-hero-title">
            Track your season.<br />
            Know your standing.<br />
            Ride with confidence.
          </h1>
          <p className="lp-hero-sub">
            KlipKlop is the dedicated hub for Western Mounted Games — qualifying times, horse management,
            nationals eligibility, and club oversight, all in one place.
          </p>
          <div className="lp-hero-cta">
            <Link to="/register" className="lp-btn lp-btn-primary">Get started — it's free</Link>
            <Link to="/login" className="lp-btn lp-btn-ghost">Log in</Link>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────── */}
      <section className="lp-section">
        <div className="container-page">
          <div className="lp-section-header">
            <h2 className="lp-section-title">Everything you need to compete</h2>
            <p className="lp-section-sub">
              Built specifically for SAWMGA, with every feature shaped around how the season actually works.
            </p>
          </div>
          <div className="lp-features-grid">
            {features.map((f) => (
              <article key={f.title} className="lp-feature-card">
                <div className="lp-feature-icon">
                  <f.icon size={22} />
                </div>
                <h3 className="lp-feature-title">{f.title}</h3>
                <p className="lp-feature-desc">{f.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Roles ───────────────────────────────────────────────────── */}
      <section className="lp-section lp-section-alt">
        <div className="container-page">
          <div className="lp-section-header">
            <h2 className="lp-section-title">One platform, three roles</h2>
            <p className="lp-section-sub">
              Choose the role that fits you when you register. You can always update it later.
            </p>
          </div>
          <div className="lp-roles-grid">
            {roles.map((r) => (
              <article key={r.title} className="lp-role-card">
                <div className="lp-role-header">
                  <div className="lp-role-icon">
                    <r.icon size={20} />
                  </div>
                  <h3 className="lp-role-title">{r.title}</h3>
                </div>
                <ul className="lp-role-list">
                  {r.points.map((p) => (
                    <li key={p} className="lp-role-point">
                      <CheckCircle2 size={14} className="lp-role-check" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ──────────────────────────────────────────────── */}
      <section className="lp-cta-band">
        <div className="container-page lp-cta-inner">
          <h2 className="lp-cta-title">Ready to ride with KlipKlop?</h2>
          <p className="lp-cta-sub">Create your free account in minutes and take control of your season.</p>
          <div className="lp-hero-cta">
            <Link to="/register" className="lp-btn lp-btn-primary">Create a free account</Link>
            <Link to="/login" className="lp-btn lp-btn-outline">Log in</Link>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="container-page lp-footer-inner">
          <div className="lp-footer-brand">
            <img src={APP_LOGO_SRC} alt="KlipKlop logo" className="lp-footer-logo" />
            <div>
              <p className="lp-footer-name">{APP_NAME}</p>
              <p className="lp-footer-tag">{APP_TAGLINE}</p>
            </div>
          </div>
          <p className="lp-footer-copy">
            Built for SAWMGA riders, supporters, and clubs.{' '}
            <a href="mailto:support@klipklop.co.za" className="lp-footer-link">
              <Mail size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
              support@klipklop.co.za
            </a>
          </p>
        </div>
      </footer>

    </div>
  )
}
