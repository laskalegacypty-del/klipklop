import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDemo } from '../demo/store'
import { rand } from '../demo/money'
import { PhotoStage } from '../components/PhotoCropper'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { Select } from '../components/ui/Select'
import { Textarea } from '../components/ui/Textarea'

export function FanProfile() {
  const { fanId } = useParams()
  const { fanById, riderById, world, fan, upgradeFanToRider, boostRider, saveFanProfile } = useDemo()
  const card = fanById(fanId)
  const [klass, setKlass] = useState('Adult')
  const [province, setProvince] = useState('Gauteng')
  const [bio, setBio] = useState(card?.bio ?? '')
  if (!card) return <p>Supporter not found.</p>
  const fav = riderById(card.biggestFanOf)
  const mine = fan?.id === card.id
  const provinces = [...new Set(world.riders.map((r) => r.province))]

  return (
    <div>
      <div className="mb-5 overflow-hidden rounded-xl bg-charcoal text-brand-50">
        <div className="h-1 bg-brand-400" />
        <PhotoStage
          slot="cover"
          src={card.cover}
          alt=""
          editable={mine}
          onSave={(cover) => saveFanProfile(card.id, { cover })}
          empty={<div className="h-full w-full bg-gradient-to-br from-ink via-charcoal to-stone-800" />}
        />
        <div className="px-5 pb-5 -mt-8">
          <PhotoStage
            slot="avatar"
            src={card.photo}
            alt=""
            editable={mine}
            onSave={(photo) => saveFanProfile(card.id, { photo })}
            className="h-20 w-20 rounded-sm ring-2 ring-charcoal"
            compact
            empty={
              <div className="flex h-full w-full items-center justify-center bg-brand-400 font-display text-2xl font-bold text-charcoal">
                {card.name.slice(0, 1)}
              </div>
            }
          />
          <div className="mt-3">
            <h1 className="font-display text-4xl font-semibold">{card.name}</h1>
            <p className="mt-1 text-sm text-brand-200">Supporter</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{rand(card.wallet)}</CardTitle>
          <CardDescription>Wallet · boost riders from here</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {mine ? (
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              onBlur={() => saveFanProfile(card.id, { bio })}
              autoSize
              placeholder="A few lines about you…"
            />
          ) : (
            <p className="whitespace-pre-wrap text-stone-600">{card.bio}</p>
          )}
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
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <Select value={province} onChange={(e) => setProvince(e.target.value)}>
                {provinces.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
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
