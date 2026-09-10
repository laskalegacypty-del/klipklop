// Re-export the existing JWT helper so new utilities routes copy this pattern:
//   const user = await getUserFromRequest(req)
export {
  getUserFromRequest,
  createAdminClient,
  createAuthedClient,
} from '../../api/_lib/supabaseAdmin.js'
