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

      {/* ── Pricing ─────────────────────────────────────────────────── */}
      <section className="lp-section">
        <div className="container-page">
          <div className="lp-section-header">
            <h2 className="lp-section-title">Simple, transparent pricing</h2>
            <p className="lp-section-sub">
              One flat monthly rate — no setup fees, no hidden costs. Save 2 months with an annual plan. Cancel any time.
            </p>
          </div>
          <div className="lp-pricing-grid">

            <article className="lp-price-card">
              <div className="lp-price-badge">Supporter</div>
              <div className="lp-price-amount">
                <span className="lp-price-currency">R</span>
                <span className="lp-price-number">29</span>
                <span className="lp-price-period">/month</span>
              </div>
              <p className="lp-price-desc">
                Follow the riders you cheer for and stay updated throughout the season.
              </p>
              <ul className="lp-price-list">
                <li><CheckCircle2 size={15} className="lp-price-check" />Follow riders you support</li>
                <li><CheckCircle2 size={15} className="lp-price-check" />View qualifier progress &amp; times</li>
                <li><CheckCircle2 size={15} className="lp-price-check" />See level progression at a glance</li>
                <li><CheckCircle2 size={15} className="lp-price-check" />Stay updated through the season</li>
              </ul>
              <p className="lp-price-annual-note">R290/year — 2 months free</p>
              <Link to="/register" className="lp-price-btn lp-price-btn-outline">Get started</Link>
            </article>

            <article className="lp-price-card lp-price-card-featured">
              <div className="lp-price-popular">Most popular</div>
              <div className="lp-price-badge lp-price-badge-white">Rider</div>
              <div className="lp-price-amount">
                <span className="lp-price-currency">R</span>
                <span className="lp-price-number">49</span>
                <span className="lp-price-period">/month</span>
              </div>
              <p className="lp-price-desc">
                Track your horses, times, and nationals eligibility — everything you need to compete.
              </p>
              <ul className="lp-price-list">
                <li><CheckCircle2 size={15} className="lp-price-check" />Unlimited horse profiles</li>
                <li><CheckCircle2 size={15} className="lp-price-check" />Full qualifier history &amp; personal bests</li>
                <li><CheckCircle2 size={15} className="lp-price-check" />Nationals eligibility tracker</li>
                <li><CheckCircle2 size={15} className="lp-price-check" />AI rules assistant</li>
              </ul>
              <p className="lp-price-annual-note lp-price-annual-note-white">R490/year — 2 months free</p>
              <Link to="/register" className="lp-price-btn lp-price-btn-white">Get started</Link>
            </article>

            <article className="lp-price-card">
              <div className="lp-price-badge">Club / Family Head</div>
              <div className="lp-price-amount">
                <span className="lp-price-currency">R</span>
                <span className="lp-price-number">249</span>
                <span className="lp-price-period">/month</span>
              </div>
              <p className="lp-price-desc">
                Manage your entire club or family stable under one account — for coaches and yard managers.
              </p>
              <ul className="lp-price-list">
                <li><CheckCircle2 size={15} className="lp-price-check" />Everything in Rider</li>
                <li><CheckCircle2 size={15} className="lp-price-check" />Unlimited managed riders</li>
                <li><CheckCircle2 size={15} className="lp-price-check" />Log times on behalf of riders</li>
                <li><CheckCircle2 size={15} className="lp-price-check" />Club leaderboard &amp; overview</li>
              </ul>
              <p className="lp-price-annual-note">R2,490/year — 2 months free</p>
              <Link to="/register" className="lp-price-btn lp-price-btn-outline">Get started</Link>
            </article>

          </div>
          <p className="lp-pricing-note">
            All subscriptions in ZAR · Cancel any time · Secure payments via Paystack ·{' '}
            <a href="mailto:support@klipklop.co.za" className="lp-pricing-note-link">Federation pricing? Contact us</a>
          </p>
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
          <div className="lp-footer-links-block">
            <p className="lp-footer-copy">
              Built for SAWMGA riders, supporters, and clubs.{' '}
              <a href="mailto:support@klipklop.co.za" className="lp-footer-link">
                <Mail size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                support@klipklop.co.za
              </a>
            </p>
            <p className="lp-footer-legal-links">
              <Link to="/legal?tab=privacy" className="lp-footer-link">Privacy Policy</Link>
              <span className="lp-footer-sep">·</span>
              <Link to="/legal?tab=terms" className="lp-footer-link">Terms of Service</Link>
              <span className="lp-footer-sep">·</span>
              <Link to="/legal?tab=refund" className="lp-footer-link">Refund Policy</Link>
              <span className="lp-footer-sep">·</span>
              <Link to="/legal?tab=cancellation" className="lp-footer-link">Cancellation Policy</Link>
            </p>
          </div>
        </div>
      </footer>

    </div>
  )
}
