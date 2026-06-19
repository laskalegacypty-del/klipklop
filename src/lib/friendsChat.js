import { supabase } from './supabaseClient'

const PAGE_SIZE = 50

/**
 * Fetch the most recent messages in a conversation between two users.
 * Returns messages sorted oldest-first for display.
 */
export async function fetchMessages(myId, friendId, before = null) {
  let query = supabase
    .from('friend_messages')
    .select('*')
    .or(
      `and(sender_id.eq.${myId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${myId})`
    )
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE)

  if (before) {
    query = query.lt('created_at', before)
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []).reverse() // oldest-first
}

/**
 * Send a plain text message.
 */
export async function sendTextMessage(senderId, receiverId, text) {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('Message cannot be empty')
  const { data, error } = await supabase
    .from('friend_messages')
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      message_text: trimmed,
      message_type: 'text',
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

/**
 * Share a time result in chat.
 * meta: { horse_name, game, time_seconds, level, qualifier_name }
 */
export async function sendTimesShare(senderId, receiverId, meta) {
  const { data, error } = await supabase
    .from('friend_messages')
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      message_text: `Shared a time: ${meta.horse_name} — ${meta.game}`,
      message_type: 'times_share',
      attachment_meta: meta,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

/**
 * Share a video in chat.
 * meta: { title, video_url, horse_name }
 */
export async function sendVideoShare(senderId, receiverId, meta) {
  const { data, error } = await supabase
    .from('friend_messages')
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      message_text: `Shared a video: ${meta.title || meta.horse_name}`,
      message_type: 'video_share',
      attachment_url: meta.video_url,
      attachment_meta: meta,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

/**
 * Mark all unread messages from a specific sender as read.
 */
export async function markMessagesRead(myId, friendId) {
  const { error } = await supabase
    .from('friend_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('receiver_id', myId)
    .eq('sender_id', friendId)
    .is('read_at', null)
  if (error) console.error('[chat] markMessagesRead error:', error)
}

/**
 * Fetch unread message counts per sender for the current user.
 * Returns a map: { [senderId]: count }
 */
export async function fetchUnreadCounts(myId) {
  const { data, error } = await supabase
    .from('friend_messages')
    .select('sender_id')
    .eq('receiver_id', myId)
    .is('read_at', null)
  if (error) return {}
  const counts = {}
  for (const row of (data || [])) {
    counts[row.sender_id] = (counts[row.sender_id] || 0) + 1
  }
  return counts
}

/**
 * Fetch the last message for each friend conversation (for preview in friends list).
 * Returns a map: { [friendId]: messageRow }
 */
export async function fetchConversationPreviews(myId, friendIds) {
  if (!friendIds.length) return {}
  const { data, error } = await supabase
    .from('friend_messages')
    .select('*')
    .or(
      friendIds.map(fid =>
        `and(sender_id.eq.${myId},receiver_id.eq.${fid}),and(sender_id.eq.${fid},receiver_id.eq.${myId})`
      ).join(',')
    )
    .order('created_at', { ascending: false })
  if (error) return {}

  const previews = {}
  for (const row of (data || [])) {
    const otherId = row.sender_id === myId ? row.receiver_id : row.sender_id
    if (!previews[otherId]) previews[otherId] = row
  }
  return previews
}

/**
 * Subscribe to new messages in a conversation.
 * Returns the channel — call channel.unsubscribe() to clean up.
 */
export function subscribeToChatChannel(myId, friendId, onInsert) {
  const channelName = `chat:${[myId, friendId].sort().join('-')}`
  return supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'friend_messages',
        filter: `receiver_id=eq.${myId}`,
      },
      payload => {
        const msg = payload.new
        if (msg.sender_id === friendId) onInsert(msg)
      }
    )
    .subscribe()
}

export function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
}

export function formatDateGroup(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Group messages by date for display dividers.
 * Returns an array of { date: string, messages: [] }
 */
export function groupMessagesByDate(messages) {
  const groups = []
  let currentGroup = null
  for (const msg of messages) {
    const label = formatDateGroup(msg.created_at)
    if (!currentGroup || currentGroup.date !== label) {
      currentGroup = { date: label, messages: [] }
      groups.push(currentGroup)
    }
    currentGroup.messages.push(msg)
  }
  return groups
}
