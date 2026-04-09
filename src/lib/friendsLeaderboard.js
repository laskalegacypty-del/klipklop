import { supabase } from './supabaseClient'

export const LEADERBOARD_MODES = {
  CURRENT_YEAR: 'current_year',
  PERSONAL_BEST: 'personal_best',
}

export const REACTION_OPTIONS = ['🔥', '👏', '💪', '⚡', '🚀', '🏆']
export const LEADERBOARD_VIEW_MODES = {
  PLACINGS: 'placings',
  LEVELS: 'levels',
}

export async function fetchFriendships(userId) {
  const { data, error } = await supabase
    .from('user_friendships')
    .select('*')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function fetchProfilesByIds(ids) {
  if (!ids?.length) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('id, rider_name, province, profile_photo_url, role')
    .in('id', ids)

  if (error) throw error
  return data || []
}

export function mapFriendshipCollections(rows, myUserId) {
  const incoming = []
  const outgoing = []
  const accepted = []
  const blocked = []

  rows.forEach(row => {
    const isRequester = row.requester_id === myUserId
    if (row.status === 'pending') {
      if (isRequester) outgoing.push(row)
      else incoming.push(row)
      return
    }
    if (row.status === 'accepted') {
      accepted.push(row)
      return
    }
    if (row.status === 'blocked') blocked.push(row)
  })

  return { incoming, outgoing, accepted, blocked }
}

export async function searchRiders(query, userId, excludedUserIds = []) {
  const q = query.trim()
  if (q.length < 2) return []

  const excluded = new Set([userId, ...excludedUserIds])
  const { data, error } = await supabase
    .from('profiles')
    .select('id, rider_name, province, profile_photo_url, role')
    .eq('role', 'user')
    .ilike('rider_name', `%${q}%`)
    .limit(10)

  if (error) throw error
  return (data || []).filter(profile => !excluded.has(profile.id))
}

export async function createFriendRequest(requesterId, addresseeId) {
  const { error } = await supabase
    .from('user_friendships')
    .insert({
      requester_id: requesterId,
      addressee_id: addresseeId,
      status: 'pending',
    })
  if (error) throw error
}

export async function respondToFriendRequest(friendshipId, status) {
  const payload = { status, responded_at: new Date().toISOString() }
  const { error } = await supabase
    .from('user_friendships')
    .update(payload)
    .eq('id', friendshipId)
  if (error) throw error
}

export async function removeFriendship(friendshipId) {
  const { error } = await supabase
    .from('user_friendships')
    .delete()
    .eq('id', friendshipId)
  if (error) throw error
}

export async function fetchFriendsLeaderboard({
  mode = LEADERBOARD_MODES.CURRENT_YEAR,
  year = new Date().getFullYear(),
  game = 'all',
  myComboId = null,
  levelFilter = null,
}) {
  const { data, error } = await supabase
    .rpc('get_friends_leaderboard', {
      p_mode: mode,
      p_year: year,
      p_game: game,
      p_my_combo_id: myComboId,
      p_level_filter: levelFilter,
    })

  if (error) throw error
  return data || []
}

export async function fetchMyHorseCombos(userId) {
  const { data, error } = await supabase
    .from('horse_rider_combos')
    .select('id, horse_name, is_archived, is_pinned')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('is_pinned', { ascending: false })
    .order('horse_name', { ascending: true })
  if (error) throw error
  return data || []
}

export async function fetchDisplayHorseNamesForUsers(userIds = []) {
  const ids = Array.from(new Set((userIds || []).filter(Boolean)))
  if (ids.length === 0) return {}

  const { data, error } = await supabase
    .from('horse_rider_combos')
    .select('user_id, horse_name, is_pinned, created_at')
    .in('user_id', ids)
    .eq('is_archived', false)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) throw error

  const map = {}
  ;(data || []).forEach(row => {
    const userId = row.user_id
    const horseName = String(row.horse_name || '').trim()
    if (!userId || !horseName) return
    if (!map[userId]) map[userId] = horseName
  })
  return map
}

export async function sendFriendReaction({ fromUserId, toUserId, reaction }) {
  const { error } = await supabase
    .from('friend_reactions')
    .insert({
      from_user_id: fromUserId,
      to_user_id: toUserId,
      reaction,
    })
  if (error) throw error
}

export async function fetchRecentFriendReactions(userId, limit = 20) {
  const { data, error } = await supabase
    .from('friend_reactions')
    .select('*')
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function sendFriendOvertakeNotifications({
  actorUserId,
  otherUserId,
  otherName,
  overtakerUserId,
  overtakerName,
  newRank,
  oldRank,
  mode,
  year,
  game,
}) {
  const modeLabel = mode === LEADERBOARD_MODES.CURRENT_YEAR ? `Current Year ${year}` : 'Personal Best'
  const gameLabel = game === 'all' ? 'All Games' : game
  const link = `/friends-leaderboard?mode=${mode}&year=${year}&game=${encodeURIComponent(game)}&overtaker=${overtakerUserId}&target=${otherUserId}&new=${newRank}&old=${oldRank}`

  const actorMessage = `${overtakerName} moved to #${newRank} and overtook ${otherName} (${modeLabel}, ${gameLabel}).`
  const otherMessage = `${overtakerName} overtook you and moved to #${newRank} (${modeLabel}, ${gameLabel}).`

  const payload = [
    {
      user_id: actorUserId,
      type: 'friend_overtake',
      message: actorMessage,
      link,
      is_read: false,
    },
    {
      user_id: otherUserId,
      type: 'friend_overtake',
      message: otherMessage,
      link,
      is_read: false,
    },
  ]

  const { error } = await supabase
    .from('notifications')
    .upsert(payload, {
      onConflict: 'user_id,type,link,message',
      ignoreDuplicates: true,
    })

  if (error) throw error
}

export function buildAchievements({ leaderboardRows, myUserId, acceptedCount, pendingIncomingCount }) {
  const myRank = leaderboardRows.find(row => row.user_id === myUserId)?.rank || null
  const myRow = leaderboardRows.find(row => row.user_id === myUserId) || null

  return [
    {
      id: 'first_friend',
      title: 'First Link',
      unlocked: acceptedCount >= 1,
      detail: acceptedCount >= 1 ? 'You linked your first friend.' : 'Add your first friend.',
    },
    {
      id: 'social_hub',
      title: 'Social Hub',
      unlocked: acceptedCount >= 5,
      detail: `${acceptedCount}/5 friends linked.`,
    },
    {
      id: 'top_three',
      title: 'Podium Finisher',
      unlocked: myRank !== null && myRank <= 3,
      detail: myRank ? `Current rank: #${myRank}` : 'Get a time on the board.',
    },
    {
      id: 'all_games',
      title: 'All-Rounder',
      unlocked: Number(myRow?.games_covered || 0) >= 13,
      detail: `${myRow?.games_covered || 0}/13 games covered.`,
    },
    {
      id: 'popular',
      title: 'In Demand',
      unlocked: pendingIncomingCount >= 3,
      detail: `${pendingIncomingCount} incoming request${pendingIncomingCount === 1 ? '' : 's'}.`,
    },
  ]
}
