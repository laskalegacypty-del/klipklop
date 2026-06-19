import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Search, Bell, ChevronRight, X } from 'lucide-react'
import { Button, EmptyState, Input, PageHeader, Skeleton } from '../../components/ui'

// Deterministic colour accent per horse name
const HORSE_PALETTES = [
  { bg: 'from-green-400 to-green-600',   ring: 'ring-green-300',  badge: 'bg-green-100 text-green-800' },
  { bg: 'from-blue-400 to-blue-600',     ring: 'ring-blue-300',   badge: 'bg-blue-100 text-blue-800' },
  { bg: 'from-purple-400 to-purple-600', ring: 'ring-purple-300', badge: 'bg-purple-100 text-purple-800' },
  { bg: 'from-amber-400 to-amber-600',   ring: 'ring-amber-300',  badge: 'bg-amber-100 text-amber-800' },
  { bg: 'from-rose-400 to-rose-600',     ring: 'ring-rose-300',   badge: 'bg-rose-100 text-rose-800' },
  { bg: 'from-teal-400 to-teal-600',     ring: 'ring-teal-300',   badge: 'bg-teal-100 text-teal-800' },
  { bg: 'from-orange-400 to-orange-600', ring: 'ring-orange-300', badge: 'bg-orange-100 text-orange-800' },
  { bg: 'from-indigo-400 to-indigo-600', ring: 'ring-indigo-300', badge: 'bg-indigo-100 text-indigo-800' },
]

function horseColour(name = '') {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return HORSE_PALETTES[Math.abs(hash) % HORSE_PALETTES.length]
}

function startOfTodayISO() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

function daysDiff(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr); due.setHours(0, 0, 0, 0)
  return Math.round((due - today) / (1000 * 60 * 60 * 24))
}

function reminderLabel(reminder) {
  const byType = {
    flu_vaccination: 'Flu Vaccination',
    ahs_vaccination: 'AHS Vaccination',
    farrier: 'Farrier',
    deworming: 'Deworming',
    dental: 'Dental',
    coggins_test: 'Coggins Test',
    passport_renewal: 'Passport Renewal',
    custom: 'Custom',
  }
  if (reminder.reminder_type && reminder.reminder_type !== 'custom')
    return byType[reminder.reminder_type] || reminder.label || 'Reminder'
  const norm = String(reminder.label || reminder.custom_label || '').trim().toLowerCase().replace(/\s+/g, ' ')
  const found = Object.entries(byType).find(([, h]) => h.trim().toLowerCase() === norm)
  return found?.[1] || reminder.label || 'Reminder'
}

function reminderUrgency(dateStr) {
  const d = daysDiff(dateStr)
  if (d < 0)  return { label: `Overdue ${Math.abs(d)}d`, cls: 'bg-red-100 text-red-700 border-red-200' }
  if (d === 0) return { label: 'Due today',              cls: 'bg-red-100 text-red-700 border-red-200' }
  if (d <= 7)  return { label: `Due in ${d}d`,           cls: 'bg-amber-100 text-amber-700 border-amber-200' }
  if (d <= 30) return { label: `Due in ${d}d`,           cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' }
  return { label: new Date(dateStr).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }), cls: 'bg-gray-100 text-gray-600 border-gray-200' }
}

function isMissingNextDueDateError(error) {
  const msg = String(error?.message || error?.details || '').toLowerCase()
  return msg.includes('next_due_date') || msg.includes('schema cache') ||
    (msg.includes('column') && (msg.includes('not found') || msg.includes('does not exist')))
}

export default function Horses() {
  const { profile, isClubHead } = useAuth()
  const [loading, setLoading] = useState(true)
  const [horses, setHorses] = useState([])
  const [reminders, setReminders] = useState([])
  const [query, setQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newHorseName, setNewHorseName] = useState('')

  useEffect(() => {
    if (!profile?.id) return
    fetchData(profile.id)
  }, [profile?.id])

  async function fetchData(userId) {
    setLoading(true)
    try {
      const today = startOfTodayISO()
      const [horsesRes, remByNextDue] = await Promise.all([
        supabase.from('horses').select('*').eq('user_id', userId).order('name', { ascending: true }),
        supabase.from('horse_reminders').select('*').eq('user_id', userId).eq('is_done', false)
          .gte('next_due_date', today).order('next_due_date', { ascending: true }),
      ])

      let remindersRes = remByNextDue
      if (remByNextDue.error && isMissingNextDueDateError(remByNextDue.error)) {
        const fallback = await supabase.from('horse_reminders').select('*').eq('user_id', userId)
          .eq('is_done', false).gte('due_date', today).order('due_date', { ascending: true })
        remindersRes = fallback
      }

      if (horsesRes.error) throw horsesRes.error

      setHorses(horsesRes.data || [])
      setReminders((remindersRes.data || []).map(r => ({ ...r, next_due_date: r.next_due_date || r.due_date || null })))
    } catch (e) {
      console.error(e)
      toast.error('Error loading horses')
    } finally {
      setLoading(false)
    }
  }

  const nextReminderByHorseId = useMemo(() => {
    const map = new Map()
    for (const r of reminders) if (!map.has(r.horse_id)) map.set(r.horse_id, r)
    return map
  }, [reminders])

  const urgentCount = useMemo(() => reminders.filter(r => {
    const d = daysDiff(r.next_due_date || r.due_date)
    return d <= 7
  }).length, [reminders])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return horses
    return horses.filter(h =>
      (h.name || '').toLowerCase().includes(q) ||
      (h.breed || '').toLowerCase().includes(q) ||
      (h.color || '').toLowerCase().includes(q)
    )
  }, [horses, query])

  async function handleCreateHorse() {
    const name = newHorseName.trim()
    if (!name) { toast.error('Please enter a horse name'); return }
    setCreating(true)
    try {
      const { error } = await supabase.from('horses').insert({ user_id: profile.id, name })
      if (error) throw error
      toast.success('Horse added')
      setShowAddModal(false)
      setNewHorseName('')
      await fetchData(profile.id)
    } catch (e) {
      console.error(e)
      toast.error('Error adding horse')
    } finally {
      setCreating(false)
    }
  }

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-16 w-full" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Skeleton className="h-48" /><Skeleton className="h-48" /><Skeleton className="h-48" />
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="My Horses"
        description={isClubHead ? 'Your family stable' : 'Manage profiles, health logs and reminders'}
        actions={
          <Button data-tour="horses-add" onClick={() => setShowAddModal(true)}>
            <Plus size={16} />
            Add horse
          </Button>
        }
      />

      {isClubHead && (
        <p className="text-sm text-gray-500 -mt-1">
          Link horses to members on{' '}
          <a href="/my-club-riders" className="text-green-700 font-medium hover:underline">My Riders</a>.
        </p>
      )}

      {/* Stats strip */}
      {horses.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">🐴</span>
            <div>
              <p className="text-xl font-black text-gray-800">{horses.length}</p>
              <p className="text-xs text-gray-500">Horse{horses.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
            urgentCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'
          }`}>
            <Bell size={20} className={urgentCount > 0 ? 'text-amber-500' : 'text-gray-400'} />
            <div>
              <p className={`text-xl font-black ${urgentCount > 0 ? 'text-amber-700' : 'text-gray-800'}`}>{urgentCount}</p>
              <p className="text-xs text-gray-500">Urgent reminder{urgentCount !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 items-center gap-3 hidden sm:flex">
            <span className="text-2xl">📋</span>
            <div>
              <p className="text-xl font-black text-gray-800">{reminders.length}</p>
              <p className="text-xs text-gray-500">Upcoming reminders</p>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      {horses.length > 0 && (
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, breed or colour…"
            className="pl-9 pr-9"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {horses.length === 0 ? (
        <EmptyState
          title="No horses yet"
          description={isClubHead
            ? 'Add horses to your stable, then link them to members on My Riders.'
            : 'Add your first horse to start tracking health and reminders.'}
          action={
            <button
              data-tour="horses-add"
              onClick={() => setShowAddModal(true)}
              className="text-sm font-semibold text-green-800 hover:underline"
            >
              Add a horse →
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-400">
          No horses match "{query.trim()}".
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(horse => {
            const next = nextReminderByHorseId.get(horse.id)
            const palette = horseColour(horse.name)
            const urgency = next ? reminderUrgency(next.next_due_date || next.due_date) : null
            const ageParts = []
            if (horse.breed) ageParts.push(horse.breed)
            if (horse.color) ageParts.push(horse.color)
            if (horse.sex && horse.sex !== 'unknown') ageParts.push(horse.sex.charAt(0).toUpperCase() + horse.sex.slice(1))

            return (
              <Link key={horse.id} to={`/horses/${horse.id}`} className="group block">
                <div className="bg-white rounded-2xl border border-gray-200 hover:border-green-300 hover:shadow-md transition-all duration-200 flex overflow-hidden">

                  {/* Square avatar — fixed 80×full, object-cover so any photo looks clean */}
                  <div className={`w-20 flex-shrink-0 relative bg-gradient-to-br ${palette.bg} flex items-center justify-center overflow-hidden`}>
                    {horse.photo_url ? (
                      <img
                        src={horse.photo_url}
                        alt={horse.name}
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <>
                        <span className="text-3xl font-black text-white z-10">
                          {horse.name?.charAt(0)?.toUpperCase()}
                        </span>
                        <span className="absolute -bottom-2 -right-1 text-6xl font-black text-white/15 select-none leading-none">
                          {horse.name?.charAt(0)?.toUpperCase()}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Card body */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 text-base truncate group-hover:text-green-700 transition-colors">
                          {horse.name}
                        </p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {ageParts.join(' · ') || 'No details yet'}
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-gray-300 group-hover:text-green-500 flex-shrink-0 mt-0.5 transition-colors" />
                    </div>

                    {/* Next reminder */}
                    <div className="mt-3">
                      {next ? (
                        <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${urgency?.cls}`}>
                          <Bell size={11} />
                          {reminderLabel(next)} · {urgency?.label}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">No upcoming reminders</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Add horse modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Add horse</h3>
                <p className="text-sm text-gray-500 mt-0.5">You can fill in full details after creating.</p>
              </div>
              <button
                onClick={() => { setShowAddModal(false); setNewHorseName('') }}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Horse name <span className="text-red-500">*</span>
              </label>
              <Input
                value={newHorseName}
                onChange={e => setNewHorseName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateHorse()}
                placeholder="e.g. Thunder"
                autoFocus
              />
              {/* Live colour preview */}
              {newHorseName.trim() && (
                <div className="flex items-center gap-3 mt-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${horseColour(newHorseName).bg} flex items-center justify-center`}>
                    <span className="text-white font-black text-lg">{newHorseName.trim().charAt(0).toUpperCase()}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-700">{newHorseName.trim()}</p>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => { setShowAddModal(false); setNewHorseName('') }}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateHorse} disabled={creating}>
                {creating ? 'Adding…' : 'Add horse'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
