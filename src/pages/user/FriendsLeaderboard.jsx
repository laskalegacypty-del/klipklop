import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { EmptyState, PageHeader, Skeleton } from '../../components/ui'
import { GAMES } from '../../lib/constants'
import {
  LEADERBOARD_MODES,
  REACTION_OPTIONS,
  buildAchievements,
  createFriendRequest,
  fetchDisplayHorseNamesForUsers,
  fetchFriendships,
  fetchFriendsLeaderboard,
  fetchProfilesByIds,
  fetchRecentFriendReactions,
  mapFriendshipCollections,
  removeFriendship,
  respondToFriendRequest,
  searchRiders,
  sendFriendOvertakeNotifications,
  sendFriendReaction,
} from '../../lib/friendsLeaderboard'
import {
  Crown,
  Search,
  Sparkles,
  Trophy,
  Users,
  UserPlus,
  Hourglass,
  Medal,
  Filter,
  Flame,
} from 'lucide-react'
import toast from 'react-hot-toast'

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, idx) => CURRENT_YEAR - idx)

function getOtherUserId(friendship, myUserId) {
  return friendship.requester_id === myUserId ? friendship.addressee_id : friendship.requester_id
}

function Avatar({ profile }) {
  return (
    <div className="w-9 h-9 rounded-full overflow-hidden border border-gray-200 bg-green-100 flex items-center justify-center flex-shrink-0">
      {profile?.profile_photo_url ? (
        <img src={profile.profile_photo_url} alt={profile.rider_name} className="w-full h-full object-cover" />
      ) : (
        <span className="text-sm font-bold text-green-700">{profile?.rider_name?.charAt(0)?.toUpperCase() || '?'}</span>
      )}
    </div>
  )
}

function ProgressRing({ value, max }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)))
  return (
    <div
      className="w-16 h-16 rounded-full grid place-items-center text-xs font-semibold text-gray-700"
      style={{ background: `conic-gradient(#16a34a ${pct}%, #e5e7eb ${pct}% 100%)` }}
    >
      <div className="w-11 h-11 rounded-full bg-white grid place-items-center">{pct}%</div>
    </div>
  )
}

export default function FriendsLeaderboard() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [friendships, setFriendships] = useState([])
  const [profilesMap, setProfilesMap] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [sendingRequestMap, setSendingRequestMap] = useState({})
  const [leaderboardRows, setLeaderboardRows] = useState([])
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false)
  const [mode, setMode] = useState(LEADERBOARD_MODES.CURRENT_YEAR)
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR)
  const [selectedGame, setSelectedGame] = useState('all')
  const [reactions, setReactions] = useState([])
  const [horseNameMap, setHorseNameMap] = useState({})
  const previousRanksRef = useRef({})

  const collections = useMemo(
    () => mapFriendshipCollections(friendships, profile?.id),
    [friendships, profile?.id],
  )

  const excludedProfileIds = useMemo(() => {
    const ids = friendships.flatMap(row => [row.requester_id, row.addressee_id])
    return Array.from(new Set(ids))
  }, [friendships])

  const acceptedFriendIds = useMemo(() => {
    if (!profile?.id) return []
    return collections.accepted.map(row => getOtherUserId(row, profile.id)).filter(Boolean)
  }, [collections.accepted, profile?.id])

  const loadFriendshipsAndProfiles = useCallback(async () => {
    if (!profile?.id) return
    const rows = await fetchFriendships(profile.id)
    setFriendships(rows)

    const otherIds = Array.from(
      new Set(rows.map(row => getOtherUserId(row, profile.id)).filter(Boolean)),
    )
    const foundProfiles = await fetchProfilesByIds(otherIds)
    const map = {}
    foundProfiles.forEach(item => {
      map[item.id] = item
    })
    setProfilesMap(map)
  }, [profile?.id])

  const loadLeaderboard = useCallback(async () => {
    if (!profile?.id) return
    setLoadingLeaderboard(true)
    try {
      const rows = await fetchFriendsLeaderboard({
        mode,
        year: selectedYear,
        game: selectedGame,
      })
      setLeaderboardRows(rows)
      try {
        const names = await fetchDisplayHorseNamesForUsers(rows.map(row => row.user_id))
        setHorseNameMap(names)
      } catch {
        setHorseNameMap({})
      }
      const modeKey = `${mode}|${selectedYear}|${selectedGame}|overall_levels`
      const previousRanks = previousRanksRef.current[modeKey] || {}
      const currentRanks = {}
      rows.forEach(item => {
        const existing = currentRanks[item.user_id]
        currentRanks[item.user_id] = existing ? Math.min(existing, item.rank) : item.rank
      })

      const myId = profile.id
      const myName = profile.rider_name || 'A friend'
      const myRankPrev = previousRanks[myId]
      const myRankNow = currentRanks[myId]

      if (myRankPrev && myRankNow) {
        const rowsById = {}
        rows.forEach(item => { rowsById[item.user_id] = item })

        for (const friendId of acceptedFriendIds) {
          const friendPrev = previousRanks[friendId]
          const friendNow = currentRanks[friendId]
          if (!friendPrev || !friendNow) continue

          const friendName = rowsById[friendId]?.rider_name || 'your friend'

          // I overtook friend
          if (myRankPrev > friendPrev && myRankNow < friendNow) {
            await sendFriendOvertakeNotifications({
              actorUserId: myId,
              otherUserId: friendId,
              otherName: friendName,
              overtakerUserId: myId,
              overtakerName: myName,
              newRank: myRankNow,
              oldRank: myRankPrev,
              mode,
              year: selectedYear,
              game: selectedGame,
            })
          }

          // Friend overtook me
          if (myRankPrev < friendPrev && myRankNow > friendNow) {
            await sendFriendOvertakeNotifications({
              actorUserId: myId,
              otherUserId: friendId,
              otherName: friendName,
              overtakerUserId: friendId,
              overtakerName: friendName,
              newRank: friendNow,
              oldRank: friendPrev,
              mode,
              year: selectedYear,
              game: selectedGame,
            })
          }
        }
      }

      previousRanksRef.current[modeKey] = currentRanks
    } catch {
      toast.error('Could not load leaderboard.')
    } finally {
      setLoadingLeaderboard(false)
    }
  }, [acceptedFriendIds, mode, profile?.id, profile?.rider_name, selectedGame, selectedYear])

  const loadReactions = useCallback(async () => {
    if (!profile?.id) return
    try {
      const rows = await fetchRecentFriendReactions(profile.id, 30)
      setReactions(rows)
    } catch {
      setReactions([])
    }
  }, [profile?.id])

  useEffect(() => {
    if (!profile?.id) return
    let mounted = true
    previousRanksRef.current = {}
    ;(async () => {
      setLoading(true)
      try {
        await Promise.all([loadFriendshipsAndProfiles(), loadReactions()])
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [loadFriendshipsAndProfiles, loadReactions, profile?.id])

  useEffect(() => {
    if (!profile?.id) return
    loadLeaderboard()
  }, [loadLeaderboard, mode, profile?.id, selectedGame, selectedYear])

  useEffect(() => {
    if (!profile?.id) return
    const q = searchQuery.trim()
    if (q.length < 2) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const found = await searchRiders(q, profile.id, excludedProfileIds)
        setSearchResults(found)
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [searchQuery, profile?.id, excludedProfileIds])

  async function handleSendRequest(targetProfile) {
    setSendingRequestMap(prev => ({ ...prev, [targetProfile.id]: true }))
    try {
      await createFriendRequest(profile.id, targetProfile.id)
      toast.success(`Request sent to ${targetProfile.rider_name}`)
      setSearchQuery('')
      setSearchResults([])
      await loadFriendshipsAndProfiles()
    } catch (error) {
      if (error?.code === '23505') {
        toast.error('You already have a request or friendship with this rider.')
      } else {
        toast.error('Could not send friend request.')
      }
    } finally {
      setSendingRequestMap(prev => ({ ...prev, [targetProfile.id]: false }))
    }
  }

  async function handleRequestAction(friendshipId, status) {
    try {
      await respondToFriendRequest(friendshipId, status)
      toast.success(status === 'accepted' ? 'Friend request accepted!' : 'Request declined.')
      await Promise.all([loadFriendshipsAndProfiles(), loadLeaderboard()])
    } catch {
      toast.error('Could not update request.')
    }
  }

  async function handleRemoveFriend(friendshipId) {
    try {
      await removeFriendship(friendshipId)
      toast.success('Friend removed.')
      await Promise.all([loadFriendshipsAndProfiles(), loadLeaderboard()])
    } catch {
      toast.error('Could not remove friend.')
    }
  }

  async function handleReaction(toUserId, reaction) {
    try {
      await sendFriendReaction({ fromUserId: profile.id, toUserId, reaction })
      toast.success(`Reaction sent ${reaction}`)
      await loadReactions()
    } catch {
      toast.error('Could not send reaction.')
    }
  }

  const achievements = buildAchievements({
    leaderboardRows,
    myUserId: profile?.id,
    acceptedCount: collections.accepted.length,
    pendingIncomingCount: collections.incoming.length,
  })

  const displayedRows = useMemo(() => {
    const sorted = [...leaderboardRows].sort((a, b) => {
      const aHasData = Number(a.games_covered || 0) > 0 ? 0 : 1
      const bHasData = Number(b.games_covered || 0) > 0 ? 0 : 1
      if (aHasData !== bHasData) return aHasData - bHasData
      const levelDiff = Number(b.total_level_points || 0) - Number(a.total_level_points || 0)
      if (levelDiff !== 0) return levelDiff
      const l4Diff = Number(b.level4_count || 0) - Number(a.level4_count || 0)
      if (l4Diff !== 0) return l4Diff
      return String(a.rider_name || '').localeCompare(String(b.rider_name || ''))
    })
    return sorted.map((row, idx) => ({ ...row, display_rank: idx + 1 }))
  }, [leaderboardRows])

  const podium = displayedRows.slice(0, 3)
  const listRows = displayedRows.slice(3)
  const getDisplayHorseName = (row) => {
    const fromRpc = String(row?.horse_name || '').trim()
    if (fromRpc && fromRpc.toLowerCase() !== 'no horse selected') return fromRpc
    return horseNameMap[row?.user_id] || 'Unknown horse'
  }

  if (profile && profile.role !== 'user') {
    return (
      <EmptyState
        title="Riders only"
        description="This game is currently available for rider accounts only."
      />
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-14" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Friends Leaderboard"
        description="Friendly competition with rankings, badges, and bragging rights."
      />

      <div className="bg-gradient-to-r from-green-700 to-emerald-600 rounded-xl p-5 text-white">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 text-green-100 text-xs uppercase tracking-wide font-semibold">
              <Sparkles size={14} />
              Friendly Challenge
            </div>
            <h2 className="text-2xl font-bold mt-1">Beat your friends, beat your best.</h2>
            <p className="text-sm text-green-100 mt-1">
              {mode === LEADERBOARD_MODES.CURRENT_YEAR ? `Current Year (${selectedYear})` : 'All-Time Personal Best'} mode
            </p>
          </div>
          <div className="flex items-center gap-4">
            <ProgressRing value={collections.accepted.length} max={5} />
            <ProgressRing value={Number(leaderboardRows.find(r => r.user_id === profile?.id)?.games_covered || 0)} max={13} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <UserPlus size={16} className="text-green-600" />
              Add Friends
            </h3>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                placeholder="Search riders by name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            {searchQuery.trim().length > 1 && (
              <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
                {searching ? (
                  <div className="p-3 text-sm text-gray-400">Searching...</div>
                ) : searchResults.length === 0 ? (
                  <div className="p-3 text-sm text-gray-400">No riders found.</div>
                ) : (
                  searchResults.map(item => (
                    <div key={item.id} className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 last:border-b-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar profile={item} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{item.rider_name}</p>
                          <p className="text-xs text-gray-400 truncate">{item.province || 'No province'}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSendRequest(item)}
                        disabled={!!sendingRequestMap[item.id]}
                        className="px-3 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        {sendingRequestMap[item.id] ? 'Sending...' : 'Add'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Filter size={16} className="text-green-600" />
              Leaderboard Filters
            </h3>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
                <button
                  onClick={() => setMode(LEADERBOARD_MODES.CURRENT_YEAR)}
                  className={`px-3 py-2 text-sm font-medium ${mode === LEADERBOARD_MODES.CURRENT_YEAR ? 'bg-green-600 text-white' : 'bg-white text-gray-600'}`}
                >
                  Current Year
                </button>
                <button
                  onClick={() => setMode(LEADERBOARD_MODES.PERSONAL_BEST)}
                  className={`px-3 py-2 text-sm font-medium ${mode === LEADERBOARD_MODES.PERSONAL_BEST ? 'bg-green-600 text-white' : 'bg-white text-gray-600'}`}
                >
                  Personal Best
                </button>
              </div>

              {mode === LEADERBOARD_MODES.CURRENT_YEAR && (
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {YEAR_OPTIONS.map(year => <option key={year} value={year}>{year}</option>)}
                </select>
              )}

              <select
                value={selectedGame}
                onChange={e => setSelectedGame(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="all">All Games</option>
                {GAMES.map(game => <option key={game} value={game}>{game}</option>)}
              </select>
              <span className="px-3 py-2 rounded-lg bg-green-50 text-green-700 text-sm font-medium">
                Overall Levels Leaderboard
              </span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Trophy size={16} className="text-yellow-500" />
              Podium
            </h3>
            {loadingLeaderboard ? (
              <Skeleton className="h-24" />
            ) : podium.length === 0 ? (
              <p className="text-sm text-gray-400">No leaderboard data yet. Add times to start competing.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {podium.map((row, idx) => (
                  <div key={row.combo_id || `${row.user_id}-${idx}`} className={`rounded-lg border p-4 ${idx === 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wide text-gray-500">#{row.display_rank}</span>
                      {idx === 0 ? <Crown size={16} className="text-yellow-600" /> : <Medal size={16} className="text-gray-500" />}
                    </div>
                    <p className="font-semibold text-gray-800 mt-1">{row.rider_name}</p>
                    <p className="text-xs text-gray-500">{getDisplayHorseName(row)}</p>
                    <p className="text-xs text-gray-400">{row.province || 'No province'}</p>
                    <div className="mt-3 text-xs text-gray-600 space-y-1">
                      <p>Games covered: <span className="font-semibold">{row.games_covered}</span></p>
                      <p>Level points: <span className="font-semibold">{row.total_level_points || 0}</span></p>
                      <p>Avg level: <span className="font-semibold">{row.avg_level ? Number(row.avg_level).toFixed(2) : '—'}</span></p>
                      <p>Level 4 count: <span className="font-semibold">{row.level4_count || 0}</span></p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Leaderboard</h3>
            </div>
            {loadingLeaderboard ? (
              <div className="p-4"><Skeleton className="h-56" /></div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-gray-600 font-semibold">Rank</th>
                    <th className="text-left px-4 py-2.5 text-gray-600 font-semibold">Rider</th>
                    <th className="text-center px-4 py-2.5 text-gray-600 font-semibold">Games</th>
                    <th className="text-center px-4 py-2.5 text-gray-600 font-semibold">Level Points</th>
                    <th className="text-center px-4 py-2.5 text-gray-600 font-semibold">Avg Level</th>
                    <th className="text-center px-4 py-2.5 text-gray-600 font-semibold">L4 Count</th>
                    <th className="text-center px-4 py-2.5 text-gray-600 font-semibold">Placement Tie-break</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[...podium, ...listRows].map(row => {
                    const isMe = row.user_id === profile?.id
                    return (
                      <tr key={row.combo_id || `${row.user_id}-${row.display_rank}`} className={isMe ? 'bg-green-50/50' : ''}>
                        <td className="px-4 py-2.5 font-semibold text-gray-800">#{row.display_rank}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <Avatar profile={row} />
                            <div>
                              <p className="font-medium text-gray-800">
                                {row.rider_name} {isMe && <span className="text-xs text-green-700">(You)</span>}
                              </p>
                              <p className="text-xs text-gray-500">{getDisplayHorseName(row)}</p>
                              <p className="text-xs text-gray-400">{row.province || 'No province'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-center">{row.games_covered}</td>
                        <td className="px-4 py-2.5 text-center">{row.total_level_points || 0}</td>
                        <td className="px-4 py-2.5 text-center">{row.avg_level ? Number(row.avg_level).toFixed(2) : '—'}</td>
                        <td className="px-4 py-2.5 text-center">{row.level4_count || 0}</td>
                        <td className="px-4 py-2.5 text-center">{row.placement_score ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Users size={16} className="text-green-600" />
              Friends ({collections.accepted.length})
            </h3>
            {collections.accepted.length === 0 ? (
              <p className="text-sm text-gray-400">No friends yet.</p>
            ) : (
              <div className="space-y-2">
                {collections.accepted.map(row => {
                  const friendId = getOtherUserId(row, profile.id)
                  const friend = profilesMap[friendId]
                  return (
                    <div key={row.id} className="border border-gray-200 rounded-lg p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar profile={friend} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{friend?.rider_name || 'Unknown rider'}</p>
                            <p className="text-xs text-gray-400 truncate">{friend?.province || 'No province'}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveFriend(row.id)}
                          className="text-xs text-gray-500 hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="mt-2 flex items-center gap-1">
                        {REACTION_OPTIONS.map(reaction => (
                          <button
                            key={reaction}
                            onClick={() => handleReaction(friendId, reaction)}
                            className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
                            title={`Send ${reaction}`}
                          >
                            {reaction}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Hourglass size={16} className="text-yellow-500" />
              Requests
            </h3>
            <div className="space-y-2">
              {collections.incoming.map(row => {
                const friend = profilesMap[getOtherUserId(row, profile.id)]
                return (
                  <div key={row.id} className="border border-yellow-200 bg-yellow-50 rounded-lg p-2.5">
                    <p className="text-sm font-medium text-gray-800">{friend?.rider_name || 'Rider'}</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => handleRequestAction(row.id, 'accepted')}
                        className="text-xs px-2.5 py-1 rounded bg-green-600 text-white"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleRequestAction(row.id, 'rejected')}
                        className="text-xs px-2.5 py-1 rounded bg-gray-200 text-gray-700"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                )
              })}
              {collections.outgoing.map(row => {
                const friend = profilesMap[getOtherUserId(row, profile.id)]
                return (
                  <div key={row.id} className="border border-gray-200 rounded-lg p-2.5">
                    <p className="text-sm text-gray-700">Pending: <span className="font-medium">{friend?.rider_name || 'Rider'}</span></p>
                  </div>
                )
              })}
              {collections.incoming.length === 0 && collections.outgoing.length === 0 && (
                <p className="text-sm text-gray-400">No active requests.</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Sparkles size={16} className="text-purple-500" />
              Achievements
            </h3>
            <div className="space-y-2.5">
              {achievements.map(item => (
                <div key={item.id} className={`rounded-lg border p-2.5 ${item.unlocked ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                  <p className="text-sm font-medium text-gray-800 flex items-center gap-2">
                    {item.unlocked ? <Trophy size={14} className="text-green-600" /> : <Flame size={14} className="text-gray-400" />}
                    {item.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Reactions</h3>
            {reactions.length === 0 ? (
              <p className="text-sm text-gray-400">No reactions yet.</p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {reactions.map(item => {
                  const isSent = item.from_user_id === profile.id
                  const otherId = isSent ? item.to_user_id : item.from_user_id
                  const other = profilesMap[otherId]
                  return (
                    <div key={item.id} className="text-xs border border-gray-200 rounded-lg px-2.5 py-2 flex items-center justify-between gap-2">
                      <span className="text-gray-600 truncate">
                        {isSent ? 'You -> ' : ''}{other?.rider_name || 'Rider'}
                      </span>
                      <span className="text-sm">{item.reaction}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
