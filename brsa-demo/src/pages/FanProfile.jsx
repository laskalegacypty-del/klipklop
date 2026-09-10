import { Link, useParams } from 'react-router-dom'
import { useDemo } from '../demo/store'
import { rand } from '../demo/money'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'

export function FanProfile() {
  const { fanId } = useParams()
  const { fanById, riderById, world, user, fan, upgradeFanToRider, boostRider } = useDemo()
  const card = fanById(fanId)
  if (!card) return <p>Supporter not found.</p>
  const fav = riderById(card.biggestFanOf)
  const mine = fan?.id === card.id

  return (
    <div>
      <PageHeader title={card.name} description="Supporter" />
      <Card>
        <CardHeader>
          <CardTitle>{rand(card.wallet)}</CardTitle>
          <CardDescription>{card.bio}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {fav ? (
            <p>
              Biggest fan of{' '}
              <Link className="underline" to={`/riders/${fav.id}`}>
                {fav.name}
              </Link>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {fav ? <Button onClick={() => boostRider(fav.id, 50)}>Boost R50</Button> : null}
            {mine ? <Button variant="secondary" onClick={() => upgradeFanToRider(card.id)}>Upgrade to rider</Button> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
