import { getD1, newId, nowIso } from '../_lib/d1.js'
import { readJsonBody, sendJson } from '../_lib/http.js'
import { sendResend } from '../email/handlers.js'
import { getFloors } from './floors.server.js'
import { ROLES, SEAT_PRICES, TIERS, LIMITS, SALES_EMAIL } from '../../src/constants/pricing.js'
import {
  sanitiseCounts,
  sanitisePrices,
  costForTier,
  annualFee,
  formatRand,
} from '../../src/lib/pricingCalc.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RATE_LIMIT_PER_HOUR = 3

// The client only ever sees this, whatever the floor check decided.
const RECEIVED = { ok: true, message: 'Received. We will respond with a final quote.' }

function text(v, max = LIMITS.maxFieldLength) {
  return String(v ?? '').trim().slice(0, max)
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function clientIp(req) {
  const h = req.headers || {}
  const fwd = String(h['cf-connecting-ip'] || h['x-forwarded-for'] || '').split(',')[0].trim()
  return fwd || 'unknown'
}

async function hashIp(ip) {
  const data = new TextEncoder().encode(`${process.env.PRICING_IP_SALT || 'klipklop'}:${ip}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function priceRows(prices) {
  return ROLES.map(r => `<tr><td style="padding:4px 12px 4px 0">${r.singular}</td><td>${formatRand(SEAT_PRICES[r.key])} list</td><td style="padding-left:12px"><b>${prices[r.key] === SEAT_PRICES[r.key] ? 'unchanged' : `R${prices[r.key]}`}</b></td></tr>`).join('')
}

// Creates the table on first use so no separate D1 migration run is needed.
// Mirrors migrations/d1/0002_pricing_proposals.sql; safe to run repeatedly.
let tableReady = null
function ensureTable(db) {
  if (!tableReady) {
    tableReady = db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS pricing_proposals (
        id TEXT PRIMARY KEY, association TEXT NOT NULL, contact_name TEXT NOT NULL, email TEXT NOT NULL,
        phone TEXT NOT NULL, note TEXT, selected_tier TEXT NOT NULL, counts TEXT NOT NULL,
        proposed_prices TEXT NOT NULL, list_prices TEXT NOT NULL, totals TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'within range', 'needs review')),
        ip_hash TEXT, created_at TEXT NOT NULL)`),
      db.prepare('CREATE INDEX IF NOT EXISTS pricing_proposals_ip_idx ON pricing_proposals (ip_hash, created_at)'),
      db.prepare('CREATE INDEX IF NOT EXISTS pricing_proposals_email_idx ON pricing_proposals (email, created_at)'),
    ]).catch(err => { tableReady = null; throw err })
  }
  return tableReady
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return }
  if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed' }); return }

  const body = await readJsonBody(req)

  // Honeypot: bots fill the hidden field. Pretend success, store nothing.
  if (text(body.website)) { sendJson(res, 200, RECEIVED); return }

  const association = text(body.association)
  const contactName = text(body.contactName)
  const email = text(body.email).toLowerCase()
  const phone = text(body.phone, 50)
  const note = text(body.note, LIMITS.maxNoteLength)
  const tierName = text(body.selectedTier, 50)

  if (!association || !contactName || !email || !phone) {
    sendJson(res, 400, { error: 'Please fill in your association, name, email and phone number.' }); return
  }
  if (!EMAIL_RE.test(email)) { sendJson(res, 400, { error: 'Please enter a valid email address.' }); return }

  const counts = sanitiseCounts(body.counts)
  const prices = sanitisePrices(body.prices)
  const tier = TIERS.find(t => t.name === tierName)
  if (!counts || !prices || !tier) {
    sendJson(res, 400, { error: 'Those numbers do not look right. Please check the seat counts and prices.' }); return
  }

  // Proposals live in Cloudflare D1 (binding DB on the klipklop-api Worker).
  const db = getD1()
  if (!db) { sendJson(res, 503, { error: 'Proposals are not available right now.' }); return }

  const ipHash = await hashIp(clientIp(req))
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  try {
    await ensureTable(db)
    const byIp = await db.prepare('SELECT COUNT(*) AS n FROM pricing_proposals WHERE ip_hash = ? AND created_at >= ?').bind(ipHash, since).first()
    const byEmail = await db.prepare('SELECT COUNT(*) AS n FROM pricing_proposals WHERE lower(email) = ? AND created_at >= ?').bind(email, since).first()
    if ((byIp?.n || 0) >= RATE_LIMIT_PER_HOUR || (byEmail?.n || 0) >= RATE_LIMIT_PER_HOUR) {
      sendJson(res, 429, { error: 'Too many proposals. Please try again later.' }); return
    }
  } catch (err) {
    console.error('pricing proposal rate-limit check failed', err?.message || err)
    sendJson(res, 500, { error: 'Could not save your proposal, please try again.' }); return
  }

  // Totals are always recomputed here; client-sent totals are ignored.
  const listCost = costForTier(tier, counts, SEAT_PRICES)
  const propCost = costForTier(tier, counts, prices)
  const totals = {
    list: { monthly: listCost.totalMonthly, annual: listCost.totalAnnualPrepay },
    proposed: { monthly: propCost.totalMonthly, annual: propCost.totalAnnualPrepay, tierFee: propCost.tierFee, annualTierFee: annualFee(tier, prices) },
  }

  const row = { id: newId() }
  try {
    await db.prepare(
      `INSERT INTO pricing_proposals
        (id, association, contact_name, email, phone, note, selected_tier, counts, proposed_prices, list_prices, totals, status, ip_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    ).bind(
      row.id, association, contactName, email, phone, note || null, tier.name,
      JSON.stringify(counts), JSON.stringify(prices), JSON.stringify(SEAT_PRICES), JSON.stringify(totals),
      ipHash, nowIso(),
    ).run()
  } catch (err) {
    console.error('pricing proposal insert failed', err?.message || err)
    sendJson(res, 500, { error: 'Could not save your proposal, please try again.' }); return
  }

  // Floors never leave the server. Only staff see this status.
  const floors = getFloors()
  const withinRange = ROLES.every(r => prices[r.key] >= floors[r.key])
  const status = withinRange ? 'within range' : 'needs review'
  try {
    await db.prepare('UPDATE pricing_proposals SET status = ? WHERE id = ?').bind(status, row.id).run()
  } catch (err) {
    console.error('pricing proposal status update failed', err?.message || err)
  }

  // Emails are best effort: the proposal is already saved.
  const notifyTo = process.env.PRICING_NOTIFY_EMAIL || SALES_EMAIL
  const summary = `
    <table style="font-size:14px;color:#374151">${priceRows(prices)}</table>
    <p style="font-size:14px;color:#374151">Tier: <b>${esc(tier.name)}</b><br>
    Proposed: <b>${formatRand(totals.proposed.monthly)}/month</b> (${formatRand(totals.proposed.annual)}/year with annual prepay)<br>
    List: ${formatRand(totals.list.monthly)}/month (${formatRand(totals.list.annual)}/year)</p>`
  try {
    await sendResend({
      to: notifyTo,
      subject: `Pricing proposal from ${association} (${status})`,
      html: `<div style="font-family:sans-serif;max-width:560px">
        <h2>New pricing proposal: ${esc(status)}</h2>
        <p><b>${esc(association)}</b><br>${esc(contactName)} · ${esc(email)} · ${esc(phone)}</p>
        <p style="font-size:14px">Seats: ${ROLES.map(r => `${counts[r.key]} ${r.label.toLowerCase()}`).join(', ')}</p>
        ${summary}
        ${note ? `<p style="font-size:14px;white-space:pre-wrap"><b>Note:</b> ${esc(note)}</p>` : ''}
        <p style="font-size:12px;color:#6b7280">Proposal ${row.id}</p></div>`,
    })
    await sendResend({
      to: email,
      subject: 'We received your KlipKlop pricing proposal',
      html: `<div style="font-family:sans-serif;max-width:520px">
        <h2>Thanks, ${esc(contactName)}</h2>
        <p style="font-size:15px;color:#374151;line-height:1.6">We received your pricing proposal for ${esc(association)} and will respond with a final quote. A proposal is a request, not a binding agreement. The final price is set in the signed Order Form under the Platform Services Agreement.</p>
        <p style="font-size:13px;color:#6b7280">What you sent:</p>${summary}</div>`,
    })
  } catch (err) {
    console.error('pricing proposal email failed', err?.message || err)
  }

  sendJson(res, 200, RECEIVED)
}
