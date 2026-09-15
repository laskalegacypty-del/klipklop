import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, ChevronDown, Send, Trash2 } from 'lucide-react'
import { useDemo } from '../demo/store'
import { brsa } from '../lib/brsaDomain'
import { buildBarryRiderBlock, looksPersonal } from '../lib/barryContext'
import { loadBarryRules, searchBarryRules, buildBarryContext } from '../lib/barryRules'
import { RuleText } from '../lib/rulebookView'
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

function Citation({ citation }) {
  const entry = citation || null
  if (!entry?.text) return null
  const sectionRules = [...(entry.sectionEntries || [])]
  const idx = sectionRules.findIndex((r) => r.id === entry.id)
  if (idx > 0) {
    const [hit] = sectionRules.splice(idx, 1)
    sectionRules.unshift(hit)
  }
  const rules = sectionRules.length ? sectionRules : [{ id: entry.id, title: entry.title, text: entry.text, note: entry.note }]
  return (
    <details className="group mt-3 border-t border-dust-200 pt-3">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-charcoal">
        <BookOpen size={13} />
        {brsa.ui.citationLabel}
        {entry.sectionId ? ` · Section ${entry.sectionId}` : ''}
        <ChevronDown size={13} className="ml-auto transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-2 max-h-80 space-y-3 overflow-y-auto rounded-md border border-dust-200 bg-dust-50 px-3 py-2">
        {rules.map((rule) => {
          const referenced = rule.id === entry.id || rule.title === entry.title
          return (
            <div key={rule.id || rule.title} className={referenced ? 'rounded-sm border border-season bg-white px-2 py-2' : ''}>
              <p className="text-xs font-semibold text-charcoal">
                {rule.title}
                {referenced ? <span className="ml-2 text-[10px] uppercase tracking-wide text-season">Referenced</span> : null}
              </p>
              <RuleText text={rule.text} className="mt-1" />
              {rule.note ? <p className="mt-1 text-[11px] italic text-stone-500">{rule.note}</p> : null}
            </div>
          )
        })}
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
    loadBarryRules()
      .then(() => { if (active) setReady(true) })
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
      const matches = personal ? [] : searchBarryRules(query, 6)
      const citation = personal ? null : (matches[0] || null)
      const rulesContext = personal ? '' : buildBarryContext(matches, 6000)
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
        if (citation) {
          response = `Here's the most relevant rule I found${citation.section ? ` (${citation.section})` : ''}:\n\n**${citation.title}**\n${citation.text}`
        } else if (personal && riderBlock) {
          response = `From your demo season:\n\n${riderBlock}`
        } else {
          response = 'I could not find that in the BRSA rulebook I have. Try the Rulebook page, or rephrase the question.'
        }
      }

      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'assistant', content: response, citation: personal ? null : citation },
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
      {compact ? null : (
        <Link to="/rules">
          <Button variant="secondary">Open rulebook</Button>
        </Link>
      )}
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
          description="Rules assistant for Barrel Racing SA. Grounded in the 2026 rulebook, sections A–L."
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
                        <Citation citation={m.citation || m.citations?.[0] || null} />
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
