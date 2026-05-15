import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Search, Calendar } from 'lucide-react'
import { Button, Card, CardContent, EmptyState, Input, PageHeader, Skeleton } from '../../components/ui'

function startOfTodayISO() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

function reminderLabel(reminder) {
  const byType = {
    flu_vaccination: 'Flu Vaccination (Equine Influenza)',
    ahs_vaccination: 'AHS Vaccination (African Horse Sickness)',
    farrier: 'Farrier (Trimming / Shoeing)',
    deworming: 'Deworming',
    dental: 'Dental (Teeth floating)',
    coggins_test: 'Coggins Test (EIA)',
    passport_renewal: 'Passport Renewal',
    custom: 'Custom',
  }
  if (reminder.reminder_type && reminder.reminder_type !== 'custom') {
    return byType[reminder.reminder_type] || reminder.label || 'Reminder'
  }

  const normalizedLabel = String(reminder.label || reminder.custom_label || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

  const inferred = Object.entries(byType).find(([, header]) => (
    header.trim().toLowerCase() === normalizedLabel
  ))
  return (inferred?.[1]) || byType[reminder.reminder_type] || reminder.label || 'Reminder'
}

function isMissingNextDueDateError(error) {
  const msg = String(error?.message || error?.details || '').toLowerCase()
  return (
    msg.includes('next_due_date') ||
    msg.includes('schema cache') ||
    (msg.includes('column') && (msg.includes('not found') || msg.includes('does not exist')))
  )
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

  const effectiveUserId = profile?.id

  useEffect(() => {
    if (!profile?.id) return
    fetchData(profile.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  async function fetchData(userId) {
    setLoading(true)
    try {
      const today = startOfTodayISO()
      const horsesPromise = supabase
        .from('horses')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true })

      const remindersByNextDuePromise = supabase
        .from('horse_reminders')
        .select('*')
        .eq('user_id', userId)
        .eq('is_done', false)
        .gte('next_due_date', today)
        .order('next_due_date', { ascending: true })

      const [horsesRes, remindersByNextDueRes] = await Promise.all([
        horsesPromise,
        remindersByNextDuePromise
      ])

      let remindersRes = remindersByNextDueRes
      if (remindersByNextDueRes.error && isMissingNextDueDateError(remindersByNextDueRes.error)) {
        const fallback = await supabase
          .from('horse_reminders')
          .select('*')
          .eq('user_id', userId)
          .eq('is_done', false)
          .gte('due_date', today)
          .order('due_date', { ascending: true })
        remindersRes = fallback
      }

      const normalizedReminders = (remindersRes.data || []).map(r => ({
        ...r,
        next_due_date: r.next_due_date || r.due_date || null
      }))

      if (horsesRes.error) throw horsesRes.error
      if (remindersRes.error) throw remindersRes.error

      setHorses(horsesRes.data || [])
      setReminders(normalizedReminders)
    } catch (e) {
      console.error(e)
      toast.error('Error loading horses')
    } finally {
      setLoading(false)
    }
  }

  const nextReminderByHorseId = useMemo(() => {
    const map = new Map()
    for (const r of reminders) {
      if (!map.has(r.horse_id)) map.set(r.horse_id, r)
    }
    return map
  }, [reminders])

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
    if (!name) {
      toast.error('Please enter a horse name')
      return
    }
    setCreating(true)
    try {
      const { error } = await supabase
        .from('horses')
        .insert({
          user_id: effectiveUserId,
          name
        })
      if (error) throw error

      toast.success('Horse added')
      setShowAddModal(false)
      setNewHorseName('')
      await fetchData(effectiveUserId)
    } catch (e) {
      console.error(e)
      toast.error('Error adding horse')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Horses"
        description={
          isClubHead
            ? 'Your family stable — horses shared across club or family members'
            : 'Manage your horse profiles, medical logs, and reminders'
        }
        actions={
          <Button data-tour="horses-add" onClick={() => setShowAddModal(true)}>
            <Plus size={16} />
            Add horse
          </Button>
        }
      />

      {isClubHead && (
        <p className="text-sm text-gray-500 -mt-2">
          Link horses to members on{' '}
          <a href="/my-club-riders" className="text-green-700 font-medium hover:underline">My Riders</a>
          {' '}when you add a horse/rider combo.
        </p>
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search horses…"
            className="pl-9"
          />
        </div>
      </div>

      {horses.length === 0 ? (
        <EmptyState
          title="No horses yet"
          description={
            isClubHead
              ? 'Add horses to your family stable, then link them to members on My Riders.'
              : 'Add your first horse to start tracking health and reminders.'
          }
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
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          No horses match “{query.trim()}”.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(horse => {
            const next = nextReminderByHorseId.get(horse.id)
            return (
              <Link key={horse.id} to={`/horses/${horse.id}`}>
                <Card className="hover:border-green-300 hover:shadow transition">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-green-50 border border-green-100 overflow-hidden flex items-center justify-center">
                        {horse.photo_url ? (
                          <img
                            src={horse.photo_url}
                            alt={horse.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span className="text-green-800 font-bold">
                            {horse.name?.charAt(0)?.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{horse.name}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {[horse.breed, horse.color].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                      <Calendar size={14} className="text-gray-400" />
                      {next ? (
                        <span className="truncate">
                          Next reminder: <span className="font-medium text-gray-800">{reminderLabel(next)}</span> ·{' '}
                          {new Date(next.next_due_date || next.due_date).toLocaleDateString('en-ZA', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      ) : (
                        <span className="text-gray-400">No upcoming reminders</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 sm:p-6">
            <h3 className="text-lg font-bold text-gray-900">Add horse</h3>
            <p className="text-sm text-gray-600 mt-1">You can fill in full details after creating.</p>

            <div className="mt-4 space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Horse name <span className="text-red-500">*</span>
              </label>
              <Input
                value={newHorseName}
                onChange={e => setNewHorseName(e.target.value)}
                placeholder="e.g. Thunder"
                autoFocus
              />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowAddModal(false)
                  setNewHorseName('')
                }}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateHorse} disabled={creating}>
                {creating ? 'Adding…' : 'Add'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
