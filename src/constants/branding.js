/** App display name and logo served from /public/brand/ */
export const APP_NAME = 'KlipKlop'
export const APP_LOGO_SRC = '/brand/klipklop-logo.png'
export const APP_TAGLINE = 'Western Mounted Games Hub'
export const APP_TAGLINE_SIDEBAR = 'Western Mounted Games'

export function isDevWorkerHost(hostname = typeof window === 'undefined' ? '' : window.location.hostname) {
  return hostname.endsWith('.workers.dev')
}

export function withHostTitle(title = APP_NAME) {
  return isDevWorkerHost() ? `[Dev] ${title}` : title
}
