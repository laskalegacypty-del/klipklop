import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDemo } from '../demo/store'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Input } from '../components/ui/Input'
import { PageHeader } from '../components/ui/PageHeader'
import { Select } from '../components/ui/Select'

export function Community() {
  const { world, rider, fan, riderById, postCommunity, likeCommunity, commentCommunity, toggleFollow } = useDemo()
  const [text, setText] = useState('')
  const [kind, setKind] = useState('photo')
  const [videoUrl, setVideoUrl] = useState('')
  const [resultId, setResultId] = useState('')
  const who = rider?.id || fan?.id
  const following = world.follows?.[who] ?? []
  const posts = [...world.community].sort((a, b) => {
    const af = following.includes(a.riderId) ? 0 : 1
    const bf = following.includes(b.riderId) ? 0 : 1
    if (af !== bf) return af - bf
    return new Date(b.at) - new Date(a.at)
  })
  const myRuns = rider ? world.results.filter((r) => r.riderId === rider.id && r.time != null) : []

  return (
    <div>
      <PageHeader title="Community" description="Member posts. Official notices stay on News." />
      {rider || fan ? (
        <Card className="mb-4">
          <CardContent className="space-y-3 pt-5">
            <Select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="photo">Photo post</option>
              <option value="video">Video</option>
              <option value="result">Share a result</option>
            </Select>
            {kind === 'video' ? <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://…" /> : null}
            {kind === 'result' ? (
              <Select value={resultId} onChange={(e) => setResultId(e.target.value)}>
                <option value="">Pick a run</option>
                {myRuns.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.time.toFixed(3)} · {world.events.find((e) => e.id === r.eventId)?.name}
                  </option>
                ))}
              </Select>
            ) : null}
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Barn talk…" />
            <Button
              onClick={() => {
                postCommunity({ text, kind, videoUrl, resultId: resultId || undefined })
                setText('')
              }}
            >
              Post
            </Button>
          </CardContent>
        </Card>
      ) : null}
      {posts.length === 0 ? (
        <EmptyState title="Quiet in the yard" description="When riders post, it shows up here." />
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const author = riderById(post.riderId)
            const run = post.resultId ? world.results.find((r) => r.id === post.resultId) : null
            return (
              <Card key={post.id}>
                <CardContent>
                  <p className="text-xs uppercase tracking-wide text-stone-500">
                    <span className="text-season">{post.kind}</span> · {new Date(post.at).toLocaleString('en-ZA')}
                  </p>
                  <p className="mt-1">
                    {author ? (
                      <Link className="font-semibold underline" to={`/riders/${author.id}`}>
                        {author.name}
                      </Link>
                    ) : (
                      'Member'
                    )}
                    {author && who && who !== author.id ? (
                      <button type="button" className="ml-2 text-xs underline" onClick={() => toggleFollow(author.id)}>
                        {following.includes(author.id) ? 'Following' : 'Follow'}
                      </button>
                    ) : null}
                  </p>
                  <p className="mt-1 text-stone-700">{post.text}</p>
                  {post.kind === 'video' && post.videoUrl ? (
                    <p className="mt-2 text-sm">
                      <a className="underline" href={post.videoUrl} target="_blank" rel="noreferrer">
                        Watch video
                      </a>
                    </p>
                  ) : null}
                  {run ? (
                    <div className="mt-3 rounded-md border border-season bg-season-soft px-3 py-2 text-sm">
                      {run.time.toFixed(3)} · {run.division} · {world.events.find((e) => e.id === run.eventId)?.name}
                    </div>
                  ) : null}
                  <div className="mt-3 flex gap-3 text-sm">
                    <button type="button" onClick={() => likeCommunity(post.id)}>
                      ♥ {post.likes?.length || 0}
                    </button>
                    <CommentBox postId={post.id} onSend={commentCommunity} />
                  </div>
                  {(post.comments || []).map((c) => (
                    <p key={c.id} className="mt-1 text-sm text-stone-600">
                      {riderById(c.riderId)?.name || 'Member'}: {c.text}
                    </p>
                  ))}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CommentBox({ postId, onSend }) {
  const [v, setV] = useState('')
  return (
    <form
      className="flex gap-1"
      onSubmit={(e) => {
        e.preventDefault()
        if (v.trim()) onSend(postId, v.trim())
        setV('')
      }}
    >
      <input className="h-8 rounded border border-dust-200 px-2 text-sm" value={v} onChange={(e) => setV(e.target.value)} placeholder="Comment" />
    </form>
  )
}
