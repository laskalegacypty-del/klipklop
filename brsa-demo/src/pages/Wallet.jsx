import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDemo } from '../demo/store'
import { rand } from '../demo/money'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Input } from '../components/ui/Input'
import { PageHeader } from '../components/ui/PageHeader'
import { Table, TableWrap, Td, Th } from '../components/ui/Table'
import { Tabs } from '../components/ui/Tabs'

export function Wallet() {
  const {
    user,
    rider,
    fan,
    producer,
    world,
    boostRider,
    withdrawWallet,
    updateBankDetails,
    setDebitOrder,
    payInvoice,
    writeOffMembership,
    topSupporters,
  } = useDemo()
  const [tab, setTab] = useState(() => 'balance')
  const owner = rider ? { id: rider.id, type: 'rider' } : fan ? { id: fan.id, type: 'fan' } : null
  const wallet = rider?.wallet ?? fan?.wallet
  const bank = rider?.bank ?? fan?.bank ?? {}
  const txs = (world.transactions ?? []).filter((t) => owner && t.ownerId === owner.id)
  const invoices = rider
    ? world.invoices.filter((i) => i.riderId === rider.id)
    : user.role === 'producer'
      ? world.invoices
      : []
  const supporters = topSupporters()
  const owing = invoices.filter((i) => !i.paid)

  if (wallet == null && user.role !== 'producer') {
    return <EmptyState title="No wallet on this account" description="Riders and supporters hold wallets. A sponsor can still send a direct payment from a rider profile." />
  }

  return (
    <div>
      <PageHeader title="Money" description="What you have, what you owe, and where it went." />
      <Tabs
        tabs={[
          { id: 'balance', label: 'Pocket' },
          { id: 'invoices', label: 'What I owe' },
          { id: 'bank', label: 'Bank' },
          { id: 'ledger', label: 'History' },
          { id: 'supporters', label: 'Biggest fans' },
        ]}
        activeTab={tab}
        onChange={setTab}
      />
      <div className="mt-5">
        {tab === 'balance' && (
          <div className="space-y-4">
            {owing.length ? (
              <Card className="border-red-200 bg-red-50">
                <CardHeader>
                  <CardTitle>You still owe</CardTitle>
                  <CardDescription>
                    {owing.map((i) => `${i.label} ${rand(i.amount)}`).join(' · ')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button size="lg" onClick={() => payInvoice(owing[0].id, { fromWallet: Boolean(rider) })}>
                    Pay {rand(owing[0].amount)}
                  </Button>
                </CardContent>
              </Card>
            ) : null}
            <Card>
              <CardHeader>
                <CardTitle>{rand(wallet ?? world.brsaWallet)}</CardTitle>
                <CardDescription>{rider ? `Won this season ${rand(rider.earnings)}` : fan ? 'Money you can send to a rider' : "BRSA's cut this season"}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {fan ? <Button onClick={() => boostRider('sunny', 50)}>Boost Liani R50</Button> : null}
                {owner ? (
                  <Button variant="secondary" onClick={() => withdrawWallet(100, owner)}>
                    Send R100 to my bank
                  </Button>
                ) : null}
              </CardContent>
            </Card>
            {rider
              ? Object.values(world.payouts)
                  .filter((p) => p.riderShares.some((s) => s.riderId === rider.id))
                  .map((p) => {
                    const share = p.riderShares.find((s) => s.riderId === rider.id)
                    const event = world.events.find((e) => e.id === p.eventId)
                    return (
                      <Card key={p.eventId}>
                        <CardHeader>
                          <CardTitle>{event?.name}</CardTitle>
                          <CardDescription>
                            Share {rand(share.amount)}
                            {share.appliedToMembership ? ` · ${rand(share.appliedToMembership)} to membership` : ''}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="flex gap-2">
                          <Link to={`/events/${p.eventId}?tab=payout`}>
                            <Button variant="secondary" size="sm">
                              Receipt
                            </Button>
                          </Link>
                          {share.appliedToMembership && !share.writtenOff ? (
                            <Button size="sm" variant="ghost" onClick={() => writeOffMembership(p.eventId, rider.id)}>
                              Keep it as cash instead
                            </Button>
                          ) : null}
                        </CardContent>
                      </Card>
                    )
                  })
              : null}
          </div>
        )}
        {tab === 'invoices' && (
          invoices.length === 0 ? (
            <EmptyState title="No invoices" description="Entry, membership and fines land here." />
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    {user.role === 'producer' ? <Th>Rider</Th> : null}
                    <Th>Item</Th>
                    <Th>Amount</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      {user.role === 'producer' ? <Td>{world.riders.find((r) => r.id === inv.riderId)?.name}</Td> : null}
                      <Td>
                        {inv.label}
                        <span className="ml-2 text-xs uppercase text-stone-400">{inv.type}</span>
                      </Td>
                      <Td>{rand(inv.amount)}</Td>
                      <Td>
                        {inv.paid ? (
                          'Paid'
                        ) : (
                          <Button size="sm" onClick={() => payInvoice(inv.id, { fromWallet: Boolean(rider) })}>
                            Pay
                          </Button>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )
        )}
        {tab === 'bank' && owner ? (
          <Card>
            <CardHeader>
              <CardTitle>Bank details</CardTitle>
              <CardDescription>Withdrawals use this account. Debit order auto-renews membership from wallet.</CardDescription>
            </CardHeader>
            <CardContent className="grid max-w-md gap-3">
              <Input defaultValue={bank.bank} placeholder="Bank" onBlur={(e) => updateBankDetails({ bank: e.target.value }, owner)} />
              <Input defaultValue={bank.account} placeholder="Account" onBlur={(e) => updateBankDetails({ account: e.target.value }, owner)} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" defaultChecked={Boolean(rider?.debitOrder ?? fan?.debitOrder)} onChange={(e) => setDebitOrder(e.target.checked, owner)} />
                Debit order / auto-renew
              </label>
            </CardContent>
          </Card>
        ) : null}
        {tab === 'ledger' && (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Item</Th>
                  <Th>Dir</Th>
                  <Th>Amount</Th>
                </tr>
              </thead>
              <tbody>
                {txs.map((t) => (
                  <tr key={t.id}>
                    <Td>{new Date(t.at).toLocaleString('en-ZA')}</Td>
                    <Td>{t.label}</Td>
                    <Td>{t.dir}</Td>
                    <Td>{rand(t.amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
        {tab === 'supporters' && (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>#</Th>
                  <Th>Supporter</Th>
                  <Th>Boosted</Th>
                </tr>
              </thead>
              <tbody>
                {supporters.map((s, i) => (
                  <tr key={s.id}>
                    <Td>{i + 1}</Td>
                    <Td>
                      <Link className="underline" to={`/fans/${s.id}`}>
                        {s.name}
                      </Link>
                    </Td>
                    <Td>{rand(s.amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </div>
    </div>
  )
}
