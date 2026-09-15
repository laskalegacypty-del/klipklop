import { Link, useParams } from 'react-router-dom'
import { useDemo } from '../demo/store'
import { rand } from '../demo/money'
import { PhotoStage } from '../components/PhotoCropper'
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
      <PhotoStage
        slot="horse"
        src={horse.photo}
        alt={horse.name}
        editable={mine}
        onSave={(photo) => saveHorse(horse.id, { photo })}
        className="mb-4 max-w-md rounded-xl"
        empty={
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-ink via-charcoal to-stone-800 text-sm text-stone-400">
            {mine ? 'Add a photo of this horse' : 'No photo yet'}
          </div>
        }
      />
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
          {mine ? (
            <label className="sm:col-span-2 text-sm font-medium">
              Name
              <Input
                className="mt-1"
                defaultValue={horse.name}
                onBlur={(e) => {
                  const name = e.target.value.trim()
                  if (name && name !== horse.name) saveHorse(horse.id, { name })
                }}
              />
            </label>
          ) : null}
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
          {runs.length === 0 ? <p className="text-stone-500">No times posted yet.</p> : null}
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
