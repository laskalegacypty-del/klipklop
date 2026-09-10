// SPA host Worker. Static assets come from dist/; /api/* is forwarded
// to the utilities Worker (klipklop-api) over a service binding.

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) {
      return env.API.fetch(request)
    }
    return env.ASSETS.fetch(request)
  },
}
