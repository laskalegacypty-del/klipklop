import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadDomain, searchDomain, buildDomainContext } from 'rules-engine/core'
import { ArrowLeft, BookOpen, ChevronDown, Send, Zap } from 'lucide-react'
import { wmg } from '../lib/rulesDomains/wmg'
import { MATRIX, getLevel } from '../lib/matrix'
import { APP_LOGO_SRC } from '../constants/branding'

const MASCOT_SRC = '/klippies-mascot.png'

const LEVEL_LABELS = ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite']
const LEVEL_COLORS = [
  'text-gray-300 border-gray-400/40 bg-gray-400/10',
  'text-yellow-300 border-yellow-400/40 bg-yellow-400/10',
  'text-blue-300 border-blue-400/40 bg-blue-400/10',
  'text-orange-300 border-orange-400/40 bg-orange-400/10',
  'text-green-300 border-green-400/40 bg-green-400/10',
]
const LEVEL_EMOJI = ['🐢', '🌱', '⚡', '🔥', '🏆']

// ── Game name lookup for chat detection ──────────────────────────────────────
const GAME_LOOKUP_SORTED = [
  ['speed barrels', 'Speed Barrels'],
  ['speed barrel', 'Speed Barrels'],
  ['hurry scurry', 'Hurry Scurry'],
  ['hurry-scurry', 'Hurry Scurry'],
  ['single stake', 'Single Stake'],
  ['fig 8 flags', 'Fig 8 Flags'],
  ['fig8 flags', 'Fig 8 Flags'],
  ['fig8flags', 'Fig 8 Flags'],
  ['fig 8 stake', 'Fig 8 Stake'],
  ['fig8 stake', 'Fig 8 Stake'],
  ['fig8stake', 'Fig 8 Stake'],
  ['barrel race', 'Barrel Race'],
  ['poles i', 'Poles I'],
  ['poles 1', 'Poles I'],
  ['poles ii', 'Poles II'],
  ['poles 2', 'Poles II'],
  ['big t', 'Big T'],
  ['speed ball', 'Speedball'],
  ['birangle', 'Birangle'],
  ['keyhole', 'Keyhole'],
  ['quadrangle', 'Quadrangle'],
  ['speedball', 'Speedball'],
  ['barrels', 'Barrel Race'],
  ['barrel', 'Barrel Race'],
  ['flags', 'Fig 8 Flags'],
  ['stake', 'Single Stake'],
  ['poles', 'Poles I'],
  ['hurry', 'Hurry Scurry'],
  ['scurry', 'Hurry Scurry'],
  ['quad', 'Quadrangle'],
  ['bigt', 'Big T'],
]

function parseTimeLevelQuery(message) {
  const msg = message.toLowerCase()
  const timeMatch = msg.match(/\b(\d{1,2}\.?\d{0,3})\b/)
  if (!timeMatch) return null
  const time = parseFloat(timeMatch[1])
  if (time < 5 || time > 70) return null

  for (const [alias, gameName] of GAME_LOOKUP_SORTED) {
    if (msg.includes(alias)) return { game: gameName, time }
  }
  return null
}

function buildLevelResponse(game, time, level) {
  const thresholds = MATRIX[game]
  if (level === null || !thresholds) {
    return `I couldn't determine the level for ${game} with a time of ${time.toFixed(3)}s. Please check the SAWMGA rating matrix.`
  }

  let out = `**${game}: ${time.toFixed(3)}s = Level ${level} ${LEVEL_EMOJI[level]} (${LEVEL_LABELS[level]})**\n\n`

  if (level < 4) {
    const nextMax = thresholds[level + 1][1]
    const needed = (time - nextMax).toFixed(3)
    out += `You're **${needed}s away from Level ${level + 1}** (${LEVEL_LABELS[level + 1]}).\n\n`
  } else {
    out += `You're at the **top level — Elite!** Outstanding work! 🔥\n\n`
  }

  out += `**${game} level ranges:**\n`
  for (let l = 4; l >= 0; l--) {
    const [min, max] = thresholds[l]
    const maxStr = max === Infinity ? '+' : max.toFixed(3) + 's'
    const marker = l === level ? ' ◀ your time' : ''
    out += `- Level ${l} ${LEVEL_EMOJI[l]}: ${min.toFixed(3)}s – ${maxStr}${marker}\n`
  }

  return out
}

// ── Inline level checker widget ──────────────────────────────────────────────
function LevelChecker({ onAsk }) {
  const [game, setGame] = useState('')
  const [time, setTime] = useState('')
  const [result, setResult] = useState(null)

  function check() {
    const t = parseFloat(time)
    if (!game || isNaN(t) || t < 5 || t > 70) return
    const level = getLevel(game, t)
    setResult({ game, time: t, level })
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') check()
  }

  function askKlippies() {
    if (!game || !time) return
    onAsk(`What level is ${time} seconds in ${game}?`)
  }

  return (
    <div className="w-full mb-4">
      <div className="bg-white/10 border border-white/20 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={15} className="text-yellow-400" />
          <span className="text-white font-bold text-sm">Level Checker</span>
          <span className="text-green-400 text-xs ml-auto">instant</span>
        </div>
        {/* Game select — always full width */}
        <select
          value={game}
          onChange={e => { setGame(e.target.value); setResult(null) }}
          className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-400/50 appearance-none mb-2"
          style={{ colorScheme: 'dark' }}
        >
          <option value="">Select a game…</option>
          {Object.keys(MATRIX).sort().map(g => (
            <option key={g} value={g} className="bg-green-900">{g}</option>
          ))}
        </select>
        {/* Time + button always on same row */}
        <div className="flex gap-2">
          <input
            type="number"
            step="0.001"
            min="5"
            max="70"
            value={time}
            onChange={e => { setTime(e.target.value); setResult(null) }}
            onKeyDown={handleKeyDown}
            placeholder="Your time (e.g. 14.823)"
            className="flex-1 rounded-xl bg-white/10 border border-white/20 px-3 py-2.5 text-sm text-white placeholder-green-400/60 focus:outline-none focus:ring-2 focus:ring-green-400/50"
          />
          <button
            onClick={check}
            disabled={!game || !time}
            className="px-4 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 text-white text-sm font-bold transition disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            Check
          </button>
        </div>

        {result && result.level !== null && (
          <div className={`mt-3 rounded-xl border px-4 py-3 ${LEVEL_COLORS[result.level]}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{LEVEL_EMOJI[result.level]}</span>
              <div>
                <p className="font-black text-lg leading-tight">Level {result.level} · {LEVEL_LABELS[result.level]}</p>
                <p className="text-xs opacity-80">{result.game} · {result.time.toFixed(3)}s</p>
              </div>
            </div>
            {result.level < 4 && (() => {
              const thresholds = MATRIX[result.game]
              const nextMax = thresholds[result.level + 1][1]
              const needed = (result.time - nextMax).toFixed(3)
              return (
                <p className="text-xs opacity-70 mt-1">
                  Cut <strong>{needed}s</strong> to reach Level {result.level + 1} {LEVEL_EMOJI[result.level + 1]} ({LEVEL_LABELS[result.level + 1]})
                </p>
              )
            })()}
            <button
              onClick={askKlippies}
              className="mt-2 text-xs underline opacity-60 hover:opacity-100 transition"
            >
              Ask Klippies for tips →
            </button>
          </div>
        )}

        {result && result.level === null && (
          <p className="mt-3 text-xs text-red-300">
            Couldn't determine level — check that the time is realistic for that game.
          </p>
        )}
      </div>
      <p className="text-center text-green-600 text-xs mt-2">
        Or just type in chat: <span className="text-green-400">"11.234 flags"</span>, <span className="text-green-400">"hurry scurry 14.5"</span>…
      </p>
    </div>
  )
}

// ── System prompt ────────────────────────────────────────────────────────────
const KLIPPIES_SYSTEM_PROMPT = `You are Klippies, the friendly AI assistant for South African Western Mounted Games (SAWMGA).
You answer questions about SAWMGA rules, games, nationals eligibility, competition regulations, equipment, levels, and the rating matrix.

Answer ONLY from the "Official SAWMGA Rules" excerpts provided. Cite the section you rely on (e.g. "see Section 2.4 Penalties").

LEVEL PREDICTION — SAWMGA OVERCOUNT PRINCIPLE:
The official SAWMGA overcount rule determines what level a rider competes at Nationals:
1. Per-game overcount (OC) = max(0, level_achieved - level_entered) for each game at a qualifier.
2. Bonus OC = number of games where the per-game OC was 3 or more.
3. Effective OC = sum of all per-game OCs + bonus OC.
4. Level jump = floor(effectiveOC / 4).
5. New level = min(4, level_entered + level_jump).
6. The new level becomes the entering level for the next qualifier.

Rules:
- Be friendly, concise and practical. Use South African terms.
- Never invent rules, penalties, distances, dates or facts.
- If the answer is not in the provided excerpts, say you do not have that rule and suggest checking the official SAWMGA rulebook at sawmga.co.za.
- If someone asks about their personal times, horses, or KlipKlop data, explain that this demo only covers rules — invite them to create a KlipKlop account to track their own records.
- Times are in seconds; lower is better. Levels run 0 (slowest) to 4 (fastest).
- Nationals eligibility typically requires 2+ qualifiers, 2+ in the rider's province, and 11+ of 13 games covered.`

// ── Quick questions ──────────────────────────────────────────────────────────
const QUICK_QUESTIONS = [
  { label: 'Nationals 2026 dates',     query: 'When and where is Nationals 2026?' },
  { label: 'Silver vs Gold Nationals', query: 'What is the difference between Silver and Gold Nationals?' },
  { label: 'Nationals entry fees',     query: 'What are the entry fees for Nationals 2026?' },
  { label: 'Trot-up requirements',     query: 'What are the trot-up requirements for Nationals 2026?' },
  { label: 'Bumping at Nationals',     query: 'How does bumping work at Nationals 2026?' },
  { label: 'Overcount rule',           query: 'How does the SAWMGA overcount rule work?' },
  { label: 'Nationals eligibility',    query: 'What are the requirements to qualify for Nationals?' },
  { label: 'Barrel penalty',           query: 'What is the penalty for knocking over a barrel?' },
  { label: 'Qualifier games',          query: 'What games are included in each qualifier?' },
  { label: 'WMG levels',              query: 'What levels are there in Western Mounted Games?' },
  { label: 'Horse marking rules',      query: 'What are the horse marking rules for Nationals?' },
  { label: 'Stabling at Nationals',    query: 'What are the stabling and paddock options at Nationals 2026?' },
]

// ── Markdown renderer ────────────────────────────────────────────────────────
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
    <details className="mt-3 pt-3 border-t border-green-100 group">
      <summary className="flex items-center gap-1.5 text-xs font-semibold text-green-700 cursor-pointer select-none list-none hover:text-green-900 transition">
        <BookOpen size={13} />
        Official SAWMGA Rules
        <ChevronDown size={13} className="ml-auto transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-1.5 mt-2">
        {citations.slice(0, 3).map((c, i) => (
          <div key={i} className="rounded-lg bg-green-50 border border-green-100 px-3 py-2">
            <p className="text-xs font-semibold text-green-800">
              {c.section && c.section !== c.title ? `${c.section} · ` : ''}{c.title}
            </p>
            <p className="text-xs text-green-700 mt-0.5 line-clamp-2">{c.text}</p>
          </div>
        ))}
      </div>
    </details>
  )
}

let seq = 0
function nextId() { seq += 1; return `m${Date.now()}_${seq}` }

// ── Main component ────────────────────────────────────────────────────────────
export default function Klippies() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    loadDomain(wmg).then(ok => setReady(Boolean(ok))).catch(() => {})
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading])

  async function handleSend(text) {
    const query = String(text ?? input).trim()
    if (!query || loading) return
    setInput('')

    const userMsg = { id: nextId(), role: 'user', content: query }
    setMessages(prev => [...prev, userMsg])

    // ── Instant local level-check (no AI call needed) ────────────────────
    const levelQuery = parseTimeLevelQuery(query)
    if (levelQuery) {
      const level = getLevel(levelQuery.game, levelQuery.time)
      const response = buildLevelResponse(levelQuery.game, levelQuery.time, level)
      setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: response, citations: [] }])
      inputRef.current?.focus()
      return
    }

    // ── AI call ──────────────────────────────────────────────────────────
    const historySnapshot = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }))

    setLoading(true)
    try {
      const citations = searchDomain(wmg, query, 6)
      const rulesContext = buildDomainContext(wmg, query, 6000, 12)

      let response = ''
      try {
        const res = await fetch('/api/rules/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            context: rulesContext ? `Official SAWMGA Rules (excerpts):\n${rulesContext}` : '',
            systemPrompt: KLIPPIES_SYSTEM_PROMPT,
            model: wmg.ai.model,
            history: historySnapshot,
          }),
        })
        if (res.ok) {
          const data = await res.json().catch(() => ({}))
          if (!data.fallback && data.response) response = String(data.response)
        }
      } catch { /* fallback to citations */ }

      if (!response) {
        if (citations.length) {
          const top = citations[0]
          response = `Here's the most relevant rule I found${top.section ? ` (${top.section})` : ''}:\n\n**${top.title}**\n${top.text}`
        } else {
          response = "I couldn't find that in the SAWMGA rules I have. Please check the official rulebook at sawmga.co.za or try rephrasing your question."
        }
      }

      setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: response, citations }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-950 via-green-950 to-green-900 flex flex-col">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-green-800/60">
        <div className="flex items-center gap-2.5">
          <img src={APP_LOGO_SRC} alt="KlipKlop" className="h-8 w-8 object-contain" />
          <div>
            <span className="text-white font-black text-sm tracking-tight">Klippies</span>
            <span className="text-green-400 text-xs font-medium ml-1.5">by KlipKlop</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-green-300 hover:text-white text-xs font-medium transition">
            Sign in
          </Link>
          <Link to="/register" className="bg-white text-green-900 text-xs font-bold px-3.5 py-1.5 rounded-full hover:bg-green-50 transition">
            Create account
          </Link>
        </div>
      </header>

      {/* ── Chat area ────────────────────────────────────────────────────── */}
      <div className={`flex-1 flex flex-col w-full mx-auto px-4 sm:px-6 pb-0 pt-4 min-h-0 ${isEmpty ? 'max-w-5xl' : 'max-w-3xl'}`}>

        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pb-4" style={{ minHeight: 0 }}>

          {isEmpty ? (
            /* ── Empty / hero state ─────────────────────────────────────── */
            <div className="flex flex-col py-4 sm:py-6">

              {/* ── Top row: mascot left, level checker right ────────────── */}
              <div className="flex flex-row items-start gap-4 sm:gap-8 lg:gap-12 mb-5">

                {/* LEFT: Mascot */}
                <div className="flex flex-col items-center flex-shrink-0" style={{ width: 'clamp(90px, 24vw, 300px)' }}>
                  <div className="relative w-full">
                    <div
                      className="absolute rounded-full pointer-events-none"
                      style={{
                        width: '130%', height: '130%',
                        top: '50%', left: '50%',
                        transform: 'translate(-50%, -50%)',
                        background: 'radial-gradient(ellipse, rgba(74,222,128,0.2) 0%, transparent 70%)',
                        filter: 'blur(20px)',
                      }}
                    />
                    <img
                      src={MASCOT_SRC}
                      alt="Klippies mascot"
                      className="relative object-contain w-full"
                      style={{
                        filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.5)) drop-shadow(0 0 20px rgba(74,222,128,0.2))',
                        animation: 'klippies-float 4s ease-in-out infinite',
                      }}
                    />
                  </div>
                  <h1 className="font-black text-white tracking-tight mt-1 text-center leading-tight"
                    style={{ fontSize: 'clamp(1.1rem, 4vw, 3rem)' }}>
                    Klippies
                  </h1>
                  <p className="text-green-400 font-semibold text-center leading-tight"
                    style={{ fontSize: 'clamp(0.6rem, 1.8vw, 0.875rem)' }}>
                    SAWMGA AI Guide
                  </p>
                  <p className="text-green-600 text-center mt-1 hidden sm:block"
                    style={{ fontSize: 'clamp(0.55rem, 1.5vw, 0.75rem)' }}>
                    No sign-up · Free
                  </p>
                </div>

                {/* RIGHT: Level checker */}
                <div className="flex-1 min-w-0">
                  <p className="text-green-300/80 text-xs sm:text-sm leading-relaxed mb-3 hidden sm:block">
                    Ask me anything about <strong className="text-white">SAWMGA rules</strong>, nationals, game regulations — or check your level instantly below.
                  </p>
                  <LevelChecker onAsk={q => handleSend(q)} />
                </div>
              </div>

              {/* ── Full-width chips row ──────────────────────────────────── */}
              <div className="w-full">
                <p className="text-xs font-semibold uppercase tracking-widest text-green-500 mb-2">
                  Ask Klippies…
                </p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_QUESTIONS.map(q => (
                    <button
                      key={q.query}
                      onClick={() => handleSend(q.query)}
                      disabled={loading}
                      className="px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium bg-white/10 text-green-100 border border-white/20 hover:bg-white/20 hover:text-white transition disabled:opacity-50"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* ── Messages ───────────────────────────────────────────────── */
            messages.map(m => (
              <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden ${
                  m.role === 'user' ? 'bg-white text-green-900 font-bold text-xs' : 'bg-green-800'
                }`}>
                  {m.role === 'user'
                    ? <span className="text-xs font-bold">You</span>
                    : <img src={MASCOT_SRC} alt="Klippies" className="w-8 h-8 object-cover object-top scale-150 translate-y-1" />
                  }
                </div>
                <div className={`max-w-[85%] sm:max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-white text-green-900 font-medium'
                    : 'bg-white/10 border border-white/15 text-green-50'
                }`}>
                  {m.role === 'user'
                    ? <p className="whitespace-pre-wrap">{m.content}</p>
                    : <div>{renderRichText(m.content)}<Citations citations={m.citations} /></div>
                  }
                </div>
              </div>
            ))
          )}

          {/* Typing indicator */}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-green-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
                <img src={MASCOT_SRC} alt="Klippies" className="w-8 h-8 object-cover object-top scale-150 translate-y-1" />
              </div>
              <div className="bg-white/10 border border-white/15 rounded-2xl px-4 py-3">
                <div className="flex gap-1 items-center h-4">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick chips row (active chat) */}
        {!isEmpty && (
          <div className="flex items-center gap-2 py-2 border-t border-white/10">
            {/* Back to home */}
            <button
              onClick={() => setMessages([])}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 text-green-200 border border-white/20 hover:bg-white/20 hover:text-white transition disabled:opacity-40 flex-shrink-0"
            >
              <ArrowLeft size={13} />
              Home
            </button>
            {/* Quick chips — horizontal scroll */}
            <div className="flex gap-1.5 flex-1 min-w-0 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
              {QUICK_QUESTIONS.slice(0, 8).map(q => (
                <button
                  key={q.query}
                  onClick={() => handleSend(q.query)}
                  disabled={loading}
                  className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/10 text-green-200 hover:bg-white/20 hover:text-white transition disabled:opacity-50 whitespace-nowrap flex-shrink-0"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Composer */}
        <div className="py-3 border-t border-white/10">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={ready ? 'Ask Klippies about rules, or type "14.823 flags"…' : 'Loading rules…'}
              className="flex-1 resize-none max-h-32 rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-sm text-white placeholder-green-400/60 focus:outline-none focus:ring-2 focus:ring-green-400/50 focus:border-green-400/50"
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="h-11 w-11 flex items-center justify-center rounded-xl bg-green-500 hover:bg-green-400 text-white transition disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              aria-label="Send"
            >
              <Send size={18} />
            </button>
          </div>
          <p className="text-xs text-green-600 text-center mt-2">
            Answers grounded in official SAWMGA rules ·{' '}
            <a href="https://www.sawmga.co.za" target="_blank" rel="noreferrer" className="underline hover:text-green-400 transition">
              sawmga.co.za
            </a>
          </p>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="border-t border-green-800/60 bg-green-950/80 px-4 py-4 text-center">
        <p className="text-green-400 text-xs">
          Want to track your own times, horses and eligibility?{' '}
          <Link to="/register" className="text-white font-semibold hover:underline">
            Create your KlipKlop account →
          </Link>
        </p>
      </div>

      {/* ── Float animation ──────────────────────────────────────────────── */}
      <style>{`
        @keyframes klippies-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
      `}</style>
    </div>
  )
}
