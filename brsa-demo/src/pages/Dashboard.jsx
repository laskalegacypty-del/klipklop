import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useDemo } from '../demo/store'
import { rand, showsAttended } from '../demo/money'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'
import { StatCard } from '../components/ui/StatCard'

export function Dashboard() {
  const { user, rider, world, unpaidFines, unpaidMembership, officialStandings, payInvoice } = useDemo()
  const hooksRider = rider

  const stats = useMemo(() => {
    if (!hooksRider) return { rank: 0, shows: 0, horses: 0 }
    return {
      rank: officialStandings().findIndex((r) => r.id === hooksRider.id) + 1,
      shows: showsAttended(world.entries, hooksRider.id),
      horses: world.horses.filter((h) => h.riderId === hooksRider.id).length,
    }
  }, [hooksRider, officialStandings, world.entries, world.horses])

  if (user.role !== 'rider' || !rider) {
    return <EmptyState title="My season" description="This page is for riders — points, money and the next show." />
  }

  const fines = unpaidFines(rider.id)
  const dues = unpaidMembership(rider.id)
  const championshipsCut = 40

  return (
    <div>
      <PageHeader title="My season" description={`${rider.name} · ${rider.sa} · ${rider.membershipNote}`} />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="In my pocket" value={rand(rider.wallet)} hint="Only you see this" />
        <StatCard label="Points" value={rider.points} hint={`#${stats.rank} in ${rider.class}`} />
        <StatCard label="Shows this season" value={stats.shows} hint={`${stats.horses} horses in the barn`} />
        <StatCard label="Championships" value={rider.points >= championshipsCut ? 'You are on the list' : `${championshipsCut - rider.points} points to go`} hint={`Need ${championshipsCut} points`} />
      </div>
      {dues.length ? (
        <Card className="mt-5 border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle>Membership renewal is due</CardTitle>
            <CardDescription>
              {dues[0].label} — {rand(dues[0].amount)}. New entries are blocked until this is paid.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="lg" onClick={() => payInvoice(dues[0].id, { fromWallet: true })}>
              Pay {rand(dues[0].amount)}
            </Button>
          </CardContent>
        </Card>
      ) : null}
      {fines.length ? (
        <Card className="mt-5 border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle>Fine still open</CardTitle>
            <CardDescription>
              {fines[0].label} — {rand(fines[0].amount)}. The office will not take your next entry until this is paid.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button size="lg" onClick={() => payInvoice(fines[0].id)}>
                Pay {rand(fines[0].amount)}
              </Button>
              <Link to="/wallet">
                <Button variant="secondary">See what I owe</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : null}
      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Barn</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {world.horses
            .filter((h) => h.riderId === rider.id)
            .map((h) => (
              <Link key={h.id} to={`/horses/${h.id}`}>
                <Badge>{h.name}</Badge>
              </Link>
            ))}
          <Link to={`/riders/${rider.id}`}>
            <Button variant="secondary" size="sm">
              Edit profile
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
