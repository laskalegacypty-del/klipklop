import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, RotateCcw } from 'lucide-react'
import { useDemo } from '../demo/store'
import { ACCENT_PRESETS } from '../demo/accents'
import { rand } from '../demo/money'
import { roleLabel } from '../demo/world'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Input } from '../components/ui/Input'
import { PageHeader } from '../components/ui/PageHeader'
import { Select } from '../components/ui/Select'

const REASONS = ['Support', 'Fines & entries', 'Results', 'Membership']

export function AdminPage() {
  const {
    world,
    user,
    viewingFromAdmin,
    makeOfficial,
    setMembershipIncludesApp,
    setAccent,
    switchUser,
    exitViewAs,
    resetDemo,
    eventById,
    unpaidFines,
  } = useDemo()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [reason, setReason] = useState('Support')

  if (user.role !== 'admin') {
    return (
      <EmptyState
        title="Administrators only"
        description="This desk is for BRSA staff."
        action={
          viewingFromAdmin ? (
            <Button
              onClick={() => {
                exitViewAs()
                navigate('/admin')
              }}
            >
              Stop viewing as member
            </Button>
          ) : null
        }
      />
    )
  }

  const west = eventById('west-fest')
  const unpaid = world.invoices.filter((i) => !i.paid)
  const due = world.riders.filter(
    (r) => /due/i.test(r.membershipNote) || world.invoices.some((i) => i.riderId === r.id && i.type === 'membership' && !i.paid),
  )

  const members = useMemo(() => {
    const query = q.trim().toLowerCase()
    return world.users
      .filter((u) => u.role !== 'admin')
      .map((u) => {
        const r = u.riderId ? world.riders.find((x) => x.id === u.riderId) : null
        const fines = r ? unpaidFines(r.id) : []
        return { user: u, rider: r, fines }
      })
      .filter(({ user: u, rider: r }) => {
        if (!query) return true
        return (
          u.name.toLowerCase().includes(query) ||
          u.role.toLowerCase().includes(query) ||
          (r && (r.sa.toLowerCase().includes(query) || r.province.toLowerCase().includes(query)))
        )
      })
  }, [q, unpaidFines, world.riders, world.users])

  function inspect(userId) {
    switchUser(userId, { reason })
    navigate('/')
  }

  return (
    <div>
      <PageHeader title="Admin" description={`${world.riders.length} members · ${world.season}`} />

      <Card className="mb-4 overflow-hidden">
        <div className="h-1.5 bg-season" />
        <CardHeader>
          <CardTitle>View as member</CardTitle>
          <CardDescription>
            Inspect the app exactly as they see it — fine blocks, invoices, entries. Payments you make apply to their
            record. A banner stays up until you stop.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, SA number, province" />
            <Select value={reason} onChange={(e) => setReason(e.target.value)} className="sm:w-56">
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  Reason · {r}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-2">
            {members.length === 0 ? (
              <EmptyState title="No members match" description="Try another name or SA number." />
            ) : (
              members.map(({ user: u, rider: r, fines }) => (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dust-200 bg-white px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-charcoal font-display text-sm text-brand-300">
                      {u.name.slice(0, 1)}
                    </span>
                    <div>
                      <p className="font-semibold text-charcoal">{u.name}</p>
                      <p className="text-sm text-stone-500">
                        {r ? `${roleLabel(u.role)} · ${r.sa} · ${r.class} · ${r.province}` : roleLabel(u.role)}
                      </p>
                    </div>
                    {fines.length > 0 ? (
                      <Badge variant="danger">
                        {fines.length} unpaid fine{fines.length > 1 ? 's' : ''}
                      </Badge>
                    ) : null}
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => inspect(u.id)}>
                    <Eye size={14} />
                    Inspect
                  </Button>
                </div>
              ))
            )}
          </div>
          {(world.viewAsLog ?? []).length > 0 ? (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">Recent inspections</p>
              <ul className="space-y-1 text-sm text-stone-600">
                {(world.viewAsLog ?? []).slice(0, 5).map((row, i) => (
                  <li key={`${row.at}-${i}`}>
                    {row.name} · {row.reason} · {new Date(row.at).toLocaleString('en-ZA')}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="mb-4 overflow-hidden">
        <div className="h-1.5 bg-season" />
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>
            Black and gold are house colours. The season accent is the yearly trim — merch, posters, the app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {ACCENT_PRESETS.map((preset) => {
              const selected = world.accent?.hex === preset.hex
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setAccent(preset)}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm ${
                    selected ? 'border-brand-400 bg-brand-50' : 'border-dust-200 bg-white hover:border-brand-400'
                  }`}
                >
                  <span className="h-7 w-7 rounded-sm border border-black/10" style={{ backgroundColor: preset.hex }} />
                  <span>
                    <span className="block font-semibold">{preset.name}</span>
                    <span className="text-xs text-stone-500">{preset.note}</span>
                  </span>
                </button>
              )
            })}
          </div>
          <label className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium">Custom</span>
            <input
              type="color"
              value={world.accent?.hex ?? '#7A1F2B'}
              onChange={(e) =>
                setAccent(
                  {
                    id: 'custom',
                    name: 'Custom',
                    note: world.season,
                    hex: e.target.value,
                  },
                  { quiet: true },
                )
              }
              className="h-9 w-14 cursor-pointer rounded-sm border border-dust-200 bg-white"
            />
            <span className="font-mono text-xs text-stone-500">{world.accent?.hex}</span>
          </label>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Membership billing</CardTitle>
          <CardDescription>Treat the app as included in BRSA membership, or as a separate subscription.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={world.membershipIncludesApp}
              onChange={(e) => setMembershipIncludesApp(e.target.checked)}
            />
            App included in BRSA membership
          </label>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>West Fest</CardTitle>
            <CardDescription>Mark official when the protest window is done.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {west.official ? (
              <Badge variant="success">Already official</Badge>
            ) : (
              <Button onClick={() => makeOfficial(west.id)}>Make official</Button>
            )}
            <Link to={`/events/${west.id}?tab=results`}>
              <Button variant="secondary">Open results</Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Open invoices</CardTitle>
            <CardDescription>
              {unpaid.length ? `${unpaid.length} unpaid · fines block entry` : 'All clear'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {unpaid.length === 0 ? (
              <p className="text-sm text-stone-500">No unpaid invoices.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {unpaid.map((i) => (
                  <li key={i.id}>
                    {world.riders.find((r) => r.id === i.riderId)?.name} — {i.label} · {rand(i.amount)}
                  </li>
                ))}
              </ul>
            )}
            <Link to="/invoices" className="mt-3 inline-block">
              <Button variant="secondary" size="sm">
                Inbox
              </Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Membership due</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {due.length === 0 ? (
              <p className="text-stone-500">Nobody is flagged.</p>
            ) : (
              due.map((r) => (
                <p key={r.id}>
                  {r.name} · {r.membershipNote}
                </p>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Contacts by region</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {world.contacts.map((c) => (
              <p key={c.region}>
                <span className="font-semibold">{c.region}</span> — {c.name} · {c.phone}
              </p>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>This device</CardTitle>
          <CardDescription>Restore the sample 2026/27 season stored in this browser.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="secondary" onClick={resetDemo}>
            <RotateCcw size={14} />
            Restore sample season
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
