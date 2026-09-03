import { Link } from 'react-router-dom'
import { useDemo } from '../demo/store'
import { rand } from '../demo/money'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'

export function Wallet() {
  const { user, rider, fan, world, boostRider } = useDemo()

  if (user.role === 'fan' && fan) {
    const sunny = world.riders.find((r) => r.id === 'sunny')
    return (
      <div>
        <PageHeader title="Wallet" description="Boosts land on the rider’s wallet and the news feed." />
        <Card>
          <CardHeader>
            <CardTitle>{rand(fan.wallet)}</CardTitle>
            <CardDescription>Biggest fan of {sunny.name}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button onClick={() => boostRider('sunny', 50)}>Boost {sunny.name.split(' ')[0]} R50</Button>
            <Link to={`/riders/${sunny.id}`}>
              <Button variant="secondary">Open profile</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!rider) {
    return (
      <EmptyState
        title="No wallet on this account"
        description="Wallets sit on rider and supporter accounts."
      />
    )
  }

  const payouts = Object.values(world.payouts).filter((p) => p.riderShares.some((s) => s.riderId === rider.id))

  return (
    <div>
      <PageHeader title="Wallet" description="Boosts and official payouts land here." />
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>{rand(rider.wallet)}</CardTitle>
          <CardDescription>
            Season earnings {rand(rider.earnings)} · LTE {rand(rider.lte)}
          </CardDescription>
        </CardHeader>
      </Card>
      {payouts.length === 0 ? (
        <EmptyState title="No payouts yet" description="Receipts appear once an event is marked official." />
      ) : (
        payouts.map((p) => {
          const share = p.riderShares.find((s) => s.riderId === rider.id)
          const event = world.events.find((e) => e.id === p.eventId)
          return (
            <Card key={p.eventId} className="mb-3">
              <CardHeader>
                <CardTitle>{event?.name} receipt</CardTitle>
                <CardDescription>
                  Your share {rand(share.amount)} · pool {rand(p.prizePool)} · BRSA {rand(p.brsaAdmin)} · ground{' '}
                  {rand(p.groundLevy)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to={`/events/${p.eventId}?tab=payout`}>
                  <Button variant="secondary">Open full receipt</Button>
                </Link>
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
