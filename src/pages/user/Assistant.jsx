import { useEffect, useMemo, useRef, useState } from 'react'
import { loadDomain, searchDomain, buildDomainContext } from 'rules-engine/core'
import { Bot, BookOpen, Send, Sparkles, User } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { wmg } from '../../lib/rulesDomains/wmg'
import { createKlipklopAnswerer } from '../../lib/klipklopAnswerer'
import { PageHeader } from '../../components/ui'

let messageSeq = 0
function nextId() {
  messageSeq += 1
  return `m${Date.now()}_${messageSeq}`
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

function Citations({ citations }) {
  if (!citations?.length) return null
  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-2">
        <BookOpen size={13} />
        {wmg.ui.citationLabel}
      </div>
      <div className="space-y-1.5">
        {citations.slice(0, 3).map((c, i) => (
          <div key={i} className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
            <p className="text-xs font-semibold text-gray-700">
              {c.section && c.section !== c.title ? `${c.section} · ` : ''}{c.title}
            </p>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{c.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Assistant() {
  const { profile } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  const answer = useMemo(() => createKlipklopAnswerer(profile), [profile?.id])

  useEffect(() => {
    let active = true
    loadDomain(wmg).then(ok => { if (active) setReady(Boolean(ok)) }).catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading])

  async function handleSend(text) {
    const query = String(text ?? input).trim()
    if (!query || loading) return

    setInput('')
    setMessages(prev => [...prev, { id: nextId(), role: 'user', content: query }])
    setLoading(true)

    try {
      const citations = searchDomain(wmg, query, 4)
      const context = buildDomainContext(wmg, query)

      let response = ''
      try {
        response = await answer({ query, domain: wmg, context, citations })
      } catch {
        response = ''
      }

      if (!response) {
        // Offline fallback: surface the best-matching official rule.
        if (citations.length) {
          const top = citations[0]
          response = `Here's the most relevant rule I found${top.section ? ` (${top.section})` : ''}:\n\n**${top.title}**\n${top.text}`
        } else {
          response = "I couldn't find anything about that in the SAWMGA rules or your KlipKlop data. Try rephrasing, or ask about a specific game, penalty, your times, or a horse."
        }
      }

      setMessages(prev => [
        ...prev,
        { id: nextId(), role: 'assistant', content: response, citations },
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assistant"
        description="Ask about SAWMGA rules and games, or your own horses, times and PBs."
      />

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-13rem)] min-h-[480px]">
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {isEmpty ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center mb-4">
                <Sparkles size={26} className="text-green-700" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">KlipKlop Assistant</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-md">
                {wmg.ui.greetingNote}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2 max-w-lg">
                {wmg.ui.quickQuestions.map(q => (
                  <button
                    key={q.query}
                    onClick={() => handleSend(q.query)}
                    disabled={loading}
                    className="px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700 hover:bg-green-100 hover:text-green-800 transition disabled:opacity-50"
                  >
                    {q.label}
                  </button>
                ))}
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
          <div className="px-4 sm:px-6 pt-2 flex flex-wrap gap-2 border-t border-gray-100">
            {wmg.ui.quickQuestions.slice(0, 4).map(q => (
              <button
                key={q.query}
                onClick={() => handleSend(q.query)}
                disabled={loading}
                className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-800 transition disabled:opacity-50"
              >
                {q.label}
              </button>
            ))}
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
