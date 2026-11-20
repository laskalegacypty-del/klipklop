// Hub portal Worker — static assets only (no /api).

export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request)
  },
}
