import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookDown } from 'lucide-react'
import { flattenRulebook } from '../lib/barryRules'
import { RuleText } from '../lib/rulebookView'
import { downloadRulebookPdf } from '../demo/pdf'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { PageHeader } from '../components/ui/PageHeader'

const QUICK = {
  id: 'Q',
  heading: 'Quick Rules — Dress Code & Tack',
  title: 'Dress Code & Tack',
  entries: [
    {
      id: 'Q-01',
      label: 'Dress',
      text: 'Long-sleeved Western shirt with collar, jeans or jodhpurs, cowboy hat or helmet. Riders under 18 wear a helmet. No caps. No ripped jeans. Sleeves down, shirt tails in.',
    },
    {
      id: 'Q-02',
      label: 'Tack',
      text: 'Western saddle. No weighted barrels. Welfare steward on the gate. Bareback is not a sanctioned BRSA run.',
    },
  ],
}

export function Rules() {
  const [book, setBook] = useState(null)
  const [q, setQ] = useState('')
  const [active, setActive] = useState('Q')

  useEffect(() => {
    fetch('/data/brsa-rulebook.json')
      .then((r) => r.json())
      .then((data) => {
        const flat = flattenRulebook(data)
        setBook({ ...flat, sections: [QUICK, ...flat.sections] })
      })
      .catch(() => setBook({ sections: [QUICK], entries: QUICK.entries }))
  }, [])

  const filtered = useMemo(() => {
    const sections = book?.sections || [QUICK]
    const query = q.trim().toLowerCase()
    if (!query) return sections
    return sections.filter((s) => {
      const blob = `${s.id} ${s.title} ${s.heading} ${(s.entries || []).map((e) => `${e.label} ${e.text}`).join(' ')}`.toLowerCase()
      return blob.includes(query)
    })
  }, [book, q])
  const current = filtered.find((s) => s.id === active) || filtered[0]

  return (
    <div>
      <PageHeader
        title="Rulebook"
        description="2026 Revision, sections A–L. Search, then read. Barry cites the same book."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/barry">
              <Button variant="charcoal">Ask Barry</Button>
            </Link>
            <Button
              variant="secondary"
              onClick={() => downloadRulebookPdf({ source: book?.source, sections: book?.sections || [QUICK] })}
            >
              <BookDown size={16} />
              Download PDF
            </Button>
          </div>
        }
      />
      <Input className="mb-4 max-w-md" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tekkies, 2D, protest, wildcard…" />
      <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
        <div className="flex max-h-[70vh] flex-col gap-1 overflow-y-auto">
          {filtered.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id)}
              className={`rounded-sm px-3 py-2 text-left text-sm ${current?.id === s.id ? 'bg-charcoal text-white' : 'hover:bg-dust-200'}`}
            >
              {s.id}. {s.title || s.heading}
            </button>
          ))}
        </div>
        {current ? (
          <Card>
            <CardHeader>
              <CardTitle>{current.heading || current.title}</CardTitle>
              <CardDescription>{current.id === 'Q' ? 'Condensed gate notes' : 'Official 2026 wording'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(current.entries || []).map((entry) => (
                <div key={entry.id || entry.label}>
                  <p className="text-sm font-semibold text-charcoal">{entry.label}</p>
                  <RuleText text={entry.text} className="mt-1 text-sm text-stone-700" />
                  {entry.note ? <p className="mt-1 text-xs italic text-stone-500">{entry.note}</p> : null}
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
