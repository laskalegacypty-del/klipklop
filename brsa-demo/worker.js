// SPA + /api/rules/chat for Barry. Uses the Workers AI binding (no CF_API_TOKEN).

const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
const FALLBACK_MODEL = '@cf/meta/llama-3.1-8b-instruct'
const MAX_CONTEXT_CHARS = 16000

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(data, status = 200) {
  return Response.json(data, { status, headers: CORS })
}

async function runModel(env, model, messages) {
  return env.AI.run(model, {
    messages,
    temperature: 0.2,
    max_tokens: 1200,
  })
}

async function handleChat(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }
  if (!env.AI) {
    return json({ error: 'Workers AI is not bound', response: '', fallback: true }, 500)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const query = String(body.query || '').trim()
  const context = String(body.context || '').slice(0, MAX_CONTEXT_CHARS)
  const systemPrompt = String(body.systemPrompt || 'You are a helpful assistant.')
  const history = Array.isArray(body.history) ? body.history : []
  const requestedModel = String(body.model || '').trim() || DEFAULT_MODEL

  if (!query) return json({ error: 'query is required' }, 400)

  const userContent = context ? `${context}\n\nQuestion: ${query}` : query
  const priorTurns = history.slice(-10).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 2000),
  }))
  const messages = [
    { role: 'system', content: systemPrompt },
    ...priorTurns,
    { role: 'user', content: userContent },
  ]

  try {
    let result
    try {
      result = await runModel(env, requestedModel, messages)
    } catch {
      result = await runModel(env, FALLBACK_MODEL, messages)
    }
    const response = String(result?.response || '').trim()
    if (!response) {
      return json({ response: '', used_ai: false, fallback: true })
    }
    return json({ response, used_ai: true, fallback: false })
  } catch (err) {
    return json({
      response: '',
      used_ai: false,
      fallback: true,
      error: err?.message || 'Workers AI error',
    })
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/api/rules/chat' || url.pathname === '/api/health') {
      if (url.pathname === '/api/health') {
        return json({ ok: true, service: 'brsa-demo', barry: true })
      }
      return handleChat(request, env)
    }
    return env.ASSETS.fetch(request)
  },
}
