import { readJsonBody, sendJson } from '../_lib/http.js'
import { dataBackend, getStore } from '../_lib/store.js'
import { getD1, newId, nowIso } from '../_lib/d1.js'
import { requireCaller } from '../_lib/session.js'

const PAGE_SIZE = 50

export async function handleMessages(req, res, action) {
  const caller = await requireCaller(req, res)
  if (!caller) return
  const myId = caller.user.id

  try {
    if (req.method === 'GET' && action === 'unread') {
      sendJson(res, 200, { data: await unreadCounts(caller, myId) })
      return
    }
    if (req.method === 'GET' && action === 'previews') {
      const url = new URL(req.url, 'https://klipklop.local')
      const friendIds = String(url.searchParams.get('friendIds') || '').split(',').filter(Boolean)
      sendJson(res, 200, { data: await previews(caller, myId, friendIds) })
      return
    }
    if (req.method === 'POST' && action === 'read') {
      const body = await readJsonBody(req)
      const friendId = String(body.friendId || '')
      if (!friendId) {
        sendJson(res, 400, { error: 'friendId is required' })
        return
      }
      await markRead(caller, myId, friendId)
      sendJson(res, 200, { ok: true })
      return
    }
    if (req.method === 'GET') {
      const url = new URL(req.url, 'https://klipklop.local')
      const friendId = String(url.searchParams.get('friendId') || '')
      const before = url.searchParams.get('before') || null
      if (!friendId) {
        sendJson(res, 400, { error: 'friendId is required' })
        return
      }
      sendJson(res, 200, { data: await listMessages(caller, myId, friendId, before) })
      return
    }
    if (req.method === 'POST') {
      const body = await readJsonBody(req)
      const friendId = String(body.friendId || body.receiver_id || '')
      if (!friendId) {
        sendJson(res, 400, { error: 'friendId is required' })
        return
      }
      const row = {
        sender_id: myId,
        receiver_id: friendId,
        message_text: String(body.message_text || '').trim(),
        message_type: body.message_type || 'text',
        attachment_url: body.attachment_url || null,
        attachment_meta: body.attachment_meta || null,
      }
      if (row.message_type === 'text' && !row.message_text) {
        sendJson(res, 400, { error: 'Message cannot be empty' })
        return
      }
      sendJson(res, 201, { data: await insertMessage(caller, row) })
      return
    }
    sendJson(res, 405, { error: 'Method not allowed' })
  } catch (err) {
    sendJson(res, 500, { error: err?.message || 'Chat error' })
  }
}

async function listMessages(caller, myId, friendId, before) {
  if (dataBackend() === 'd1') {
    const db = getD1()
    const sql = before
      ? `SELECT * FROM friend_messages
         WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
           AND created_at < ?
         ORDER BY created_at DESC LIMIT ?`
      : `SELECT * FROM friend_messages
         WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
         ORDER BY created_at DESC LIMIT ?`
    const binds = before
      ? [myId, friendId, friendId, myId, before, PAGE_SIZE]
      : [myId, friendId, friendId, myId, PAGE_SIZE]
    const { results } = await db.prepare(sql).bind(...binds).all()
    return (results || []).reverse()
  }
  const opts = {
    or: `and(sender_id.eq.${myId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${myId})`,
    order: { column: 'created_at', ascending: false },
    limit: PAGE_SIZE,
  }
  if (before) opts.lt = { created_at: before }
  return (await getStore(caller.token).list('friend_messages', opts) || []).reverse()
}

async function insertMessage(caller, row) {
  if (dataBackend() === 'd1') {
    const db = getD1()
    const payload = {
      id: newId(),
      ...row,
      attachment_meta: row.attachment_meta ? JSON.stringify(row.attachment_meta) : null,
      created_at: nowIso(),
    }
    await db.prepare(
      `INSERT INTO friend_messages (id, sender_id, receiver_id, message_text, message_type, attachment_url, attachment_meta, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      payload.id,
      payload.sender_id,
      payload.receiver_id,
      payload.message_text,
      payload.message_type,
      payload.attachment_url,
      payload.attachment_meta,
      payload.created_at,
    ).run()
    return { ...payload, attachment_meta: row.attachment_meta }
  }
  return getStore(caller.token).insert('friend_messages', row)
}

async function markRead(caller, myId, friendId) {
  const readAt = nowIso()
  if (dataBackend() === 'd1') {
    await getD1().prepare(
      `UPDATE friend_messages SET read_at = ? WHERE receiver_id = ? AND sender_id = ? AND read_at IS NULL`,
    ).bind(readAt, myId, friendId).run()
    return
  }
  await getStore(caller.token).update(
    'friend_messages',
    { read_at: readAt },
    { eq: { receiver_id: myId, sender_id: friendId }, is: { read_at: null } },
  )
}

async function unreadCounts(caller, myId) {
  let rows
  if (dataBackend() === 'd1') {
    const { results } = await getD1()
      .prepare('SELECT sender_id FROM friend_messages WHERE receiver_id = ? AND read_at IS NULL')
      .bind(myId)
      .all()
    rows = results || []
  } else {
    rows = await getStore(caller.token).list('friend_messages', {
      eq: { receiver_id: myId },
      is: { read_at: null },
      select: 'sender_id',
    }) || []
  }
  const counts = {}
  for (const row of rows) counts[row.sender_id] = (counts[row.sender_id] || 0) + 1
  return counts
}

async function previews(caller, myId, friendIds) {
  if (!friendIds.length) return {}
  let rows
  if (dataBackend() === 'd1') {
    const placeholders = friendIds.map(() => '?').join(', ')
    const { results } = await getD1().prepare(
      `SELECT * FROM friend_messages
       WHERE sender_id = ? AND receiver_id IN (${placeholders})
          OR receiver_id = ? AND sender_id IN (${placeholders})
       ORDER BY created_at DESC`,
    ).bind(myId, ...friendIds, myId, ...friendIds).all()
    rows = results || []
  } else {
    const or = friendIds.map((fid) =>
      `and(sender_id.eq.${myId},receiver_id.eq.${fid}),and(sender_id.eq.${fid},receiver_id.eq.${myId})`,
    ).join(',')
    rows = await getStore(caller.token).list('friend_messages', {
      or,
      order: { column: 'created_at', ascending: false },
    }) || []
  }
  const out = {}
  for (const row of rows) {
    const otherId = row.sender_id === myId ? row.receiver_id : row.sender_id
    if (!out[otherId]) out[otherId] = row
  }
  return out
}
