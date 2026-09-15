import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useDemo } from '../demo/store'
import { rand, showsAttended } from '../demo/money'
import { isPhotoSrc } from '../lib/imageCrop'
import { PhotoStage } from '../components/PhotoCropper'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Select } from '../components/ui/Select'
import { Textarea } from '../components/ui/Textarea'
import { StatCard } from '../components/ui/StatCard'

export function RiderProfile() {
  const { riderId } = useParams()
  const navigate = useNavigate()
  const { world, riderById, user, rider, boostRider, payRiderDirect, officialStandings, saveProfile, registerHorse, toggleFollow } = useDemo()
  const card = riderById(riderId)
  const [bio, setBio] = useState(card?.bio ?? '')
  const [addingHorse, setAddingHorse] = useState(false)
  if (!card) return <p>Rider not found.</p>

  const horses = world.horses.filter((h) => h.riderId === card.id)
  const rank = officialStandings().findIndex((r) => r.id === card.id) + 1
  const shows = showsAttended(world.entries.filter((e) => e.paid), card.id)
  const mine = rider?.id === card.id
  const who = rider?.id || world.users.find((u) => u.id === world.currentUserId)?.fanId
  const following = world.follows?.[who] ?? []
  const results = world.results.filter((r) => r.riderId === card.id && r.time != null)

  return (
    <div>
      <div className="mb-5 overflow-hidden rounded-xl bg-charcoal text-brand-50">
        <div className="h-1 bg-brand-400" />
        <PhotoStage
          slot="cover"
          src={card.cover}
          alt=""
          editable={mine}
          onSave={(cover) => saveProfile(card.id, { cover })}
          empty={<div className="h-full w-full bg-gradient-to-br from-ink via-charcoal to-stone-800" />}
        />
        <div className="px-5 pb-5 -mt-8">
          <PhotoStage
            slot="avatar"
            src={card.photo}
            alt=""
            editable={mine}
            onSave={(photo) => saveProfile(card.id, { photo })}
            className="h-20 w-20 rounded-sm ring-2 ring-charcoal"
            compact
            empty={
              <div className="flex h-full w-full items-center justify-center bg-brand-400 font-display text-2xl font-bold text-charcoal">
                {card.name.slice(0, 1)}
              </div>
            }
          />
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-display text-4xl font-semibold">{card.name}</h1>
              <p className="mt-1 text-sm text-brand-200">
                {card.sa} · {card.class} · {card.province}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {user.role === 'fan' ? <Button onClick={() => boostRider(card.id, 50)}>Boost R50</Button> : null}
              {user.role !== 'rider' && user.role !== 'fan' ? (
                <Button variant="secondary" onClick={() => payRiderDirect(card.id, 100)}>
                  Direct pay R100
                </Button>
              ) : null}
              {who && who !== card.id ? (
                <Button variant="ghost" onClick={() => toggleFollow(card.id)}>
                  {following.includes(card.id) ? 'Following' : 'Follow'}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Rank" value={`#${rank}`} />
        <StatCard label="Points" value={card.points} />
        <StatCard label="Shows" value={shows} />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Barn</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {horses.map((h) => (
              <Link key={h.id} to={`/horses/${h.id}`} className="flex items-center gap-3 rounded-md border border-dust-200 px-3 py-2">
                {isPhotoSrc(h.photo) ? (
                  <img src={h.photo} alt="" className="h-14 w-11 flex-shrink-0 rounded-sm object-cover" />
                ) : (
                  <span className="flex h-14 w-11 flex-shrink-0 items-center justify-center rounded-sm bg-dust-100 text-xs text-stone-400">
                    {h.name.slice(0, 1)}
                  </span>
                )}
                <span>
                  <p className="font-semibold">{h.name}</p>
                  <p className="text-sm text-stone-600">
                    {h.sex} · {h.age}yo · {h.colour} · {h.height}
                  </p>
                </span>
              </Link>
            ))}
            {mine ? (
              <Button size="sm" variant="secondary" onClick={() => setAddingHorse(true)}>
                Register a horse
              </Button>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Card</CardTitle>
            <CardDescription>
              {card.sa} · {card.membershipNote || card.class}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>Sponsors · {card.sponsors.length ? card.sponsors.join(', ') : 'Open'}</p>
            {mine ? (
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                onBlur={() => saveProfile(card.id, { bio })}
                autoSize
                placeholder="A few lines about you, the barn, and the season…"
              />
            ) : (
              <p className="whitespace-pre-wrap leading-relaxed text-stone-600">{card.bio}</p>
            )}
            <p className="text-xs uppercase tracking-wide text-stone-500">Season results</p>
            <ul className="space-y-1">
              {results.map((r) => (
                <li key={r.id}>
                  {world.events.find((e) => e.id === r.eventId)?.name} · {r.time.toFixed(3)} · {r.division}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <RegisterHorseModal
        open={addingHorse}
        onClose={() => setAddingHorse(false)}
        onSave={(patch) => {
          const id = registerHorse(card.id, patch)
          if (id) {
            setAddingHorse(false)
            navigate(`/horses/${id}`)
          }
        }}
      />
    </div>
  )
}

function RegisterHorseModal({ open, onClose, onSave }) {
  const [form, setForm] = useState({ name: '', sex: 'Gelding', age: '6', colour: 'Bay' })

  useEffect(() => {
    if (open) setForm({ name: '', sex: 'Gelding', age: '6', colour: 'Bay' })
  }, [open])

  function submit() {
    onSave({
      name: form.name.trim(),
      sex: form.sex,
      age: Number(form.age) || 6,
      colour: form.colour.trim() || 'Bay',
    })
  }

  return (
    <Modal open={open} onClose={onClose} title="Register a horse">
      <p className="text-sm text-stone-600">Name the horse first. You can add a photo and pedigree on the next screen.</p>
      <label className="block text-sm font-medium">
        Name
        <Input
          className="mt-1"
          autoFocus
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Eagle"
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Sex
          <Select className="mt-1" value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
            <option>Gelding</option>
            <option>Mare</option>
            <option>Stallion</option>
          </Select>
        </label>
        <label className="block text-sm font-medium">
          Age
          <Input className="mt-1" type="number" min="1" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
        </label>
      </div>
      <label className="block text-sm font-medium">
        Colour
        <Input className="mt-1" value={form.colour} onChange={(e) => setForm({ ...form, colour: e.target.value })} />
      </label>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!form.name.trim()}>
          Add horse
        </Button>
      </div>
    </Modal>
  )
}
