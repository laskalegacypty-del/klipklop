import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookDown } from 'lucide-react'
import { RULE_BOOK } from '../demo/world'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { PageHeader } from '../components/ui/PageHeader'

export function Rules() {
  const [q, setQ] = useState('')
  const [active, setActive] = useState('A')
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return RULE_BOOK
    return RULE_BOOK.filter((s) => `${s.id} ${s.title} ${s.body}`.toLowerCase().includes(query))
  }, [q])
  const current = filtered.find((s) => s.id === active) || filtered[0]

  return (
    <div>
      <PageHeader
        title="Rulebook"
        description="Sections A–L. Search the index, then read the gate notes."
        actions={
          <div className="flex flex-wrap gap-2">
          <Link to="/barry">
            <Button variant="charcoal">Ask Barry</Button>
          </Link>
          <Button
            variant="secondary"
            onClick={() => {
              const blob = new Blob([RULE_BOOK.map((s) => `${s.id}. ${s.title}\n${s.body}\n`).join('\n')], { type: 'text/plain' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'BRSA-rulebook.txt'
              a.click()
              URL.revokeObjectURL(url)
            }}
          >
            <BookDown size={16} />
            Download
          </Button>
          </div>
        }
      />
      <Input className="mb-4 max-w-md" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search rules" />
      <div className="grid gap-4 md:grid-cols-[12rem_1fr]">
        <div className="flex flex-col gap-1">
          {filtered.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id)}
              className={`rounded-sm px-3 py-2 text-left text-sm ${current?.id === s.id ? 'bg-charcoal text-white' : 'hover:bg-dust-200'}`}
            >
              {s.id}. {s.title}
            </button>
          ))}
        </div>
        {current ? (
          <Card>
            <CardHeader>
              <CardTitle>
                {current.id}. {current.title}
              </CardTitle>
              <CardDescription>Federation notes for the demo</CardDescription>
            </CardHeader>
            <CardContent className="leading-relaxed text-stone-700">{current.body}</CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
