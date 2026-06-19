import { randomBytes } from 'node:crypto'

export function generateShareToken() {
  return randomBytes(24)
    .toString('base64url')
}

export function buildShareUrl(origin, token) {
  const base = String(origin || '').replace(/\/$/, '')
  return `${base}/share/${token}`
}

export function buildShareMessage({ horseName, url }) {
  const name = horseName || 'this horse'
  return `Check out ${name}'s Western Mounted Games times on KlipKlop:\n${url}`
}

export function buildShareTitle({ horseName }) {
  const name = horseName || 'Horse'
  return `${name}'s times — KlipKlop`
}
