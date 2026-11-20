import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, RotateCcw } from 'lucide-react'
import { useDemo } from '../demo/store'
import { ACCENT_PRESETS } from '../demo/accents'
import { MEMBERSHIP_EARLY_BIRD, MEMBERSHIP_STANDARD, rand } from '../demo/money'
import { isFedStaff, isSysAdmin, roleLabel } from '../demo/world'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Input } from '../components/ui/Input'
import { PageHeader } from '../components/ui/PageHeader'
import { Select } from '../components/ui/Select'

const REASONS = ['Support', 'Fines & entries', 'Results', 'Membership']

export function AdminPage({ mode = 'office' } = {}) {
  const {
    world,
    user,
    viewingFromAdmin,
    setAccent,
    switchUser,
    exitViewAs,
    resetDemo,
    unpaidFines,
    setLinks,
    pendingComplaints,
    issueMembershipInvoice,
    setMembershipIncludesApp,
    setAppPrice,
    setEarlyBirdEnds,
    setKickOutOverdue,
    earlyBird,
    membershipFeeNow,
    memberCount,
    downloadMemberList,
  } = useDemo()
  const [q, setQ] = useState('')
  const [reason, setReason] = useState('Support')
  const [links, setLocalLinks] = useState(() => ({ ...world.links }))
  const [memRider, setMemRider] = useState(world.riders[0]?.id || 'sunny')
  const [memClass, setMemClass] = useState('Adult')
  const [appPrice, setLocalAppPrice] = useState(String(world.appPrice ?? 180))
  const [earlyBirdEnds, setLocalEarlyBird] = useState(world.earlyBirdEnds || '')
  const [shareCount, setShareCount] = useState(false)
  const fed = isFedStaff(user.role)
  const sys = isSysAdmin(user.role)
  const showDev = mode === 'dev'

  const members = useMemo(() => {
    const query = q.trim().toLowerCase()
    return world.users
      .filter((u) => !isFedStaff(u.role))
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

  if (!fed) {
    return (
      <EmptyState
        title={showDev ? 'Dev tools' : 'BRSA office'}
        description={
          showDev
            ? 'Sys admins only — demo restore and pitch chrome live here.'
            : 'BRSA management desk — view as a member, complaints and public links.'
        }
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

  if (showDev && !sys) {
    return <EmptyState title="Dev tools" description="Only a sys admin can open this desk." />
  }

  return (
    <div>
      <PageHeader
        title={showDev ? 'Dev tools' : 'BRSA office'}
        description={
          showDev
            ? 'Pitch-demo controls. Federation work stays on BRSA office.'
            : 'Management team desk — above the producer. See the app as a member, action complaints, keep public links current.'
        }
      />

      {!showDev ? (
        <>
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
              <CardTitle>Complaints desk</CardTitle>
              <CardDescription>BRSA replies and closes this queue. Time disputes stay with the producer.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              {pendingComplaints ? <Badge variant="danger">{pendingComplaints} open</Badge> : <Badge>Nothing open</Badge>}
              <Link to="/complaints">
                <Button>Open complaints</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Members</CardTitle>
              <CardDescription>Total member count is admin-only unless you choose to share it.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <p className="text-2xl font-semibold">{memberCount}</p>
              <Badge>{earlyBird ? 'Early bird fees' : 'Standard fees'}</Badge>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={shareCount} onChange={(e) => setShareCount(e.target.checked)} />
                Share count on Home
              </label>
              {shareCount ? <Badge variant="success">Shared · {memberCount}</Badge> : null}
              <Button variant="secondary" onClick={downloadMemberList}>
                Download member list PDF
              </Button>
            </CardContent>
          </Card>

          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Membership &amp; app pricing</CardTitle>
              <CardDescription>
                Issue renewals, set early-bird window, and choose whether the app is included in membership.
                Current {memClass} fee: {rand(membershipFeeNow(memClass))}.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid max-w-xl gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium">
                  Rider
                  <Select className="mt-1" value={memRider} onChange={(e) => setMemRider(e.target.value)}>
                    {world.riders.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} · {r.sa}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="text-sm font-medium">
                  Class
                  <Select className="mt-1" value={memClass} onChange={(e) => setMemClass(e.target.value)}>
                    {Object.keys(MEMBERSHIP_EARLY_BIRD).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
              <Button onClick={() => issueMembershipInvoice(memRider, { klass: memClass })}>Issue membership invoice</Button>

              <label className="text-sm font-medium">
                Early bird ends
                <div className="mt-1 flex gap-2">
                  <Input type="date" value={earlyBirdEnds} onChange={(e) => setLocalEarlyBird(e.target.value)} />
                  <Button variant="secondary" onClick={() => setEarlyBirdEnds(earlyBirdEnds)}>
                    Save
                  </Button>
                </div>
              </label>

              <div className="grid gap-2 text-xs text-stone-600 sm:grid-cols-2">
                <div>
                  <p className="font-semibold text-stone-800">Early bird</p>
                  {Object.entries(MEMBERSHIP_EARLY_BIRD).map(([k, v]) => (
                    <p key={k}>
                      {k} · {rand(v)}
                    </p>
                  ))}
                </div>
                <div>
                  <p className="font-semibold text-stone-800">Standard</p>
                  {Object.entries(MEMBERSHIP_STANDARD).map(([k, v]) => (
                    <p key={k}>
                      {k} · {rand(v)}
                    </p>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(world.membershipIncludesApp)}
                  onChange={(e) => setMembershipIncludesApp(e.target.checked)}
                />
                App subscription included in annual membership
              </label>
              {!world.membershipIncludesApp ? (
                <label className="text-sm font-medium">
                  Separate app price (R)
                  <div className="mt-1 flex gap-2">
                    <Input value={appPrice} onChange={(e) => setLocalAppPrice(e.target.value)} type="number" min="0" />
                    <Button variant="secondary" onClick={() => setAppPrice(appPrice)}>
                      Save
                    </Button>
                  </div>
                </label>
              ) : null}

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(world.kickOutOverdue)}
                  onChange={(e) => setKickOutOverdue(e.target.checked)}
                />
                Kick out overdue members (limit app until membership paid)
              </label>
            </CardContent>
          </Card>

          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Public links</CardTitle>
              <CardDescription>Shown in the footer and on the complaints desk.</CardDescription>
            </CardHeader>
            <CardContent className="grid max-w-lg gap-3">
              {['website', 'facebook', 'instagram', 'tiktok', 'whatsapp', 'email'].map((key) => (
                <label key={key} className="text-sm font-medium capitalize">
                  {key}
                  <Input
                    className="mt-1"
                    value={links[key] || ''}
                    onChange={(e) => setLocalLinks({ ...links, [key]: e.target.value })}
                  />
                </label>
              ))}
              <Button onClick={() => setLinks(links)}>Save links</Button>
            </CardContent>
          </Card>

          {sys ? (
            <Card>
              <CardHeader>
                <CardTitle>Sys admin</CardTitle>
                <CardDescription>Demo chrome and season restore live under Dev tools.</CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/dev">
                  <Button variant="secondary">Open Dev tools</Button>
                </Link>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : (
        <>
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Season accent</CardTitle>
              <CardDescription>Pitch-only chrome. BRSA management does not need this.</CardDescription>
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

          <Card className="mb-4">
            <CardHeader>
              <CardTitle>This device</CardTitle>
              <CardDescription>Wipe local pitch state and restore the sample 2026/27 season.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="secondary" onClick={resetDemo}>
                <RotateCcw size={14} />
                Restore sample season
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Federation desk</CardTitle>
              <CardDescription>Member view-as and complaints stay on BRSA office.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/admin">
                <Button>Open BRSA office</Button>
              </Link>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
