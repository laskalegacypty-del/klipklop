import { useCallback, useEffect, useRef, useState } from 'react'
import { X, Send, Clock, Video, ChevronDown, MessageCircle } from 'lucide-react'
import {
  fetchMessages,
  sendTextMessage,
  sendTimesShare,
  markMessagesRead,
  subscribeToChatChannel,
  groupMessagesByDate,
  formatTime,
} from '../../lib/friendsChat'
import { supabase } from '../../lib/supabaseClient'

// Fetches recent times for the current user so they can share them
async function fetchMyRecentTimes(userId) {
  try {
    const { data } = await supabase
      .from('horse_times')
      .select('id, horse_name, game, time_seconds, level, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
    return data || []
  } catch {
    return []
  }
}

function formatSeconds(secs) {
  if (secs == null) return '—'
  const s = Number(secs)
  const mins = Math.floor(s / 60)
  const rem = (s % 60).toFixed(2).padStart(5, '0')
  return mins > 0 ? `${mins}:${rem}` : `${rem}s`
}

// Avatar — same pattern as FriendsLeaderboard
function Avatar({ profile, size = 'md' }) {
  const sz = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'
  return (
    <div className={`${sz} rounded-full overflow-hidden border border-gray-200 bg-green-100 flex items-center justify-center flex-shrink-0`}>
      {profile?.profile_photo_url ? (
        <img src={profile.profile_photo_url} alt={profile.rider_name} className="w-full h-full object-cover" />
      ) : (
        <span className="font-bold text-green-700">{profile?.rider_name?.charAt(0)?.toUpperCase() || '?'}</span>
      )}
    </div>
  )
}

// A single chat message bubble
function MessageBubble({ msg, isMe }) {
  if (msg.message_type === 'times_share') {
    const m = msg.attachment_meta || {}
    return (
      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} gap-1`}>
        <div className={`rounded-2xl border overflow-hidden max-w-[260px] ${isMe ? 'rounded-tr-sm bg-green-50 border-green-200' : 'rounded-tl-sm bg-blue-50 border-blue-200'}`}>
          <div className={`flex items-center gap-2 px-3 py-2 ${isMe ? 'bg-green-100' : 'bg-blue-100'}`}>
            <Clock size={13} className={isMe ? 'text-green-700' : 'text-blue-700'} />
            <span className={`text-xs font-bold ${isMe ? 'text-green-700' : 'text-blue-700'}`}>Time shared</span>
          </div>
          <div className="px-3 py-2.5 space-y-1">
            <p className="text-sm font-bold text-gray-900">{m.horse_name || 'Horse'}</p>
            <p className="text-xs text-gray-600">{m.game}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-lg font-black text-gray-900">{formatSeconds(m.time_seconds)}</span>
              {m.level && <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Level {m.level}</span>}
            </div>
            {m.qualifier_name && <p className="text-xs text-gray-400">{m.qualifier_name}</p>}
          </div>
        </div>
        <span className="text-[10px] text-gray-400 px-1">{formatTime(msg.created_at)}</span>
      </div>
    )
  }

  if (msg.message_type === 'video_share') {
    const m = msg.attachment_meta || {}
    return (
      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} gap-1`}>
        <div className={`rounded-2xl border overflow-hidden max-w-[260px] ${isMe ? 'rounded-tr-sm bg-green-50 border-green-200' : 'rounded-tl-sm bg-purple-50 border-purple-200'}`}>
          <div className={`flex items-center gap-2 px-3 py-2 ${isMe ? 'bg-green-100' : 'bg-purple-100'}`}>
            <Video size={13} className={isMe ? 'text-green-700' : 'text-purple-700'} />
            <span className={`text-xs font-bold ${isMe ? 'text-green-700' : 'text-purple-700'}`}>Video shared</span>
          </div>
          <div className="px-3 py-2.5 space-y-1">
            <p className="text-sm font-semibold text-gray-900">{m.title || m.horse_name || 'Video'}</p>
            {m.horse_name && m.title && <p className="text-xs text-gray-500">{m.horse_name}</p>}
            {msg.attachment_url && (
              <video src={msg.attachment_url} controls preload="metadata" className="w-full rounded-lg mt-2 bg-black" style={{ maxHeight: 180 }} />
            )}
          </div>
        </div>
        <span className="text-[10px] text-gray-400 px-1">{formatTime(msg.created_at)}</span>
      </div>
    )
  }

  return (
    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} gap-0.5`}>
      <div className={`px-4 py-2.5 rounded-2xl max-w-[260px] break-words text-sm ${
        isMe
          ? 'bg-green-700 text-white rounded-tr-sm'
          : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
      }`}>
        {msg.message_text}
      </div>
      <span className="text-[10px] text-gray-400 px-1">{formatTime(msg.created_at)}</span>
    </div>
  )
}

export default function ChatPanel({ myProfile, friendProfile, onClose }) {
  const [messages, setMessages] = useState([])
  const [loadingMessages, setLoadingMessages] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [showShareTimes, setShowShareTimes] = useState(false)
  const [myTimes, setMyTimes] = useState([])
  const [loadingTimes, setLoadingTimes] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const myId = myProfile?.id
  const friendId = friendProfile?.id

  // Load messages on open
  useEffect(() => {
    if (!myId || !friendId) return
    setLoadingMessages(true)
    fetchMessages(myId, friendId)
      .then(rows => {
        setMessages(rows)
        markMessagesRead(myId, friendId)
      })
      .catch(() => setMessages([]))
      .finally(() => setLoadingMessages(false))
    inputRef.current?.focus()
  }, [myId, friendId])

  // Realtime subscription
  useEffect(() => {
    if (!myId || !friendId) return
    const channel = subscribeToChatChannel(myId, friendId, msg => {
      setMessages(prev => [...prev, msg])
      markMessagesRead(myId, friendId)
    })
    return () => { channel.unsubscribe() }
  }, [myId, friendId])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!text.trim() || sending) return
    setSending(true)
    try {
      const msg = await sendTextMessage(myId, friendId, text)
      setMessages(prev => [...prev, msg])
      setText('')
    } catch {
      console.error('Could not send message')
    } finally {
      setSending(false)
    }
  }

  async function handleShareTime(time) {
    setSending(true)
    try {
      const msg = await sendTimesShare(myId, friendId, {
        horse_name: time.horse_name,
        game: time.game,
        time_seconds: time.time_seconds,
        level: time.level,
      })
      setMessages(prev => [...prev, msg])
      setShowShareTimes(false)
    } catch {
      console.error('Could not share time')
    } finally {
      setSending(false)
    }
  }

  async function handleOpenShareTimes() {
    setShowShareTimes(v => !v)
    if (!myTimes.length) {
      setLoadingTimes(true)
      fetchMyRecentTimes(myId).then(rows => {
        setMyTimes(rows)
        setLoadingTimes(false)
      })
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const grouped = groupMessagesByDate(messages)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 pointer-events-auto"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative pointer-events-auto w-full sm:w-96 h-[85vh] sm:h-[600px] sm:mr-4 sm:mb-4 bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 bg-green-700 text-white flex-shrink-0">
          <Avatar profile={friendProfile} />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">{friendProfile?.rider_name || 'Friend'}</p>
            <p className="text-xs text-green-200 truncate">{friendProfile?.province || 'Rider'}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 transition flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50">
          {loadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-gray-400">Loading messages…</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <MessageCircle size={28} className="text-green-600" />
              </div>
              <p className="text-sm font-semibold text-gray-700">Start the conversation</p>
              <p className="text-xs text-gray-400">Say hi to {friendProfile?.rider_name?.split(' ')[0] || 'your friend'}, or share a time result!</p>
            </div>
          ) : (
            grouped.map(group => (
              <div key={group.date} className="space-y-3">
                {/* Date divider */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">{group.date}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                {group.messages.map(msg => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isMe={msg.sender_id === myId}
                  />
                ))}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Share times drawer */}
        {showShareTimes && (
          <div className="border-t border-gray-200 bg-white flex-shrink-0 max-h-52 overflow-y-auto">
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-700">Share a time result</p>
              <button onClick={() => setShowShareTimes(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <ChevronDown size={16} />
              </button>
            </div>
            {loadingTimes ? (
              <p className="text-xs text-gray-400 text-center py-4">Loading…</p>
            ) : myTimes.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No times logged yet.</p>
            ) : (
              myTimes.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleShareTime(t)}
                  disabled={sending}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-green-50 transition text-left border-b border-gray-50 last:border-b-0 disabled:opacity-50"
                >
                  <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Clock size={14} className="text-green-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-900 truncate">{t.horse_name} — {t.game}</p>
                    <p className="text-xs text-gray-500">{formatSeconds(t.time_seconds)}{t.level ? ` · Level ${t.level}` : ''}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* Input area */}
        <div className="flex-shrink-0 border-t border-gray-200 bg-white px-3 py-3 flex items-end gap-2">
          <button
            onClick={handleOpenShareTimes}
            className={`p-2.5 rounded-xl border transition flex-shrink-0 ${showShareTimes ? 'bg-green-700 border-green-700 text-white' : 'border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-700'}`}
            title="Share a time result"
          >
            <Clock size={18} />
          </button>
          <textarea
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 max-h-24"
            style={{ overflowY: text.split('\n').length > 3 ? 'scroll' : 'hidden' }}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className="p-2.5 rounded-xl bg-green-700 text-white hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed transition flex-shrink-0"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
