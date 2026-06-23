// Vercel serverless proxy for Cloudflare Workers AI.
// Keeps the Cloudflare API token server-side (never shipped to the browser).
// Env vars required (set in Vercel project settings and local .env):
//   CF_ACCOUNT_ID   - Cloudflare account id
//   CF_API_TOKEN    - Cloudflare API token with Workers AI permission
//   CF_MODEL        - optional, defaults to @cf/meta/llama-3.3-70b-instruct-fp8-fast

const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
const MAX_CONTEXT_CHARS = 16000

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string' && req.body) {
    try { return JSON.parse(req.body) } catch { return {} }
  }
  return await new Promise(resolve => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}) } catch { resolve({}) }
    })
    req.on('error', () => resolve({}))
  })
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const accountId = process.env.CF_ACCOUNT_ID
  const apiToken = process.env.CF_API_TOKEN
  const model = process.env.CF_MODEL || DEFAULT_MODEL

  if (!accountId || !apiToken) {
    res.status(500).json({
      error: 'Server is not configured',
      response: '',
      fallback: true,
    })
    return
  }

  const body = await readJsonBody(req)
  const query = String(body.query || '').trim()
  const context = String(body.context || '').slice(0, MAX_CONTEXT_CHARS)
  const systemPrompt = String(body.systemPrompt || 'You are a helpful assistant.')
  const history = Array.isArray(body.history) ? body.history : []

  if (!query) {
    res.status(400).json({ error: 'query is required' })
    return
  }

  const userContent = context
    ? `${context}\n\nQuestion: ${query}`
    : query

  const priorTurns = history.slice(-10).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 2000),
  }))

  try {
    const cfRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            ...priorTurns,
            { role: 'user', content: userContent },
          ],
          temperature: 0.2,
          max_tokens: 1200,
        }),
      }
    )

    const data = await cfRes.json().catch(() => ({}))

    if (!cfRes.ok || data.success === false) {
      const message = data?.errors?.[0]?.message || `Workers AI returned ${cfRes.status}`
      res.status(200).json({ response: '', used_ai: false, fallback: true, error: message })
      return
    }

    const response = (data?.result?.response || '').trim()
    res.status(200).json({ response, used_ai: true, fallback: false })
  } catch (error) {
    res.status(200).json({
      response: '',
      used_ai: false,
      fallback: true,
      error: error?.message || 'Unknown error calling Workers AI',
    })
  }
}
