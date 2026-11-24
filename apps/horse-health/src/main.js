import './style.css'

const STORE_KEY = 'kk-horse-health-v1'
const HUB = 'https://klipklop.klipklop.workers.dev'
const RIDER = 'https://klipklop-rider.klipklop.workers.dev'

const CARE_TYPES = ['Vaccination', 'Vet visit', 'Farrier', 'Deworm', 'Dental', 'Medication', 'Note']

const defaultState = () => ({
  horses: [
    {
      id: 'h1',
      name: 'Storm',
      breed: 'QH',
      sex: 'Gelding',
      yob: '2016',
      notes: 'Sensitive to bit pressure.',
    },
    {
      id: 'h2',
      name: 'Maple',
      breed: 'Paint',
      sex: 'Mare',
      yob: '2019',
      notes: '',
    },
  ],
  records: [
    { id: 'r1', horseId: 'h1', type: 'Vaccination', title: 'AHS booster', date: '2026-03-15', due: '2027-03-15', notes: 'Dr. Botha' },
    { id: 'r2', horseId: 'h1', type: 'Farrier', title: 'Reset shoes', date: '2026-10-20', due: '2026-12-01', notes: '' },
    { id: 'r3', horseId: 'h1', type: 'Deworm', title: 'Ivermectin', date: '2026-09-01', due: '2026-12-01', notes: '' },
    { id: 'r4', horseId: 'h2', type: 'Vaccination', title: 'Flu / tetanus', date: '2026-06-10', due: '2026-12-10', notes: '' },
    { id: 'r5', horseId: 'h2', type: 'Vet visit', title: 'Lameness check', date: '2026-11-02', due: '', notes: 'Cleared for light work' },
    { id: 'r6', horseId: 'h2', type: 'Farrier', title: 'Trim', date: '2026-10-05', due: '2026-11-20', notes: '' },
  ],
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

function uid(prefix) {
  return `${prefix}${Math.random().toString(36).slice(2, 9)}`
}

function daysUntil(iso) {
  if (!iso) return null
  const due = new Date(`${iso}T12:00:00`)
  const now = new Date()
  now.setHours(12, 0, 0, 0)
  return Math.round((due - now) / 86400000)
}

function alertClass(days) {
  if (days == null) return ''
  if (days < 0) return 'is-overdue'
  if (days <= 21) return 'is-soon'
  return ''
}

function alertBadge(days) {
  if (days == null) return ''
  if (days < 0) return `<span class="kk-badge kk-badge--danger">${Math.abs(days)}d overdue</span>`
  if (days === 0) return `<span class="kk-badge kk-badge--warning">Due today</span>`
  if (days <= 21) return `<span class="kk-badge kk-badge--warning">Due in ${days}d</span>`
  return `<span class="kk-badge kk-badge--soft">Due in ${days}d</span>`
}

let state = load()
let tab = 'alerts'
let selectedId = state.horses[0]?.id || null
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

function dueAlerts() {
  return state.records
    .filter((r) => r.due)
    .map((r) => ({ ...r, days: daysUntil(r.due), horse: state.horses.find((h) => h.id === r.horseId) }))
    .filter((r) => r.horse)
    .sort((a, b) => a.days - b.days)
}

function horseRecords(horseId) {
  return state.records
    .filter((r) => r.horseId === horseId)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
}

function render() {
  const horse = state.horses.find((h) => h.id === selectedId) || null
  const alerts = dueAlerts()
  const urgent = alerts.filter((a) => a.days <= 21)

  app.innerHTML = `
    <div class="kk-root app-shell">
      <header class="app-top">
        <div class="app-brand">
          <img src="/brand/klipklop-logo.png" alt="" />
          <div>
            <h1>Horse Health</h1>
            <p>Care · vaccines · due dates</p>
          </div>
        </div>
        <div class="kk-row">
          <a class="kk-btn kk-btn--sm kk-btn--secondary" href="${HUB}">Hub</a>
          <a class="kk-btn kk-btn--sm kk-btn--ghost" href="${RIDER}">Rider</a>
        </div>
      </header>

      <div class="kk-page-header">
        <div>
          <h1 class="kk-page-header__title">Yard tracker</h1>
          <p class="kk-page-header__desc">
            Log care per horse and catch what’s due. Billing for this product sits in Rider — not here.
          </p>
        </div>
        <div class="kk-page-header__actions">
          ${urgent.length ? `<span class="kk-badge kk-badge--warning">${urgent.length} due soon</span>` : `<span class="kk-badge kk-badge--success">All clear</span>`}
        </div>
      </div>

      <div class="kk-tabs tabs-bar" role="tablist">
        ${tabBtn('alerts', 'Due')}
        ${tabBtn('horses', 'Horses')}
        ${tabBtn('detail', 'Care log')}
      </div>

      <section class="panel ${tab === 'alerts' ? 'is-active' : ''}">
        <p class="section-lead">Anything with a due date — overdue first, then upcoming.</p>
        ${
          alerts.length === 0
            ? `<div class="kk-empty"><h3 class="kk-empty__title">No due dates yet</h3><p class="kk-empty__desc">Add care records with a next-due date on a horse.</p></div>`
            : `<div class="alert-list">
              ${alerts
                .map(
                  (a) => `
                <div class="alert-item ${alertClass(a.days)}">
                  <div>
                    <strong>${escapeHtml(a.horse.name)}</strong> · ${escapeHtml(a.type)}
                    <div class="kk-hint">${escapeHtml(a.title)} · due ${escapeHtml(a.due)}</div>
                  </div>
                  <div class="kk-row">
                    ${alertBadge(a.days)}
                    <button type="button" class="kk-btn kk-btn--sm kk-btn--secondary" data-open-horse="${a.horseId}">Open</button>
                  </div>
                </div>`,
                )
                .join('')}
            </div>`
        }
      </section>

      <section class="panel ${tab === 'horses' ? 'is-active' : ''}">
        <p class="section-lead">Your horses. Open one to add vaccines, vet visits, farrier, and notes.</p>
        <div class="horse-grid" style="margin-bottom:1rem">
          ${state.horses
            .map(
              (h) => `
            <button type="button" class="horse-card ${h.id === selectedId ? 'is-active' : ''}" data-open-horse="${h.id}">
              <h3>${escapeHtml(h.name)}</h3>
              <p>${escapeHtml([h.breed, h.sex, h.yob].filter(Boolean).join(' · '))}</p>
              <p>${horseRecords(h.id).length} care records</p>
            </button>`,
            )
            .join('')}
        </div>

        <form class="kk-card" id="add-horse-form">
          <div class="kk-card__header">
            <h3 class="kk-card__title">Add horse</h3>
            <p class="kk-card__desc">Demo data stays in this browser.</p>
          </div>
          <div class="kk-card__content form-grid">
            <label class="kk-field"><span class="kk-label">Name</span><input class="kk-input" name="name" required placeholder="e.g. Storm" /></label>
            <label class="kk-field"><span class="kk-label">Breed</span><input class="kk-input" name="breed" placeholder="QH" /></label>
            <label class="kk-field">
              <span class="kk-label">Sex</span>
              <select class="kk-select" name="sex">
                <option>Gelding</option><option>Mare</option><option>Stallion</option><option>Filly</option><option>Colt</option>
              </select>
            </label>
            <label class="kk-field"><span class="kk-label">Year of birth</span><input class="kk-input" name="yob" placeholder="2018" /></label>
            <label class="kk-field span-2"><span class="kk-label">Notes</span><textarea class="kk-textarea" name="notes" rows="2"></textarea></label>
          </div>
          <div class="kk-card__footer">
            <button type="submit" class="kk-btn kk-btn--primary">Add horse</button>
          </div>
        </form>
      </section>

      <section class="panel ${tab === 'detail' ? 'is-active' : ''}">
        ${
          !horse
            ? `<div class="kk-empty"><h3 class="kk-empty__title">Pick a horse</h3><p class="kk-empty__desc">Add or select a horse first.</p>
               <button type="button" class="kk-btn kk-btn--secondary" data-goto="horses">Horses</button></div>`
            : `
          <div class="detail-head">
            <div>
              <h2>${escapeHtml(horse.name)}</h2>
              <p>${escapeHtml([horse.breed, horse.sex, horse.yob].filter(Boolean).join(' · '))}${horse.notes ? ` · ${escapeHtml(horse.notes)}` : ''}</p>
            </div>
            <button type="button" class="kk-btn kk-btn--sm kk-btn--danger" id="remove-horse">Remove</button>
          </div>

          <form class="kk-card" id="add-record-form" style="margin-bottom:1rem">
            <div class="kk-card__header">
              <h3 class="kk-card__title">Log care</h3>
              <p class="kk-card__desc">Vaccines, vet, farrier, meds — set a next due when it matters.</p>
            </div>
            <div class="kk-card__content form-grid">
              <label class="kk-field">
                <span class="kk-label">Type</span>
                <select class="kk-select" name="type">${CARE_TYPES.map((t) => `<option>${t}</option>`).join('')}</select>
              </label>
              <label class="kk-field"><span class="kk-label">Title</span><input class="kk-input" name="title" required placeholder="e.g. AHS booster" /></label>
              <label class="kk-field"><span class="kk-label">Date</span><input class="kk-input" type="date" name="date" required /></label>
              <label class="kk-field"><span class="kk-label">Next due</span><input class="kk-input" type="date" name="due" /><span class="kk-hint">Optional</span></label>
              <label class="kk-field span-2"><span class="kk-label">Notes</span><textarea class="kk-textarea" name="notes" rows="2"></textarea></label>
            </div>
            <div class="kk-card__footer">
              <button type="submit" class="kk-btn kk-btn--primary">Save record</button>
            </div>
          </form>

          <div class="kk-table-wrap">
            <table class="kk-table">
              <thead>
                <tr><th>Date</th><th>Type</th><th>Title</th><th>Next due</th><th></th></tr>
              </thead>
              <tbody>
                ${
                  horseRecords(horse.id).length === 0
                    ? `<tr><td colspan="5">No records yet.</td></tr>`
                    : horseRecords(horse.id)
                        .map((r) => {
                          const d = daysUntil(r.due)
                          return `<tr>
                            <td>${escapeHtml(r.date)}</td>
                            <td>${escapeHtml(r.type)}</td>
                            <td>${escapeHtml(r.title)}${r.notes ? `<div class="kk-hint">${escapeHtml(r.notes)}</div>` : ''}</td>
                            <td>${r.due ? `${escapeHtml(r.due)} ${alertBadge(d)}` : '—'}</td>
                            <td><button type="button" class="kk-btn kk-btn--sm kk-btn--ghost" data-del-record="${r.id}">Delete</button></td>
                          </tr>`
                        })
                        .join('')
                }
              </tbody>
            </table>
          </div>`
        }
      </section>
    </div>
  `

  const dateInput = app.querySelector('#add-record-form [name=date]')
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().slice(0, 10)
  }

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

  document.querySelectorAll('[data-goto]').forEach((btn) => {
    btn.addEventListener('click', () => {
      tab = btn.dataset.goto
      render()
    })
  })

  document.querySelectorAll('[data-open-horse]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedId = btn.dataset.openHorse
      tab = 'detail'
      render()
    })
  })

  document.getElementById('add-horse-form')?.addEventListener('submit', (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const horse = {
      id: uid('h'),
      name: String(fd.get('name') || '').trim(),
      breed: String(fd.get('breed') || '').trim(),
      sex: String(fd.get('sex') || ''),
      yob: String(fd.get('yob') || '').trim(),
      notes: String(fd.get('notes') || ''),
    }
    state.horses.push(horse)
    selectedId = horse.id
    save(state)
    toast(`${horse.name} added`)
    tab = 'detail'
    render()
  })

  document.getElementById('add-record-form')?.addEventListener('submit', (e) => {
    e.preventDefault()
    if (!selectedId) return
    const fd = new FormData(e.target)
    state.records.push({
      id: uid('r'),
      horseId: selectedId,
      type: String(fd.get('type') || ''),
      title: String(fd.get('title') || '').trim(),
      date: String(fd.get('date') || ''),
      due: String(fd.get('due') || ''),
      notes: String(fd.get('notes') || ''),
    })
    save(state)
    toast('Care logged')
    render()
  })

  document.querySelectorAll('[data-del-record]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.records = state.records.filter((r) => r.id !== btn.dataset.delRecord)
      save(state)
      toast('Record removed')
      render()
    })
  })

  document.getElementById('remove-horse')?.addEventListener('click', () => {
    if (!selectedId) return
    const name = state.horses.find((h) => h.id === selectedId)?.name || 'Horse'
    state.records = state.records.filter((r) => r.horseId !== selectedId)
    state.horses = state.horses.filter((h) => h.id !== selectedId)
    selectedId = state.horses[0]?.id || null
    save(state)
    toast(`${name} removed`)
    tab = 'horses'
    render()
  })
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

render()
