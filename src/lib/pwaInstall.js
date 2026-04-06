/**
 * Captures `beforeinstallprompt` as soon as this module loads, before React mounts.
 * Otherwise Chrome may fire the event before Layout/Profile listeners attach.
 */

const READY = 'klipklop:pwa-install-prompt'
const INSTALLED = 'klipklop:pwa-installed'

let deferredPwaInstallPrompt = null

export function getDeferredPwaInstallPrompt() {
  return deferredPwaInstallPrompt
}

export function clearDeferredPwaInstallPrompt() {
  deferredPwaInstallPrompt = null
}

export function isPwaStandaloneDisplay() {
  if (typeof window === 'undefined') return false
  const mqStandalone = window.matchMedia('(display-mode: standalone)').matches
  const mqWco = window.matchMedia('(display-mode: window-controls-overlay)').matches
  const iosStandalone = window.navigator.standalone === true
  return mqStandalone || mqWco || iosStandalone
}

if (typeof window !== 'undefined' && !window.__klipklopPwaInstallListeners) {
  window.__klipklopPwaInstallListeners = true
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPwaInstallPrompt = e
    window.dispatchEvent(new CustomEvent(READY))
  })
  window.addEventListener('appinstalled', () => {
    deferredPwaInstallPrompt = null
    window.dispatchEvent(new CustomEvent(INSTALLED))
  })
}

export const PWA_INSTALL_PROMPT_EVENT = READY
export const PWA_APP_INSTALLED_EVENT = INSTALLED
