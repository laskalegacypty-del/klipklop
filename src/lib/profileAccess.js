import { supabase } from './supabaseClient'

export const DURATION_PRESETS = [
  { key: '24h', label: '24 hours', hours: 24 },
  { key: '1w',  label: '1 week',   hours: 24 * 7 },
]

export function isGrantActive(grant) {
  if (!grant || grant.status !== 'accepted' || grant.revoked_at) return false
  if (grant.expires_at && new Date(grant.expires_at) < new Date()) return false
  return true
}

export function isGrantPending(grant) {
  return grant?.status === 'pending'
}

export function grantStatusLabel(grant) {
  if (!grant) return 'None'
  if (grant.status === 'pending') return 'Pending'
  if (grant.status === 'declined') return 'Declined'
  if (grant.status === 'revoked') return 'Revoked'
  if (grant.status === 'accepted') return isGrantActive(grant) ? 'Active' : 'Expired'
  return grant.status
}

export function getPresetHours(durationKey, customHours) {
  if (durationKey === 'custom') return customHours
  return DURATION_PRESETS.find(p => p.key === durationKey)?.hours
}

export function getPresetLabel(durationKey, customHours) {
  if (durationKey === 'custom') return `${customHours} hour${customHours === 1 ? '' : 's'}`
  return DURATION_PRESETS.find(p => p.key === durationKey)?.label || durationKey
}

// Throws a friendly Error if a pending/active grant already exists for this admin+user pair.
export async function assertNoExistingGrant(adminId, userId) {
  const { data, error } = await supabase
    .from('profile_access_grants')
    .select('*')
    .eq('admin_id', adminId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (data && isGrantPending(data)) throw new Error('You already have a pending request for this rider.')
  if (data && isGrantActive(data)) throw new Error('You already have active access to this rider’s profile.')
}

export async function requestProfileAccess({ adminId, targetUserId, durationKey, customHours, reason }) {
  const requestedHours = getPresetHours(durationKey, customHours)
  if (!requestedHours || requestedHours < 1 || requestedHours > 720) {
    throw new Error('Duration must be between 1 hour and 30 days.')
  }

  await assertNoExistingGrant(adminId, targetUserId)

  const { data: grant, error } = await supabase
    .from('profile_access_grants')
    .insert({
      admin_id: adminId,
      user_id: targetUserId,
      duration_preset: durationKey,
      requested_hours: requestedHours,
      reason: reason || null,
    })
    .select()
    .single()
  if (error) throw error

  const durationLabel = getPresetLabel(durationKey, customHours)

  await supabase.from('notifications').insert({
    user_id: targetUserId,
    type: 'profile_access_request',
    message: `An admin is requesting temporary access to your profile (${durationLabel}). Review in your Profile.`,
    link: '/profile',
  })

  await sendProfileAccessRequestEmail({ userId: targetUserId, durationLabel, reason })

  return grant
}

export async function sendProfileAccessRequestEmail({ userId, durationLabel, reason }) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return

    await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-profile-access-request-email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ userId, durationLabel, reason }),
      }
    )
  } catch (err) {
    console.error('Profile access request email failed:', err)
  }
}
