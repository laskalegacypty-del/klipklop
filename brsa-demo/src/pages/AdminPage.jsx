import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, RotateCcw } from 'lucide-react'
import { useDemo } from '../demo/store'
import { ACCENT_PRESETS } from '../demo/accents'
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
  const { world, user, viewingFromAdmin, setAccent, switchUser, exitViewAs, resetDemo, unpaidFines } = useDemo()
  const [q, setQ] = useState('')
  const [reason, setReason] = useState('Support')

  const members = useMemo(() => {
    const query = q.trim().toLowerCase()
    return world.users
      .filter((u) => u.role !== 'admin')
      .map((u) => {
        const r = u.riderId ? world.riders.find((x) => x.id === u.riderId) : null
        return { user: u, rider: r, fines: r ? unpaidFines(r.id) : [] }
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

  if (user.role !== 'admin') {
    return (
      <EmptyState
        title="Support desk"
        description="This is app support — View as member. Event running lives on the producer desk."
        action={
          viewingFromAdmin ? (
            <Button
              onClick={() => {
                exitViewAs()
              }}
            >
              Stop viewing as member
            </Button>
          ) : null
        }
      />
    )
  }

  return (
    <div>
      <PageHeader title="Help a member" description="See the app as they see it. Running a show sits with the producer." />
      <Card className="mb-4 overflow-hidden">
        <div className="h-1.5 bg-season" />
        <CardHeader>
          <CardTitle>Look as a member</CardTitle>
          <CardDescription>Open their phone view. If you pay something, it is on their account.</CardDescription>
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
            {members.map(({ user: u, rider: r, fines }) => (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dust-200 bg-white px-4 py-3">
                <div>
                  <p className="font-semibold">{u.name}</p>
                  <p className="text-sm text-stone-500">
                    {r ? `${roleLabel(u.role)} · ${r.sa} · ${r.class} · ${r.province}` : roleLabel(u.role)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {fines.length ? (
                    <Badge variant="danger">
                      {fines.length} unpaid fine{fines.length > 1 ? 's' : ''}
                    </Badge>
                  ) : null}
                  <Button size="sm" variant="secondary" onClick={() => switchUser(u.id, { reason })}>
                    <Eye size={14} />
                    Open their app
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Season accent</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {ACCENT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setAccent(preset)}
              className="flex items-center gap-2 rounded-md border border-dust-200 px-3 py-2 text-sm"
            >
              <span className="h-6 w-6 rounded-sm" style={{ backgroundColor: preset.hex }} />
              {preset.name}
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
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
