import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Mail, Check, RotateCcw, Send, ArrowLeft, ArrowRight, Minus, Plus, Download, TrendingDown, ArrowUpCircle,
  Building2, Trophy, Heart, CalendarCheck, ShieldCheck, Sparkles, SlidersHorizontal,
} from 'lucide-react'
import { APP_NAME, APP_LOGO_SRC, APP_TAGLINE } from '../constants/branding'
import { ROLES, SEAT_PRICES, SIZE_BANDS, SIZE_LABELS, TIERS, HOW_IT_WORKS, MONTHS_FREE_ANNUAL, LIMITS, SALES_EMAIL } from '../constants/pricing'
import {
  annualFee, effectiveSaving, costForTier, cheapestTier, nextTierOf,
  formatRand, formatPercent, sanitiseCounts, sanitisePrices,
} from '../lib/pricingCalc'
import './Landing.css'
import './Pricing.css'

const ROLE_INFO = {
  rider:     { icon: Trophy,        blurb: 'Members who ride and compete.' },
  supporter: { icon: Heart,         blurb: 'Family, friends and fans who follow riders.' },
  producer:  { icon: CalendarCheck, blurb: 'People who run and score your events.' },
  admin:     { icon: ShieldCheck,   blurb: 'People who manage the association on KlipKlop.' },
}

const STEPS = ['Your association', 'Riders & supporters', 'Producers & admins', 'Your tier', 'Get your quote']
const blankCounts = () => Object.fromEntries(ROLES.map(r => [r.key, '']))
const listPriceInputs = () => Object.fromEntries(ROLES.map(r => [r.key, String(SEAT_PRICES[r.key])]))

function gaugeLevel(roleKey, n) {
  if (!n) return 0
  const i = SIZE_BANDS[roleKey].findIndex(max => n <= max)
  return (i === -1 ? SIZE_BANDS[roleKey].length - 1 : i) + 1
}

function SeatInput({ role, value, onChange }) {
  const Icon = ROLE_INFO[role.key].icon
  const n = Number(value) || 0
  const lit = gaugeLevel(role.key, n)
  const label = lit > 0 ? SIZE_LABELS[lit - 1] : 'Not set'
  const inputId = 'seat-' + role.key
  const set = v => onChange(String(Math.max(0, Math.min(LIMITS.maxSeatCount, v))))
  return (
    <div className="pw-seat">
      <div className="pw-seat-icon"><Icon size={22} /></div>
      <div className="pw-seat-text">
        <label htmlFor={inputId} className="pw-seat-title">{role.label}</label>
        <p className="pw-seat-blurb">{ROLE_INFO[role.key].blurb}</p>
      </div>
      <div className="pw-stepper">
        <button type="button" onClick={() => set(n - 1)} aria-label={'One fewer ' + role.singular.toLowerCase()} disabled={n <= 0}><Minus size={16} /></button>
        <input
          id={inputId} inputMode="numeric" autoComplete="off" placeholder="0"
          value={value} onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, String(LIMITS.maxSeatCount).length))}
        />
        <button type="button" onClick={() => set(n + 1)} aria-label={'One more ' + role.singular.toLowerCase()}><Plus size={16} /></button>
      </div>
      <div className="pw-gauge" role="img" aria-label={'Size: ' + label}>
        <div className="pw-gauge-bars">
          {SIZE_LABELS.map((l, i) => <i key={l} className={i < lit ? 'on on-' + (lit - 1) : ''} />)}
        </div>
        <span className="pw-gauge-label">{label}</span>
      </div>
    </div>
  )
}

export default function Pricing() {
  const [step, setStep] = useState(0)
  const [association, setAssociation] = useState('')
  const [countInputs, setCountInputs] = useState(blankCounts)
  const [priceInputs, setPriceInputs] = useState(listPriceInputs)
  const [annual, setAnnual] = useState(false)
  const [showPrices, setShowPrices] = useState(false)
  const [contact, setContact] = useState({ contactName: '', email: '', phone: '', note: '', website: '' })
  const [submitState, setSubmitState] = useState({ status: 'idle', error: '' })
  const [stepError, setStepError] = useState('')
  const topRef = useRef(null)

  const countsValid = sanitiseCounts(countInputs)
  const pricesValid = sanitisePrices(priceInputs)
  const counts = countsValid || sanitiseCounts(blankCounts())
  const prices = pricesValid || SEAT_PRICES
  const hasCounts = Object.values(counts).some(n => n > 0)
  const priceChanged = ROLES.some(r => prices[r.key] !== SEAT_PRICES[r.key])

  // Only the client's own tier is ever worked out and shown.
  const recommendedTier = TIERS.find(t => t.name === cheapestTier(counts, SEAT_PRICES).tier)
  const [upgradeName, setUpgradeName] = useState(null)
  const myTier = TIERS.find(t => t.name === upgradeName) || recommendedTier
  const upgraded = myTier.name !== recommendedTier.name
  const mine = costForTier(myTier, counts, prices)
  const mineList = costForTier(myTier, counts, SEAT_PRICES)
  // One upgrade only: once upgraded there is no further tier offered.
  const nextTier = upgraded ? null : nextTierOf(myTier)
  const nextCost = nextTier ? costForTier(nextTier, counts, prices) : null
  const nextDiff = nextCost ? mine.totalMonthly - nextCost.totalMonthly : 0
  const [pdfBusy, setPdfBusy] = useState(false)
  const overLargest = counts.rider > TIERS[TIERS.length - 1].seats.rider || counts.supporter > TIERS[TIERS.length - 1].seats.supporter
  const period = annual ? 'year' : 'month'

  useEffect(() => {
    if (step > 0) topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [step])

  const setCount = (k, v) => { setCountInputs(s => ({ ...s, [k]: v })); setUpgradeName(null); setStepError('') }
  const setPrice = (k, v) => setPriceInputs(s => ({ ...s, [k]: v.replace(/[^\d.]/g, '') }))
  const setField = (k, v) => setContact(s => ({ ...s, [k]: v }))

  function next() {
    if (step === 0 && !association.trim()) { setStepError('Please tell us your association name to continue.'); return }
    if (step === 2) {
      if (!countsValid) { setStepError('Seat counts must be whole numbers.'); return }
      if (!hasCounts) { setStepError('Add at least one seat to work out your tier.'); return }
    }
    setStepError('')
    setStep(s => Math.min(STEPS.length - 1, s + 1))
  }
  const back = () => { setStepError(''); setStep(s => Math.max(0, s - 1)) }
  const onEnter = e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && step < 4) { e.preventDefault(); next() } }

  async function submit(e) {
    e.preventDefault()
    if (!pricesValid || !countsValid) {
      setSubmitState({ status: 'error', error: 'Please check the prices you entered.' })
      return
    }
    setSubmitState({ status: 'sending', error: '' })
    try {
      const res = await fetch('/api/pricing/proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...contact, association, counts: countsValid, prices: pricesValid, selectedTier: myTier.name }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.')
      setSubmitState({ status: 'done', error: '' })
    } catch (err) {
      setSubmitState({ status: 'error', error: err.message })
    }
  }

  async function downloadPdf() {
    setPdfBusy(true)
    try {
      const { downloadPricingPdf } = await import('../lib/pricingPdf')
      await downloadPricingPdf({
        association: association.trim() || 'Your association', counts, tier: myTier, mine, next: nextTier, nextCost,
        prices, priceChanged, logoSrc: APP_LOGO_SRC,
      })
    } catch {
      setStepError('Could not create the PDF. Please try again.')
    }
    setPdfBusy(false)
  }

  const done = submitState.status === 'done'

  return (
    <div className="lp-root">
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

      <div className="pw-hero">
        <div className="container-page pw-hero-inner">
          <p className="pw-eyebrow">Pricing for associations</p>
          <h1 className="pw-hero-title">Find the right plan for your association</h1>
          <p className="pw-hero-sub">Answer a few quick questions and we will work out your tier and what it costs. It takes about a minute.</p>
        </div>
      </div>

      <main className="pw-main" ref={topRef}>
        <div className="container-page pw-wrap">

          {/* Progress */}
          {!done && (
            <nav className="pw-progress" aria-label="Progress">
              <div className="pw-progress-bar"><div style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }} /></div>
              <ol>
                {STEPS.map((label, i) => (
                  <li key={label} className={i === step ? 'now' : i < step ? 'past' : ''} aria-current={i === step ? 'step' : undefined}>
                    <span className="pw-dot">{i < step ? <Check size={13} /> : i + 1}</span>
                    <span className="pw-step-label">{label}</span>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          <div className="pw-card" key={done ? 'done' : step} onKeyDown={onEnter}>

            {/* Step 1 */}
            {!done && step === 0 && (
              <section>
                <div className="pw-badge-icon"><Building2 size={26} /></div>
                <h2 className="pw-h2">Let&rsquo;s start with your association</h2>
                <p className="pw-lead">One seat is taken by each member registered with your association, in their role. We will ask how many of each you have.</p>
                <label className="pw-field">
                  <span className="pw-label">Association name</span>
                  <input className="pw-input pw-input-lg" autoFocus value={association} maxLength={LIMITS.maxFieldLength}
                    onChange={e => { setAssociation(e.target.value); setStepError('') }} placeholder="e.g. Barrel Racing South Africa" autoComplete="organization" />
                </label>
                <ul className="pw-facts">
                  <li><Check size={16} /> No sign-up needed to explore your price</li>
                  <li><Check size={16} /> Prepay annually and get {MONTHS_FREE_ANNUAL} months free on your tier fee</li>
                </ul>

                <div className="pw-how">
                  <h3 className="pw-h3">How it works</h3>
                  <ol>
                    {HOW_IT_WORKS.map((s, i) => (
                      <li key={s.title}><span className="pw-how-n">{i + 1}</span><div><b>{s.title}</b><p>{s.text}</p></div></li>
                    ))}
                  </ol>
                </div>
              </section>
            )}

            {/* Step 2 */}
            {!done && step === 1 && (
              <section>
                <h2 className="pw-h2">How many riders and supporters?</h2>
                <p className="pw-lead">Roughly is fine. Use your current registered members, or what you expect.</p>
                <div className="pw-seats">
                  {ROLES.slice(0, 2).map(r => <SeatInput key={r.key} role={r} value={countInputs[r.key]} onChange={v => setCount(r.key, v)} />)}
                </div>
              </section>
            )}

            {/* Step 3 */}
            {!done && step === 2 && (
              <section>
                <h2 className="pw-h2">And your producers and admins?</h2>
                <p className="pw-lead">These are the people who run events and look after the association.</p>
                <div className="pw-seats">
                  {ROLES.slice(2).map(r => <SeatInput key={r.key} role={r} value={countInputs[r.key]} onChange={v => setCount(r.key, v)} />)}
                </div>
              </section>
            )}

            {/* Step 4: result */}
            {!done && step === 3 && (
              <section>
                <div className="pw-result-top">
                  <div>
                    <p className="pw-eyebrow-dark"><Sparkles size={14} /> Your tier for {association.trim() || 'your association'}</p>
                    <h2 className="pw-tier-title">{myTier.name}</h2>
                    <p className="pw-lead pw-tight">
                      {upgraded
                        ? <>You upgraded from {recommendedTier.name}. <button type="button" className="pw-inline-btn" onClick={() => setUpgradeName(null)}>Switch back to {recommendedTier.name}</button></>
                        : 'Best value for the seats you told us about.'}
                    </p>
                  </div>
                  <div className="pw-toggle" role="group" aria-label="Billing view">
                    <button type="button" aria-pressed={!annual} className={!annual ? 'on' : ''} onClick={() => setAnnual(false)}>Monthly</button>
                    <button type="button" aria-pressed={annual} className={annual ? 'on' : ''} onClick={() => setAnnual(true)}>Annual prepay</button>
                  </div>
                </div>

                <div className="pw-price-box">
                  <p className="pw-price-label">Total per {period}</p>
                  <p className="pw-price">{formatRand(annual ? mine.totalAnnualPrepay : mine.totalMonthly)}</p>
                  <p className="pw-price-sub">
                    {annual
                      ? `Includes ${MONTHS_FREE_ANNUAL} months free on your ${formatRand(annualFee(myTier, prices))} tier fee`
                      : `${formatRand(mine.tierFee)} tier fee${mine.extraTotal ? ` + ${formatRand(mine.extraTotal)} extra seats` : ''}`}
                  </p>
                </div>

                <div className="pw-breakdown">
                  <div><span>Your {myTier.name} tier</span><b>{formatRand(annual ? annualFee(myTier, prices) : mine.tierFee)}<small> / {period}</small></b></div>
                  <div><span>Extra seats (billed monthly)</span><b>{formatRand(mine.extraTotal)}<small> / month</small></b></div>
                </div>

                <div className="pw-chips">
                  <span>{formatPercent(effectiveSaving(myTier, prices))} saving on your included seats</span>
                  <span>Annual prepay: {formatRand(annualFee(myTier, prices))} tier fee</span>
                </div>

                <h3 className="pw-h3">What&rsquo;s in your tier</h3>
                <div className="pw-table-wrap">
                  <table className="pw-table">
                    <thead><tr><th>Role</th><th>You told us</th><th>Included</th><th>Extra</th><th>Extra cost / mo</th></tr></thead>
                    <tbody>
                      {ROLES.map(r => (
                        <tr key={r.key}>
                          <th scope="row">{r.label}</th>
                          <td>{counts[r.key]}</td>
                          <td>{myTier.seats[r.key]}</td>
                          <td className={mine.extras[r.key] ? 'pw-warn' : ''}>{mine.extras[r.key]}</td>
                          <td>{formatRand(mine.extraCost[r.key])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {nextTier && nextCost && (
                  <div className={'pw-next' + (nextDiff > 0 ? ' pw-next-save' : '')}>
                    <p className="pw-next-eyebrow"><TrendingDown size={14} /> The next tier up</p>
                    <h3 className="pw-next-title">{nextTier.name}</h3>
                    <p className="pw-next-line">
                      {formatRand(annual ? nextCost.totalAnnualPrepay : nextCost.totalMonthly)} per {period}
                      <span> ({formatRand(annual ? annualFee(nextTier, prices) : nextCost.tierFee)} tier fee{nextCost.extraTotal ? ' + ' + formatRand(nextCost.extraTotal) + ' extra seats' : ''})</span>
                    </p>
                    {nextDiff > 0 ? (
                      <p className="pw-next-result"><b>You would save {formatRand(annual ? nextDiff * 12 : nextDiff)} per {period}</b> by choosing {nextTier.name}.</p>
                    ) : nextDiff === 0 ? (
                      <p className="pw-next-result">That is the same cost as {myTier.name}.</p>
                    ) : (
                      <p className="pw-next-result">That is {formatRand(annual ? -nextDiff * 12 : -nextDiff)} more per {period} than {myTier.name}, but it includes more seats ({ROLES.map(r => nextTier.seats[r.key] + ' ' + r.label.toLowerCase()).join(', ')}) and room to grow.</p>
                    )}
                    <button type="button" className="pw-btn pw-btn-primary pw-btn-upgrade" onClick={() => { setUpgradeName(nextTier.name) }}>
                      <ArrowUpCircle size={16} /> Upgrade to {nextTier.name}
                    </button>
                  </div>
                )}

                <button type="button" className="pw-btn pw-btn-ghost pw-btn-wide" onClick={downloadPdf} disabled={pdfBusy}>
                  <Download size={16} /> {pdfBusy ? 'Preparing PDF...' : 'Download my estimate (PDF)'}
                </button>

                <ul className="pw-notes">
                  <li>Seats above your allowance are added automatically and billed monthly at the per-seat price, pro rata from registration{annual ? ', even on annual prepay' : ''}.</li>
                  <li>Your tier can only change once a year, on the anniversary of your Effective Date.</li>
                </ul>
                {overLargest && (
                  <div className="pw-note-box">
                    <b>A big association!</b> At your size a custom quote may suit you better.{' '}
                    <a href={`mailto:${SALES_EMAIL}?subject=Custom%20pricing%20enquiry`}>Talk to us</a>.
                  </div>
                )}
              </section>
            )}

            {/* Step 5: quote + proposal */}
            {!done && step === 4 && (
              <section>
                <h2 className="pw-h2">Get your quote</h2>
                <p className="pw-lead">
                  Your {myTier.name} tier comes to <b>{formatRand(mineList.totalMonthly)} / month</b>. Leave your details and we will send you a final quote.
                </p>

                <form onSubmit={submit} noValidate className="pw-form">
                  <div className="pw-grid2">
                    <label className="pw-field"><span className="pw-label">Your name</span>
                      <input className="pw-input" required value={contact.contactName} maxLength={LIMITS.maxFieldLength} onChange={e => setField('contactName', e.target.value)} autoComplete="name" autoFocus /></label>
                    <label className="pw-field"><span className="pw-label">Email</span>
                      <input className="pw-input" type="email" required value={contact.email} maxLength={LIMITS.maxFieldLength} onChange={e => setField('email', e.target.value)} autoComplete="email" /></label>
                    <label className="pw-field"><span className="pw-label">Phone</span>
                      <input className="pw-input" type="tel" required value={contact.phone} maxLength={50} onChange={e => setField('phone', e.target.value)} autoComplete="tel" /></label>
                  </div>

                  <button type="button" className="pw-link-btn" aria-expanded={showPrices} onClick={() => setShowPrices(v => !v)}>
                    <SlidersHorizontal size={15} /> {showPrices ? 'Hide price adjustments' : 'Have a different price in mind? Adjust per-seat prices'}
                  </button>

                  {showPrices && (
                    <div className="pw-prices">
                      <p className="pw-muted">Change any seat price to propose your own numbers. This is a request, not a binding agreement.</p>
                      <div className="pw-grid2">
                        {ROLES.map(r => (
                          <label key={r.key} className="pw-field">
                            <span className="pw-label">{r.singular} / month <em>(list {formatRand(SEAT_PRICES[r.key])})</em></span>
                            <div className="pw-money"><span aria-hidden="true">R</span>
                              <input className="pw-input" inputMode="decimal" autoComplete="off" value={priceInputs[r.key]}
                                onChange={e => setPrice(r.key, e.target.value)} aria-invalid={!pricesValid} /></div>
                          </label>
                        ))}
                      </div>
                      {!pricesValid && <p className="pw-error" role="alert">Prices must be numbers between 0 and {formatRand(LIMITS.maxPricePerSeat)}.</p>}
                      <div className="pw-compare">
                        <div><span>List price</span><b>{formatRand(mineList.totalMonthly)}<small> / month</small></b><b>{formatRand(mineList.totalAnnualPrepay)}<small> / year</small></b></div>
                        <div className={priceChanged ? 'on' : ''}><span>Your proposal</span><b>{formatRand(mine.totalMonthly)}<small> / month</small></b><b>{formatRand(mine.totalAnnualPrepay)}<small> / year</small></b></div>
                      </div>
                      <button type="button" className="pw-btn pw-btn-ghost" onClick={() => setPriceInputs(listPriceInputs())} disabled={!priceChanged && pricesValid}>
                        <RotateCcw size={15} /> Reset to list prices
                      </button>
                    </div>
                  )}

                  <label className="pw-field"><span className="pw-label">Anything we should know? (optional)</span>
                    <textarea className="pw-input pw-textarea" rows={3} value={contact.note} maxLength={LIMITS.maxNoteLength} onChange={e => setField('note', e.target.value)} /></label>

                  <div className="pw-hp" aria-hidden="true">
                    <label>Website<input tabIndex={-1} autoComplete="off" value={contact.website} onChange={e => setField('website', e.target.value)} /></label>
                  </div>

                  {submitState.status === 'error' && <p className="pw-error" role="alert">{submitState.error}</p>}
                  <button type="submit" className="pw-btn pw-btn-primary pw-btn-lg" disabled={submitState.status === 'sending'}>
                    <Send size={16} /> {submitState.status === 'sending' ? 'Sending...' : priceChanged ? 'Submit my proposal' : 'Send me my quote'}
                  </button>
                  <p className="pw-muted">Sending this is a request only. It does not change your pricing or create an agreement.</p>
                </form>
              </section>
            )}

            {/* Done */}
            {done && (
              <section className="pw-done" role="status">
                <div className="pw-done-icon"><Check size={34} /></div>
                <h2 className="pw-h2">Received. We will respond with a final quote.</h2>
                <p className="pw-lead">Thanks{contact.contactName ? `, ${contact.contactName.split(' ')[0]}` : ''}. We have emailed you a confirmation and will be in touch soon.</p>
              </section>
            )}

            {stepError && <p className="pw-error" role="alert">{stepError}</p>}

            {/* Nav */}
            {!done && step < 4 && (
              <div className="pw-actions">
                {step > 0 ? <button type="button" className="pw-btn pw-btn-ghost" onClick={back}><ArrowLeft size={16} /> Back</button> : <span />}
                <button type="button" className="pw-btn pw-btn-primary" onClick={next}>
                  {step === 2 ? 'Show my tier' : 'Continue'} <ArrowRight size={16} />
                </button>
              </div>
            )}
            {!done && step === 4 && (
              <div className="pw-actions pw-actions-left">
                <button type="button" className="pw-btn pw-btn-ghost" onClick={back}><ArrowLeft size={16} /> Back</button>
              </div>
            )}
          </div>

          <p className="pw-fineprint">
            Figures are indicative. The final price is set in the signed Order Form under the Platform Services Agreement.
          </p>
        </div>
      </main>

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
            Questions about pricing?{' '}
            <a href={`mailto:${SALES_EMAIL}`} className="lp-footer-link">
              <Mail size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
              {SALES_EMAIL}
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}
