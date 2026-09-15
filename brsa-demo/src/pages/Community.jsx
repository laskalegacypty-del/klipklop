import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, Send } from 'lucide-react'
import { useDemo } from '../demo/store'
import { isPhotoSrc } from '../lib/imageCrop'
import { PhotoStage } from '../components/PhotoCropper'
import { Button } from '../components/ui/Button'
import { Card, CardContent } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Input } from '../components/ui/Input'
import { PageHeader } from '../components/ui/PageHeader'
import { Select } from '../components/ui/Select'
import { cn } from '../components/ui/cn'

const EMOJIS = [
  { id: 'fire', glyph: '🔥', label: 'Fire' },
  { id: 'clap', glyph: '👏', label: 'Clap' },
  { id: 'horse', glyph: '🐴', label: 'Horse' },
]

function timeAgo(iso) {
  const delta = Date.now() - new Date(iso).getTime()
  const mins = Math.max(0, Math.floor(delta / 60000))
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 21) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-ZA')
}

export function Community() {
  const { world, user, rider, fan, riderById, fanById, postCommunity, reactCommunity, commentCommunity, toggleFollow } = useDemo()
  const [text, setText] = useState('')
  const [kind, setKind] = useState('photo')
  const [videoUrl, setVideoUrl] = useState('')
  const [resultId, setResultId] = useState('')
  const [photo, setPhoto] = useState('')
  const who = rider?.id || fan?.id || user?.id
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
      <PageHeader title="Yard" description="Barn talk, photos and results. Official notices stay on News." />
      {rider || fan ? (
        <Card className="mb-5">
          <CardContent className="space-y-3 pt-5">
            <Select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="photo">Photo post</option>
              <option value="video">Video</option>
              <option value="result">Share a result</option>
            </Select>
            {kind === 'photo' ? (
              <PhotoStage
                slot="post"
                src={photo}
                alt=""
                editable
                onSave={setPhoto}
                className="max-w-lg rounded-md"
                empty={<div className="flex h-full items-center justify-center text-sm text-stone-500">Crop a photo for this post</div>}
              />
            ) : null}
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
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="What’s happening in the barn?" />
            <Button
              onClick={() => {
                postCommunity({ text, kind, videoUrl, resultId: resultId || undefined, photo: kind === 'photo' ? photo : undefined })
                setText('')
                setPhoto('')
                setVideoUrl('')
                setResultId('')
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
        <div className="space-y-4">
          {posts.map((post) => {
            const author = riderById(post.riderId) || fanById(post.fanId)
            const run = post.resultId ? world.results.find((r) => r.id === post.resultId) : null
            const liked = who ? (post.likes || []).includes(who) : false
            const hearts = post.likes?.length || 0
            return (
              <Card key={post.id} className="overflow-hidden">
                <CardContent className="pt-5">
                  <div className="flex items-start gap-3">
                    {isPhotoSrc(author?.photo) ? (
                      <img src={author.photo} alt="" className="h-11 w-11 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-400 font-display font-bold text-charcoal">
                        {(author?.name || 'M').slice(0, 1)}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {author && post.riderId ? (
                          <Link className="font-semibold text-charcoal hover:underline" to={`/riders/${author.id}`}>
                            {author.name}
                          </Link>
                        ) : (
                          <span className="font-semibold">{author?.name || 'Member'}</span>
                        )}
                        <span className="text-xs text-stone-500">{timeAgo(post.at)}</span>
                        {author && who && who !== author.id && post.riderId ? (
                          <button
                            type="button"
                            className="rounded-full border border-dust-200 px-2 py-0.5 text-[11px] font-semibold text-stone-600 hover:border-season hover:text-charcoal"
                            onClick={() => toggleFollow(author.id)}
                          >
                            {following.includes(author.id) ? 'Following' : 'Follow'}
                          </button>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-stone-700">{post.text}</p>
                      {isPhotoSrc(post.photo) ? (
                        <img src={post.photo} alt="" className="mt-3 aspect-[4/3] w-full max-w-lg rounded-xl object-cover" />
                      ) : null}
                      {post.kind === 'video' && post.videoUrl ? (
                        <p className="mt-2 text-sm">
                          <a className="underline" href={post.videoUrl} target="_blank" rel="noreferrer">
                            Watch video
                          </a>
                        </p>
                      ) : null}
                      {run ? (
                        <div className="mt-3 rounded-xl border border-season bg-brand-50 px-3 py-2 text-sm font-medium">
                          {run.time.toFixed(3)} · {run.division} · {world.events.find((e) => e.id === run.eventId)?.name}
                        </div>
                      ) : null}

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            reactCommunity(post.id, 'heart')
                          }}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition',
                            liked
                              ? 'border-red-200 bg-red-50 text-red-700'
                              : 'border-dust-200 bg-white text-stone-600 hover:border-red-200 hover:bg-red-50',
                          )}
                          aria-label="Love"
                        >
                          <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
                          {hearts || ''}
                        </button>
                        {EMOJIS.map((emo) => {
                          const count = post.reactions?.[emo.id]?.length || 0
                          const mine = who ? (post.reactions?.[emo.id] || []).includes(who) : false
                          return (
                            <button
                              key={emo.id}
                              type="button"
                              aria-label={emo.label}
                              aria-pressed={mine}
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                reactCommunity(post.id, emo.id)
                              }}
                              className={cn(
                                'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-base transition',
                                mine
                                  ? 'border-brand-400 bg-brand-50'
                                  : 'border-dust-200 bg-white hover:border-brand-400 hover:bg-brand-50',
                              )}
                            >
                              <span aria-hidden="true">{emo.glyph}</span>
                              {count ? <span className="text-xs font-semibold text-stone-600">{count}</span> : null}
                            </button>
                          )
                        })}
                      </div>

                      <div className="mt-3 space-y-2">
                        {(post.comments || []).map((c) => (
                          <p key={c.id} className="rounded-lg bg-dust-50 px-3 py-2 text-sm text-stone-700">
                            <span className="font-semibold text-charcoal">{riderById(c.riderId)?.name || fanById(c.riderId)?.name || 'Member'}</span>
                            <span className="text-stone-400"> · </span>
                            {c.text}
                          </p>
                        ))}
                        {who ? <CommentBox postId={post.id} onSend={commentCommunity} /> : null}
                      </div>
                    </div>
                  </div>
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
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (v.trim()) onSend(postId, v.trim())
        setV('')
      }}
    >
      <input
        className="h-10 flex-1 rounded-full border border-dust-200 bg-white px-4 text-sm"
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="Write a comment…"
      />
      <Button type="submit" size="sm" variant="secondary" className="rounded-full px-3" disabled={!v.trim()}>
        <Send size={14} />
      </Button>
    </form>
  )
}
