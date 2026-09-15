import { useState } from 'react'
import { useDemo } from '../demo/store'
import { HOF_CATEGORIES } from '../demo/money'
import { isFedStaff } from '../demo/world'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { PageHeader } from '../components/ui/PageHeader'
import { Select } from '../components/ui/Select'

export function HallOfFame() {
  const { world, user, addHofEntry } = useDemo()
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState({ category: 'brsa-record', year: '2026/27', name: '', horse: '', achievement: '', title: 'Record' })
  const rows = world.hallOfFame.filter((c) => filter === 'all' || c.category === filter)

  return (
    <div>
      <PageHeader title="Hall of Fame" description="Category is required. The achievement line is free text." />
      <div className="mb-4 flex flex-wrap gap-2">
        <Button size="sm" variant={filter === 'all' ? 'primary' : 'secondary'} onClick={() => setFilter('all')}>
          All
        </Button>
        {HOF_CATEGORIES.map((c) => (
          <Button key={c.id} size="sm" variant={filter === c.id ? 'primary' : 'secondary'} onClick={() => setFilter(c.id)}>
            {c.label}
          </Button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((card) => (
          <article key={card.id} className="overflow-hidden rounded-xl border border-white/10 bg-charcoal">
            <div className="h-1 bg-brand-400" />
            <div className="px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300">
                {card.year} · {HOF_CATEGORIES.find((c) => c.id === card.category)?.label || card.title}
              </p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-white">{card.name}</h3>
            </div>
            <div className="border-t border-white/15 px-5 py-4">
              <p className="text-sm leading-relaxed text-brand-100">
                {card.horse ? `${card.horse} · ` : ''}
                {card.achievement || card.title}
              </p>
            </div>
          </article>
        ))}
      </div>
      {user.role === 'producer' || isFedStaff(user.role) ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Add induction</CardTitle>
          </CardHeader>
          <CardContent className="grid max-w-lg gap-3">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {HOF_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
            <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="Horse" value={form.horse} onChange={(e) => setForm({ ...form, horse: e.target.value })} />
            <Input placeholder="Achievement" value={form.achievement} onChange={(e) => setForm({ ...form, achievement: e.target.value })} />
            <Button
              onClick={() => {
                if (!form.category || !form.name || !form.achievement) return
                addHofEntry(form)
              }}
            >
              Save
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
