import { useDemo } from '../demo/store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'

export function HallOfFame() {
  const { world } = useDemo()
  return (
    <div>
      <PageHeader title="Hall of Fame" description="Set dressing they should notice." />
      <div className="grid gap-4 sm:grid-cols-2">
        {world.hallOfFame.map((card) => (
          <Card key={card.id} className="bg-charcoal text-brand-50 border-charcoal">
            <CardHeader>
              <CardDescription className="text-brand-200">
                {card.year} · {card.title}
              </CardDescription>
              <CardTitle className="text-brand-50">{card.name}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-stone-300">{card.horse || card.rider || 'Inducted'}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
