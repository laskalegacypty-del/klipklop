const CACHE_NAME = 'klipklop-v1'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon.svg'
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => Promise.allSettled(
      STATIC_ASSETS.map(asset => cache.add(asset))
    ))
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    })
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  // Network first for API calls
  if (event.request.url.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request)
      })
    )
    return
  }

  // Cache first for static assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        const clone = response.clone()
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, clone)
        })
        return response
      })
    })
  )
})