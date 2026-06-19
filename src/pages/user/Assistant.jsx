import { useEffect, useMemo, useRef, useState } from 'react'
import { loadDomain, searchDomain, buildDomainContext } from 'rules-engine/core'
import { Bot, BookOpen, ChevronDown, RefreshCw, Send, Sparkles, Trash2, User } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { wmg } from '../../lib/rulesDomains/wmg'
import { createKlipklopAnswerer } from '../../lib/klipklopAnswerer'
import { clearKlipklopSummaryCache, getCachedKlipklopSummary } from '../../lib/klipklopContext'
import { PageHeader } from '../../components/ui'

let messageSeq = 0
function nextId() {
  messageSeq += 1
  return `m${Date.now()}_${messageSeq}`
}

const CHAT_TTL_DAYS = 7

function chatKey(profileId) {
  return `klipklop_chat_${profileId}`
}

function loadPersistedChat(profileId) {
  if (!profileId) return []
  try {
    const raw = localStorage.getItem(chatKey(profileId))
    if (!raw) return []
    const { messages, savedAt } = JSON.parse(raw)
    const ageMs = Date.now() - new Date(savedAt).getTime()
    if (ageMs > CHAT_TTL_DAYS * 86400 * 1000) {
      localStorage.removeItem(chatKey(profileId))
      return []
    }
    return Array.isArray(messages) ? messages : []
  } catch {
    return []
  }
}

function persistChat(profileId, messages) {
  if (!profileId || !messages.length) return
  try {
    localStorage.setItem(chatKey(profileId), JSON.stringify({ messages, savedAt: new Date().toISOString() }))
  } catch { /* storage full — ignore */ }
}

function clearPersistedChat(profileId) {
  if (profileId) localStorage.removeItem(chatKey(profileId))
}

// Minimal, dependency-free formatter for the assistant's text.
function renderRichText(text) {
  const lines = String(text || '').split(/\r?\n/)
  const blocks = []
  let list = null

  const renderInline = (line, key) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
    return parts.map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={`${key}-${i}`}>{part.slice(2, -2)}</strong>
        : <span key={`${key}-${i}`}>{part}</span>
    )
  }

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd()
    const bullet = line.match(/^\s*[-*]\s+(.*)$/)
    if (bullet) {
      if (!list) list = []
      list.push(bullet[1])
      return
    }
    if (list) {
      blocks.push(
        <ul key={`ul${idx}`} className="list-disc pl-5 space-y-0.5 my-1">
          {list.map((item, i) => <li key={i}>{renderInline(item, `li${idx}-${i}`)}</li>)}
        </ul>
      )
      list = null
    }
    if (line.trim() === '') return
    blocks.push(<p key={`p${idx}`} className="my-1">{renderInline(line, `p${idx}`)}</p>)
  })
  if (list) {
    blocks.push(
      <ul key="ul-final" className="list-disc pl-5 space-y-0.5 my-1">
        {list.map((item, i) => <li key={i}>{renderInline(item, `li-final-${i}`)}</li>)}
      </ul>
    )
  }
  return blocks
}

// Keywords that mark a question as being about the rider's own KlipKlop data.
// Rule citations are hidden for these so we never show rulebook excerpts next to
// personal horse/times answers.
const PERSONAL_KEYWORDS = [
  'my ', 'i ', "i'm", 'mine', 'me ', 'am i', 'how am i', 'how fast',
  'pb', 'personal best', 'best time', 'my time', 'my horse', 'my horses',
  'eagle', 'vitals', 'temperature', 'heart rate', 'medical', 'vaccin',
  'reminder', 'due', 'next event', 'next qualifier', 'leaderboard', 'rank',
  'notification', 'season', 'eligible', 'eligibility', 'games done',
]

function looksPersonal(query) {
  const q = ` ${String(query || '').toLowerCase()} `
  return PERSONAL_KEYWORDS.some(k => q.includes(k))
}

function Citations({ citations }) {
  if (!citations?.length) return null
  return (
    <details className="mt-3 pt-3 border-t border-gray-100 group">
      <summary className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 cursor-pointer select-none list-none hover:text-green-700 transition">
        <BookOpen size={13} />
        {wmg.ui.citationLabel}
        <ChevronDown size={13} className="ml-auto transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-1.5 mt-2">
        {citations.slice(0, 3).map((c, i) => (
          <div key={i} className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
            <p className="text-xs font-semibold text-gray-700">
              {c.section && c.section !== c.title ? `${c.section} · ` : ''}{c.title}
            </p>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{c.text}</p>
          </div>
        ))}
      </div>
    </details>
  )
}

export default function Assistant() {
  const { profile } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [dataStatus, setDataStatus] = useState('loading') // 'loading' | 'ok' | 'empty'
  const [dataDebug, setDataDebug] = useState('')
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  const answer = useMemo(() => createKlipklopAnswerer(profile), [profile?.id])
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    let active = true
    loadDomain(wmg)
      .then(ok => { if (active) setReady(Boolean(ok)) })
      .catch(() => {})
    return () => { active = false }
  }, [])

  // Load persisted chat when profile becomes available
  useEffect(() => {
    if (!profile?.id) return
    const saved = loadPersistedChat(profile.id)
    if (saved.length) setMessages(saved)
  }, [profile?.id])

  // Persist messages whenever they change
  useEffect(() => {
    if (profile?.id && messages.length) persistChat(profile.id, messages)
  }, [messages, profile?.id])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading])

  // Pre-fetch and cache rider data on mount so the first question is instant
  useEffect(() => {
    if (!profile?.id) return
    setDataStatus('loading')
    clearKlipklopSummaryCache(profile.id)
    getCachedKlipklopSummary(profile)
      .then(summary => {
        if (summary && summary.length > 50) {
          setDataStatus('ok')
          setDataDebug(`${summary.length} chars loaded`)
        } else {
          setDataStatus('empty')
          setDataDebug(summary ? `only ${summary.length} chars` : 'empty string returned')
        }
      })
      .catch(err => {
        setDataStatus('empty')
        setDataDebug(`fetch error: ${err?.message || err}`)
        console.error('[Assistant] pre-fetch error:', err)
      })
  }, [profile?.id])

  function handleClearChat() {
    setMessages([])
    clearPersistedChat(profile?.id)
  }

  async function handleRefresh() {
    if (refreshing || loading) return
    setRefreshing(true)
    setDataStatus('loading')
    clearKlipklopSummaryCache(profile?.id)
    getCachedKlipklopSummary(profile)
      .then(summary => {
        setDataStatus(summary && summary.length > 50 ? 'ok' : 'empty')
        setDataDebug(summary ? `${summary.length} chars` : 'empty')
        setRefreshing(false)
      })
      .catch(() => { setDataStatus('empty'); setRefreshing(false) })
  }

  async function handleSend(text) {
    const query = String(text ?? input).trim()
    if (!query || loading) return

    setInput('')
    // Snapshot history before adding this user message
    const historySnapshot = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }))

    setMessages(prev => [...prev, { id: nextId(), role: 'user', content: query }])
    setLoading(true)

    try {
      // For personal questions (my horses, my times, etc.) skip the rules context
      // entirely so the AI focuses on rider data rather than defaulting to the rulebook.
      const isPersonal = looksPersonal(query)
      const citations = isPersonal ? [] : searchDomain(wmg, query, 6)
      const rulesContext = isPersonal ? null : buildDomainContext(wmg, query, 6000, 12)

      let response = ''
      try {
        response = await answer({ query, domain: wmg, context: rulesContext, citations, history: historySnapshot })
      } catch {
        response = ''
      }

      if (!response) {
        if (!isPersonal && citations.length) {
          const top = citations[0]
          response = `Here's the most relevant rule I found${top.section ? ` (${top.section})` : ''}:\n\n**${top.title}**\n${top.text}`
        } else {
          response = "I couldn't find that in your KlipKlop data. Try rephrasing, or use the refresh button if you recently added data."
        }
      }

      const displayCitations = isPersonal ? [] : citations

      setMessages(prev => [
        ...prev,
        { id: nextId(), role: 'assistant', content: response, citations: displayCitations },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isEmpty = messages.length === 0

  const statusColor = dataStatus === 'ok' ? 'bg-green-100 text-green-700' : dataStatus === 'empty' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
  const statusLabel = dataStatus === 'ok' ? `KlipKlop data loaded (${dataDebug})` : dataStatus === 'empty' ? `No KlipKlop data found — ${dataDebug}` : 'Loading your data…'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assistant"
        description="Ask about SAWMGA rules and games, or your own horses, times and PBs."
      />

      {/* Data status badge — visible indicator for debugging */}
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${statusColor}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dataStatus === 'ok' ? 'bg-green-500' : dataStatus === 'empty' ? 'bg-red-500' : 'bg-gray-400 animate-pulse'}`} />
        {statusLabel}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-13rem)] min-h-[480px]">
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {isEmpty ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mb-4">
                <Sparkles size={28} className="text-green-700" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">KlipKlop Assistant</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-sm">
                {wmg.ui.greetingNote}
              </p>

              {/* My data chips */}
              <div className="mt-6 w-full max-w-lg text-left">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2 px-1">My KlipKlop data</p>
                <div className="flex flex-wrap gap-2">
                  {wmg.ui.quickQuestions.slice(0, 8).map(q => (
                    <button
                      key={q.query}
                      onClick={() => handleSend(q.query)}
                      disabled={loading}
                      className="px-3 py-1.5 rounded-full text-sm font-medium bg-green-50 text-green-800 border border-green-200 hover:bg-green-100 transition disabled:opacity-50"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rules chips */}
              <div className="mt-4 w-full max-w-lg text-left">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2 px-1">Rules & games</p>
                <div className="flex flex-wrap gap-2">
                  {wmg.ui.quickQuestions.slice(8).map(q => (
                    <button
                      key={q.query}
                      onClick={() => handleSend(q.query)}
                      disabled={loading}
                      className="px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition disabled:opacity-50"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map(m => (
              <div
                key={m.id}
                className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    m.role === 'user' ? 'bg-green-700 text-white' : 'bg-green-100 text-green-700'
                  }`}
                >
                  {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === 'user'
                      ? 'bg-green-700 text-white'
                      : 'bg-gray-50 border border-gray-200 text-gray-800'
                  }`}
                >
                  {m.role === 'user' ? (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  ) : (
                    <div className="leading-relaxed">
                      {renderRichText(m.content)}
                      <Citations citations={m.citations} />
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center flex-shrink-0">
                <Bot size={16} />
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick chips when conversation is active */}
        {!isEmpty && (
          <div className="px-4 sm:px-6 pt-2 pb-1 flex items-center gap-2 border-t border-gray-100 overflow-x-auto">
            <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
              {wmg.ui.quickQuestions.slice(0, 6).map(q => (
                <button
                  key={q.query}
                  onClick={() => handleSend(q.query)}
                  disabled={loading}
                  className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-800 transition disabled:opacity-50 whitespace-nowrap"
                >
                  {q.label}
                </button>
              ))}
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              title="Refresh my horse & times data"
              className="ml-1 p-1.5 rounded-full text-gray-400 hover:text-green-700 hover:bg-green-50 transition disabled:opacity-40 flex-shrink-0"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleClearChat}
              disabled={loading}
              title="Clear chat history"
              className="p-1.5 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition disabled:opacity-40 flex-shrink-0"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}

        {/* Composer */}
        <div className="p-3 sm:p-4 border-t border-gray-100">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={ready ? 'Ask about rules, games, your times or your horses…' : 'Loading rules…'}
              className="flex-1 resize-none max-h-32 rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-green-700 text-white hover:bg-green-800 transition disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              aria-label="Send message"
            >
              <Send size={18} />
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-2 text-center">
            Answers are grounded in the official SAWMGA rules and your own KlipKlop records.
          </p>
        </div>
      </div>
    </div>
  )
}
