import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDemo } from '../demo/store'
import { rand } from '../demo/money'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { Select } from '../components/ui/Select'

export function FanProfile() {
  const { fanId } = useParams()
  const { fanById, riderById, world, fan, upgradeFanToRider, boostRider } = useDemo()
  const card = fanById(fanId)
  const [klass, setKlass] = useState('Adult')
  const [province, setProvince] = useState('Gauteng')
  if (!card) return <p>Supporter not found.</p>
  const fav = riderById(card.biggestFanOf)
  const mine = fan?.id === card.id
  const provinces = [...new Set(world.riders.map((r) => r.province))]

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
              Following{' '}
              <Link className="underline" to={`/riders/${fav.id}`}>
                {fav.name}
              </Link>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {fav ? <Button onClick={() => boostRider(fav.id, 50)}>Boost R50</Button> : null}
          </div>
          {mine ? (
            <div className="grid max-w-md gap-2 pt-2">
              <p className="text-sm font-medium">Upgrade to rider</p>
              <Select value={klass} onChange={(e) => setKlass(e.target.value)}>
                {['Peewee', 'Junior', 'Youth', 'Adult', 'Senior'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
              <Select value={province} onChange={(e) => setProvince(e.target.value)}>
                {provinces.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Select>
              <Button variant="secondary" onClick={() => upgradeFanToRider(card.id, { klass, province })}>
                Upgrade to rider
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
