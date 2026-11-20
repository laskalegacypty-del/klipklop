import { useState } from 'react'
import { useDemo } from '../demo/store'
import { COMPLAINT_FEE, rand } from '../demo/money'
import { isFedStaff } from '../demo/world'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Input } from '../components/ui/Input'
import { PageHeader } from '../components/ui/PageHeader'
import { Select } from '../components/ui/Select'

const REASONS = ['Draw / running order', 'Membership / app', 'Payout', 'Welfare', 'Other']

export function Complaints() {
  const { user, rider, fan, world, submitComplaint, replyToComplaint, resolveComplaint } = useDemo()
  const [reason, setReason] = useState(REASONS[0])
  const [message, setMessage] = useState('')
  const [reply, setReply] = useState({})
  const desk = isFedStaff(user.role) || user.role === 'producer'
  const who = rider?.id || fan?.id
  const wallet = rider?.wallet ?? fan?.wallet ?? 0
  const mine = (world.complaints || []).filter((c) => c.fromId === who)
  const all = world.complaints || []
  const list = desk ? all : mine
  const open = list.filter((c) => c.status === 'open')
  const done = list.filter((c) => c.status !== 'open')

  if (user.role !== 'rider' && user.role !== 'fan' && user.role !== 'producer' && !isFedStaff(user.role)) {
    return <EmptyState title="Queries & complaints" description="Riders, supporters, BRSA and the producer use this desk. Time disputes stay on My times." />
  }

  function fromName(c) {
    return world.riders.find((r) => r.id === c.fromId)?.name || world.fans.find((f) => f.id === c.fromId)?.name || c.fromRole
  }

  return (
    <div>
      <PageHeader
        title="Queries & complaints"
        description={
          desk
            ? 'BRSA owns this queue. Reply and close items here. Verified complaints refund the R500 fee. Time disputes stay on My times.'
            : `R${COMPLAINT_FEE} fee (refundable if verified). Separate from a race-time query.`
        }
      />
      {world.links?.whatsapp || world.links?.email ? (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle>Talk to the office</CardTitle>
            <CardDescription>Federation line — not the time-query queue.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {world.links.whatsapp ? (
              <a href={world.links.whatsapp} target="_blank" rel="noreferrer">
                <Button variant="secondary">WhatsApp</Button>
              </a>
            ) : null}
            {world.links.email ? (
              <a href={world.links.email}>
                <Button variant="ghost">Email</Button>
              </a>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {!desk ? (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle>Send a complaint</CardTitle>
            <CardDescription>
              Fee {rand(COMPLAINT_FEE)} is taken from your wallet now and refunded if BRSA verifies the complaint. Wallet balance {rand(wallet)}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
            <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What happened?" />
            <Button
              onClick={() => {
                if (!message.trim()) return
                submitComplaint({ reason, message: message.trim() })
                setMessage('')
              }}
            >
              Send · pay {rand(COMPLAINT_FEE)}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <h2 className="mb-2 font-display text-xl">Open</h2>
      <div className="space-y-3">
        {open.length === 0 ? <p className="text-sm text-stone-500">Nothing open.</p> : null}
        {open.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <CardTitle>{c.reason}</CardTitle>
              <CardDescription>
                {desk ? `${fromName(c)} · ${c.fromRole} · ` : ''}
                {new Date(c.at).toLocaleString('en-ZA')}
                {c.fee ? ` · fee ${rand(c.fee)} held` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{c.message}</p>
              {(c.replies || []).map((r) => (
                <p key={r.at} className="rounded-sm bg-dust-100 px-3 py-2 text-stone-600">
                  <span className="font-semibold">{r.from}: </span>
                  {r.text}
                </p>
              ))}
              {desk ? (
                <div className="flex flex-wrap gap-2">
                  <Input
                    value={reply[c.id] || ''}
                    onChange={(e) => setReply({ ...reply, [c.id]: e.target.value })}
                    placeholder="Reply"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (reply[c.id]?.trim()) replyToComplaint(c.id, reply[c.id].trim())
                      setReply({ ...reply, [c.id]: '' })
                    }}
                  >
                    Reply
                  </Button>
                  <Button onClick={() => resolveComplaint(c.id, { verified: true })}>Verify & refund {rand(c.fee || COMPLAINT_FEE)}</Button>
                  <Button variant="ghost" onClick={() => resolveComplaint(c.id, { verified: false })}>
                    Close without refund
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <h2 className="mb-2 mt-6 font-display text-xl">Resolved</h2>
      <div className="space-y-3">
        {done.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <CardTitle>{c.reason}</CardTitle>
              <CardDescription>
                {desk ? `${fromName(c)} · ` : ''}Closed {c.resolvedAt ? new Date(c.resolvedAt).toLocaleString('en-ZA') : ''}
                {c.verified ? ' · verified · fee refunded' : c.fee ? ' · closed without refund' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-stone-600">
              <p>{c.message}</p>
              {(c.replies || []).map((r) => (
                <p key={r.at} className="rounded-sm bg-dust-100 px-3 py-2">
                  <span className="font-semibold">{r.from}: </span>
                  {r.text}
                </p>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
