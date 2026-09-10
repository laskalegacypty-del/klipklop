import { sendJson } from '../_lib/http.js'
import { RESOURCES, UPLOAD_BUCKETS } from '../_lib/catalog.js'
import { dataBackend } from '../_lib/store.js'
import { getD1 } from '../_lib/d1.js'

function hasSecret(...keys) {
  return keys.some((key) => Boolean(process.env[key]))
}

export async function handleStatus(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }

  const env = globalThis.__KK_ENV || {}
  sendJson(res, 200, {
    ok: true,
    backend: dataBackend(),
    bindings: {
      DB: Boolean(env.DB || getD1()),
      MEDIA: Boolean(env.MEDIA),
      SESSIONS: Boolean(env.SESSIONS),
      AI: Boolean(env.AI),
    },
    secrets: {
      SUPABASE_SERVICE_ROLE_KEY: hasSecret('SUPABASE_SERVICE_ROLE_KEY'),
      CF_API_TOKEN: hasSecret('CF_API_TOKEN'),
      PAYSTACK_SECRET_KEY: hasSecret('PAYSTACK_SECRET_KEY'),
      RESEND_API_KEY: hasSecret('RESEND_API_KEY'),
      VAPID_PRIVATE_KEY: hasSecret('VAPID_PRIVATE_KEY'),
    },
    resources: Object.fromEntries(
      Object.entries(RESOURCES).map(([name, spec]) => [name, {
        table: spec.table,
        d1Ready: spec.d1Ready !== false,
        adminWrite: Boolean(spec.adminWrite),
      }]),
    ),
    uploads: {
      buckets: UPLOAD_BUCKETS,
      r2Enabled: Boolean(env.MEDIA),
    },
    routes: [
      'GET /api/bff',
      'GET|PATCH /api/me',
      'CRUD /api/{resource} and /api/{resource}/:id',
      'GET|POST /api/messages',
      'POST /api/uploads',
      'GET /api/media/:bucket/*',
      'POST /api/paystack/verify',
      'POST /api/paystack/webhook',
      'POST /api/email/approval',
      'POST /api/email/profile-access',
      'POST /api/push/send',
    ],
  })
}
