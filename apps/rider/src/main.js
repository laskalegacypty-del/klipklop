import './style.css'

const STORE_KEY = 'kk-rider-v1'
const HUB = 'https://klipklop.klipklop.workers.dev'
const HEALTH = 'https://klipklop-horse-health.klipklop.workers.dev'
const SAWMGA = 'https://klipklop-sawmga.klipklop.workers.dev'
const BRSA = 'https://brsa-demo.klipklop.co.za'

const defaultState = () => ({
  profile: {
    firstName: 'Dewald',
    lastName: 'Pretorius',
    email: 'dewald.pretorius@example.com',
    phone: '+27 82 000 0000',
    city: 'Pretoria',
    emergencyName: 'Annelize Pretorius',
    emergencyPhone: '+27 83 000 0000',
    notes: '',
  },
  subscriptions: [
    {
      id: 'kk-platform',
      name: 'KlipKlop Rider',
      blurb: 'Central account — profile, billing, horse health link.',
      status: 'active',
      renews: '2026-12-01',
      amount: 'R99 / mo',
    },
    {
      id: 'kk-health',
      name: 'Horse Health',
      blurb: 'Care logs & due alerts for your yard.',
      status: 'active',
      renews: '2026-12-01',
      amount: 'R49 / mo',
    },
  ],
  payments: [
    { id: 'p3', date: '2026-11-01', label: 'KlipKlop Rider + Horse Health', amount: 'R148', status: 'Paid' },
    { id: 'p2', date: '2026-10-01', label: 'KlipKlop Rider + Horse Health', amount: 'R148', status: 'Paid' },
    { id: 'p1', date: '2026-09-01', label: 'KlipKlop Rider', amount: 'R99', status: 'Paid' },
  ],
  method: { brand: 'Visa', last4: '4242', exp: '09/28' },
})

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return defaultState()
    return { ...defaultState(), ...JSON.parse(raw) }
  } catch {
    return defaultState()
  }
}

function save(state) {
  localStorage.setItem(STORE_KEY, JSON.stringify(state))
}

let state = load()
let tab = 'profile'
const app = document.getElementById('app')

function toast(msg) {
  let el = document.getElementById('toast')
  if (!el) {
    el = document.createElement('div')
    el.id = 'toast'
    el.className = 'toast'
    document.body.appendChild(el)
  }
  el.textContent = msg
  el.classList.add('is-in')
  clearTimeout(toast._t)
  toast._t = setTimeout(() => el.classList.remove('is-in'), 2200)
}

function statusBadge(status) {
  const map = {
    active: 'kk-badge--success',
    paused: 'kk-badge--warning',
    cancelled: 'kk-badge--danger',
    Paid: 'kk-badge--success',
    Failed: 'kk-badge--danger',
    Pending: 'kk-badge--warning',
  }
  return `<span class="kk-badge ${map[status] || 'kk-badge--soft'}">${status}</span>`
}

function render() {
  const p = state.profile
  app.innerHTML = `
    <div class="kk-root app-shell">
      <header class="app-top">
        <div class="app-brand">
          <img src="/brand/klipklop-logo.png" alt="" />
          <div>
            <h1>Rider</h1>
            <p>Account · subscriptions · payments</p>
          </div>
        </div>
        <div class="kk-row">
          <a class="kk-btn kk-btn--sm kk-btn--secondary" href="${HUB}">Hub</a>
          <a class="kk-btn kk-btn--sm kk-btn--ghost" href="${HEALTH}">Horse Health</a>
        </div>
      </header>

      <div class="kk-page-header">
        <div>
          <h1 class="kk-page-header__title">${escapeHtml(p.firstName)} ${escapeHtml(p.lastName)}</h1>
          <p class="kk-page-header__desc">
            Your KlipKlop home for details and billing. Association memberships, entries, and sport rules stay in each association app.
          </p>
        </div>
        <div class="kk-page-header__actions">
          <span class="kk-badge kk-badge--accent">Central account</span>
        </div>
      </div>

      <div class="kk-tabs tabs-bar" role="tablist">
        ${tabBtn('profile', 'Details')}
        ${tabBtn('subs', 'Subscriptions')}
        ${tabBtn('pay', 'Payments')}
        ${tabBtn('assoc', 'Associations')}
      </div>

      <section class="panel ${tab === 'profile' ? 'is-active' : ''}" data-panel="profile">
        <p class="section-lead">Contact and emergency info used across KlipKlop. Sport grades and association IDs live in those apps.</p>
        <form class="kk-card" id="profile-form">
          <div class="kk-card__content form-grid">
            <label class="kk-field">
              <span class="kk-label">First name</span>
              <input class="kk-input" name="firstName" value="${escapeAttr(p.firstName)}" required />
            </label>
            <label class="kk-field">
              <span class="kk-label">Last name</span>
              <input class="kk-input" name="lastName" value="${escapeAttr(p.lastName)}" required />
            </label>
            <label class="kk-field">
              <span class="kk-label">Email</span>
              <input class="kk-input" type="email" name="email" value="${escapeAttr(p.email)}" required />
            </label>
            <label class="kk-field">
              <span class="kk-label">Phone</span>
              <input class="kk-input" name="phone" value="${escapeAttr(p.phone)}" />
            </label>
            <label class="kk-field">
              <span class="kk-label">City</span>
              <input class="kk-input" name="city" value="${escapeAttr(p.city)}" />
            </label>
            <label class="kk-field">
              <span class="kk-label">Emergency contact</span>
              <input class="kk-input" name="emergencyName" value="${escapeAttr(p.emergencyName)}" />
            </label>
            <label class="kk-field span-2">
              <span class="kk-label">Emergency phone</span>
              <input class="kk-input" name="emergencyPhone" value="${escapeAttr(p.emergencyPhone)}" />
            </label>
            <label class="kk-field span-2">
              <span class="kk-label">Notes</span>
              <textarea class="kk-textarea" name="notes" rows="3" placeholder="Anything KlipKlop staff should know…">${escapeHtml(p.notes)}</textarea>
            </label>
          </div>
          <div class="kk-card__footer kk-row">
            <button type="submit" class="kk-btn kk-btn--primary">Save details</button>
          </div>
        </form>
      </section>

      <section class="panel ${tab === 'subs' ? 'is-active' : ''}" data-panel="subs">
        <p class="section-lead">Platform and product subscriptions only. SAWMGA / BRSA membership renewals stay in those apps.</p>
        <div class="kk-card">
          <div class="kk-card__content">
            ${state.subscriptions
              .map(
                (s) => `
              <div class="sub-row" data-sub="${s.id}">
                <div class="sub-meta">
                  <strong>${escapeHtml(s.name)}</strong>
                  <span>${escapeHtml(s.blurb)}</span>
                  <span>${escapeHtml(s.amount)} · renews ${escapeHtml(s.renews)}</span>
                </div>
                <div class="kk-row">
                  ${statusBadge(s.status)}
                  ${
                    s.status === 'active'
                      ? `<button type="button" class="kk-btn kk-btn--sm kk-btn--ghost" data-action="pause" data-id="${s.id}">Pause</button>`
                      : `<button type="button" class="kk-btn kk-btn--sm kk-btn--primary" data-action="resume" data-id="${s.id}">Resume</button>`
                  }
                </div>
              </div>`,
              )
              .join('')}
          </div>
        </div>
      </section>

      <section class="panel ${tab === 'pay' ? 'is-active' : ''}" data-panel="pay">
        <p class="section-lead">Demo billing history for KlipKlop products. Association entry fees and wallets stay where the sport lives.</p>
        <div class="kk-stack">
          <div class="kk-card">
            <div class="kk-card__header">
              <h3 class="kk-card__title">Payment method</h3>
              <p class="kk-card__desc">Stored for demo only — not charged.</p>
            </div>
            <div class="kk-card__content kk-row" style="justify-content:space-between">
              <div>
                <strong>${escapeHtml(state.method.brand)}</strong> ···· ${escapeHtml(state.method.last4)}
                <div class="kk-hint">Expires ${escapeHtml(state.method.exp)}</div>
              </div>
              <button type="button" class="kk-btn kk-btn--sm kk-btn--secondary" id="update-card">Update (demo)</button>
            </div>
          </div>

          <div class="kk-table-wrap">
            <table class="kk-table">
              <thead>
                <tr><th>Date</th><th>Description</th><th>Amount</th><th>Status</th></tr>
              </thead>
              <tbody>
                ${state.payments
                  .map(
                    (pay) => `
                  <tr>
                    <td>${escapeHtml(pay.date)}</td>
                    <td>${escapeHtml(pay.label)}</td>
                    <td class="pay-amount">${escapeHtml(pay.amount)}</td>
                    <td>${statusBadge(pay.status)}</td>
                  </tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="panel ${tab === 'assoc' ? 'is-active' : ''}" data-panel="assoc">
        <p class="section-lead">Open an association for membership numbers, classes, entries, and sport-specific settings.</p>
        <div class="assoc-list">
          <div class="assoc-item">
            <div>
              <strong>SAWMGA</strong>
              <p>Matrix, qualifiers, Nationals, Klippies — manage in SAWMGA.</p>
            </div>
            <a class="kk-btn kk-btn--sm kk-btn--secondary" href="${SAWMGA}">Open</a>
          </div>
          <div class="assoc-item">
            <div>
              <strong>BRSA</strong>
              <p>Events, wallet, standings, Barry — manage in BRSA.</p>
            </div>
            <a class="kk-btn kk-btn--sm kk-btn--secondary" href="${BRSA}">Open</a>
          </div>
          <div class="assoc-item">
            <div>
              <strong>Horse Health</strong>
              <p>Yard care, vaccines, vet &amp; farrier — linked product.</p>
            </div>
            <a class="kk-btn kk-btn--sm kk-btn--primary" href="${HEALTH}">Open</a>
          </div>
        </div>
      </section>
    </div>
  `

  bind()
}

function tabBtn(id, label) {
  return `<button type="button" class="kk-tab ${tab === id ? 'is-active' : ''}" data-tab="${id}" aria-selected="${tab === id}">${label}</button>`
}

function bind() {
  document.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      tab = btn.dataset.tab
      render()
    })
  })

  document.getElementById('profile-form')?.addEventListener('submit', (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    state.profile = {
      firstName: String(fd.get('firstName') || '').trim(),
      lastName: String(fd.get('lastName') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      phone: String(fd.get('phone') || '').trim(),
      city: String(fd.get('city') || '').trim(),
      emergencyName: String(fd.get('emergencyName') || '').trim(),
      emergencyPhone: String(fd.get('emergencyPhone') || '').trim(),
      notes: String(fd.get('notes') || ''),
    }
    save(state)
    toast('Details saved')
    render()
  })

  document.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sub = state.subscriptions.find((s) => s.id === btn.dataset.id)
      if (!sub) return
      sub.status = btn.dataset.action === 'pause' ? 'paused' : 'active'
      save(state)
      toast(sub.status === 'paused' ? `${sub.name} paused` : `${sub.name} resumed`)
      render()
    })
  })

  document.getElementById('update-card')?.addEventListener('click', () => {
    state.method.last4 = String(Math.floor(1000 + Math.random() * 9000))
    save(state)
    toast('Card updated (demo)')
    render()
  })
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function escapeAttr(s) {
  return escapeHtml(s).replaceAll('"', '&quot;')
}

render()
