import { Link, useParams } from 'react-router-dom'
import { useDemo } from '../demo/store'
import { rand } from '../demo/money'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { PageHeader } from '../components/ui/PageHeader'

export function HorseProfile() {
  const { horseId } = useParams()
  const { horseById, riderById, rider, saveHorse, world } = useDemo()
  const horse = horseById(horseId)
  if (!horse) return <p>Horse not found.</p>
  const owner = riderById(horse.riderId)
  const mine = rider?.id === horse.riderId
  const runs = world.results.filter((r) => r.horseId === horse.id && r.time != null)

  return (
    <div>
      <PageHeader title={horse.name} description={`${horse.sex} · ${horse.age}yo · ${horse.colour} · ${horse.height}`} />
      <Card>
        <CardHeader>
          <CardTitle>Pedigree</CardTitle>
          <CardDescription>
            Rider{' '}
            <Link className="underline" to={`/riders/${owner?.id}`}>
              {owner?.name}
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
          <p>Sire · {horse.sire}</p>
          <p>Dam · {horse.dam}</p>
          <p>LTE · {rand(horse.lte)}</p>
          <p>Futurity · {horse.futurity ? 'Yes' : 'No'}</p>
          {mine ? (
            <Input
              defaultValue={horse.sire}
              onBlur={(e) => saveHorse(horse.id, { sire: e.target.value })}
              placeholder="Sire"
            />
          ) : null}
        </CardContent>
      </Card>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Clock</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          {runs.map((r) => (
            <p key={r.id}>
              {world.events.find((e) => e.id === r.eventId)?.name} · {r.time.toFixed(3)} · {r.division}
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
