import { useDemo } from '../demo/store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'

export function HallOfFame() {
  const { world } = useDemo()
  return (
    <div>
      <PageHeader title="Hall of Fame" description="Champions of seasons past." />
      <div className="grid gap-4 sm:grid-cols-2">
        {world.hallOfFame.map((card) => (
          <Card key={card.id} className="overflow-hidden bg-charcoal text-brand-50 border-charcoal">
            <div className="h-0.5 bg-brand-400" />
            <div className="h-px bg-season" />
            <CardHeader>
              <CardDescription className="text-season uppercase tracking-[0.16em]">
                {card.year} · {card.title}
              </CardDescription>
              <CardTitle className="text-brand-50">{card.name}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-stone-400">{card.horse || card.rider || 'Inducted'}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
