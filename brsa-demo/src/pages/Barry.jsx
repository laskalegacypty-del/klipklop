import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadDomain, searchDomain, buildDomainContext } from 'rules-engine/core'
import { BookOpen, ChevronDown, Send, Trash2 } from 'lucide-react'
import { useDemo } from '../demo/store'
import { brsa } from '../lib/brsaDomain'
import { buildBarryRiderBlock, looksPersonal } from '../lib/barryContext'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'

const CHAT_KEY = 'brsa-barry-chat'
const ENDPOINT = '/api/rules/chat'

let messageSeq = 0
function nextId() {
  messageSeq += 1
  return `b${Date.now()}_${messageSeq}`
}

function loadChat() {
  try {
    const raw = localStorage.getItem(CHAT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed.messages) ? parsed.messages : []
  } catch {
    return []
  }
}

function persistChat(messages) {
  try {
    localStorage.setItem(CHAT_KEY, JSON.stringify({ messages, savedAt: new Date().toISOString() }))
  } catch {
    /* ignore */
  }
}

function renderRichText(text) {
  const lines = String(text || '').split(/\r?\n/)
  const blocks = []
  let list = null

  const renderInline = (line, key) =>
    line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={`${key}-${i}`}>{part.slice(2, -2)}</strong>
        : <span key={`${key}-${i}`}>{part}</span>,
    )

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
        <ul key={`ul${idx}`} className="my-1 list-disc space-y-0.5 pl-5">
          {list.map((item, i) => <li key={i}>{renderInline(item, `li${idx}-${i}`)}</li>)}
        </ul>,
      )
      list = null
    }
    if (line.trim() === '') return
    blocks.push(<p key={`p${idx}`} className="my-1">{renderInline(line, `p${idx}`)}</p>)
  })
  if (list) {
    blocks.push(
      <ul key="ul-final" className="my-1 list-disc space-y-0.5 pl-5">
        {list.map((item, i) => <li key={i}>{renderInline(item, `li-final-${i}`)}</li>)}
      </ul>,
    )
  }
  return blocks
}

function Citations({ citations }) {
  if (!citations?.length) return null
  return (
    <details className="group mt-3 border-t border-dust-200 pt-3">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-charcoal">
        <BookOpen size={13} />
        {brsa.ui.citationLabel}
        <ChevronDown size={13} className="ml-auto transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-2 space-y-1.5">
        {citations.slice(0, 3).map((c, i) => (
          <div key={i} className="rounded-md border border-dust-200 bg-dust-50 px-3 py-2">
            <p className="text-xs font-semibold text-charcoal">
              {c.section && c.section !== c.title ? `${c.section} · ` : ''}{c.title}
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs text-stone-600">{c.text}</p>
          </div>
        ))}
      </div>
    </details>
  )
}

function BarryMark({ size = 'md' }) {
  const cls = size === 'lg' ? 'h-16 w-16' : 'h-8 w-8'
  return (
    <img
      src="/barry-avatar.png"
      alt="Barry"
      className={`${cls} flex-shrink-0 rounded-full border border-dust-200 bg-white object-cover`}
    />
  )
}

export function Barry({ compact = false } = {}) {
  const { world, rider, unpaidFines } = useDemo()
  const [ready, setReady] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState(() => loadChat())
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  const fines = rider ? unpaidFines(rider.id) : []
  const nextEvent = world.events.find((e) => e.status === 'live') || world.events.find((e) => e.status === 'upcoming')
  const riderBlock = useMemo(
    () => buildBarryRiderBlock({ rider, horses: world.horses, unpaidFines: fines, nextEvent }),
    [fines, nextEvent, rider, world.horses],
  )

  useEffect(() => {
    let active = true
    loadDomain(brsa)
      .then((ok) => { if (active) setReady(Boolean(ok)) })
      .catch(() => { if (active) setReady(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    persistChat(messages)
  }, [messages])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading])

  async function handleSend(text) {
    const query = String(text ?? input).trim()
    if (!query || loading || !ready) return

    setInput('')
    const historySnapshot = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content }))

    setMessages((prev) => [...prev, { id: nextId(), role: 'user', content: query }])
    setLoading(true)

    try {
      const personal = looksPersonal(query)
      const citations = personal ? [] : searchDomain(brsa, query, 6)
      const rulesContext = personal ? '' : buildDomainContext(brsa, query, 6000, 12)
      const merged = [
        rulesContext ? `${brsa.ai.rulesHeading}\n${rulesContext}` : '',
        riderBlock ? `RIDER DATA (the signed-in demo rider):\n${riderBlock}` : '',
      ].filter(Boolean).join('\n\n')

      let response = ''
      try {
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            context: merged,
            systemPrompt: brsa.ai.systemPrompt,
            model: brsa.ai.model,
            history: historySnapshot,
          }),
        })
        if (res.ok) {
          const data = await res.json().catch(() => ({}))
          if (!data.fallback && data.response) response = String(data.response)
        }
      } catch {
        /* local fallback */
      }

      if (!response) {
        if (citations.length) {
          const top = citations[0]
          response = `Here's the most relevant rule I found${top.section ? ` (${top.section})` : ''}:\n\n**${top.title}**\n${top.text}`
        } else if (personal && riderBlock) {
          response = `From your demo season:\n\n${riderBlock}`
        } else {
          response = 'I could not find that in the BRSA rulebook I have. Try the Rulebook page, or rephrase the question.'
        }
      }

      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'assistant', content: response, citations: personal ? [] : citations },
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

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Link to="/rules">
        <Button variant="secondary">Open rulebook</Button>
      </Link>
      {messages.length ? (
        <Button
          variant="ghost"
          onClick={() => {
            setMessages([])
            localStorage.removeItem(CHAT_KEY)
          }}
        >
          <Trash2 size={16} />
          Clear
        </Button>
      ) : null}
    </div>
  )

  return (
    <div>
      {compact ? (
        <div className="mb-5 flex justify-end sm:mb-6">{actions}</div>
      ) : (
        <PageHeader
          title="Barry"
          description="Rules assistant for Barrel Racing SA. Grounded in sections A–L."
          actions={actions}
        />
      )}

      <Card className="overflow-hidden">
        <CardContent className="flex h-[calc(100vh-14rem)] min-h-[28rem] flex-col p-0">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            {isEmpty ? (
              <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                <BarryMark size="lg" />
                <h3 className="mt-4 font-display text-2xl font-semibold text-charcoal">Ask Barry</h3>
                <p className="mt-1 max-w-sm text-sm text-stone-600">{brsa.ui.greetingNote}</p>
                {rider ? (
                  <p className="mt-2 text-xs text-stone-500">Looking as {rider.name.split(' ')[0]} · {rider.class}</p>
                ) : null}
                <div className="mt-6 flex w-full max-w-lg flex-wrap justify-center gap-2">
                  {brsa.ui.quickQuestions.map((q) => (
                    <button
                      key={q.query}
                      type="button"
                      disabled={!ready || loading}
                      onClick={() => handleSend(q.query)}
                      className="rounded-full border border-dust-200 bg-white px-3 py-1.5 text-sm text-charcoal hover:border-season hover:bg-brand-50 disabled:opacity-50"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
                {!ready ? <p className="mt-4 text-xs text-stone-400">Loading the rulebook…</p> : null}
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  {m.role === 'assistant' ? <BarryMark /> : (
                    <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-charcoal text-xs font-semibold text-brand-200">
                      You
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm sm:max-w-[75%] ${
                      m.role === 'user'
                        ? 'bg-charcoal text-white'
                        : 'border border-dust-200 bg-dust-50 text-charcoal'
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

            {loading ? (
              <div className="flex gap-3">
                <BarryMark />
                <div className="rounded-lg border border-dust-200 bg-dust-50 px-4 py-3">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-stone-400" style={{ animationDelay: '0ms' }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-stone-400" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-stone-400" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <form
            className="flex items-center gap-2 border-t border-dust-200 p-3"
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!ready || loading}
              placeholder={ready ? 'Ask Barry about a rule…' : 'Loading rules…'}
              className="h-11 flex-1 rounded-md border border-dust-200 bg-white px-3 text-sm text-charcoal placeholder:text-stone-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <Button type="submit" variant="charcoal" disabled={!ready || loading || !input.trim()}>
              <Send size={16} />
              Send
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
