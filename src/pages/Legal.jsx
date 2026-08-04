import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { APP_NAME, APP_LOGO_SRC, APP_TAGLINE } from '../constants/branding'
import './Landing.css'
import './Legal.css'

const TABS = [
  { id: 'refund',       label: 'Refund Policy' },
  { id: 'cancellation', label: 'Cancellation Policy' },
  { id: 'privacy',      label: 'Privacy Policy' },
  { id: 'terms',        label: 'Terms of Service' },
]

const EFFECTIVE = '4 August 2026'

function Section({ title, children }) {
  return (
    <section className="legal-section">
      <h2 className="legal-h2">{title}</h2>
      {children}
    </section>
  )
}

function P({ children }) {
  return <p className="legal-p">{children}</p>
}

function Ul({ items }) {
  return (
    <ul className="legal-ul">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  )
}

function RefundPolicy() {
  return (
    <article className="legal-doc">
      <div className="legal-doc-header">
        <h1 className="legal-doc-title">Refund Policy</h1>
        <p className="legal-doc-meta">Effective date: {EFFECTIVE} · Last updated: {EFFECTIVE}</p>
      </div>

      <Section title="Subscription fees">
        <P>
          Subscription fees (Rider, Club, and Federation tiers) are billed in advance and are
          non-refundable, including for partial months, unused features, or early cancellation.
          If you cancel your subscription, you will keep access until the end of your current
          paid billing period, but no refund will be issued for the remaining days.
        </P>
        <P>
          If you believe you were billed in error (duplicate charge, incorrect amount, or a
          failed cancellation that still charged you), contact us at{' '}
          <a href="mailto:support@klipklop.co.za" className="legal-link">support@klipklop.co.za</a>{' '}
          within 14 days of the charge and we will investigate and refund where a billing error is confirmed.
        </P>
      </Section>

      <Section title="Event and clinic bookings">
        <P>
          Where an event, clinic, or qualifier booking is paid through KlipKlop (by card via
          Stripe or by EFT):
        </P>
        <Ul items={[
          'A deposit secures your spot and is non-refundable once the organiser has confirmed the booking, except where the event itself is cancelled or postponed by the organiser.',
          'The balance of a booking fee follows the cancellation windows set out in our Cancellation Policy.',
          'If an event is cancelled by the organiser, all payments made through KlipKlop for that event will be refunded in full, or a credit toward a future event may be offered at your choice.',
          'EFT payments not received within the payment window shown at booking (default 48 hours) may result in the spot being released. Any funds later received will be refunded manually, which can take up to 10 business days.',
        ]} />
        <P>
          Refunds are paid back to the original payment method. Card refunds via Stripe typically
          take 5 to 10 business days to reflect, depending on your bank. EFT refunds are processed
          manually and may take up to 10 business days.
        </P>
        <P>
          We do not offer refunds for change of mind once a service has been fully delivered (for
          example, once an event has taken place).
        </P>
      </Section>

      <Section title="Contact">
        <P>
          For refund queries, email{' '}
          <a href="mailto:support@klipklop.co.za" className="legal-link">support@klipklop.co.za</a>.
        </P>
      </Section>
    </article>
  )
}

function CancellationPolicy() {
  return (
    <article className="legal-doc">
      <div className="legal-doc-header">
        <h1 className="legal-doc-title">Cancellation Policy</h1>
        <p className="legal-doc-meta">Effective date: {EFFECTIVE} · Last updated: {EFFECTIVE}</p>
      </div>

      <Section title="Cancelling your subscription">
        <P>
          You can cancel your Rider, Club, or Federation subscription at any time from your account
          settings, or by emailing{' '}
          <a href="mailto:support@klipklop.co.za" className="legal-link">support@klipklop.co.za</a>.
          Cancellation takes effect at the end of your current billing period. There is no
          cancellation fee. Your data (horse profiles, medical and vaccination records, qualifier
          history) remains accessible until the end of the paid period, after which your account
          reverts to a limited or free tier where applicable.
        </P>
      </Section>

      <Section title="Cancelling an event or clinic booking">
        <P>Unless a specific event states otherwise:</P>
        <Ul items={[
          'Cancellations made more than 14 days before the event date receive a full refund of the balance paid, minus the deposit.',
          'Cancellations made 7 to 14 days before the event date receive a 50% refund of the balance paid, minus the deposit.',
          'Cancellations made less than 7 days before the event date are not eligible for a refund, as the organiser will have already committed resources (arena setup, catering, judging, entries submitted to SAWMGA or the relevant body).',
          'No-shows are treated as a cancellation within the non-refundable window.',
        ]} />
        <P>
          Individual event organisers using KlipKlop may set their own cancellation windows for
          their specific event, which will be shown to you before you confirm your booking. Where
          an event-specific policy conflicts with this general policy, the event-specific policy
          applies.
        </P>
      </Section>

      <Section title="Cancellation by KlipKlop or the organiser">
        <P>
          If we or an event organiser need to cancel or postpone an event (weather, insufficient
          entries, venue issues, or other circumstances beyond our control), you will be notified
          as soon as possible and offered a full refund or the option to transfer your entry to a
          rescheduled date.
        </P>
      </Section>

      <Section title="Account termination">
        <P>
          We may suspend or terminate an account for breach of the Terms of Service, fraudulent
          payment activity, or abusive conduct toward other users, organisers, or KlipKlop staff.
          In such cases, no refund will be issued for the remaining subscription period.
        </P>
      </Section>

      <Section title="Contact">
        <P>
          For cancellation queries, email{' '}
          <a href="mailto:support@klipklop.co.za" className="legal-link">support@klipklop.co.za</a>.
        </P>
      </Section>
    </article>
  )
}

function PrivacyPolicy() {
  return (
    <article className="legal-doc">
      <div className="legal-doc-header">
        <h1 className="legal-doc-title">Privacy Policy</h1>
        <p className="legal-doc-meta">Effective date: {EFFECTIVE} · Last updated: {EFFECTIVE}</p>
      </div>

      <P>
        KlipKlop ("we", "us", "our") is committed to protecting your privacy and handling your
        personal information responsibly, in line with South Africa's Protection of Personal
        Information Act (POPIA).
      </P>

      <Section title="Who this applies to">
        <P>
          This policy applies to anyone who creates an account, uses the KlipKlop app, or books
          an event through klipklop.co.za, including riders, club administrators, and event
          organisers.
        </P>
      </Section>

      <Section title="Information we collect">
        <Ul items={[
          'Account information: name, email address, phone number, and password (stored securely, never in plain text).',
          'Horse and rider information: horse profiles, medical logs, vaccination records, personal bests, qualifier history, and provincial ranking data that you or your club choose to add.',
          'Payment information: when you pay via card, payment is processed directly by Stripe. We do not store your full card details on our servers. For EFT payments, we retain proof of payment records for reconciliation.',
          'Location information: if you use the GPS-guided arena setup tool, we access your device\'s location and compass heading only while that feature is in active use, to calculate obstacle placement. This location data is not stored beyond what is needed to complete the setup session unless you choose to save an arena layout.',
          'Usage information: device type, app version, and general usage patterns to help us fix bugs and improve features.',
          'AI assistant interactions: questions or messages you send to KlipKlop\'s built-in AI assistant, used to provide you with a response and improve the assistant\'s accuracy over time.',
        ]} />
      </Section>

      <Section title="How we use your information">
        <Ul items={[
          'To provide and maintain your account, horse records, and event bookings',
          'To process payments and deposits through Stripe',
          'To send booking confirmations, reminders, vaccination alerts, and important updates via email or in-app notification',
          'To calculate rankings, leaderboards, and qualifier statistics',
          'To power the GPS arena setup tool and AI assistant',
          'To communicate with you about your account or support queries',
          'To improve KlipKlop\'s features and fix issues',
        ]} />
        <P>We do not sell your personal information to third parties.</P>
      </Section>

      <Section title="Who we share information with">
        <Ul items={[
          'Stripe, for processing card payments',
          'Supabase, our database and hosting provider, which stores your account and app data securely',
          'Resend, for sending transactional emails (booking confirmations, reminders)',
          'Event organisers and clubs, limited to the information needed for them to manage your entry (name, horse details, qualifier history relevant to their event)',
          'SAWMGA or other affiliated bodies, only where you have opted in for your results or rankings to be shared for official record purposes',
        ]} />
        <P>
          We do not share medical or vaccination records with anyone beyond what is strictly
          necessary for event eligibility checks, and only with your consent.
        </P>
      </Section>

      <Section title="Data retention">
        <P>
          We keep your information for as long as your account is active. If you close your
          account, we will delete or anonymise your personal information within 30 days, except
          where we are required to keep records for legal, tax, or dispute resolution purposes
          (such as payment records, which we retain for 5 years in line with South African tax
          record requirements).
        </P>
      </Section>

      <Section title="Your rights under POPIA">
        <P>You have the right to:</P>
        <Ul items={[
          'Access the personal information we hold about you',
          'Request correction of inaccurate information',
          'Request deletion of your information, subject to legal retention requirements',
          'Object to certain uses of your information',
          'Lodge a complaint with the Information Regulator of South Africa if you believe your information has been mishandled',
        ]} />
        <P>
          To exercise any of these rights, contact us at{' '}
          <a href="mailto:support@klipklop.co.za" className="legal-link">support@klipklop.co.za</a>.
          We aim to respond to all requests within 14 days.
        </P>
      </Section>

      <Section title="Cookies">
        <P>
          KlipKlop uses essential cookies and local storage to keep you logged in and remember
          your preferences. We do not use third-party advertising cookies.
        </P>
      </Section>

      <Section title="Children's privacy">
        <P>
          KlipKlop is not intended for use by children under 18 without a parent or guardian
          creating and managing the account on their behalf.
        </P>
      </Section>

      <Section title="Security">
        <P>
          We use industry-standard security measures, including encrypted connections and secure
          database access, to protect your information. No system is completely secure, and we
          cannot guarantee absolute security of data transmitted to us.
        </P>
      </Section>

      <Section title="International users">
        <P>
          KlipKlop is built primarily for the South African WMG community. If you access KlipKlop
          from outside South Africa, your information will still be processed and stored in line
          with this policy.
        </P>
      </Section>

      <Section title="Changes to this policy">
        <P>
          We may update this Privacy Policy from time to time. Material changes will be
          communicated via email or in-app notice at least 14 days before they take effect.
          Continued use of KlipKlop after changes take effect constitutes acceptance of the
          updated policy.
        </P>
      </Section>

      <Section title="Contact us">
        <P>
          Questions about this Privacy Policy can be sent to{' '}
          <a href="mailto:support@klipklop.co.za" className="legal-link">support@klipklop.co.za</a>.
        </P>
      </Section>
    </article>
  )
}

function TermsOfService() {
  return (
    <article className="legal-doc">
      <div className="legal-doc-header">
        <h1 className="legal-doc-title">Terms of Service</h1>
        <p className="legal-doc-meta">Effective date: {EFFECTIVE} · Last updated: {EFFECTIVE}</p>
      </div>

      <P>
        Welcome to KlipKlop. These Terms of Service ("Terms") govern your use of the KlipKlop
        app and website (klipklop.co.za). By creating an account or using KlipKlop, you agree
        to these Terms.
      </P>

      <Section title="1. Who we are">
        <P>
          KlipKlop is a platform built for the Western Mounted Games (WMG) community in South
          Africa, providing horse and rider profile management, medical and vaccination tracking,
          qualifier history, provincial rankings, a GPS-guided arena setup tool, an AI assistant,
          and event and clinic booking functionality.
        </P>
      </Section>

      <Section title="2. Eligibility and accounts">
        <P>
          You must be 18 or older to create an account, or have a parent or guardian create and
          manage an account on your behalf if you are under 18. You are responsible for keeping
          your login details secure and for all activity under your account. Notify us immediately
          at{' '}
          <a href="mailto:support@klipklop.co.za" className="legal-link">support@klipklop.co.za</a>{' '}
          if you suspect unauthorised access to your account.
        </P>
      </Section>

      <Section title="3. Subscriptions and fees">
        <P>KlipKlop offers tiered access:</P>
        <Ul items={[
          'Rider tier: individual access to profiles, tracking, and rankings features',
          'Club tier: additional tools for managing club members and events',
          'Federation tier: custom pricing for association-level partnerships',
        ]} />
        <P>
          Fees are billed in advance on a recurring basis at the rate shown at signup, in South
          African Rand. We may change pricing with at least 30 days notice. Continued use after
          a price change takes effect means you accept the new pricing. See our Refund Policy and
          Cancellation Policy for how billing, cancellation, and refunds work.
        </P>
      </Section>

      <Section title="4. Event and clinic bookings">
        <P>
          When you book an event or clinic through KlipKlop, you are entering into an agreement
          with the event organiser, not with KlipKlop directly, except where KlipKlop itself is
          the organiser. KlipKlop facilitates the booking and payment process (via Stripe or EFT)
          but is not responsible for the conduct, cancellation, or delivery of third-party events,
          beyond processing refunds as set out in our Refund and Cancellation Policies.
        </P>
      </Section>

      <Section title="5. Your content">
        <P>
          You retain ownership of the information you upload, including horse profiles, medical
          records, and photos. By uploading content, you grant KlipKlop a licence to store,
          display, and process that content solely to provide the service to you and, where
          applicable, to clubs or organisers you choose to share it with.
        </P>
        <P>
          You are responsible for the accuracy of the information you enter, including medical and
          vaccination records. KlipKlop is not responsible for decisions made by event organisers
          based on information you have entered.
        </P>
      </Section>

      <Section title="6. AI assistant">
        <P>
          KlipKlop's AI assistant provides general information and assistance based on the data
          available to it. It is not a substitute for professional veterinary, medical, or
          competition rules advice. Always confirm important decisions, especially those relating
          to horse health or event eligibility, with a qualified professional or the relevant
          governing body.
        </P>
      </Section>

      <Section title="7. GPS arena setup tool">
        <P>
          The GPS-guided arena setup tool provides obstacle placement estimates based on device
          GPS and compass accuracy, which can vary by device and environment. Always verify final
          measurements against the official SAWMGA rulebook or relevant event rules before
          competition. KlipKlop is not liable for placement errors arising from device accuracy
          limitations.
        </P>
      </Section>

      <Section title="8. Acceptable use">
        <P>You agree not to:</P>
        <Ul items={[
          'Use KlipKlop for any unlawful purpose',
          'Upload false information, including false medical or vaccination records',
          'Attempt to interfere with, hack, or reverse engineer the platform',
          'Harass, abuse, or defame other users, organisers, or KlipKlop staff',
          'Use the GPS arena setup tool in a way that is unsafe or reckless',
        ]} />
        <P>We may suspend or terminate accounts that breach these Terms.</P>
      </Section>

      <Section title="9. Assumption of risk">
        <P>
          Western Mounted Games and equestrian sport carry inherent risks. KlipKlop is a
          management and information tool. It does not supervise events, guarantee arena
          measurements are error-free, or take responsibility for injuries, accidents, or losses
          arising from participation in any event, whether or not booked through KlipKlop.
        </P>
      </Section>

      <Section title="10. Limitation of liability">
        <P>
          To the maximum extent permitted by law, KlipKlop and its founders are not liable for
          any indirect, incidental, or consequential loss arising from your use of the platform,
          including but not limited to loss of data, missed events, incorrect rankings, or
          reliance on the AI assistant. Our total liability for any claim will not exceed the
          amount you paid to KlipKlop in the 3 months before the claim arose.
        </P>
      </Section>

      <Section title="11. Third-party services">
        <P>
          KlipKlop relies on third-party providers, including Stripe for payments, Supabase for
          hosting and data storage, and Resend for email delivery. We are not responsible for
          outages or issues caused by these providers, though we will work to resolve any impact
          on your experience.
        </P>
      </Section>

      <Section title="12. Intellectual property">
        <P>
          The KlipKlop name, logo, app design, and underlying software are the property of Liani
          van der Walt. You may not copy, resell, or create derivative products based on KlipKlop
          without written permission.
        </P>
      </Section>

      <Section title="13. Termination">
        <P>
          We may suspend or terminate your access to KlipKlop at any time for breach of these
          Terms. You may close your account at any time by contacting{' '}
          <a href="mailto:support@klipklop.co.za" className="legal-link">support@klipklop.co.za</a>.
        </P>
      </Section>

      <Section title="14. Changes to these Terms">
        <P>
          We may update these Terms from time to time. We will notify you of material changes via
          email or in-app notice at least 14 days before they take effect. Continued use of
          KlipKlop after changes take effect means you accept the updated Terms.
        </P>
      </Section>

      <Section title="15. Governing law">
        <P>
          These Terms are governed by the laws of the Republic of South Africa. Any disputes will
          be subject to the jurisdiction of the South African courts.
        </P>
      </Section>

      <Section title="16. Contact us">
        <P>
          Questions about these Terms can be sent to{' '}
          <a href="mailto:support@klipklop.co.za" className="legal-link">support@klipklop.co.za</a>.
        </P>
      </Section>
    </article>
  )
}

const CONTENT = {
  refund:       <RefundPolicy />,
  cancellation: <CancellationPolicy />,
  privacy:      <PrivacyPolicy />,
  terms:        <TermsOfService />,
}

export default function Legal() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = TABS.find(t => t.id === searchParams.get('tab')) ? searchParams.get('tab') : 'refund'

  function setTab(id) {
    setSearchParams({ tab: id })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    const id = searchParams.get('tab')
    if (!id || !TABS.find(t => t.id === id)) {
      setSearchParams({ tab: 'refund' }, { replace: true })
    }
  }, [])

  return (
    <div className="lp-root">

      {/* Nav */}
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

      {/* Page header */}
      <div className="legal-hero">
        <div className="container-page legal-hero-inner">
          <p className="legal-hero-eyebrow">Legal</p>
          <h1 className="legal-hero-title">Policies &amp; Terms</h1>
          <p className="legal-hero-sub">
            Everything you need to know about how KlipKlop works, what we do with your data,
            and your rights as a member.
          </p>
        </div>
      </div>

      {/* Tab strip */}
      <div className="legal-tabs-wrap">
        <div className="container-page">
          <div className="legal-tabs" role="tablist">
            {TABS.map(t => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`legal-tab ${tab === t.id ? 'legal-tab-active' : ''}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="legal-main">
        <div className="container-page legal-content">
          {CONTENT[tab]}
        </div>
      </main>

      {/* Footer */}
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
