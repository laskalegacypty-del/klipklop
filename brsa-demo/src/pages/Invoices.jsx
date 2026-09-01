import { useDemo } from '../demo/store'
import { rand } from '../demo/money'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'
import { Table, TableWrap, Td, Th } from '../components/ui/Table'

export function Invoices() {
  const { world, user, rider, payInvoice } = useDemo()
  const rows =
    user.role === 'admin'
      ? world.invoices
      : world.invoices.filter((i) => i.riderId === rider?.id)

  return (
    <div>
      <PageHeader
        title="Invoices & fines"
        description="Unpaid fines block the next entry. Day-member winnings can walk toward membership — shown as copy, not a live debit."
      />
      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>Item</Th>
              {user.role === 'admin' ? <Th>Rider</Th> : null}
              <Th>Type</Th>
              <Th>Amount</Th>
              <Th>Status</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((inv) => (
              <tr key={inv.id}>
                <Td className="font-medium">{inv.label}</Td>
                {user.role === 'admin' ? (
                  <Td>{world.riders.find((r) => r.id === inv.riderId)?.name ?? '—'}</Td>
                ) : null}
                <Td className="capitalize">{inv.type}</Td>
                <Td>{rand(inv.amount)}</Td>
                <Td>{inv.paid ? <Badge variant="success">Paid</Badge> : <Badge variant="danger">Unpaid</Badge>}</Td>
                <Td>
                  {!inv.paid ? (
                    <Button size="sm" onClick={() => payInvoice(inv.id)}>
                      Pay
                    </Button>
                  ) : null}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
    </div>
  )
}
