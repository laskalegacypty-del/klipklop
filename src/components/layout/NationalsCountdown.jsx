import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Trophy } from 'lucide-react'
import './NationalsCountdown.css'

function FlipChar({ char }) {
  const [displayed, setDisplayed] = useState(char)
  const [next, setNext]           = useState(char)
  const [phase, setPhase]         = useState('idle')
  const t1 = useRef(null)
  const t2 = useRef(null)

  useEffect(() => {
    if (char === displayed && phase === 'idle') return
    if (char === displayed) return

    setNext(char)
    setPhase('phase1')

    t1.current = setTimeout(() => setPhase('phase2'), 160)
    t2.current = setTimeout(() => {
      setDisplayed(char)
      setPhase('idle')
    }, 320)

    return () => {
      clearTimeout(t1.current)
      clearTimeout(t2.current)
    }
  }, [char])

  return (
    <div className="nc-char">
      <div className="nc-char-top">{displayed}</div>
      <div className="nc-char-bottom">{phase !== 'idle' ? next : displayed}</div>
      {phase === 'phase1' && <div className="nc-flap nc-flap-out">{displayed}</div>}
      {phase === 'phase2' && <div className="nc-flap nc-flap-in">{next}</div>}
    </div>
  )
}

function Tile({ value, label }) {
  const str = String(value).padStart(2, '0')
  return (
    <div className="nc-tile">
      <div className="nc-tile-digits">
        <FlipChar char={str[0]} />
        <FlipChar char={str[1]} />
      </div>
      <div className="nc-tile-label">{label}</div>
    </div>
  )
}

function buildTicker(event) {
  const dateStr = new Date(event.date + 'T00:00:00').toLocaleDateString('en-ZA', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const year  = new Date(event.date + 'T00:00:00').getFullYear()
  const chunk = `Get your game face on! ★  SAWMGA Nationals ${year}  ★  ${event.venue}, ${event.province}  ★  ${dateStr}  ★  Train hard, ride proud  ★  See you on the field!  ★  Good luck to every rider`
  return `${chunk}          ${chunk}          `
}

export default function NationalsCountdown() {
  const [event,    setEvent]    = useState(null)
  const [timeLeft, setTimeLeft] = useState(null)

  useEffect(() => {
    async function fetchNationals() {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('qualifier_events')
        .select('id, date, venue, province')
        .eq('event_type', 'nationals')
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (data) setEvent(data)
    }
    fetchNationals()
  }, [])

  useEffect(() => {
    if (!event) return
    function calc() {
      const target = new Date(event.date + 'T00:00:00')
      const diff   = target - Date.now()
      if (diff <= 0) { setTimeLeft(null); return }
      setTimeLeft({
        days:  Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        mins:  Math.floor((diff % 3600000)  / 60000),
        secs:  Math.floor((diff % 60000)    / 1000),
      })
    }
    calc()
    const id = setInterval(calc, 1000)
    return () => clearInterval(id)
  }, [event])

  if (!event || !timeLeft) return null

  const ticker = buildTicker(event)
  const dateLabel = new Date(event.date + 'T00:00:00').toLocaleDateString('en-ZA', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="nc-banner" role="timer" aria-label="Nationals countdown">
      <div className="nc-inner">
        <div className="nc-label">
          <Trophy size={14} aria-hidden="true" />
          <span>Nationals countdown</span>
        </div>

        <div className="nc-tiles">
          <Tile value={timeLeft.days}  label="days" />
          <div className="nc-sep" aria-hidden="true">:</div>
          <Tile value={timeLeft.hours} label="hrs" />
          <div className="nc-sep" aria-hidden="true">:</div>
          <Tile value={timeLeft.mins}  label="min" />
          <div className="nc-sep" aria-hidden="true">:</div>
          <Tile value={timeLeft.secs}  label="sec" />
        </div>

        <div className="nc-venue">
          <span className="nc-venue-name">{event.venue}</span>
          <span className="nc-venue-date">{dateLabel}</span>
        </div>
      </div>

      <div className="nc-ticker-wrap" aria-hidden="true">
        <div className="nc-ticker-track">
          <span className="nc-ticker-text">{ticker}</span>
          <span className="nc-ticker-text" aria-hidden="true">{ticker}</span>
        </div>
      </div>
    </div>
  )
}
