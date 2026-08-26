import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import App from './App.jsx'
import './index.css'
import './lib/pwaInstall'

if ('serviceWorker' in navigator) {
  // When a new service worker takes control, the page that triggered the
  // update is often still running on the old one (its own fetches can race
  // ahead of the new worker claiming control) — reload once so the app is
  // fully served by the new worker instead of leaving stale data in place
  // until the user happens to reload again on their own.
  let reloadedForUpdate = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadedForUpdate) return
    reloadedForUpdate = true
    window.location.reload()
  })
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)
