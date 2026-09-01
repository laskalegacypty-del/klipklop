import { Link } from 'react-router-dom'
import { useDemo } from '../demo/store'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'

export function AdminPage() {
  const { world, user, makeOfficial, setMembershipIncludesApp, eventById } = useDemo()
  if (user.role !== 'admin') {
    return <p>Admin seat only. Switch to BRSA Admin above.</p>
  }

  const west = eventById('west-fest')
  const unpaid = world.invoices.filter((i) => !i.paid)
  const due = world.riders.filter((r) => /due/i.test(r.membershipNote) || world.invoices.some((i) => i.riderId === r.id && i.type === 'membership' && !i.paid))

  return (
    <div>
      <PageHeader title="BRSA admin" description={`${world.riders.length} members on the books this season.`} />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>App vs membership</CardTitle>
          <CardDescription>Don’t pick a fight in the pitch — show both.</CardDescription>
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
          <span className="text-stone-500">
            {world.membershipIncludesApp ? 'Currently: included' : 'Currently: separate sub'}
          </span>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>West Fest</CardTitle>
            <CardDescription>Mark official when you’ve walked the unofficial board.</CardDescription>
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
            <CardDescription>{unpaid.length} unpaid · fines block entry</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {unpaid.map((i) => (
                <li key={i.id}>
                  {world.riders.find((r) => r.id === i.riderId)?.name} — {i.label}
                </li>
              ))}
            </ul>
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
            {due.map((r) => (
              <p key={r.id}>
                {r.name} · {r.membershipNote}
              </p>
            ))}
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
    </div>
  )
}
