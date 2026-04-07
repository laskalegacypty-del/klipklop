const CACHE_NAME = 'klipklop-v3'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/brand/klipklop-logo.png',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(STATIC_ASSETS.map(asset => cache.add(asset)))
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

function isSupabase(url) {
  return url.includes('supabase.co')
}

function isServiceWorkerScript(url) {
  try {
    const u = new URL(url)
    return u.pathname === '/sw.js'
  } catch {
    return false
  }
}

self.addEventListener('fetch', event => {
  const { request } = event
  const url = request.url

  if (request.method !== 'GET') return

  // Always fetch latest SW so updates can ship
  if (isServiceWorkerScript(url)) {
    event.respondWith(fetch(request))
    return
  }

  if (isSupabase(url)) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    )
    return
  }

  // HTML / navigations: network first so new deploys show up
  const isNavigation =
    request.mode === 'navigate' || request.destination === 'document'

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone()
          if (response.ok) {
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
          }
          return response
        })
        .catch(() => caches.match(request).then(c => c || caches.match('/index.html')))
    )
    return
  }

  // JS/CSS and other assets: stale-while-revalidate
  event.respondWith(
    caches.match(request).then(cached => {
      const networkFetch = fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
          }
          return response
        })
        .catch(() => cached)

      if (cached) {
        event.waitUntil(networkFetch)
        return cached
      }
      return networkFetch
    })
  )
})
