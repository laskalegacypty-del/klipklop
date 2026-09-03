import { BookDown } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'

const RULES = [
  {
    title: 'Dress',
    body: 'Long sleeve, collar, hat or helmet in the alley. Numbers visible both sides. No dress protest after the first horse runs.',
  },
  {
    title: 'Tack',
    body: 'Western saddle. Tie-downs legal. No training devices in the pattern. Bit protest must be lodged before the class is paid out.',
  },
  {
    title: 'Welfare',
    body: 'Steward can scratch a horse at the gate. Blood, excessive use of the crop, or an exhausted horse is a no-time and a possible fine.',
  },
]

const RULEBOOK = `BRSA Rulebook — Gate notes (${new Date().getFullYear()})

Dress
Long sleeve, collar, hat or helmet in the alley. Numbers visible both sides.

Tack
Western saddle. Tie-downs legal. No training devices in the pattern.

Welfare
The steward may scratch a horse at the gate. Blood, excessive use of the crop, or an exhausted horse is a no-time and may carry a fine.
`

export function Rules() {
  return (
    <div>
      <PageHeader
        title="Rulebook"
        description="Dress, tack and welfare at the gate. Download the full notes for the rest."
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              const blob = new Blob([RULEBOOK], { type: 'text/plain' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'BRSA-rulebook.txt'
              a.click()
              URL.revokeObjectURL(url)
            }}
          >
            <BookDown size={16} />
            Download rulebook
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        {RULES.map((rule) => (
          <Card key={rule.title}>
            <CardHeader>
              <CardTitle>{rule.title}</CardTitle>
              <CardDescription>On the gate</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-stone-700 leading-relaxed">{rule.body}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
