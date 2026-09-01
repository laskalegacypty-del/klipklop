import { Link } from 'react-router-dom'
import { useDemo } from '../demo/store'
import { rand } from '../demo/money'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'

export function Wallet() {
  const { user, rider, fan, world, boostRider } = useDemo()

  if (user.role === 'fan' && fan) {
    const sunny = world.riders.find((r) => r.id === 'sunny')
    return (
      <div>
        <PageHeader title="Fan wallet" description={`${fan.name} · boost a rider, they feel it immediately.`} />
        <Card>
          <CardHeader>
            <CardTitle>Balance {rand(fan.wallet)}</CardTitle>
            <CardDescription>Biggest fan of {sunny.name}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button onClick={() => boostRider('sunny', 50)}>Boost Sunny R50</Button>
            <Link to={`/riders/${sunny.id}`}>
              <Button variant="secondary">Sunny’s profile</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!rider) {
    return <p>Switch to a rider or fan seat to see a wallet.</p>
  }

  const payouts = Object.values(world.payouts).filter((p) => p.riderShares.some((s) => s.riderId === rider.id))

  return (
    <div>
      <PageHeader title="Wallet" description="Boosts and payouts land here. No live Paystack in this demo." />
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>{rand(rider.wallet)}</CardTitle>
          <CardDescription>Season earnings {rand(rider.earnings)} · LTE {rand(rider.lte)}</CardDescription>
        </CardHeader>
      </Card>
      {payouts.map((p) => {
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
      })}
    </div>
  )
}
