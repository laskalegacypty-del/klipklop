import './style.css'

const SESSION_KEY = 'kk-admin-ok'
/** Preview gate only — replace with Cloudflare Access before any public admin domain. */
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY || 'KlipKlop-Admin'

const app = document.getElementById('app')

function unlocked() {
  return sessionStorage.getItem(SESSION_KEY) === '1'
}

function renderGate(error = '') {
  app.innerHTML = `
    <div class="gate kk-root">
      <div class="kk-card gate-card">
        <div class="kk-card__header">
          <h1 class="kk-card__title">KlipKlop Admin</h1>
          <p class="kk-card__desc">Shared UI template — staff only.</p>
        </div>
        <form class="kk-card__content kk-stack" id="gate-form">
          <label class="kk-field">
            <span class="kk-label">Admin key</span>
            <input class="kk-input" type="password" name="key" autocomplete="current-password" required autofocus />
          </label>
          ${error ? `<p class="gate-error">${error}</p>` : ''}
          <button class="kk-btn kk-btn--primary" type="submit">Enter</button>
        </form>
      </div>
    </div>
  `
  document.getElementById('gate-form').addEventListener('submit', (e) => {
    e.preventDefault()
    const key = new FormData(e.target).get('key')
    if (String(key) !== ADMIN_KEY) {
      renderGate('Wrong key.')
      return
    }
    sessionStorage.setItem(SESSION_KEY, '1')
    renderApp()
  })
}

function renderApp() {
  app.innerHTML = `
    <div class="kk-root admin-shell">
      <header class="admin-top">
        <div class="admin-brand">
          <img src="/brand/klipklop-logo.png" alt="" />
          <div>
            <h1>UI Template</h1>
            <p>Admin · @klipklop/ui</p>
          </div>
        </div>
        <div class="kk-row">
          <a class="kk-btn kk-btn--sm kk-btn--secondary" href="https://klipklop.klipklop.workers.dev">Hub</a>
          <button type="button" class="kk-btn kk-btn--sm kk-btn--ghost" id="lock-btn">Lock</button>
        </div>
      </header>

      <div class="kk-page-header">
        <div>
          <h1 class="kk-page-header__title">Shared controls</h1>
          <p class="kk-page-header__desc">
            One KlipKlop look for the template. Association apps (SAWMGA, BRSA, …) each inject their own palette later via --kk-* tokens — not here.
          </p>
        </div>
        <div class="kk-page-header__actions">
          <span class="kk-badge kk-badge--soft">packages/ui</span>
          <span class="kk-badge kk-badge--accent">KlipKlop default</span>
        </div>
      </div>

      <section class="section">
        <h2>Buttons</h2>
        <p class="section-lead">Primary action hierarchy. Same sizes/variants in every app.</p>
        <div class="kk-card">
          <div class="kk-card__content kk-row">
            <button type="button" class="kk-btn kk-btn--primary">Primary</button>
            <button type="button" class="kk-btn kk-btn--secondary">Secondary</button>
            <button type="button" class="kk-btn kk-btn--ghost">Ghost</button>
            <button type="button" class="kk-btn kk-btn--danger">Danger</button>
            <button type="button" class="kk-btn kk-btn--inverse">Inverse</button>
            <button type="button" class="kk-btn kk-btn--sm kk-btn--primary">Small</button>
            <button type="button" class="kk-btn kk-btn--lg kk-btn--primary">Large</button>
            <button type="button" class="kk-btn kk-btn--primary" disabled>Disabled</button>
          </div>
        </div>
      </section>

      <section class="section">
        <h2>Fields</h2>
        <p class="section-lead">Labels, inputs, selects, textareas, hints.</p>
        <div class="kk-card">
          <div class="kk-card__content kk-stack">
            <div class="kk-row" style="align-items:stretch">
              <label class="kk-field" style="flex:1;min-width:12rem">
                <span class="kk-label">Rider name</span>
                <input class="kk-input" placeholder="e.g. Liani" />
              </label>
              <label class="kk-field" style="flex:1;min-width:10rem">
                <span class="kk-label">Class</span>
                <select class="kk-select">
                  <option>Adult</option>
                  <option>Youth</option>
                  <option>Open</option>
                </select>
              </label>
            </div>
            <label class="kk-field">
              <span class="kk-label">Notes</span>
              <textarea class="kk-textarea" rows="3" placeholder="Association palettes override tokens in their own app."></textarea>
              <span class="kk-hint">Hint text · kk-hint</span>
            </label>
          </div>
        </div>
      </section>

      <section class="section">
        <h2>Badges</h2>
        <div class="kk-card">
          <div class="kk-card__content kk-row">
            <span class="kk-badge kk-badge--default">Default</span>
            <span class="kk-badge kk-badge--accent">Accent</span>
            <span class="kk-badge kk-badge--soft">Soft</span>
            <span class="kk-badge kk-badge--success">Success</span>
            <span class="kk-badge kk-badge--warning">Warning</span>
            <span class="kk-badge kk-badge--danger">Danger</span>
          </div>
        </div>
      </section>

      <section class="section">
        <h2>Layout</h2>
        <p class="section-lead">Cards, tabs, tables, empty states — structure only.</p>
        <div class="kk-stack">
          <div class="kk-card">
            <div class="kk-card__header">
              <h3 class="kk-card__title">Card title</h3>
              <p class="kk-card__desc">Short supporting line under a section header.</p>
            </div>
            <div class="kk-card__content">
              <div class="kk-tabs" role="tablist" id="demo-tabs">
                <button type="button" class="kk-tab is-active" aria-selected="true">Entries</button>
                <button type="button" class="kk-tab" aria-selected="false">Results</button>
                <button type="button" class="kk-tab" aria-selected="false">Payout</button>
              </div>
            </div>
            <div class="kk-card__footer kk-row">
              <button type="button" class="kk-btn kk-btn--secondary">Cancel</button>
              <button type="button" class="kk-btn kk-btn--primary">Save</button>
            </div>
          </div>

          <div class="kk-table-wrap">
            <table class="kk-table">
              <thead>
                <tr><th>Component</th><th>Export / class</th><th>Role</th></tr>
              </thead>
              <tbody>
                <tr><td>Button</td><td>Button · kk-btn</td><td>Actions</td></tr>
                <tr><td>Input / Select / Textarea</td><td>kk-input…</td><td>Forms</td></tr>
                <tr><td>Card / Tabs / Table</td><td>kk-card…</td><td>Structure</td></tr>
                <tr><td>Modal / Empty</td><td>kk-modal / kk-empty</td><td>Overlays &amp; voids</td></tr>
              </tbody>
            </table>
          </div>

          <div class="kk-empty">
            <h3 class="kk-empty__title">Empty state</h3>
            <p class="kk-empty__desc">When a list has nothing yet — same pattern in every division.</p>
            <button type="button" class="kk-btn kk-btn--secondary">Primary empty action</button>
          </div>
        </div>
      </section>

      <section class="section">
        <h2>For association apps</h2>
        <p class="section-lead">
          Import <code>@klipklop/ui</code>, keep these controls, then set that association’s palette with
          <code>applyTheme({…})</code> or CSS <code>--kk-*</code> overrides in that app only.
        </p>
        <pre class="code">import '@klipklop/ui/index.css'
import { Button, applyTheme } from '@klipklop/ui'

// Later, per association (example — not applied in this admin app):
// applyTheme({ accent: '#…', accentInk: '#…', bg: '#…', … })</pre>
        <div class="links" style="margin-top:0.75rem">
          <a class="kk-btn kk-btn--secondary" href="https://klipklop.klipklop.workers.dev">Hub</a>
          <a class="kk-btn kk-btn--secondary" href="https://klipklop-rider.klipklop.workers.dev">Rider</a>
          <a class="kk-btn kk-btn--secondary" href="https://klipklop-horse-health.klipklop.workers.dev">Horse Health</a>
          <a class="kk-btn kk-btn--secondary" href="https://klipklop-sawmga.klipklop.workers.dev">SAWMGA</a>
          <a class="kk-btn kk-btn--secondary" href="https://brsa-demo.klipklop.co.za">BRSA</a>
        </div>
      </section>
    </div>
  `

  document.getElementById('lock-btn')?.addEventListener('click', () => {
    sessionStorage.removeItem(SESSION_KEY)
    renderGate()
  })

  document.querySelectorAll('#demo-tabs .kk-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      tab.parentElement.querySelectorAll('.kk-tab').forEach((t) => {
        t.classList.remove('is-active')
        t.setAttribute('aria-selected', 'false')
      })
      tab.classList.add('is-active')
      tab.setAttribute('aria-selected', 'true')
    })
  })
}

if (unlocked()) renderApp()
else renderGate()
