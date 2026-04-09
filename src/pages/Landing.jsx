import { Link } from 'react-router-dom'
import { Bell, Flag, LineChart, ShieldCheck, TimerReset, User } from 'lucide-react'
import { APP_NAME, APP_LOGO_SRC, APP_TAGLINE } from '../constants/branding'
import './Landing.css'

const featureCards = [
  {
    icon: TimerReset,
    title: 'Qualifier Tracking',
    description:
      'Track each run, see your progress over time, and keep a clean view of your qualifier journey.',
  },
  {
    icon: User,
    title: 'Rider Profiles',
    description:
      'Manage rider details, horses, and season information in one place that is easy to update.',
  },
  {
    icon: Flag,
    title: 'Supporter & Club Views',
    description:
      'Follow riders you care about and view club-level performance from a simple dashboard.',
  },
  {
    icon: LineChart,
    title: 'Live Score Insights',
    description:
      'See timing trends and points snapshots to understand where gains are being made.',
  },
  {
    icon: Bell,
    title: 'Notifications',
    description:
      'Stay informed about updates and approvals so important changes are never missed.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure Account Access',
    description:
      'Your account is protected with secure sign-in and reliable access to your season data.',
  },
]

const galleryImages = [
  {
    src: '/landing/rider-turn.png',
    alt: 'Rider making a fast turn around a pole during mounted games',
    className: 'landing-gallery-main',
  },
  {
    src: '/landing/rider-gallop.png',
    alt: 'Rider and horse galloping at a mounted games event',
  },
  {
    src: '/landing/rider-jump.png',
    alt: 'Rider and horse mid-stride in a mounted games arena',
  },
  {
    src: '/landing/rider-flag.png',
    alt: 'Rider reaching for a flag while turning in arena',
  },
]

export default function Landing() {
  return (
    <div className="landing-page">
      <div className="landing-bg-orb landing-orb-left" aria-hidden="true" />
      <div className="landing-bg-orb landing-orb-right" aria-hidden="true" />

      <header className="landing-banner">
        <div className="container-page landing-banner-inner">
          <img
            src="/landing/rider-turn.png"
            alt="Mounted games rider banner"
            className="landing-banner-image"
          />
          <div className="landing-banner-overlay" />
          <div className="landing-banner-brand">
            <img src={APP_LOGO_SRC} alt={`${APP_NAME} logo`} className="landing-banner-logo" />
            <div>
              <p className="landing-banner-name">{APP_NAME}</p>
              <p className="landing-banner-tag">{APP_TAGLINE}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container-page landing-main">
        <section className="landing-hero landing-reveal">
          <div>
            <p className="landing-hype-pill">Bold. Fast. Western Mounted Games.</p>
            <p className="landing-kicker">Welcome to KlipKlop.co.za</p>
            <h1 className="landing-title">
              The Western Mounted Games platform for riders, supporters, and clubs.
            </h1>
            <p className="landing-subtitle">
              KlipKlop gives you one place to register, log in, track qualifiers, manage horses,
              follow rider progress, and stay up to date through the full season.
            </p>
            <div className="landing-cta-row">
              <Link to="/register" className="landing-btn landing-btn-primary">
                Register
              </Link>
              <Link to="/login" className="landing-btn landing-btn-secondary">
                Log in
              </Link>
            </div>
          </div>

          <div className="landing-gallery">
            {galleryImages.map((image, index) => (
              <figure key={image.src} className={`landing-gallery-card ${image.className ?? ''}`}>
                <img
                  src={image.src}
                  alt={image.alt}
                  loading={index === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                />
              </figure>
            ))}
          </div>
        </section>

        <section className="landing-section landing-reveal">
          <h2>What KlipKlop Does</h2>
          <p>
            KlipKlop is a dedicated hub for Western Mounted Games. It connects the full ecosystem:
            riders can monitor their performance, supporters can follow progress, clubs can view
            their riders, and everyone gets one clear place to stay in sync through the season.
          </p>
        </section>

        <section className="landing-section landing-reveal">
          <h2>Cool Features You Can Use</h2>
          <div className="landing-features-grid">
            {featureCards.map((feature) => (
              <article key={feature.title} className="landing-feature-card">
                <div className="landing-feature-icon-wrap" aria-hidden="true">
                  <feature.icon className="landing-feature-icon" />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-bottom-cta landing-reveal">
          <h2>Ready to ride with KlipKlop?</h2>
          <p>Create your account in minutes or log back in to continue your season.</p>
          <div className="landing-cta-row">
            <Link to="/register" className="landing-btn landing-btn-primary">
              Register
            </Link>
            <Link to="/login" className="landing-btn landing-btn-secondary">
              Log in
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
