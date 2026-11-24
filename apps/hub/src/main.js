import './style.css'

const DIVISIONS = [
  {
    id: 'rider',
    name: 'Rider',
    blurb: 'Your central account — details, subscriptions, payments.',
    href: 'https://klipklop-rider.klipklop.workers.dev',
    status: 'open',
    cta: 'Open Rider',
  },
  {
    id: 'horse-health',
    name: 'Horse Health',
    blurb: 'Yard care tracker — vaccines, vet, farrier, due alerts.',
    href: 'https://klipklop-horse-health.klipklop.workers.dev',
    status: 'open',
    cta: 'Open Horse Health',
  },
  {
    id: 'sawmga',
    name: 'SAWMGA',
    blurb: 'Western Mounted Games — matrix, qualifiers, Nationals, Klippies.',
    href: 'https://klipklop-sawmga.klipklop.workers.dev',
    status: 'open',
    cta: 'Open SAWMGA',
  },
  {
    id: 'brsa',
    name: 'BRSA',
    blurb: 'Barrel Racing South Africa — events, wallet, standings, Barry.',
    href: 'https://brsa-demo.klipklop.co.za',
    status: 'open',
    cta: 'Open BRSA',
  },
  {
    id: 'endurance',
    name: 'Endurance',
    blurb: 'Endurance riders — slot reserved. Not live yet.',
    href: null,
    status: 'soon',
    cta: 'Coming soon',
  },
]

const app = document.getElementById('app')

app.innerHTML = `
  <div class="scene kk-root">
    <div class="grain" aria-hidden="true"></div>
    <div class="shell">
      <p class="kk-badge kk-badge--soft reveal" style="--d:0">Western sports hub</p>
      <div class="brand-row reveal" style="--d:1">
        <img src="/brand/klipklop-logo.png" alt="" width="56" height="56" />
        <h1>KlipKlop</h1>
      </div>
      <p class="lede reveal" style="--d:2">
        One home for Rider account &amp; Horse Health, plus each association’s own tools and rules.
      </p>

      <nav class="divisions reveal" style="--d:3" aria-label="Divisions">
        ${DIVISIONS.map((d) =>
          d.href
            ? `<a class="division" href="${d.href}" data-id="${d.id}">
                <span class="division-name">${d.name}</span>
                <span class="division-blurb">${d.blurb}</span>
                <span class="division-cta">${d.cta} →</span>
              </a>`
            : `<div class="division is-soon" data-id="${d.id}" aria-disabled="true">
                <span class="division-name">${d.name}</span>
                <span class="division-blurb">${d.blurb}</span>
                <span class="division-cta">${d.cta}</span>
              </div>`,
        ).join('')}
      </nav>

      <p class="foot reveal" style="--d:4">Preview on workers.dev · apex still on Vercel</p>
    </div>
  </div>
`

requestAnimationFrame(() => {
  document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'))
})
