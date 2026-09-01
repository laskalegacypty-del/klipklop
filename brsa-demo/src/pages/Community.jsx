import { Link } from 'react-router-dom'
import { useDemo } from '../demo/store'
import { Card, CardContent } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'

export function Community() {
  const { world, riderById } = useDemo()
  const posts = [...world.community].sort((a, b) => new Date(b.at) - new Date(a.at))

  return (
    <div>
      <PageHeader title="Community" description="Rider posts — photo, video, result. Not the official news feed." />
      <div className="space-y-3">
        {posts.map((post) => {
          const rider = riderById(post.riderId)
          return (
            <Card key={post.id}>
              <CardContent>
                <p className="text-xs uppercase tracking-wide text-stone-500">
                  {post.kind} · {new Date(post.at).toLocaleString('en-ZA')}
                </p>
                <p className="mt-1">
                  <Link className="font-semibold hover:underline" to={`/riders/${rider.id}`}>
                    {rider.name}
                  </Link>
                </p>
                <p className="mt-1 text-stone-700">{post.text}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
