import { Link } from 'react-router-dom'
import { useDemo } from '../demo/store'
import { rand } from '../demo/money'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'

export function ProducerPage() {
  const { user, producer, world, entriesFor } = useDemo()
  if (user.role !== 'producer' || !producer) {
    return <p>Switch to Ansie (producer / demo).</p>
  }

  const events = world.events.filter((e) => producer.eventIds.includes(e.id) || e.producerId === producer.id)

  return (
    <div>
      <PageHeader title="Producer desk" description={`${producer.name} · ${producer.region} · ${producer.phone}`} />
      <div className="grid gap-4">
        {events.map((event) => {
          const paid = entriesFor(event.id, { paidOnly: true })
          return (
            <Card key={event.id}>
              <CardHeader>
                <CardTitle>{event.name}</CardTitle>
                <CardDescription>
                  Admin / producing cost {rand(event.adminFee)} per entry · {paid.length} paid in the field
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Link to={`/events/${event.id}`}>
                  <Button>Open flyer</Button>
                </Link>
                <p className="self-center text-sm text-stone-600">
                  Contact: {producer.email}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
