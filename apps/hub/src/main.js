import './style.css'

const DIVISIONS = [
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
  <div class="scene">
    <div class="glow glow-a" aria-hidden="true"></div>
    <div class="glow glow-b" aria-hidden="true"></div>
    <div class="grain" aria-hidden="true"></div>

    <main class="hero">
      <p class="eyebrow reveal" style="--d:0">Western sports hub</p>
      <div class="brand reveal" style="--d:1">
        <img class="mark" src="/brand/klipklop-logo.png" alt="" width="72" height="72" />
        <h1>KlipKlop</h1>
      </div>
      <p class="lede reveal" style="--d:2">
        One home. Pick your division — each sport keeps its own tools, rules, and rhythm.
      </p>

      <nav class="divisions reveal" style="--d:3" aria-label="Divisions">
        ${DIVISIONS.map(
          (d) => `
          ${
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
                </div>`
          }
        `,
        ).join('')}
      </nav>
    </main>

    <footer class="foot reveal" style="--d:4">
      <span>Preview on workers.dev · apex still on Vercel</span>
    </footer>
  </div>
`

requestAnimationFrame(() => {
  document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'))
})
