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
  MessageCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import ChatPanel from '../../components/chat/ChatPanel'
import { fetchUnreadCounts, fetchConversationPreviews } from '../../lib/friendsChat'

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
  const [activeChatFriend, setActiveChatFriend] = useState(null) // { id, profile }
  const [unreadCounts, setUnreadCounts] = useState({})
  const [conversationPreviews, setConversationPreviews] = useState({})

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

  // Chat meta runs in its own effect, keyed only on profile + accepted friends
  // (keeping it out of the main loading effect prevents an infinite re-render loop)
  useEffect(() => {
    if (!profile?.id) return
    fetchUnreadCounts(profile.id)
      .then(counts => setUnreadCounts(counts))
      .catch(() => {})
    if (acceptedFriendIds.length > 0) {
      fetchConversationPreviews(profile.id, acceptedFriendIds)
        .then(previews => setConversationPreviews(previews))
        .catch(() => {})
    }
  }, [profile?.id, acceptedFriendIds])

  const loadChatMeta = useCallback(async () => {
    if (!profile?.id) return
    try {
      const [counts, previews] = await Promise.all([
        fetchUnreadCounts(profile.id),
        fetchConversationPreviews(profile.id, acceptedFriendIds),
      ])
      setUnreadCounts(counts)
      setConversationPreviews(previews)
    } catch {
      // non-critical
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const myRow = displayedRows.find(r => r.user_id === profile?.id)
  const myRank = myRow?.display_rank
  const myGamesCovered = Number(myRow?.games_covered || 0)
  const recentYears = YEAR_OPTIONS.slice(0, 3)

  const podiumOrder = podium.length === 3
    ? [podium[1], podium[0], podium[2]]
    : podium

  const podiumStyles = [
    { gradient: 'bg-gradient-to-b from-gray-300 to-gray-400', height: 'h-44', icon: <Medal size={22} className="text-gray-600" />, label: 'Silver', rankColor: 'text-gray-700' },
    { gradient: 'bg-gradient-to-b from-yellow-400 to-amber-500', height: 'h-52', icon: <Crown size={26} className="text-yellow-900" />, label: 'Gold', rankColor: 'text-yellow-900' },
    { gradient: 'bg-gradient-to-b from-orange-300 to-orange-400', height: 'h-40', icon: <Medal size={20} className="text-orange-700" />, label: 'Bronze', rankColor: 'text-orange-800' },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Friends Leaderboard"
        description="Friendly competition with rankings, badges, and bragging rights."
      />

      {/* Hero banner */}
      <div className="bg-gradient-to-r from-green-700 via-green-600 to-emerald-500 rounded-xl p-5 text-white shadow-md">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 text-green-100 text-xs uppercase tracking-widest font-semibold mb-2">
              <Sparkles size={13} />
              Friendly Challenge
            </div>
            <h2 className="text-2xl font-bold leading-tight">Beat your friends, beat your best.</h2>
            <p className="text-sm text-green-100 mt-1">
              {mode === LEADERBOARD_MODES.CURRENT_YEAR ? `Current Year (${selectedYear})` : 'All-Time Personal Best'} · Overall Levels
            </p>
          </div>
          <div className="flex items-center gap-5 flex-wrap">
            {myRank && (
              <div className="flex flex-col items-center">
                <span className="text-4xl font-extrabold leading-none">#{myRank}</span>
                <span className="text-xs text-green-200 mt-1 uppercase tracking-wide">Your rank</span>
              </div>
            )}
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center gap-1">
                <ProgressRing value={collections.accepted.length} max={5} />
                <span className="text-xs text-green-200">Friends</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <ProgressRing value={myGamesCovered} max={13} />
                <span className="text-xs text-green-200">Games</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add friends search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
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

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Filter size={16} className="text-green-600" />
          Filters
        </h3>
        <div className="flex flex-col gap-3">
          {/* Mode toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 font-medium w-12">Mode</span>
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setMode(LEADERBOARD_MODES.CURRENT_YEAR)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${mode === LEADERBOARD_MODES.CURRENT_YEAR ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Current Year
              </button>
              <button
                onClick={() => setMode(LEADERBOARD_MODES.PERSONAL_BEST)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${mode === LEADERBOARD_MODES.PERSONAL_BEST ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Personal Best
              </button>
            </div>
          </div>

          {/* Year pills — only shown in Current Year mode */}
          {mode === LEADERBOARD_MODES.CURRENT_YEAR && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500 font-medium w-12">Year</span>
              <div className="flex gap-2 flex-wrap">
                {recentYears.map(year => (
                  <button
                    key={year}
                    onClick={() => setSelectedYear(year)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${selectedYear === year ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-300 hover:border-green-400 hover:text-green-700'}`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Game filter strip */}
          <div className="flex items-start gap-2">
            <span className="text-xs text-gray-500 font-medium w-12 pt-1.5">Game</span>
            <div className="flex gap-2 overflow-x-auto pb-1 flex-1" style={{ scrollbarWidth: 'none' }}>
              <button
                onClick={() => setSelectedGame('all')}
                className={`px-3 py-1.5 text-sm font-medium rounded-full border whitespace-nowrap transition-colors flex-shrink-0 ${selectedGame === 'all' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-300 hover:border-green-400 hover:text-green-700'}`}
              >
                All Games
              </button>
              {GAMES.map(game => (
                <button
                  key={game}
                  onClick={() => setSelectedGame(game)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-full border whitespace-nowrap transition-colors flex-shrink-0 ${selectedGame === game ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-300 hover:border-green-400 hover:text-green-700'}`}
                >
                  {game}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 xl:grid xl:grid-cols-3">
        {/* Main column: podium + leaderboard */}
        <div className="xl:col-span-2 xl:order-1 space-y-5">

          {/* Podium */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Trophy size={16} className="text-yellow-500" />
              Podium
            </h3>
            {loadingLeaderboard ? (
              <Skeleton className="h-52" />
            ) : podium.length === 0 ? (
              <p className="text-sm text-gray-400">No leaderboard data yet. Add times to start competing.</p>
            ) : (
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-end sm:justify-center sm:gap-4">
                {(podium.length === 3 ? podiumOrder : podium.map((r, i) => r)).map((row, slotIdx) => {
                  const originalIdx = podium.indexOf(row)
                  const style = podiumStyles[podium.length === 3 ? slotIdx : originalIdx] || podiumStyles[0]
                  const isMe = row.user_id === profile?.id
                  return (
                    <div
                      key={row.combo_id || `${row.user_id}-${slotIdx}`}
                      className={`flex flex-col items-center rounded-2xl shadow-md p-4 w-full sm:w-36 ${style.gradient} ${style.height} justify-end ${isMe ? 'ring-2 ring-green-500' : ''}`}
                    >
                      <div className={`w-14 h-14 rounded-full overflow-hidden border-2 border-white shadow mb-2 bg-white flex items-center justify-center flex-shrink-0`}>
                        {row.profile_photo_url ? (
                          <img src={row.profile_photo_url} alt={row.rider_name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-lg font-bold text-gray-600">{row.rider_name?.charAt(0)?.toUpperCase() || '?'}</span>
                        )}
                      </div>
                      <div className="mb-1">{style.icon}</div>
                      <p className={`text-sm font-bold text-center leading-tight ${style.rankColor}`}>{row.rider_name}</p>
                      <p className="text-xs text-center text-white/80 truncate w-full text-center mt-0.5">{getDisplayHorseName(row)}</p>
                      <div className="mt-2 flex items-center gap-1 justify-center flex-wrap">
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded bg-white/30 ${style.rankColor}`}>{row.total_level_points || 0} pts</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded bg-white/20 ${style.rankColor}`}>{row.games_covered}/13</span>
                      </div>
                      {isMe && (
                        <span className="mt-1.5 text-xs font-semibold text-white bg-green-600 rounded-full px-2 py-0.5">You</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Leaderboard table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Full Leaderboard</h3>
              {loadingLeaderboard && <span className="text-xs text-gray-400">Loading...</span>}
            </div>
            {loadingLeaderboard ? (
              <div className="p-4"><Skeleton className="h-56" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2.5 text-gray-500 font-semibold text-xs uppercase tracking-wide">#</th>
                      <th className="text-left px-3 py-2.5 text-gray-500 font-semibold text-xs uppercase tracking-wide">Rider</th>
                      <th className="text-center px-3 py-2.5 text-gray-500 font-semibold text-xs uppercase tracking-wide">Games</th>
                      <th className="text-center px-3 py-2.5 text-gray-500 font-semibold text-xs uppercase tracking-wide">Points</th>
                      <th className="text-center px-3 py-2.5 text-gray-500 font-semibold text-xs uppercase tracking-wide">Avg Lvl</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[...podium, ...listRows].map(row => {
                      const isMe = row.user_id === profile?.id
                      return (
                        <tr
                          key={row.combo_id || `${row.user_id}-${row.display_rank}`}
                          className={isMe ? 'bg-green-50 font-medium' : 'hover:bg-gray-50'}
                        >
                          <td className="px-3 py-2.5 font-bold text-gray-700 text-center w-10">
                            {row.display_rank <= 3 ? (
                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${row.display_rank === 1 ? 'bg-yellow-400 text-yellow-900' : row.display_rank === 2 ? 'bg-gray-300 text-gray-700' : 'bg-orange-300 text-orange-800'}`}>
                                {row.display_rank}
                              </span>
                            ) : (
                              <span className="text-gray-500">{row.display_rank}</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <Avatar profile={row} />
                              <div className="min-w-0">
                                <p className="font-medium text-gray-800 truncate leading-tight">
                                  {row.rider_name}
                                  {isMe && (
                                    <span className="ml-1.5 text-xs bg-green-100 text-green-700 rounded-full px-1.5 py-0.5 font-semibold">You</span>
                                  )}
                                </p>
                                <p className="text-xs text-gray-400 truncate">{getDisplayHorseName(row)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center text-gray-700">
                            <span className="text-xs">{row.games_covered}<span className="text-gray-400">/13</span></span>
                          </td>
                          <td className="px-3 py-2.5 text-center font-semibold text-gray-800">{row.total_level_points || 0}</td>
                          <td className="px-3 py-2.5 text-center text-gray-700">{row.avg_level ? Number(row.avg_level).toFixed(1) : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: friends, requests, achievements, reactions */}
        <div className="xl:order-2 space-y-4">

          {/* Friends */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Users size={16} className="text-green-600" />
              Friends
              <span className="ml-auto text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-semibold">{collections.accepted.length}</span>
            </h3>
            {collections.accepted.length === 0 ? (
              <p className="text-sm text-gray-400">No friends yet. Search for riders above to add them.</p>
            ) : (
              <div className="space-y-2.5">
                {collections.accepted.map(row => {
                  const friendId = getOtherUserId(row, profile.id)
                  const friend = profilesMap[friendId]
                  const friendLbRow = displayedRows.find(r => r.user_id === friendId)
                  const friendRank = friendLbRow?.display_rank
                  const friendGames = Number(friendLbRow?.games_covered || 0)
                  return (
                    <div key={row.id} className="border border-gray-200 rounded-xl p-3 hover:border-green-300 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar profile={friend} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-semibold text-gray-800 truncate">{friend?.rider_name || 'Unknown rider'}</p>
                              {friendRank && (
                                <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5 font-medium flex-shrink-0">#{friendRank}</span>
                              )}
                              {friendGames > 0 && (
                                <span className="text-xs bg-green-50 text-green-700 rounded-full px-1.5 py-0.5 font-medium flex-shrink-0">{friendGames}/13</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 truncate">{friend?.province || 'No province'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => setActiveChatFriend({ id: friendId, profile: friend })}
                            className="relative text-xs text-green-700 hover:text-green-800 font-semibold flex items-center gap-1"
                          >
                            <MessageCircle size={13} />
                            Chat
                            {unreadCounts[friendId] > 0 && (
                              <span className="absolute -top-1 -right-1.5 min-w-[14px] h-3.5 bg-red-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full px-0.5">
                                {unreadCounts[friendId]}
                              </span>
                            )}
                          </button>
                          <button
                            onClick={() => handleRemoveFriend(row.id)}
                            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                        {REACTION_OPTIONS.map(reaction => (
                          <button
                            key={reaction}
                            onClick={() => handleReaction(friendId, reaction)}
                            className="text-lg px-2 py-1 rounded-lg bg-gray-50 hover:bg-gray-100 hover:ring-1 hover:ring-gray-300 active:ring-2 active:ring-green-400 transition-all"
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

          {/* Requests */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Hourglass size={16} className="text-yellow-500" />
              Requests
            </h3>
            <div className="space-y-2">
              {collections.incoming.map(row => {
                const friend = profilesMap[getOtherUserId(row, profile.id)]
                return (
                  <div key={row.id} className="border border-yellow-200 bg-yellow-50 rounded-lg p-2.5">
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar profile={friend} />
                      <p className="text-sm font-medium text-gray-800">{friend?.rider_name || 'Rider'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRequestAction(row.id, 'accepted')}
                        className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleRequestAction(row.id, 'rejected')}
                        className="text-xs px-3 py-1.5 rounded-lg bg-gray-200 text-gray-700 font-medium hover:bg-gray-300"
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
                  <div key={row.id} className="border border-gray-200 rounded-lg p-2.5 flex items-center gap-2">
                    <Avatar profile={friend} />
                    <p className="text-sm text-gray-500">Sent to <span className="font-medium text-gray-700">{friend?.rider_name || 'Rider'}</span></p>
                  </div>
                )
              })}
              {collections.incoming.length === 0 && collections.outgoing.length === 0 && (
                <p className="text-sm text-gray-400">No active requests.</p>
              )}
            </div>
          </div>

          {/* Achievements */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Sparkles size={16} className="text-purple-500" />
              Achievements
            </h3>
            <div className="space-y-2">
              {achievements.map(item => (
                <div key={item.id} className={`rounded-lg border p-2.5 ${item.unlocked ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                  <p className="text-sm font-medium text-gray-800 flex items-center gap-2">
                    {item.unlocked ? <Trophy size={14} className="text-green-600" /> : <Flame size={14} className="text-gray-400" />}
                    {item.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recent reactions */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
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
                    <div key={item.id} className="text-xs border border-gray-100 rounded-lg px-2.5 py-2 flex items-center justify-between gap-2 bg-gray-50">
                      <span className="text-gray-600 truncate">
                        {isSent ? <span className="text-green-700 font-medium">You</span> : <span className="font-medium">{other?.rider_name || 'Rider'}</span>}
                        <span className="text-gray-400"> {isSent ? '→' : '→ you'}</span>
                        {isSent && <span className="font-medium text-gray-700"> {other?.rider_name || 'Rider'}</span>}
                      </span>
                      <span className="text-base flex-shrink-0">{item.reaction}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {activeChatFriend && (
        <ChatPanel
          myProfile={profile}
          friendProfile={activeChatFriend.profile}
          onClose={() => {
            setActiveChatFriend(null)
            loadChatMeta()
          }}
        />
      )}
    </div>
  )
}
