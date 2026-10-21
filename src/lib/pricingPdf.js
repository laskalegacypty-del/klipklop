import { ROLES, HOW_IT_WORKS, MONTHS_FREE_ANNUAL, SALES_EMAIL } from '../constants/pricing.js'
import { annualFee, formatRand } from './pricingCalc.js'

const GREEN = [21, 128, 61]
const DARK = [17, 24, 39]
const GREY = [75, 85, 99]
const LIGHT = [240, 253, 244]

async function loadLogo(src) {
  try {
    const blob = await (await fetch(src)).blob()
    return await new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result)
      r.onerror = reject
      r.readAsDataURL(blob)
    })
  } catch { return null }
}

/**
 * Builds and downloads the client's pricing estimate as a formatted PDF.
 * jsPDF is loaded on demand so it is not in the main bundle.
 */
export async function downloadPricingPdf({ association, counts, tier, mine, next, nextCost, prices, priceChanged, logoSrc }) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210, M = 16, CW = W - M * 2
  let y = 0

  const text = (s, x, yy, opts = {}) => {
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal')
    doc.setFontSize(opts.size || 10)
    doc.setTextColor(...(opts.color || DARK))
    doc.text(String(s), x, yy, { align: opts.align || 'left' })
  }
  const para = (s, x, width, opts = {}) => {
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal')
    doc.setFontSize(opts.size || 10)
    const lines = doc.splitTextToSize(s, width)
    doc.setTextColor(...(opts.color || GREY))
    doc.text(lines, x, y)
    y += lines.length * ((opts.size || 10) * 0.45) + 1
  }
  const ensure = need => { if (y + need > 275) { doc.addPage(); y = M } }
  const heading = s => { ensure(14); y += 4; text(s, M, y, { bold: true, size: 13, color: GREEN }); y += 6 }

  // Header band
  doc.setFillColor(...GREEN)
  doc.rect(0, 0, W, 34, 'F')
  const logo = await loadLogo(logoSrc)
  if (logo) { try { doc.addImage(logo, 'PNG', M, 7, 20, 20) } catch { /* logo is optional */ } }
  text('KlipKlop seat pricing', logo ? M + 25 : M, 16, { bold: true, size: 18, color: [255, 255, 255] })
  text('Estimate for ' + association, logo ? M + 25 : M, 24, { size: 11, color: [220, 252, 231] })
  text(new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }), W - M, 24, { size: 10, color: [220, 252, 231], align: 'right' })
  y = 46

  // Your tier
  text('Your tier', M, y, { size: 10, color: GREY }); y += 8
  text(tier.name, M, y, { bold: true, size: 26 }); y += 4
  doc.setFillColor(...LIGHT)
  doc.roundedRect(M, y, CW, 30, 3, 3, 'F')
  text('Total per month', M + 6, y + 8, { size: 10, color: GREY })
  text(formatRand(mine.totalMonthly), M + 6, y + 21, { bold: true, size: 24, color: GREEN })
  text('Tier fee ' + formatRand(mine.tierFee), W - M - 6, y + 12, { size: 10, align: 'right' })
  text('Extra seats ' + formatRand(mine.extraTotal), W - M - 6, y + 18, { size: 10, align: 'right' })
  text('Annual prepay: ' + formatRand(mine.totalAnnualPrepay) + ' per year', W - M - 6, y + 24, { size: 10, align: 'right', bold: true })
  y += 38
  para(`Annual prepay covers your tier fee (${formatRand(annualFee(tier, prices))} for 12 months, ${MONTHS_FREE_ANNUAL} months free). Extra seats stay on monthly billing, shown above as 12 months.`, M, CW, { size: 9 })

  // Seats table
  heading('Seats in your tier')
  const cols = [M, M + 52, M + 88, M + 118, W - M]
  doc.setFillColor(243, 244, 246)
  doc.rect(M, y - 5, CW, 8, 'F')
  ;['Role', 'You told us', 'Included', 'Extra'].forEach((h, i) => text(h, cols[i] + (i ? 0 : 2), y, { bold: true, size: 9, color: GREY }))
  text('Extra cost / month', cols[4] - 2, y, { bold: true, size: 9, color: GREY, align: 'right' })
  y += 8
  ROLES.forEach(r => {
    text(r.label, cols[0] + 2, y, { bold: true, size: 10 })
    text(counts[r.key], cols[1], y)
    text(tier.seats[r.key], cols[2], y)
    text(mine.extras[r.key], cols[3], y, { bold: mine.extras[r.key] > 0, color: mine.extras[r.key] > 0 ? [180, 83, 9] : DARK })
    text(formatRand(mine.extraCost[r.key]), cols[4] - 2, y, { align: 'right' })
    doc.setDrawColor(229, 231, 235); doc.line(M, y + 2.5, W - M, y + 2.5)
    y += 8
  })
  if (priceChanged) { para('Based on the per-seat prices you proposed. A proposal is a request, not a binding agreement.', M, CW, { size: 9 }) }

  // Next tier
  if (next && nextCost) {
    heading('If you moved up: ' + next.name)
    const diff = mine.totalMonthly - nextCost.totalMonthly
    para(`${next.name} costs ${formatRand(nextCost.totalMonthly)} per month for your seats (${formatRand(nextCost.tierFee)} tier fee + ${formatRand(nextCost.extraTotal)} extra seats), or ${formatRand(nextCost.totalAnnualPrepay)} per year with annual prepay.`, M, CW)
    if (diff > 0) para(`That would save you ${formatRand(diff)} per month (${formatRand(diff * 12)} per year).`, M, CW, { bold: true, color: GREEN })
    else if (diff === 0) para('That is the same monthly cost as your current tier.', M, CW, { bold: true, color: GREEN })
    else para(`That is ${formatRand(-diff)} more per month than ${tier.name}, but it includes more seats and room to grow.`, M, CW, { bold: true, color: DARK })
  }

  // How it works
  heading('How it works')
  HOW_IT_WORKS.forEach((s, i) => {
    ensure(18)
    text(String(i + 1), M + 2, y, { bold: true, size: 10, color: GREEN })
    text(s.title, M + 9, y, { bold: true, size: 10 })
    y += 5
    para(s.text, M + 9, CW - 9, { size: 9.5 })
    y += 1.5
  })

  // Footer on every page
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setDrawColor(229, 231, 235); doc.line(M, 281, W - M, 281)
    doc.setFontSize(8); doc.setTextColor(...GREY); doc.setFont('helvetica', 'normal')
    doc.text('Figures are indicative. The final price is set in the signed Order Form under the Platform Services Agreement.', M, 286)
    doc.text(SALES_EMAIL, M, 290)
    doc.text(`Page ${p} of ${pages}`, W - M, 290, { align: 'right' })
  }

  const safe = association.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'estimate'
  doc.save(`KlipKlop-pricing-${safe}.pdf`)
}
