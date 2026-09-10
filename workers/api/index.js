import { handleApi } from './routes.js'

export default {
  async fetch(request, env) {
    return handleApi(request, env)
  },
}
