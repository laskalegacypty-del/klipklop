import { getUserFromFetch } from '../_lib/supabaseAdmin.js'
import { UPLOAD_BUCKETS } from '../_lib/catalog.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Id',
}

const ALLOWED = new Set(UPLOAD_BUCKETS)
const MAX_BYTES = {
  avatars: 2 * 1024 * 1024,
  'horse-photos': 2 * 1024 * 1024,
  videos: 100 * 1024 * 1024,
}

function json(data, status = 200) {
  return Response.json(data, { status, headers: CORS })
}

function mediaKey(bucket, path) {
  const clean = String(path || '').replace(/^\/+/, '').replace(/\.\./g, '')
  return `${bucket}/${clean}`
}

export async function handleMedia(request, env) {
  const url = new URL(request.url)
  const media = url.pathname.match(/^\/api\/media\/(avatars|horse-photos|videos)\/(.+)$/)
  if (media && request.method === 'GET') {
    if (!env.MEDIA) {
      return json({ error: 'R2 is not enabled on this account yet' }, 503)
    }
    const key = mediaKey(media[1], media[2])
    const object = await env.MEDIA.get(key)
    if (!object) return new Response('Not found', { status: 404, headers: CORS })
    const headers = new Headers(CORS)
    headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream')
    headers.set('Cache-Control', 'public, max-age=3600')
    return new Response(object.body, { headers })
  }

  if (url.pathname !== '/api/uploads' || request.method !== 'POST') return null

  if (!env.MEDIA) {
    return json({
      error: 'R2 is not enabled. Turn on R2 in the Laskalegacypty dashboard, then wrangler r2 bucket create klipklop-media.',
    }, 503)
  }

  const user = await getUserFromFetch(request)
  if (!user) return json({ error: 'Unauthorized' }, 401)

  const form = await request.formData()
  const bucket = String(form.get('bucket') || '')
  const path = String(form.get('path') || '')
  const file = form.get('file')

  if (!ALLOWED.has(bucket)) return json({ error: 'Invalid bucket' }, 400)
  if (!file || typeof file === 'string') return json({ error: 'file is required' }, 400)
  if (!path.startsWith(`${user.id}/`)) {
    return json({ error: 'Path must start with your user id' }, 403)
  }

  const max = MAX_BYTES[bucket] || MAX_BYTES.avatars
  if (file.size > max) return json({ error: 'File too large' }, 400)

  const key = mediaKey(bucket, path)
  await env.MEDIA.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
  })

  const origin = env.PUBLIC_APP_URL || new URL(request.url).origin
  const publicUrl = `${origin}/api/media/${bucket}/${path.replace(/^\/+/, '')}`
  return json({ path, publicUrl, key })
}
